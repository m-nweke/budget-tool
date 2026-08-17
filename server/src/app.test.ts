import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from './app';
import db from './db';
import userRepository from './repositories/userRepository';
import { hashPassword } from './utils/password';

beforeEach(() => {
  db.exec('DELETE FROM department_access; DELETE FROM users;');
});

// Smoke tests for the app.ts/server.ts split: confirms the exported app
// still serves existing routes and behaviors correctly via supertest,
// without needing a real listening socket.
describe('app', () => {
  it('requires authentication for existing API routes', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });

  it('serves existing API routes once authenticated', async () => {
    await userRepository.create({
      name: 'Dana Head',
      email: 'dana@example.com',
      role: 'department_head',
      department_id: null,
      password_hash: await hashPassword('correct-horse'),
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'dana@example.com', password: 'correct-horse' });

    const res = await agent.get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns JSON 404 for an unmatched /api path', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
