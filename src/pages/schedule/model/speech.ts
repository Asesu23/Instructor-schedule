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

const lookup = (token: string | undefined) => WORDS.get((token ?? '').toLowerCase());

const startsAmount = (token: string | undefined) => {
  const word = (token ?? '').toLowerCase();
  return WORDS.has(word) || /^\d/.test(word) || word === 'полтора' || word === 'полчаса';
};

export function normalizeSpeech(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i] ?? '';
    const word = token.toLowerCase();
    const entry = lookup(token);
    if (entry) {
      if (entry.kind === 'zero') {
        const next = lookup(tokens[i + 1]);
        if (next && (next.kind === 'unit' || next.kind === 'zero')) {
          out.push(`0${next.value}`);
          i += 2;
        } else {
          out.push('0');
          i += 1;
        }
        continue;
      }
      let total = entry.value;
      let kind: Kind = entry.kind;
      i += 1;
      for (let next = lookup(tokens[i]); next; next = lookup(tokens[i])) {
        const joins =
          (kind === 'hundred' && next.kind !== 'zero' && next.kind !== 'hundred') ||
          (kind === 'ten' && next.kind === 'unit');
        if (!joins) break;
        total += next.value;
        kind = next.kind;
        i += 1;
      }
      out.push(String(total));
      continue;
    }
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
      if (HOUR_WORD.test((tokens[i] ?? '').toLowerCase())) i += 1;
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
}
