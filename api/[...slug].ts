import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const sql = neon(process.env.DATABASE_URL!);
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const COOKIE_FLAGS = 'HttpOnly; Secure; SameSite=Strict; Path=/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = Record<string, unknown>;
type Result = { status: number; body?: unknown };

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

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

const isAuthed = (req: VercelRequest) => {
  const [expires, mac] = (readCookie(req, 'session') ?? '').split('.');
  return Boolean(expires && mac) && safeEqual(mac, sign(expires)) && Number(expires) > Date.now();
};

const checkPassword = (password: string) => {
  const [salt, hash] = (process.env.PASSWORD_HASH ?? '').split('.');
  return Boolean(salt && hash) && safeEqual(scryptSync(password, salt, 64).toString('hex'), hash);
};

const pgCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

const requireId = (id: string | undefined) => {
  if (!id || !UUID.test(id)) throw new HttpError(404, 'NOT_FOUND', 'Не найдено');
  return id;
};

const parseText = (value: unknown, field: string, max: number, required: boolean) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new HttpError(400, 'VALIDATION_ERROR', `Поле «${field}» обязательно`);
  if (text.length > max) throw new HttpError(400, 'VALIDATION_ERROR', `Поле «${field}» длиннее ${max} символов`);
  return text || null;
};

const parseLesson = (body: Body) => {
  const studentId = typeof body.studentId === 'string' && UUID.test(body.studentId) ? body.studentId : null;
  if (!studentId) throw new HttpError(400, 'VALIDATION_ERROR', 'Выберите ученика');
  const start = new Date(String(body.startAt));
  if (Number.isNaN(start.getTime()) || start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Некорректное время начала');
  }
  const durationMin = Number(body.durationMin);
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 480) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Длительность от 5 до 480 минут');
  }
  return { studentId, startAt: start.toISOString(), durationMin, note: parseText(body.note, 'Заметка', 500, false) };
};

const lessonById = async (id: string) => {
  const rows = await sql`
    select l.id, l.student_id as "studentId", s.name as "studentName",
      to_char(l.start_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startAt",
      l.duration_min as "durationMin", l.note
    from lessons l join students s on s.id = l.student_id
    where l.id = ${id}`;
  return rows[0];
};

const lessonError = (error: unknown): never => {
  const code = pgCode(error);
  if (code === '23P01') throw new HttpError(409, 'LESSON_OVERLAP', 'Занятие пересекается с другим');
  if (code === '23503') throw new HttpError(404, 'STUDENT_NOT_FOUND', 'Ученик не найден');
  throw error;
};

async function login(body: Body, res: VercelResponse): Promise<Result> {
  const password = typeof body.password === 'string' ? body.password : '';
  if (!checkPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    throw new HttpError(401, 'BAD_PASSWORD', 'Неверный пароль');
  }
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  res.setHeader('Set-Cookie', `session=${expires}.${sign(expires)}; ${COOKIE_FLAGS}; Max-Age=${SESSION_SECONDS}`);
  return { status: 200, body: { ok: true } };
}

async function handleStudents(method: string, rawId: string | undefined, body: Body): Promise<Result> {
  if (!rawId && method === 'GET') {
    return { status: 200, body: await sql`select id, name, note from students order by lower(name)` };
  }
  if (!rawId && method === 'POST') {
    const name = parseText(body.name, 'Имя', 100, true);
    const note = parseText(body.note, 'Заметка', 500, false);
    const rows = await sql`insert into students (name, note) values (${name}, ${note}) returning id, name, note`;
    return { status: 201, body: rows[0] };
  }
  const id = requireId(rawId);
  if (method === 'PUT') {
    const name = parseText(body.name, 'Имя', 100, true);
    const note = parseText(body.note, 'Заметка', 500, false);
    const rows = await sql`update students set name = ${name}, note = ${note} where id = ${id} returning id, name, note`;
    if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Ученик не найден');
    return { status: 200, body: rows[0] };
  }
  if (method === 'DELETE') {
    let rows: Record<string, unknown>[];
    try {
      rows = await sql`delete from students where id = ${id} returning id`;
    } catch (error) {
      if (pgCode(error) === '23503') throw new HttpError(409, 'STUDENT_HAS_LESSONS', 'У ученика есть занятия');
      throw error;
    }
    if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Ученик не найден');
    return { status: 204 };
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
}

async function handleLessons(
  method: string,
  rawId: string | undefined,
  body: Body,
  req: VercelRequest,
): Promise<Result> {
  if (!rawId && method === 'GET') {
    const from = new Date(String(req.query.from));
    const to = new Date(String(req.query.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() <= from.getTime()) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Некорректный период');
    }
    const rows = await sql`
      select l.id, l.student_id as "studentId", s.name as "studentName",
        to_char(l.start_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startAt",
        l.duration_min as "durationMin", l.note
      from lessons l join students s on s.id = l.student_id
      where l.start_at >= ${from.toISOString()}::timestamp and l.start_at < ${to.toISOString()}::timestamp
      order by l.start_at`;
    return { status: 200, body: rows };
  }
  if (!rawId && method === 'POST') {
    const lesson = parseLesson(body);
    try {
      const rows = await sql`
        insert into lessons (student_id, start_at, duration_min, note)
        values (${lesson.studentId}, ${lesson.startAt}::timestamp, ${lesson.durationMin}, ${lesson.note})
        returning id`;
      return { status: 201, body: await lessonById(rows[0].id) };
    } catch (error) {
      return lessonError(error);
    }
  }
  const id = requireId(rawId);
  if (method === 'PUT') {
    const lesson = parseLesson(body);
    try {
      const rows = await sql`
        update lessons set student_id = ${lesson.studentId}, start_at = ${lesson.startAt}::timestamp,
          duration_min = ${lesson.durationMin}, note = ${lesson.note}
        where id = ${id} returning id`;
      if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Занятие не найдено');
      return { status: 200, body: await lessonById(id) };
    } catch (error) {
      return lessonError(error);
    }
  }
  if (method === 'DELETE') {
    const rows = await sql`delete from lessons where id = ${id} returning id`;
    if (rows.length === 0) throw new HttpError(404, 'NOT_FOUND', 'Занятие не найдено');
    return { status: 204 };
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Метод не поддерживается');
}

async function exportAll(): Promise<Result> {
  const [students, lessons] = await Promise.all([
    sql`select id, name, note, created_at as "createdAt" from students order by created_at`,
    sql`select id, student_id as "studentId", to_char(start_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startAt",
      duration_min as "durationMin", note from lessons order by start_at`,
  ]);
  return { status: 200, body: { exportedAt: new Date().toISOString(), students, lessons } };
}

async function route(req: VercelRequest, res: VercelResponse): Promise<Result> {
  const [resource, id] = ([] as string[]).concat(req.query.slug ?? []);
  const method = req.method ?? 'GET';
  const body = (req.body ?? {}) as Body;
  if (resource === 'login' && method === 'POST') return login(body, res);
  if (resource === 'logout' && method === 'POST') {
    res.setHeader('Set-Cookie', `session=; ${COOKIE_FLAGS}; Max-Age=0`);
    return { status: 204 };
  }
  if (!isAuthed(req)) throw new HttpError(401, 'UNAUTHENTICATED', 'Нужен вход');
  if (resource === 'session' && method === 'GET') return { status: 200, body: { ok: true } };
  if (resource === 'export' && method === 'GET') return exportAll();
  if (resource === 'students') return handleStudents(method, id, body);
  if (resource === 'lessons') return handleLessons(method, id, body, req);
  throw new HttpError(404, 'NOT_FOUND', 'Не найдено');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
