import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lessonKeys } from '@/entities/lesson';
import { studentApi, studentKeys, type StudentInput } from '@/entities/student';

export function useSaveStudent() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: StudentInput }) =>
      id ? studentApi.update(id, body) : studentApi.create(body),
    onSuccess: (_student, { id }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: studentKeys.all }),
        id ? client.invalidateQueries({ queryKey: lessonKeys.all }) : undefined,
      ]),
  });
}

export function useDeleteStudent() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => studentApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: studentKeys.all }),
  });
}
