import type { Student } from '@/entities/student';
import { pad } from '@/shared/lib';
import { normalizeSpeech } from './speech';

export const NEEDS_TIME = 'Начните со времени, например 10:30';

export type QuickLine = {
  raw: string;
  error?: string;
  startAt?: string;
  durationMin?: number;
  name?: string;
  student?: Student;
  options?: Student[];
  note?: string;
};

const TIME = /^(\d{1,2})(?:[:.]?(\d{2}))?$/;
const HOURS = /^(\d+(?:[.,]\d+)?)(?:ч|h)$/i;
const MINUTES = /^\d{1,3}$/;

const titleCase = (value: string) =>
  value.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());

const stem = (word: string) => {
  let value = word.toLowerCase().replace(/ё/g, 'е');
  for (let i = 0; i < 2 && value.length > 2 && /[аяуюыиеоьй]$/.test(value); i += 1) value = value.slice(0, -1);
  return value;
};

const sameName = (typed: string, known: string) => {
  const a = typed.split(/\s+/).map(stem);
  const b = known.split(/\s+/).map(stem);
  return (
    a[0] === b[0] &&
    a
      .slice(1)
      .every((word) =>
        b.slice(1).some((other) => other.startsWith(word) || (other.length === 2 && other.endsWith('.') && word.startsWith(other[0] ?? ''))),
      )
  );
};

function parseLine(raw: string, day: string, students: Student[], fallback: number): QuickLine {
  const [head = '', ...rest] = raw.split(',');
  const note = rest.join(',').trim();
  const tokens = normalizeSpeech(head).split(/\s+/).filter(Boolean);
  const first = tokens.shift() ?? '';
  const time = TIME.exec(first);
  if (!time) return { raw, error: NEEDS_TIME };
  const hours = Number(time[1]);
  let minutes = Number(time[2] ?? 0);
  if (/^\d{1,2}$/.test(first) && /^\d{2}$/.test(tokens[0] ?? '') && tokens.length > 1) minutes = Number(tokens.shift());
  if (hours > 23 || minutes > 59) return { raw, error: 'Некорректное время' };
  let durationMin = fallback;
  const last = tokens[tokens.length - 1] ?? '';
  const inHours = HOURS.exec(last);
  if (tokens.length > 1 && (inHours || MINUTES.test(last))) {
    durationMin = inHours ? Math.round(Number((inHours[1] ?? '0').replace(',', '.')) * 60) : Number(last);
    tokens.pop();
  }
  const name = tokens.join(' ');
  if (!name || /^\d+$/.test(name)) return { raw, error: 'Не указан ученик' };
  if (name.length > 100) return { raw, error: 'Слишком длинное имя' };
  if (durationMin < 5 || durationMin > 480) return { raw, error: 'Длительность от 5 до 480 минут' };
  const startAt = new Date(`${day}T${pad(hours)}:${pad(minutes)}`).toISOString();
  const matches = students.filter((s) => sameName(name, s.name));
  const exact = matches.find((s) => s.name.toLowerCase() === name.toLowerCase());
  const student = exact ?? (matches.length === 1 ? matches[0] : undefined);
  const options = !student && matches.length > 1 ? matches : undefined;
  return { raw, startAt, durationMin, name: student?.name ?? titleCase(name), student, options, note };
}

export function parseQuickEntry(text: string, day: string, students: Student[], fallback: number): QuickLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseLine(line, day, students, fallback));
}
