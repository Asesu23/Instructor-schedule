import type { Lesson } from '../model/types';
import { lessonEnd } from './time';

export function findOverlap(lessons: Lesson[], startAt: string, durationMin: number, ignoreId?: string) {
  const start = new Date(startAt).getTime();
  const end = start + durationMin * 60000;
  return lessons.find((l) => l.id !== ignoreId && new Date(l.startAt).getTime() < end && lessonEnd(l) > start);
}
