import { useMutation, type QueryClient } from '@tanstack/react-query';
import { lessonKeys, renameStudentInLessonCache } from '@/entities/lesson';
import { studentApi, studentKeys, type Student, type StudentInput } from '@/entities/student';
import { ApiError } from '@/shared/api';
import { OUTBOX_SCOPE, isLastPendingWrite } from '@/shared/lib';

export type SaveStudentVars = { id: string; isNew: boolean; body: StudentInput };

const saveKey = ['student', 'save'] as const;
const removeKey = ['student', 'remove'] as const;

const byName = (a: Student, b: Student) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());

const ignoreMissing = (error: unknown) => {
  if (error instanceof ApiError && error.status === 404) return;
  throw error;
};

const refreshWhenIdle = (client: QueryClient) => {
  if (!isLastPendingWrite(client)) return;
  void client.invalidateQueries({ queryKey: studentKeys.all });
  void client.invalidateQueries({ queryKey: lessonKeys.all });
};

export function registerStudentMutations(client: QueryClient) {
  client.setMutationDefaults(saveKey, {
    scope: OUTBOX_SCOPE,
    mutationFn: ({ id, isNew, body }: SaveStudentVars) =>
      isNew ? studentApi.create({ ...body, id }) : studentApi.update(id, body),
    onMutate: async ({ id, isNew, body }: SaveStudentVars) => {
      await Promise.all([
        client.cancelQueries({ queryKey: studentKeys.all }),
        client.cancelQueries({ queryKey: lessonKeys.all }),
      ]);
      const next: Student = { id, name: body.name.trim(), note: body.note.trim() || null };
      client.setQueryData<Student[]>(studentKeys.list(), (old) =>
        old && [...old.filter((s) => s.id !== id), next].sort(byName),
      );
      if (!isNew) renameStudentInLessonCache(client, id, next.name);
    },
    onSettled: () => refreshWhenIdle(client),
  });

  client.setMutationDefaults(removeKey, {
    scope: OUTBOX_SCOPE,
    mutationFn: (id: string) => studentApi.remove(id).catch(ignoreMissing),
    onMutate: async (id: string) => {
      await client.cancelQueries({ queryKey: studentKeys.all });
      client.setQueryData<Student[]>(studentKeys.list(), (old) => old?.filter((s) => s.id !== id));
    },
    onSettled: () => refreshWhenIdle(client),
  });
}

export const useSaveStudent = () => useMutation<Student, Error, SaveStudentVars>({ mutationKey: saveKey });

export const useDeleteStudent = () => useMutation<unknown, Error, string>({ mutationKey: removeKey });
