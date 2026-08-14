import express, { Request, Response } from 'express';
import dashboardRepository from '../repositories/dashboardRepository';

const router = express.Router();
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

router.get('/', (req: Request, res: Response) => {
  const month = req.query.month;
  if (month !== undefined && (typeof month !== 'string' || !MONTH_PATTERN.test(month))) {
    return res.status(400).json({ error: 'month must be in YYYY-MM format' });
  }
  res.json(dashboardRepository.findSummary(month));
});

export default router;
