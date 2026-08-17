import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config';

interface TokenPayload {
  // The JWT spec's registered `sub` claim is a string; the userRepository
  // lookup id is numeric, so callers convert with Number(payload.sub).
  sub: string;
}

export function signToken(userId: number): string {
  const payload: TokenPayload = { sub: String(userId) };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Returns null instead of throwing so callers (the authenticate middleware)
// can treat "invalid/expired token" as a plain 401 without a try/catch.
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return null;
    return { sub: decoded.sub };
  } catch {
    return null;
  }
}
