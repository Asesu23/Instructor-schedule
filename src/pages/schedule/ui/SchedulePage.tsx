import { useState } from 'react';
import { LessonItem, lessonEnd, useDayLessons, type Lesson } from '@/entities/lesson';
import type { Student } from '@/entities/student';
import { LessonForm } from '@/features/lesson-editor';
import { shiftDay, toDay, useNow } from '@/shared/lib';
import { DateField, ErrorBanner, Skeleton } from '@/shared/ui';

export function SchedulePage({ students }: { students: Student[] | null }) {
  const now = useNow();
  const today = toDay(new Date(now));
  const [day, setDay] = useState(today);
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null);
  const { items, error, dismissError, reload } = useDayLessons(day);

  const upcoming = items?.filter((l) => lessonEnd(l) > now) ?? null;

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
      {upcoming === null ? (
        <Skeleton rows={3} />
      ) : (
        <ul className="list">
          {upcoming.map((l) => (
            <LessonItem key={l.id} lesson={l} onSelect={setEditing} />
          ))}
          {upcoming.length === 0 && <li className="empty">Занятий нет</li>}
        </ul>
      )}
      <button className="add" onClick={() => setEditing('new')}>
        + Занятие
      </button>
      {editing && students && (
        <LessonForm
          lesson={editing === 'new' ? null : editing}
          day={day}
          students={students}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </section>
  );
}
