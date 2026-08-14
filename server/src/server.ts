import path from 'path';
import express, { Request, Response, NextFunction } from 'express';

import categoriesRouter from './routes/categories';
import transactionsRouter from './routes/transactions';
import dashboardRouter from './routes/dashboard';
import recurringTransactionsRouter from './routes/recurringTransactions';
import recurringTransactionRepository from './repositories/recurringTransactionRepository';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Materialize any due recurring transactions before serving reads. There's
// no background job runner in this deployment, so generation happens lazily
// on request instead of on a schedule (see decisions.md #18).
//
// Scoped to only the routers whose data can actually be affected by newly
// materialized transactions — running this full-table scan/transaction on
// every request (static assets, categories CRUD, 404s, ...) was pure waste.
function materializeDueTransactions(req: Request, res: Response, next: NextFunction): void {
  recurringTransactionRepository.generateDue();
  next();
}

app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', materializeDueTransactions, transactionsRouter);
app.use('/api/dashboard', materializeDueTransactions, dashboardRouter);
app.use('/api/recurring-transactions', materializeDueTransactions, recurringTransactionsRouter);

// Any /api/* path that didn't match a router above is a real 404, not a
// SPA route — return JSON instead of falling through to index.html.
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use((req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
