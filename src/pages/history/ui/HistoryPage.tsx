import { useState } from 'react';
import { LessonItem, groupByDay, useLessonHistory, type Lesson } from '@/entities/lesson';
import type { Student } from '@/entities/student';
import { LessonForm } from '@/features/lesson-editor';
import { toDay } from '@/shared/lib';
import { ErrorBanner, Skeleton } from '@/shared/ui';

export function HistoryPage({ students }: { students: Student[] | null }) {
  const [editing, setEditing] = useState<Lesson | null>(null);
  const { items, error, dismissError } = useLessonHistory();

  return (
    <section>
      <ErrorBanner message={error} onDismiss={dismissError} />
      {items === null ? (
        <Skeleton rows={4} />
      ) : items.length === 0 ? (
        <ul className="list">
          <li className="empty">Прошедших занятий нет</li>
        </ul>
      ) : (
        groupByDay(items).map(([key, list]) => (
          <div key={key}>
            <h2 className="day">
              {new Date(`${key}T00:00`).toLocaleDateString('ru-RU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <ul className="list">
              {list.map((l) => (
                <LessonItem key={l.id} lesson={l} onSelect={setEditing} />
              ))}
            </ul>
          </div>
        ))
      )}
      {editing && students && (
        <LessonForm
          lesson={editing}
          day={toDay(new Date(editing.startAt))}
          students={students}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </section>
  );
}
