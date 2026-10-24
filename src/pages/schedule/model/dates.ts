const WEEKDAYS = new Map<string, number>([
  ['понедельник', 1],
  ['понедельника', 1],
  ['пн', 1],
  ['вторник', 2],
  ['вторника', 2],
  ['вт', 2],
  ['среда', 3],
  ['среду', 3],
  ['среды', 3],
  ['ср', 3],
  ['четверг', 4],
  ['четверга', 4],
  ['чт', 4],
  ['пятница', 5],
  ['пятницу', 5],
  ['пятницы', 5],
  ['пт', 5],
  ['суббота', 6],
  ['субботу', 6],
  ['субботы', 6],
  ['сб', 6],
  ['воскресенье', 0],
  ['воскресенья', 0],
  ['вс', 0],
]);

const RELATIVE = new Map<string, number>([
  ['сегодня', 0],
  ['завтра', 1],
  ['послезавтра', 2],
]);

const MONTHS = new Map<string, number>([
  ['января', 1],
  ['февраля', 2],
  ['марта', 3],
  ['апреля', 4],
  ['мая', 5],
  ['июня', 6],
  ['июля', 7],
  ['августа', 8],
  ['сентября', 9],
  ['октября', 10],
  ['ноября', 11],
  ['декабря', 12],
]);

const PREPOSITION = /^(?:в|во|на)$/;
const TIME_LIKE = /^\d{1,2}(?:[:.]\d{2})?$/;

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (day: string, delta: number) => {
  const d = new Date(`${day}T00:00`);
  d.setDate(d.getDate() + delta);
  return key(d);
};

const nextWeekday = (from: string, target: number) =>
  addDays(from, (target - new Date(`${from}T00:00`).getDay() + 7) % 7);

type Hit = { date: string; next: number };

const fromParts = (day: number, month: number, year: string | undefined, today: string, next: number): Hit | null => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let y = Number(today.slice(0, 4));
  if (year) y = year.length === 2 ? 2000 + Number(year) : Number(year);
  const candidate = new Date(y, month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  if (!year && key(candidate) < today) candidate.setFullYear(y + 1);
  return { date: key(candidate), next };
};

const dateAt = (tokens: string[], i: number, today: string): Hit | null => {
  const word = (n: number) => (tokens[n] ?? '').toLowerCase();
  const start = PREPOSITION.test(word(i)) ? i + 1 : i;
  const current = word(start);
  const relative = RELATIVE.get(current);
  if (relative !== undefined) return { date: addDays(today, relative), next: start + 1 };
  const weekday = WEEKDAYS.get(current);
  if (weekday !== undefined) return { date: nextWeekday(today, weekday), next: start + 1 };
  const numeric = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/.exec(tokens[start] ?? '');
  if (numeric && TIME_LIKE.test(tokens[start + 1] ?? '')) {
    return fromParts(Number(numeric[1]), Number(numeric[2]), numeric[3], today, start + 1);
  }
  const month = MONTHS.get(word(start + 1));
  if (/^\d{1,2}$/.test(tokens[start] ?? '') && month !== undefined) {
    return fromParts(Number(tokens[start]), month, undefined, today, start + 2);
  }
  return null;
};

export function readDates(tokens: string[], today: string): { dates: string[]; next: number } {
  const word = (n: number) => (tokens[n] ?? '').toLowerCase();
  const from = WEEKDAYS.get(word(1));
  const to = WEEKDAYS.get(word(3));
  if (word(0) === 'с' && from !== undefined && word(2) === 'по' && to !== undefined) {
    const first = nextWeekday(today, from);
    const last = nextWeekday(first, to);
    const dates: string[] = [];
    for (let d = first; d <= last && dates.length < 14; d = addDays(d, 1)) dates.push(d);
    return { dates, next: 4 };
  }
  const dates: string[] = [];
  let i = 0;
  for (;;) {
    const hit = dateAt(tokens, i, today) ?? (word(i) === 'и' ? dateAt(tokens, i + 1, today) : null);
    if (!hit || dates.length >= 14) break;
    dates.push(hit.date);
    i = hit.next;
  }
  return { dates, next: i };
}
