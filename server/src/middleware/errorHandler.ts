import { Request, Response, NextFunction } from 'express';

interface HttpBodyParserError extends Error {
  type?: string;
  status?: number;
}

interface SqliteError extends Error {
  code?: string;
}

// Registered last in server.ts. Express 5 auto-forwards synchronous throws
// here, so route handlers don't need try/catch for unexpected errors — only
// the explicit, anticipated validation (400s) needs to be handled inline.
// This is the safety net for everything else: known failure modes we didn't
// (or can't) guard against explicitly, mapped to specific messages where the
// cause is identifiable, and a generic 500 for truly unexpected errors.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires all 4 params to recognize this as error-handling middleware
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const bodyParserError = err as HttpBodyParserError;
  if (bodyParserError.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }

  const sqliteError = err as SqliteError;
  switch (sqliteError.code) {
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      res.status(400).json({ error: 'This action references a record that no longer exists' });
      return;
    case 'SQLITE_CONSTRAINT_NOTNULL':
      res.status(400).json({ error: 'A required field is missing' });
      return;
    case 'SQLITE_CONSTRAINT_UNIQUE':
      res.status(400).json({ error: 'A record with that value already exists' });
      return;
    case 'SQLITE_CONSTRAINT':
      res.status(400).json({ error: 'This action conflicts with related data and cannot be completed' });
      return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
