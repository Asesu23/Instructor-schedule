export const pad = (n: number) => String(n).padStart(2, '0');

export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const parseDay = (day: string) => new Date(`${day}T00:00`);

export const shiftDay = (day: string, delta: number) => {
  const d = parseDay(day);
  d.setDate(d.getDate() + delta);
  return toDay(d);
};
