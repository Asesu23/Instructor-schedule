import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lessonApi, lessonKeys, type Lesson, type LessonInput } from '@/entities/lesson';

export function useSaveLesson() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: LessonInput }) =>
      id ? lessonApi.update(id, body) : lessonApi.create(body),
    onSuccess: () => client.invalidateQueries({ queryKey: lessonKeys.all }),
  });
}

export function useDeleteLesson() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => lessonApi.remove(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: lessonKeys.all });
      const previous = client.getQueriesData<Lesson[]>({ queryKey: lessonKeys.all });
      client.setQueriesData<Lesson[]>({ queryKey: lessonKeys.all }, (old) => old?.filter((l) => l.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => client.setQueryData(key, data));
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: lessonKeys.all });
    },
  });
}
