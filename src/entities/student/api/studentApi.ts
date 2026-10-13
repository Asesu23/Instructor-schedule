import { api } from '@/shared/api';
import type { Student, StudentInput } from '../model/types';

export const studentApi = {
  list: () => api<Student[]>('/students'),
  create: (body: StudentInput) => api<Student>('/students', 'POST', body),
  update: (id: string, body: StudentInput) => api<Student>(`/students?id=${id}`, 'PUT', body),
  remove: (id: string) => api(`/students?id=${id}`, 'DELETE'),
};
