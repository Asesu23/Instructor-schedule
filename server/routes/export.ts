import { sql } from '../db.js';
import type { Result } from '../http.js';

export async function exportAll(): Promise<Result> {
  const [students, lessons] = await Promise.all([
    sql`select id, name, note, created_at as "createdAt" from students order by created_at`,
    sql`select id, student_id as "studentId", to_char(start_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startAt",
      duration_min as "durationMin", note from lessons order by start_at`,
  ]);
  return { status: 200, body: { exportedAt: new Date().toISOString(), students, lessons } };
}
