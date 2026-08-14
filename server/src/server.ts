import path from 'path';
import express, { Request, Response, NextFunction } from 'express';

import categoriesRouter from './routes/categories';
import transactionsRouter from './routes/transactions';
import dashboardRouter from './routes/dashboard';
import recurringTransactionsRouter from './routes/recurringTransactions';
import recurringTransactionRepository from './repositories/recurringTransactionRepository';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Materialize any due recurring transactions before serving reads. There's
// no background job runner in this deployment, so generation happens lazily
// on request instead of on a schedule (see decisions.md #18).
app.use((req: Request, res: Response, next: NextFunction) => {
  recurringTransactionRepository.generateDue();
  next();
});

app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/recurring-transactions', recurringTransactionsRouter);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use((req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
