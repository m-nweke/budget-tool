import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from './errorHandler';
import type { Request, Response, NextFunction } from 'express';

function mockRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
}

const req = {} as Request;
const next = vi.fn() as NextFunction;

describe('errorHandler', () => {
  it('maps a body-parser JSON error to 400', () => {
    const { res, status, json } = mockRes();
    errorHandler({ type: 'entity.parse.failed' }, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Request body is not valid JSON' });
  });

  it('maps SQLITE_CONSTRAINT_FOREIGNKEY to 400 with a referenced-record message', () => {
    const { res, status, json } = mockRes();
    errorHandler({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'This action references a record that no longer exists' });
  });

  it('maps SQLITE_CONSTRAINT_NOTNULL to 400 with a missing-field message', () => {
    const { res, status, json } = mockRes();
    errorHandler({ code: 'SQLITE_CONSTRAINT_NOTNULL' }, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'A required field is missing' });
  });

  it('maps SQLITE_CONSTRAINT_UNIQUE to 400 with a duplicate-record message', () => {
    const { res, status, json } = mockRes();
    errorHandler({ code: 'SQLITE_CONSTRAINT_UNIQUE' }, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'A record with that value already exists' });
  });

  it('maps a generic SQLITE_CONSTRAINT to 400 with a conflict message', () => {
    const { res, status, json } = mockRes();
    errorHandler({ code: 'SQLITE_CONSTRAINT' }, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'This action conflicts with related data and cannot be completed',
    });
  });

  it('falls back to a generic 500 for an unrecognized error, and logs it', () => {
    const { res, status, json } = mockRes();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('something truly unexpected');

    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(consoleError).toHaveBeenCalledWith(err);
    consoleError.mockRestore();
  });

  it('falls back to 500 for an SQLITE_CONSTRAINT code it does not recognize', () => {
    const { res, status, json } = mockRes();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler({ code: 'SQLITE_BUSY' }, req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
    consoleError.mockRestore();
  });
});
