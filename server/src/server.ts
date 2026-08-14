import express from 'express';
import path from 'path';
import { categoriesRouter } from './routes/categories';
import { transactionsRouter } from './routes/transactions';
import { recurringTransactionsRouter } from './routes/recurringTransactions';
import { dashboardRouter } from './routes/dashboard';
import { errorHandler, generateDueMiddleware } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', generateDueMiddleware, transactionsRouter);
app.use('/api/recurring-transactions', generateDueMiddleware, recurringTransactionsRouter);
app.use('/api/dashboard', generateDueMiddleware, dashboardRouter);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
