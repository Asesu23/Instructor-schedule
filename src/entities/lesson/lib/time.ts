import { toDay } from '@/shared/lib';
import type { Lesson } from '../model/types';

export const lessonEnd = (l: Lesson) => new Date(l.startAt).getTime() + l.durationMin * 60000;

export function groupByDay(lessons: Lesson[]) {
  const groups = new Map<string, Lesson[]>();
  for (const l of lessons) {
    const key = toDay(new Date(l.startAt));
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups];
}
