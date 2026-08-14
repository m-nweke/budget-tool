import type { Request, Response, NextFunction } from 'express';
import { generateDue } from '../utils/recurringGenerator';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : '';

  if (message.includes('FOREIGN KEY constraint failed')) {
    res.status(400).json({ error: 'This operation violates a data relationship (e.g. referenced record still in use).' });
    return;
  }
  if (message.includes('UNIQUE constraint failed')) {
    res.status(400).json({ error: 'A record with this value already exists.' });
    return;
  }
  if (message.includes('NOT NULL constraint failed')) {
    res.status(400).json({ error: 'A required field is missing.' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

export function generateDueMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  try {
    generateDue();
    next();
  } catch (err) {
    next(err);
  }
}
