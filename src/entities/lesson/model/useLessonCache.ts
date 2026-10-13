import { useQueryClient } from '@tanstack/react-query';
import { findOverlap } from '../lib/overlap';
import { knownLessons } from './cache';

export function useLessonCache() {
  const client = useQueryClient();

  return {
    findOverlap: (startAt: string, durationMin: number, ignoreId?: string) =>
      findOverlap(knownLessons(client), startAt, durationMin, ignoreId),
    hasLessonsFor: (studentId: string) => knownLessons(client).some((l) => l.studentId === studentId),
  };
}
