import type { QueryClient } from '@tanstack/react-query';
import { toDay } from '@/shared/lib';
import { lessonEnd } from '../lib/time';
import { lessonKeys } from './keys';
import type { Lesson } from './types';

const byStart = (a: Lesson, b: Lesson) => a.startAt.localeCompare(b.startAt);

export function removeLessonFromCache(client: QueryClient, id: string) {
  client.setQueriesData<Lesson[]>({ queryKey: lessonKeys.all }, (old) => old?.filter((l) => l.id !== id));
}

export function upsertLessonInCache(client: QueryClient, lesson: Lesson) {
  removeLessonFromCache(client, lesson.id);
  const day = toDay(new Date(lesson.startAt));
  client.setQueryData<Lesson[]>(lessonKeys.day(day), (old) => old && [...old, lesson].sort(byStart));
  if (lessonEnd(lesson) <= Date.now()) {
    client.setQueryData<Lesson[]>(lessonKeys.history(), (old) => old && [...old, lesson].sort((a, b) => byStart(b, a)));
  }
}

export function renameStudentInLessonCache(client: QueryClient, studentId: string, studentName: string) {
  client.setQueriesData<Lesson[]>({ queryKey: lessonKeys.all }, (old) =>
    old?.map((l) => (l.studentId === studentId ? { ...l, studentName } : l)),
  );
}

export function knownLessons(client: QueryClient) {
  const unique = new Map<string, Lesson>();
  for (const [, data] of client.getQueriesData<Lesson[]>({ queryKey: lessonKeys.all })) {
    for (const lesson of data ?? []) unique.set(lesson.id, lesson);
  }
  return [...unique.values()];
}
