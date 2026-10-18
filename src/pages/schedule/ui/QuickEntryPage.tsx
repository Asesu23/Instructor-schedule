import { useState } from 'react';
import { LessonItem, lessonEnd, useDayLessons } from '@/entities/lesson';
import type { Student } from '@/entities/student';
import { shiftDay, toDay, useNow } from '@/shared/lib';
import { DateField, ErrorBanner, Skeleton } from '@/shared/ui';
import { QuickEntry } from './QuickEntry';

export function QuickEntryPage({ students }: { students: Student[] | null }) {
  const now = useNow();
  const today = toDay(new Date(now));
  const [day, setDay] = useState(today);
  const { items, error, dismissError } = useDayLessons(day);

  const upcoming = items?.filter((l) => lessonEnd(l) > now) ?? [];

  const dayLabel = new Date(`${day}T00:00`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <section>
      <ErrorBanner message={error} onDismiss={dismissError} />
      <div className="daybar">
        <button disabled={day <= today} onClick={() => setDay(shiftDay(day, -1))}>
          ‹
        </button>
        <DateField value={day} min={today} onChange={(d) => setDay(d < today ? today : d)} />
        <button onClick={() => setDay(shiftDay(day, 1))}>›</button>
        <button onClick={() => setDay(today)}>Сегодня</button>
      </div>
      <h2 className="day">{dayLabel}</h2>
      {students ? <QuickEntry day={day} students={students} /> : <Skeleton rows={3} />}
      {upcoming.length > 0 && (
        <ul className="list">
          {upcoming.map((l) => (
            <LessonItem key={l.id} lesson={l} onSelect={() => undefined} />
          ))}
        </ul>
      )}
    </section>
  );
}
