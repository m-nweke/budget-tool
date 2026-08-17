import express, { Request, Response } from 'express';
import { COOKIE_NAME, COOKIE_SECURE } from '../config';
import { verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { authenticate } from '../middleware/authenticate';
import userRepository, { toAuthUser } from '../repositories/userRepository';
import type { LoginRequest, LoginResponse, AuthUser } from '../types';

// A hash of an unguessable, never-issued password, used to give a
// nonexistent-user login attempt the same bcrypt.compare cost as a real one
// (see the timing note below). Comparing against it always fails.
const DUMMY_HASH = '$2b$10$DCDkFenFV5VYAwMnrKG9eecUDVmh3IXyasd.MOsGyK5/4UlgCXL76';

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = userRepository.findByEmail(email);
  // Always run a bcrypt.compare, even for a nonexistent user (against
  // DUMMY_HASH, which never matches) — skipping it when `user` is missing
  // would make login attempts for unregistered emails return measurably
  // faster than ones for registered emails, letting response timing leak
  // which emails exist despite the identical error message below.
  const passwordValid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !passwordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

  const body: LoginResponse = { user: toAuthUser(user) };
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
