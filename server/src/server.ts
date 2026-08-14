import path from 'path';
import express, { Request, Response } from 'express';

import categoriesRouter from './routes/categories';
import transactionsRouter from './routes/transactions';
import dashboardRouter from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/dashboard', dashboardRouter);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use((req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
