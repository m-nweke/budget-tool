import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import { hashPassword } from '../utils/password';

beforeEach(() => {
  db.exec('DELETE FROM department_access; DELETE FROM users;');
});

async function seedUser() {
  return userRepository.create({
    name: 'Dana Head',
    email: 'dana@example.com',
    role: 'department_head',
    department_id: null,
    password_hash: await hashPassword('correct-horse'),
  });
}

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and sets an httpOnly cookie', async () => {
    await seedUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dana@example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user: { email: 'dana@example.com', name: 'Dana Head' } });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/auth_token=.*HttpOnly/);
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
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/auth_token=;/);
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
