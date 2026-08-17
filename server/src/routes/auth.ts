import express, { Request, Response } from 'express';
import { COOKIE_NAME, COOKIE_SECURE } from '../config';
import { verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { authenticate } from '../middleware/authenticate';
import userRepository from '../repositories/userRepository';
import type { LoginRequest, LoginResponse, AuthUser } from '../types';

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = userRepository.findByEmail(email);
  // Same generic message whether the email doesn't exist or the password is
  // wrong — don't let the response shape confirm which emails are registered.
  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

  const { password_hash, ...authUser } = user;
  const body: LoginResponse = { user: authUser as AuthUser };
  res.json(body);
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.status(204).end();
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const body: LoginResponse = { user: req.user as AuthUser };
  res.json(body);
});

export default router;
