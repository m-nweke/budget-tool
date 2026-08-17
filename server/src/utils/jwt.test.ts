import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from './jwt';

describe('jwt', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken(42);
    expect(verifyToken(token)).toEqual({ sub: '42' });
  });

  it('returns null for a malformed token', () => {
    expect(verifyToken('not-a-real-token')).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: '1' }, 'wrong-secret');
    expect(verifyToken(forged)).toBeNull();
  });
});
