import express, { Request, Response } from 'express';
import dashboardRepository from '../repositories/dashboardRepository';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  res.json(dashboardRepository.findSummary());
});

export default router;
