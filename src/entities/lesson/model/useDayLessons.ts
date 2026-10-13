import { useQuery } from '@tanstack/react-query';
import { shiftDay, useQueryError } from '@/shared/lib';
import { lessonApi } from '../api/lessonApi';
import { lessonKeys } from './keys';

export function useDayLessons(day: string) {
  const query = useQuery({
    queryKey: lessonKeys.day(day),
    queryFn: () => {
      const from = new Date(`${day}T00:00`).toISOString();
      const to = new Date(`${shiftDay(day, 1)}T00:00`).toISOString();
      return lessonApi.range(from, to);
    },
  });
  const { error, dismissError } = useQueryError(query);

  return { items: query.data ?? (query.isError ? [] : null), error, dismissError };
}
