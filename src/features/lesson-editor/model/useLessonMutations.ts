import { useMutation, type QueryClient } from '@tanstack/react-query';
import {
  lessonApi,
  lessonKeys,
  removeLessonFromCache,
  upsertLessonInCache,
  type Lesson,
  type LessonInput,
} from '@/entities/lesson';
import { studentKeys, type Student } from '@/entities/student';
import { ApiError } from '@/shared/api';
import { OUTBOX_SCOPE, isLastPendingWrite } from '@/shared/lib';

export type SaveLessonVars = { id: string; isNew: boolean; body: LessonInput };

const saveKey = ['lesson', 'save'] as const;
const removeKey = ['lesson', 'remove'] as const;

const ignoreMissing = (error: unknown) => {
  if (error instanceof ApiError && error.status === 404) return;
  throw error;
};

const refreshWhenIdle = (client: QueryClient) => {
  if (isLastPendingWrite(client)) void client.invalidateQueries({ queryKey: lessonKeys.all });
};

export function registerLessonMutations(client: QueryClient) {
  client.setMutationDefaults(saveKey, {
    scope: OUTBOX_SCOPE,
    mutationFn: ({ id, isNew, body }: SaveLessonVars) =>
      isNew ? lessonApi.create({ ...body, id }) : lessonApi.update(id, body),
    onMutate: async ({ id, body }: SaveLessonVars) => {
      await client.cancelQueries({ queryKey: lessonKeys.all });
      const student = client.getQueryData<Student[]>(studentKeys.list())?.find((s) => s.id === body.studentId);
      upsertLessonInCache(client, {
        id,
        studentId: body.studentId,
        studentName: student?.name ?? '',
        startAt: body.startAt.replace(/\.\d{3}Z$/, 'Z'),
        durationMin: body.durationMin,
        note: body.note.trim() || null,
      });
    },
    onSettled: () => refreshWhenIdle(client),
  });

  client.setMutationDefaults(removeKey, {
    scope: OUTBOX_SCOPE,
    mutationFn: (id: string) => lessonApi.remove(id).catch(ignoreMissing),
    onMutate: async (id: string) => {
      await client.cancelQueries({ queryKey: lessonKeys.all });
      removeLessonFromCache(client, id);
    },
    onSettled: () => refreshWhenIdle(client),
  });
}

export const useSaveLesson = () => useMutation<Lesson, Error, SaveLessonVars>({ mutationKey: saveKey });

export const useDeleteLesson = () => useMutation<unknown, Error, string>({ mutationKey: removeKey });
