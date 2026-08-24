import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth';
import departmentsRouter from './routes/departments';
import categoriesRouter from './routes/categories';
import transactionsRouter from './routes/transactions';
import dashboardRouter from './routes/dashboard';
import recurringTransactionsRouter from './routes/recurringTransactions';
import approvalsRouter from './routes/approvals';
import teamRouter from './routes/team';
import bankAccountsRouter from './routes/bankAccounts';
import paychecksRouter from './routes/paychecks';
import savingsGoalsRouter from './routes/savingsGoals';
import debtsRouter from './routes/debts';
import billsRouter from './routes/bills';
import cashflowRouter from './routes/cashflow';
import recurringTransactionRepository from './repositories/recurringTransactionRepository';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/authenticate';

// Builds and exports the Express app without binding a port, so tests can
// exercise routes directly via supertest instead of over a real socket.
// server.ts stays a thin entrypoint that imports this and calls listen().
const app = express();

app.use(express.json());
app.use(cookieParser());

// /login and /logout are public by design; /me guards itself inline via
// authenticate. Every other router below now requires a valid session —
// this is the point department scoping actually needs req.user for.
app.use('/api/auth', authRouter);

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

app.use('/api/departments', authenticate, departmentsRouter);
app.use('/api/categories', authenticate, categoriesRouter);
app.use('/api/transactions', authenticate, materializeDueTransactions, transactionsRouter);
app.use('/api/dashboard', authenticate, materializeDueTransactions, dashboardRouter);
app.use(
  '/api/recurring-transactions',
  authenticate,
  materializeDueTransactions,
  recurringTransactionsRouter
);
app.use('/api/approvals', authenticate, approvalsRouter);
app.use('/api/team', authenticate, teamRouter);
// Personal-budget resources (Phase 2) — no materializeDueTransactions,
// since nothing here interacts with recurring-transaction generation.
app.use('/api/bank-accounts', authenticate, bankAccountsRouter);
app.use('/api/paychecks', authenticate, paychecksRouter);
app.use('/api/savings-goals', authenticate, savingsGoalsRouter);
app.use('/api/debts', authenticate, debtsRouter);
app.use('/api/bills', authenticate, billsRouter);
// Unlike the other Phase 2 routers, cash-flow projects recurring-transaction
// occurrences forward from next_run_date — needs materializeDueTransactions
// first so that value is current, not stale backlog (story 18).
app.use('/api/cash-flow', authenticate, materializeDueTransactions, cashflowRouter);

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

export default app;
