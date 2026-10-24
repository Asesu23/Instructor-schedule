import type { Student } from '@/entities/student';
import { pad } from '@/shared/lib';
import { normalizeSpeech } from './speech';

export const NEEDS_TIME = 'Начните со времени, например 10:30';

export type QuickLine = {
  raw: string;
  day?: string;
  error?: string;
  startAt?: string;
  durationMin?: number;
  name?: string;
  typed?: string;
  student?: Student;
  options?: Student[];
  note?: string;
};

const TIME = /^(\d{1,2})(?:[:.]?(\d{2}))?$/;
const HOURS = /^(\d+(?:[.,]\d+)?)(?:ч|h)$/i;
const MINUTES = /^\d{1,3}$/;

const ALIASES = [
  ['михаил', 'миш'],
  ['александр', 'саш', 'шур'],
  ['алекс', 'леш', 'алеш'],
  ['евген', 'жен'],
  ['дмитр', 'дим'],
  ['владимир', 'вов', 'волод'],
  ['никол', 'кол'],
  ['серг', 'сереж'],
  ['павел', 'паш'],
  ['петр', 'пет'],
  ['иван', 'ван'],
  ['виктор', 'вит'],
  ['константин', 'кост'],
  ['андр', 'андрюш'],
  ['артем', 'тем'],
  ['максим', 'макс'],
  ['мар', 'маш'],
  ['екатерин', 'кат'],
  ['анастас', 'наст'],
  ['татьян', 'тан'],
  ['ольг', 'ол'],
  ['елен', 'лен'],
  ['светлан', 'свет'],
  ['ирин', 'ир'],
  ['анн', 'ан'],
  ['натал', 'наташ'],
  ['дар', 'даш'],
  ['елизавет', 'лиз'],
  ['валентин', 'вал'],
];

const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const titleCase = (value: string) =>
  value.replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());

const stem = (word: string) => {
  let value = word.toLowerCase().replace(/ё/g, 'е');
  for (let i = 0; i < 2 && value.length > 2 && /[аяуюыиеоьй]$/.test(value); i += 1) value = value.slice(0, -1);
  return value;
};

const sameStem = (a: string | undefined, b: string | undefined) =>
  a === b || ALIASES.some((group) => group.includes(a ?? '') && group.includes(b ?? ''));

const words = (value: string) => value.split(/\s+/).filter(Boolean);

const wordMatches = (typed: string, known: string) => {
  if (sameStem(typed, known) || (typed.length >= 3 && known.startsWith(typed))) return 2;
  return known.length === 2 && known.endsWith('.') && typed.startsWith(known[0] ?? '') ? 1 : 0;
};

const strength = (typed: string, known: string) => {
  const knownStems = words(known).map(stem);
  let level = 2;
  for (const word of words(typed).map(stem)) {
    const best = Math.max(0, ...knownStems.map((other) => wordMatches(word, other)));
    if (best === 0) return 0;
    level = Math.min(level, best);
  }
  return level;
};

const sortedWords = (value: string) => words(value.toLowerCase()).sort().join(' ');

function parseLine(raw: string, day: string, today: string, students: Student[], fallback: number): QuickLine[] {
  const [head = '', ...rest] = raw.split(',');
  const note = rest.join(',').trim();
  const { dates, line } = normalizeSpeech(head, today);
  const tokens = line.split(/\s+/).filter(Boolean);
  const first = tokens.shift() ?? '';
  const time = TIME.exec(first);
  if (!time) return [{ raw, error: NEEDS_TIME }];
  const hours = Number(time[1]);
  let minutes = Number(time[2] ?? 0);
  if (/^\d{1,2}$/.test(first) && /^\d{2}$/.test(tokens[0] ?? '') && tokens.length > 1) minutes = Number(tokens.shift());
  if (hours > 23 || minutes > 59) return [{ raw, error: 'Некорректное время' }];
  let durationMin = fallback;
  const last = tokens[tokens.length - 1] ?? '';
  const inHours = HOURS.exec(last);
  if (tokens.length > 1 && (inHours || MINUTES.test(last))) {
    durationMin = inHours ? Math.round(Number((inHours[1] ?? '0').replace(',', '.')) * 60) : Number(last);
    tokens.pop();
  }
  const name = tokens.join(' ');
  if (!name || /^\d+$/.test(name)) return [{ raw, error: 'Не указан ученик' }];
  if (name.length > 100) return [{ raw, error: 'Слишком длинное имя' }];
  if (durationMin < 5 || durationMin > 480) return [{ raw, error: 'Длительность от 5 до 480 минут' }];
  const strong = students.filter((s) => strength(name, s.name) === 2);
  const weak = students.filter((s) => strength(name, s.name) === 1);
  const exact = strong.find((s) => sortedWords(s.name) === sortedWords(name));
  const student = exact ?? (strong.length === 1 ? strong[0] : undefined);
  const candidates = strong.length > 0 ? strong : weak;
  const options = !student && candidates.length > 0 ? candidates : undefined;
  const typed = titleCase(name);
  return (dates.length ? dates : [day]).map((d) => ({
    raw,
    day: d,
    startAt: new Date(`${d}T${pad(hours)}:${pad(minutes)}`).toISOString(),
    durationMin,
    name: student?.name ?? typed,
    typed,
    student,
    options,
    note,
  }));
}

export function parseQuickEntry(
  text: string,
  day: string,
  students: Student[],
  fallback: number,
  today = dayKey(new Date()),
): QuickLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => parseLine(line, day, today, students, fallback));
}
