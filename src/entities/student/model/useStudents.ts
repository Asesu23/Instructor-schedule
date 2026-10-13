import { useQuery } from '@tanstack/react-query';
import { useQueryError, useStaleData } from '@/shared/lib';
import { studentApi } from '../api/studentApi';
import { studentKeys } from './keys';

export function useStudents() {
  const query = useQuery({
    queryKey: studentKeys.list(),
    queryFn: () => studentApi.list(),
  });
  const { error, dismissError } = useQueryError(query);
  const stale = useStaleData(query);

  return { students: query.data ?? (query.isError ? [] : null), error, dismissError, stale };
}
