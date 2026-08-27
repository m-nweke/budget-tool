import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import { hashPassword } from '../utils/password';

beforeEach(() => {
  db.exec(
    'DELETE FROM department_access; DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM departments; DELETE FROM tenants;'
  );
});

async function seedUser() {
  const tenant = tenantRepository.create('Acme Co', 'enterprise');
  const user = userRepository.create({
    name: 'Dana Head',
    email: 'dana@example.com',
    password_hash: await hashPassword('correct-horse'),
  });
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: tenant.id,
    role: 'department_head',
    department_id: null,
  });
  return { user, tenant };
}

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and sets an httpOnly cookie', async () => {
    await seedUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dana@example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { email: 'dana@example.com', name: 'Dana Head', role: 'department_head' } });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/auth_token=.*HttpOnly/);
  });

  it('sets a non-httpOnly tenant_type cookie matching the tenant, for the index.html paint hint', async () => {
    await seedUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dana@example.com', password: 'correct-horse' });

    const tenantTypeCookie = res.headers['set-cookie'].find((c: string) => c.startsWith('tenant_type='));
    expect(tenantTypeCookie).toMatch(/^tenant_type=enterprise/);
    expect(tenantTypeCookie).not.toMatch(/HttpOnly/);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('rejects a wrong password', async () => {
    await seedUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dana@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('requires email and password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'dana@example.com' });
    expect(res.status).toBe(400);
  });

  it('a login with more than one membership returns a picker instead of a session', async () => {
    const { user } = await seedUser();
    const secondTenant = tenantRepository.create("Pat's Budget", 'personal');
    tenantMembershipRepository.create({
      user_id: user.id,
      tenant_id: secondTenant.id,
      role: 'owner',
      department_id: null,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dana@example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    expect(res.body.memberships).toHaveLength(2);
    expect(res.body.user).toBeUndefined();
    // A pre-tenant token is still set — it can't authenticate a real route,
    // but it's needed to identify the user for the following select-tenant
    // call without re-entering a password.
    expect(res.headers['set-cookie'][0]).toMatch(/auth_token=.*HttpOnly/);
  });
});

describe('rate limiting', () => {
  // The rate limiter skips itself under NODE_ENV=test (see routes/auth.ts)
  // so the rest of this file's login/register calls aren't throttled by
  // their own test suite — toggle it off just for this test, restoring it
  // in a finally so no other test in this file is affected.
  it('returns 429 after exceeding the login attempt limit outside test mode', async () => {
    await seedUser();
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      let lastStatus = 0;
      for (let i = 0; i < 11; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'dana@example.com', password: 'wrong-password' });
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe('POST /api/auth/select-tenant', () => {
  it('switches an authenticated multi-membership session to the chosen tenant', async () => {
    const { user, tenant } = await seedUser();
    const secondTenant = tenantRepository.create("Pat's Budget", 'personal');
    tenantMembershipRepository.create({
      user_id: user.id,
      tenant_id: secondTenant.id,
      role: 'owner',
      department_id: null,
    });

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'dana@example.com', password: 'correct-horse' });

    const res = await agent.post('/api/auth/select-tenant').send({ tenant_id: secondTenant.id });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ tenant_id: secondTenant.id, tenant_type: 'personal', role: 'owner' });

    // The new session is actually usable for a real tenant-scoped route.
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.tenant_id).toBe(secondTenant.id);
    void tenant;

    // The paint-hint cookie follows the switch — the first login above set
    // it to 'enterprise', this switch to a personal tenant must overwrite
    // it, not leave the stale enterprise value in place.
    const tenantTypeCookie = res.headers['set-cookie'].find((c: string) => c.startsWith('tenant_type='));
    expect(tenantTypeCookie).toMatch(/^tenant_type=personal/);
  });

  it('rejects selecting a tenant the user has no membership in', async () => {
    await seedUser();
    const otherTenant = tenantRepository.create('Other Co', 'enterprise');
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'dana@example.com', password: 'correct-horse' });

    const res = await agent.post('/api/auth/select-tenant').send({ tenant_id: otherTenant.id });
    expect(res.status).toBe(403);
  });

  it('requires an authenticated identity', async () => {
    const tenant = tenantRepository.create('Acme Co', 'enterprise');
    const res = await request(app).post('/api/auth/select-tenant').send({ tenant_id: tenant.id });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/register', () => {
  it('personal account type creates a new personal tenant and an owner membership', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Pat Personal', email: 'pat@example.com', password: 'password123', accountType: 'personal' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ tenant_type: 'personal', role: 'owner' });
    expect(res.headers['set-cookie'][0]).toMatch(/auth_token=.*HttpOnly/);
  });

  it('company account type creates a new enterprise tenant with a join code and a head membership', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dana Head', email: 'dana2@example.com', password: 'password123', accountType: 'company' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ tenant_type: 'enterprise', role: 'department_head' });
  });

  it('join account type requires a valid join code and creates an unassigned employee membership', async () => {
    const tenant = tenantRepository.create('Acme Co', 'enterprise');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Evan Employee',
      email: 'evan@example.com',
      password: 'password123',
      accountType: 'join',
      joinCode: tenant.join_code,
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ tenant_id: tenant.id, role: 'department_employee', department_id: null });
  });

  it('rejects an invalid join code', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Evan Employee',
      email: 'evan@example.com',
      password: 'password123',
      accountType: 'join',
      joinCode: 'NOT-A-REAL-CODE',
    });
    expect(res.status).toBe(404);
  });

  it('registering with an existing email requires the matching password (the multi-tenant join case)', async () => {
    await seedUser();
    const tenant = tenantRepository.create('Other Co', 'enterprise');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dana Head',
      email: 'dana@example.com',
      password: 'wrong-password',
      accountType: 'join',
      joinCode: tenant.join_code,
    });
    expect(res.status).toBe(401);
  });

  it('an existing email with the correct password gets a new membership on the same account', async () => {
    await seedUser();
    const tenant = tenantRepository.create('Other Co', 'enterprise');
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dana Head',
      email: 'dana@example.com',
      password: 'correct-horse',
      accountType: 'join',
      joinCode: tenant.join_code,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.tenant_id).toBe(tenant.id);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/auth_token=;/);
  });

  it('clears the tenant_type cookie too, so a shared machine loses the paint hint on sign-out', async () => {
    const res = await request(app).post('/api/auth/logout');
    const tenantTypeCookie = res.headers['set-cookie'].find((c: string) => c.startsWith('tenant_type='));
    expect(tenantTypeCookie).toMatch(/^tenant_type=;/);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 with no cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user when authenticated', async () => {
    await seedUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'dana@example.com', password: 'correct-horse' });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { email: 'dana@example.com' } });
  });

  it('returns 401 for a tampered cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', ['auth_token=garbage']);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/memberships', () => {
  it('returns 401 with no cookie', async () => {
    const res = await request(app).get('/api/auth/memberships');
    expect(res.status).toBe(401);
  });

  it('lists every membership for the authenticated user, including the currently active one', async () => {
    const { user } = await seedUser();
    // Logs in while there's still only one membership (a direct session,
    // not the picker flow), then a second membership appears afterward —
    // the real-world "already logged into tenant A, later joins tenant B
    // elsewhere" case this endpoint exists for.
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'dana@example.com', password: 'correct-horse' });

    const secondTenant = tenantRepository.create("Pat's Budget", 'personal');
    tenantMembershipRepository.create({
      user_id: user.id,
      tenant_id: secondTenant.id,
      role: 'owner',
      department_id: null,
    });

    const res = await agent.get('/api/auth/memberships');
    expect(res.status).toBe(200);
    expect(res.body.memberships).toHaveLength(2);
    expect(res.body.memberships.map((m: { tenant_type: string }) => m.tenant_type).sort()).toEqual([
      'enterprise',
      'personal',
    ]);
  });
});
