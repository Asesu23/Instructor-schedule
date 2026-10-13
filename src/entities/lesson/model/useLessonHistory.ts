import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/shared/lib';
import { lessonApi } from '../api/lessonApi';
import { lessonEnd } from '../lib/time';
import type { Lesson } from './types';

export function useLessonHistory() {
  const [items, setItems] = useState<Lesson[] | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    const from = new Date('2000-01-01T00:00').toISOString();
    const to = new Date().toISOString();
    return lessonApi
      .range(from, to)
      .then((rows) => setItems(rows.filter((l) => lessonEnd(l) <= Date.now()).reverse()))
      .catch((e) => {
        setError(errorMessage(e));
        setItems((prev) => prev ?? []);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, error, dismissError: () => setError(''), reload };
}
