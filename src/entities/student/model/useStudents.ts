import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/shared/lib';
import { studentApi } from '../api/studentApi';
import type { Student } from './types';

export function useStudents() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(
    () =>
      studentApi
        .list()
        .then(setStudents)
        .catch((e) => {
          setError(errorMessage(e));
          setStudents((prev) => prev ?? []);
        }),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { students, error, dismissError: () => setError(''), reload };
}
