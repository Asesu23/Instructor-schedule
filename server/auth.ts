import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError, type Body, type Result } from './http.js';

const SESSION_SECONDS = 30 * 24 * 60 * 60;
const COOKIE_FLAGS = 'HttpOnly; Secure; SameSite=Strict; Path=/';

const sign = (value: string) => createHmac('sha256', process.env.SESSION_SECRET!).update(value).digest('base64url');

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const readCookie = (req: VercelRequest, name: string) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];

const checkPassword = (password: string) => {
  const [salt, hash] = (process.env.PASSWORD_HASH ?? '').split('.');
  return Boolean(salt && hash) && safeEqual(scryptSync(password, salt, 64).toString('hex'), hash);
};

export const isAuthed = (req: VercelRequest) => {
  const [expires, mac] = (readCookie(req, 'session') ?? '').split('.');
  return Boolean(expires && mac) && safeEqual(mac, sign(expires)) && Number(expires) > Date.now();
};

export async function login(body: Body, res: VercelResponse): Promise<Result> {
  const password = typeof body.password === 'string' ? body.password : '';
  if (!checkPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    throw new HttpError(401, 'BAD_PASSWORD', 'Неверный пароль');
  }
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  res.setHeader('Set-Cookie', `session=${expires}.${sign(expires)}; ${COOKIE_FLAGS}; Max-Age=${SESSION_SECONDS}`);
  return { status: 200, body: { ok: true } };
}

export function logout(res: VercelResponse): Result {
  res.setHeader('Set-Cookie', `session=; ${COOKIE_FLAGS}; Max-Age=0`);
  return { status: 204 };
}
