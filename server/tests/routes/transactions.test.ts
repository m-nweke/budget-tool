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

describe('transactions routes', () => {
  beforeEach(() => resetDb());

  it('creates and lists a transaction', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Food', budgeted_amount: 100 });
    const created = await request(app)
      .post('/api/transactions')
      .send({ amount: 12.5, date: '2026-01-05', description: 'Lunch', category_id: cat.body.id });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/transactions');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].description).toBe('Lunch');
  });

  it('rejects a transaction missing required fields', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/transactions').send({ amount: 5 });
    expect(res.status).toBe(400);
  });

  it('updates and deletes a plain transaction', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Food', budgeted_amount: 100 });
    const created = await request(app)
      .post('/api/transactions')
      .send({ amount: 12.5, date: '2026-01-05', category_id: cat.body.id });

    const updated = await request(app).put(`/api/transactions/${created.body.id}`).send({ amount: 20 });
    expect(updated.status).toBe(200);
    expect(updated.body.amount).toBe(20);

    const deleted = await request(app).delete(`/api/transactions/${created.body.id}`);
    expect(deleted.status).toBe(204);
  });

  it('404s updating/deleting a transaction that does not exist', async () => {
    const app = buildApp();
    expect((await request(app).put('/api/transactions/999').send({ amount: 1 })).status).toBe(404);
    expect((await request(app).delete('/api/transactions/999')).status).toBe(404);
  });

  it('blocks editing/deleting a transaction spawned from an active recurring series', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Rent', budgeted_amount: 1000 });
    await request(app)
      .post('/api/recurring-transactions')
      .send({ amount: 1000, category_id: cat.body.id, interval: 'monthly', start_date: '2020-01-01' });

    const txs = await request(app).get('/api/transactions');
    const spawned = txs.body[0];

    expect((await request(app).put(`/api/transactions/${spawned.id}`).send({ amount: 1 })).status).toBe(400);
    expect((await request(app).delete(`/api/transactions/${spawned.id}`)).status).toBe(400);
  });

  it('allows editing a transaction whose recurring series has been cancelled', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Software', budgeted_amount: 100 });
    const recurring = await request(app)
      .post('/api/recurring-transactions')
      .send({ amount: 20, category_id: cat.body.id, interval: 'monthly', start_date: '2020-01-01' });

    await request(app).delete(`/api/recurring-transactions/${recurring.body.id}`);

    const txs = await request(app).get('/api/transactions');
    const spawned = txs.body[0];

    const res = await request(app).put(`/api/transactions/${spawned.id}`).send({ amount: 99 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(99);
  });
});

describe('recurring-transactions routes', () => {
  beforeEach(() => resetDb());

  it('rejects an invalid interval on create', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Misc', budgeted_amount: 50 });
    const res = await request(app)
      .post('/api/recurring-transactions')
      .send({ amount: 10, category_id: cat.body.id, interval: 'yearly', start_date: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  it('404s updating a recurring template that does not exist', async () => {
    const app = buildApp();
    const res = await request(app).put('/api/recurring-transactions/999').send({ amount: 1 });
    expect(res.status).toBe(404);
  });

  it('soft-deletes (cancel) without touching already-generated transactions', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Utilities', budgeted_amount: 100 });
    const recurring = await request(app)
      .post('/api/recurring-transactions')
      .send({ amount: 20, category_id: cat.body.id, interval: 'monthly', start_date: '2020-01-01' });

    const beforeCount = (await request(app).get('/api/transactions')).body.length;
    const del = await request(app).delete(`/api/recurring-transactions/${recurring.body.id}`);
    expect(del.status).toBe(204);

    const afterCount = (await request(app).get('/api/transactions')).body.length;
    expect(afterCount).toBe(beforeCount);

    const fetched = await request(app).get('/api/recurring-transactions');
    expect(fetched.body[0].active).toBe(0);
  });

  it('apply_to_existing rebuilds history under the new interval via the route', async () => {
    const app = buildApp();
    const cat = await request(app).post('/api/categories').send({ name: 'Cleaning', budgeted_amount: 200 });
    const recurring = await request(app)
      .post('/api/recurring-transactions')
      .send({ amount: 25, category_id: cat.body.id, interval: 'weekly', start_date: '2026-01-01' });

    const res = await request(app)
      .put(`/api/recurring-transactions/${recurring.body.id}`)
      .send({ interval: 'monthly', apply_to_existing: true });

    expect(res.status).toBe(200);
    expect(res.body.interval).toBe('monthly');
  });
});
