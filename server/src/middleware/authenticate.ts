import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME } from '../config';
import { verifyToken } from '../utils/jwt';
import userRepository from '../repositories/userRepository';
import type { AuthUser } from '../types';

// Not wired into any router yet — that happens in the department-scoping
// phase, once req.user is actually needed to compute access. Built now so
// /api/auth/me can use it and so scoping work doesn't need to touch auth
// internals later.
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = userRepository.findById(Number(payload.sub));
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { password_hash, ...authUser } = user;
  req.user = authUser as AuthUser;
  next();
}
