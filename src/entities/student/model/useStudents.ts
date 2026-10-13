import { useQuery } from '@tanstack/react-query';
import { useQueryError } from '@/shared/lib';
import { studentApi } from '../api/studentApi';
import { studentKeys } from './keys';

export function useStudents() {
  const query = useQuery({
    queryKey: studentKeys.list(),
    queryFn: () => studentApi.list(),
  });
  const { error, dismissError } = useQueryError(query);

  return { students: query.data ?? (query.isError ? [] : null), error, dismissError };
}
