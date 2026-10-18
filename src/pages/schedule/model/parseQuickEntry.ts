import type { Student } from '@/entities/student';
import { pad } from '@/shared/lib';

export type QuickLine = {
  raw: string;
  error?: string;
  startAt?: string;
  durationMin?: number;
  name?: string;
  student?: Student;
  note?: string;
};

const TIME = /^(\d{1,2})(?:[:.]?(\d{2}))?$/;
const HOURS = /^(\d+(?:[.,]\d+)?)(?:ч|h)$/i;
const MINUTES = /^\d{1,3}$/;

function parseLine(raw: string, day: string, students: Student[], fallback: number): QuickLine {
  const [main = '', ...rest] = raw.split(',');
  const note = rest.join(',').trim();
  const tokens = main.trim().split(/\s+/);
  const time = TIME.exec(tokens[0] ?? '');
  if (!time) return { raw, error: 'Начните со времени, например 10:30' };
  const hours = Number(time[1]);
  const minutes = Number(time[2] ?? 0);
  if (hours > 23 || minutes > 59) return { raw, error: 'Некорректное время' };
  tokens.shift();
  let durationMin = fallback;
  const last = tokens[tokens.length - 1] ?? '';
  const inHours = HOURS.exec(last);
  if (tokens.length > 1 && (inHours || MINUTES.test(last))) {
    durationMin = inHours ? Math.round(Number((inHours[1] ?? '0').replace(',', '.')) * 60) : Number(last);
    tokens.pop();
  }
  const name = tokens.join(' ');
  if (!name) return { raw, error: 'Не указан ученик' };
  if (name.length > 100) return { raw, error: 'Слишком длинное имя' };
  if (durationMin < 5 || durationMin > 480) return { raw, error: 'Длительность от 5 до 480 минут' };
  const startAt = new Date(`${day}T${pad(hours)}:${pad(minutes)}`).toISOString();
  const student = students.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return { raw, startAt, durationMin, name: student?.name ?? name, student, note };
}

export function parseQuickEntry(text: string, day: string, students: Student[], fallback: number): QuickLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseLine(line, day, students, fallback));
}
