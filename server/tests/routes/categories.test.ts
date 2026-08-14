import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../../src/db';
import { categoriesRouter } from '../../src/routes/categories';
import { transactionsRouter } from '../../src/routes/transactions';
import { recurringTransactionsRouter } from '../../src/routes/recurringTransactions';
import { errorHandler, generateDueMiddleware } from '../../src/middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', generateDueMiddleware, transactionsRouter);
  app.use('/api/recurring-transactions', generateDueMiddleware, recurringTransactionsRouter);
  app.use(errorHandler);
  return app;
}

function resetDb() {
  db.exec('DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories;');
}

describe('category delete guard', () => {
  beforeEach(() => resetDb());

  it('blocks deletion when a real transaction references the category', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Food', budgeted_amount: 50 });
    await request(app).post('/api/transactions').send({ amount: 10, date: '2026-01-01', category_id: cat.body.id });

    const res = await request(app).delete(`/api/categories/${cat.body.id}`);
    expect(res.status).toBe(400);
  });

  it('blocks deletion when an active recurring template references the category', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Rent', budgeted_amount: 1000 });
    await request(app)
      .post('/api/recurring-transactions')
      .send({ amount: 1000, category_id: cat.body.id, interval: 'monthly', start_date: '2026-01-01' });

    const res = await request(app).delete(`/api/categories/${cat.body.id}`);
    expect(res.status).toBe(400);
  });

  it('blocks deletion when a cancelled recurring template still references the category', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Software', budgeted_amount: 200 });
    const recurring = await request(app)
      .post('/api/recurring-transactions')
      .send({ amount: 200, category_id: cat.body.id, interval: 'monthly', start_date: '2026-01-01' });
    await request(app).delete(`/api/recurring-transactions/${recurring.body.id}`);

    const res = await request(app).delete(`/api/categories/${cat.body.id}`);
    expect(res.status).toBe(400);
  });

  it('allows deletion of an unreferenced category', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Unused', budgeted_amount: 5 });
    const res = await request(app).delete(`/api/categories/${cat.body.id}`);
    expect(res.status).toBe(204);
  });

  it('PUT omitting start_on preserves the existing value', async () => {
    const app = buildApp();
    const cat = await request(app)
      .post('/api/categories')
      .send({ name: 'Marketing', budgeted_amount: 300, start_on: '2025-06-01' });

    const res = await request(app).put(`/api/categories/${cat.body.id}`).send({ budgeted_amount: 400 });
    expect(res.body.start_on).toBe('2025-06-01');
    expect(res.body.budgeted_amount).toBe(400);
  });
});
