import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPendingWrites, useQueryError, useStaleData } from '@/shared/lib';
import { lessonApi } from '../api/lessonApi';
import { lessonEnd } from '../lib/time';
import { lessonKeys } from './keys';
import type { Lesson } from './types';

export function useLessonHistory() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: lessonKeys.history(),
    queryFn: async () => {
      const cached = client.getQueryData<Lesson[]>(lessonKeys.history());
      if (cached && hasPendingWrites(client)) return cached;
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
