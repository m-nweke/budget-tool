import { Request, Response, NextFunction } from 'express';

interface HttpBodyParserError extends Error {
  type?: string;
  status?: number;
}

interface DatabaseError extends Error {
  code?: string;
}

// Registered last in server.ts. Express 5 auto-forwards synchronous throws
// here, so route handlers don't need try/catch for unexpected errors — only
// the explicit, anticipated validation (400s) needs to be handled inline.
// This is the safety net for everything else: known failure modes we didn't
// (or can't) guard against explicitly, mapped to specific messages where the
// cause is identifiable, and a generic 500 for truly unexpected errors.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const bodyParserError = err as HttpBodyParserError;
  if (bodyParserError.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }

  const databaseError = err as DatabaseError;
  switch (databaseError.code) {
    case '23503':
      res.status(400).json({ error: 'This action references a record that no longer exists' });
      return;
    case '23502':
      res.status(400).json({ error: 'A required field is missing' });
      return;
    case '23505':
      res.status(400).json({ error: 'A record with that value already exists' });
      return;
    case '23514':
      res.status(400).json({ error: 'This action conflicts with related data and cannot be completed' });
      return;
  }

  console.error('Unhandled request failure');
  res.status(500).json({ error: 'Internal server error' });
}
