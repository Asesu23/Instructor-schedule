import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPendingWrites, useQueryError, useStaleData } from '@/shared/lib';
import { studentApi } from '../api/studentApi';
import { studentKeys } from './keys';
import type { Student } from './types';

export function useStudents() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: studentKeys.list(),
    queryFn: () => {
      const cached = client.getQueryData<Student[]>(studentKeys.list());
      if (cached && hasPendingWrites(client)) return cached;
      return studentApi.list();
    },
  });
  const { error, dismissError } = useQueryError(query);
  const stale = useStaleData(query);

  return { students: query.data ?? (query.isError ? [] : null), error, dismissError, stale };
}
