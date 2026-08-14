import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

// Smoke tests for the app.ts/server.ts split: confirms the exported app
// still serves existing routes and behaviors correctly via supertest,
// without needing a real listening socket.
describe('app', () => {
  it('serves existing API routes', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns JSON 404 for an unmatched /api path', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
