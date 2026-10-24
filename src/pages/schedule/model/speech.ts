import { readDates } from './dates';

type Kind = 'unit' | 'teen' | 'ten' | 'hundred' | 'zero';

const WORDS = new Map<string, { kind: Kind; value: number }>();

const add = (kind: Kind, entries: Record<string, number>) => {
  for (const [word, value] of Object.entries(entries)) WORDS.set(word, { kind, value });
};

add('zero', { ноль: 0, нуль: 0 });
add('unit', { один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9 });
add('teen', {
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
});
add('ten', { двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90 });
add('hundred', { сто: 100, двести: 200, триста: 300, четыреста: 400 });

const HOUR_WORD = /^час(?:а|ов)?$/;
const MINUTE_WORD = /^мин(?:ут|уты|уту)?$/;
const DAYPART = /^(?:утра|дня|вечера|ночи)$/;
const VERB = /^(?:запиши|запишите|записать|поставь|поставьте|поставить|добавь|добавьте|добавить|пожалуйста|занятие|урок)$/;

const lower = (token: string | undefined) => (token ?? '').toLowerCase();
const lookup = (token: string | undefined) => WORDS.get(lower(token));
const pad2 = (n: number) => String(n).padStart(2, '0');

const startsAmount = (token: string | undefined) => {
  const word = lower(token);
  return WORDS.has(word) || /^\d/.test(word) || word === 'полтора' || word === 'полчаса';
};

const readNumber = (tokens: string[], i: number): { text: string; next: number } | null => {
  const entry = lookup(tokens[i]);
  if (!entry) return null;
  if (entry.kind === 'zero') {
    const next = lookup(tokens[i + 1]);
    if (next && (next.kind === 'unit' || next.kind === 'zero')) return { text: `0${next.value}`, next: i + 2 };
    return { text: '0', next: i + 1 };
  }
  let total = entry.value;
  let kind: Kind = entry.kind;
  let j = i + 1;
  for (let next = lookup(tokens[j]); next; next = lookup(tokens[j])) {
    const joins =
      (kind === 'hundred' && next.kind !== 'zero' && next.kind !== 'hundred') ||
      (kind === 'ten' && next.kind === 'unit');
    if (!joins) break;
    total += next.value;
    kind = next.kind;
    j += 1;
  }
  return { text: String(total), next: j };
};

const digitize = (tokens: string[]) => {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const number = readNumber(tokens, i);
    if (number) {
      out.push(number.text);
      i = number.next;
    } else {
      out.push(tokens[i] ?? '');
      i += 1;
    }
  }
  return out;
};

const to24 = (hour: number, part: string | undefined) => {
  if (part === 'вечера' || part === 'дня') return hour < 12 ? hour + 12 : hour;
  if (part === 'ночи' && hour === 12) return 0;
  return hour;
};

type Clock = { minutes: number; part?: string; next: number };

const readClock = (tokens: string[], start: number): Clock | null => {
  const head = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(tokens[start] ?? '');
  if (!head) return null;
  let i = start + 1;
  let minute = Number(head[2] ?? 0);
  if (head[2] === undefined && /^\d{2}$/.test(tokens[i] ?? '')) {
    minute = Number(tokens[i]);
    i += 1;
  }
  if (HOUR_WORD.test(lower(tokens[i]))) i += 1;
  const word = lower(tokens[i]);
  const part = DAYPART.test(word) ? word : undefined;
  if (part) i += 1;
  const hour = to24(Number(head[1]), part);
  if (hour > 23 || minute > 59) return null;
  return { minutes: hour * 60 + minute, part, next: i };
};

const rangeLine = (tokens: string[]): string | null => {
  if (lower(tokens[0]) !== 'с') return null;
  const from = readClock(tokens, 1);
  if (!from) return null;
  const joiner = lower(tokens[from.next]);
  if (joiner !== 'по' && joiner !== 'до') return null;
  const to = readClock(tokens, from.next + 1);
  if (!to) return null;
  let start = from.minutes;
  let end = to.minutes;
  if (!to.part && from.part && end <= start && end + 720 > start) end += 720;
  if (!from.part && to.part && end > start && end - start > 360 && start < 720) start += 720;
  const duration = end - start;
  const name = tokens.slice(to.next).join(' ');
  if (!name || duration < 5 || duration > 480) return null;
  return `${pad2(Math.floor(start / 60))}:${pad2(start % 60)} ${name} ${duration}`;
};

const tidy = (tokens: string[]) => {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i] ?? '';
    const word = token.toLowerCase();
    i += 1;
    if (word === 'в' && out.length === 0) continue;
    if (word === 'на' && startsAmount(tokens[i])) continue;
    if (MINUTE_WORD.test(word)) continue;
    if (word === 'полчаса') {
      out.push('30');
      continue;
    }
    if (word === 'полтора') {
      out.push('1.5ч');
      if (HOUR_WORD.test(lower(tokens[i]))) i += 1;
      continue;
    }
    if (HOUR_WORD.test(word)) {
      const previous = out[out.length - 1];
      const afterNumber = previous !== undefined && /^\d+$/.test(previous);
      if (afterNumber && out.length > 1) out[out.length - 1] = `${previous}ч`;
      else if (!afterNumber) out.push(out.length === 0 ? '1' : '1ч');
      continue;
    }
    out.push(token);
  }
  return out.join(' ');
};

export function normalizeSpeech(text: string, today: string): { dates: string[]; line: string } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let start = 0;
  while (start < tokens.length && VERB.test(lower(tokens[start]))) start += 1;
  const words = digitize(tokens.slice(start));
  const { dates, next } = readDates(words, today);
  const rest = words.slice(next);
  return { dates, line: rangeLine(rest) ?? tidy(rest) };
}
