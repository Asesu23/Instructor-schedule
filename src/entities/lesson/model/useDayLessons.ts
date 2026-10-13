import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPendingWrites, shiftDay, useQueryError, useStaleData } from '@/shared/lib';
import { lessonApi } from '../api/lessonApi';
import { lessonKeys } from './keys';
import type { Lesson } from './types';

export function useDayLessons(day: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: lessonKeys.day(day),
    queryFn: () => {
      const cached = client.getQueryData<Lesson[]>(lessonKeys.day(day));
      if (cached && hasPendingWrites(client)) return cached;
      const from = new Date(`${day}T00:00`).toISOString();
      const to = new Date(`${shiftDay(day, 1)}T00:00`).toISOString();
      return lessonApi.range(from, to);
    },
  });
  const { error, dismissError } = useQueryError(query);
  const stale = useStaleData(query);

  return { items: query.data ?? (query.isError ? [] : null), error, dismissError, stale };
}
