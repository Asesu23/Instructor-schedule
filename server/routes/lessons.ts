import type { VercelRequest } from '@vercel/node';
import { sql } from '../db.js';
import { HttpError, pgCode, type Body, type Result } from '../http.js';
import { isUuid, parseText, requireId } from '../validation.js';

const parseLesson = (body: Body) => {
  const studentId = isUuid(body.studentId) ? body.studentId : null;
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

export async function handleLessons(
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
