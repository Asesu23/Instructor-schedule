import { useQuery } from '@tanstack/react-query';
import { useQueryError, useStaleData } from '@/shared/lib';
import { lessonApi } from '../api/lessonApi';
import { lessonEnd } from '../lib/time';
import { lessonKeys } from './keys';

export function useLessonHistory() {
  const query = useQuery({
    queryKey: lessonKeys.history(),
    queryFn: async () => {
      const from = new Date('2000-01-01T00:00').toISOString();
      const to = new Date().toISOString();
      const rows = await lessonApi.range(from, to);
      return rows.filter((l) => lessonEnd(l) <= Date.now()).reverse();
    },
  });
  const { error, dismissError } = useQueryError(query);
  const stale = useStaleData(query);

  return { items: query.data ?? (query.isError ? [] : null), error, dismissError, stale };
}
