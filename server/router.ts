import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthed, login, logout } from './auth.js';
import { HttpError, type Body, type Result } from './http.js';
import { exportAll } from './routes/export.js';
import { handleLessons } from './routes/lessons.js';
import { handleStudents } from './routes/students.js';

async function route(req: VercelRequest, res: VercelResponse): Promise<Result> {
  const [resource, pathId] = ([] as string[]).concat((req.query.slug ?? req.query['...slug'] ?? []) as string | string[]);
  const id = pathId ?? (typeof req.query.id === 'string' ? req.query.id : undefined);
  const method = req.method ?? 'GET';
  const body = (req.body ?? {}) as Body;
  if (resource === 'login' && method === 'POST') return login(body, res);
  if (resource === 'logout' && method === 'POST') return logout(res);
  if (!isAuthed(req)) throw new HttpError(401, 'UNAUTHENTICATED', 'Нужен вход');
  if (resource === 'session' && method === 'GET') return { status: 200, body: { ok: true } };
  if (resource === 'export' && method === 'GET') return exportAll();
  if (resource === 'students') return handleStudents(method, id, body);
  if (resource === 'lessons') return handleLessons(method, id, body, req);
  throw new HttpError(404, 'NOT_FOUND', 'Не найдено');
}

export async function handle(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { status, body } = await route(req, res);
    if (body === undefined) res.status(status).end();
    else res.status(status).json(body);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.code, message: error.message });
    } else {
      res.status(500).json({ error: 'INTERNAL', message: 'Ошибка сервера' });
    }
  }
}
