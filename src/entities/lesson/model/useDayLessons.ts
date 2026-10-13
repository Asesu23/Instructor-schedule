import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, shiftDay } from '@/shared/lib';
import { lessonApi } from '../api/lessonApi';
import type { Lesson } from './types';

export function useDayLessons(day: string) {
  const [state, setState] = useState<{ day: string; items: Lesson[] } | null>(null);
  const [error, setError] = useState('');
  const dayRef = useRef(day);

  const reload = useCallback(() => {
    const from = new Date(`${day}T00:00`).toISOString();
    const to = new Date(`${shiftDay(day, 1)}T00:00`).toISOString();
    return lessonApi
      .range(from, to)
      .then((items) => {
        if (dayRef.current === day) setState({ day, items });
      })
      .catch((e) => {
        setError(errorMessage(e));
        if (dayRef.current === day) setState((prev) => (prev?.day === day ? prev : { day, items: [] }));
      });
  }, [day]);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items: state?.day === day ? state.items : null, error, dismissError: () => setError(''), reload };
}
