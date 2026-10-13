import { sql } from '../db.js';
import { HttpError, pgCode, type Body, type Result } from '../http.js';
import { parseText, requireId } from '../validation.js';

export async function handleStudents(method: string, rawId: string | undefined, body: Body): Promise<Result> {
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
