import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../db';
import { categoriesRouter } from './categories';
import { transactionsRouter } from './transactions';
import { dashboardRouter } from './dashboard';
import { errorHandler, generateDueMiddleware } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', generateDueMiddleware, transactionsRouter);
  app.use('/api/dashboard', generateDueMiddleware, dashboardRouter);
  app.use(errorHandler);
  return app;
}

function resetDb() {
  db.exec('DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories;');
}

describe('GET /api/dashboard', () => {
  beforeEach(() => resetDb());

  it('scopes to a single month by default budget and spend', async () => {
    const app = buildApp();
    const cat = await request(app)
      .post('/api/categories')
      .send({ name: 'Travel', budgeted_amount: 100, start_on: '2026-01-01' });
    await request(app)
      .post('/api/transactions')
      .send({ amount: 40, date: '2026-03-15', category_id: cat.body.id });

    const res = await request(app).get('/api/dashboard?from=2026-03&to=2026-03');
    expect(res.status).toBe(200);
    expect(res.body.categories[0].budgeted_amount).toBe(100);
    expect(res.body.categories[0].spent_amount).toBe(40);
  });

  it('scales budgeted_amount by month count across a multi-month range', async () => {
    const app = buildApp();
    const cat = await request(app)
      .post('/api/categories')
      .send({ name: 'Travel', budgeted_amount: 100, start_on: '2026-01-01' });

    const res = await request(app).get('/api/dashboard?from=2026-01&to=2026-03');
    expect(res.status).toBe(200);
    expect(res.body.categories[0].budgeted_amount).toBe(300);
  });

  it('excludes a category whose start_on is after the requested range', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/categories')
      .send({ name: 'Future Cat', budgeted_amount: 100, start_on: '2026-06-01' });

    const res = await request(app).get('/api/dashboard?from=2026-01&to=2026-03');
    expect(res.body.categories).toHaveLength(0);
  });

  it('scales a category whose start_on falls mid-range to only the active months', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/categories')
      .send({ name: 'Mid Start', budgeted_amount: 100, start_on: '2026-02-01' });

    const res = await request(app).get('/api/dashboard?from=2026-01&to=2026-03');
    // active for Feb + Mar only = 2 months
    expect(res.body.categories[0].budgeted_amount).toBe(200);
  });

  it('rejects an invalid month component', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/dashboard?from=2026-13&to=2026-13');
    expect(res.status).toBe(400);
  });

  it('rejects an inverted range', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/dashboard?from=2026-05&to=2026-01');
    expect(res.status).toBe(400);
  });
});
