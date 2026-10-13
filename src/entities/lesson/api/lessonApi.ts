import { api } from '@/shared/api';
import type { Lesson, LessonInput } from '../model/types';

export const lessonApi = {
  range: (from: string, to: string) =>
    api<Lesson[]>(`/lessons?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  create: (body: LessonInput & { id: string }) => api<Lesson>('/lessons', 'POST', body),
  update: (id: string, body: LessonInput) => api<Lesson>(`/lessons?id=${id}`, 'PUT', body),
  remove: (id: string) => api(`/lessons?id=${id}`, 'DELETE'),
};
