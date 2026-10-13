import { useState } from 'react';
import { StudentItem, type Student } from '@/entities/student';
import { StudentForm } from '@/features/student-editor';
import { Skeleton } from '@/shared/ui';

export function StudentsPage({ students }: { students: Student[] | null }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Student | 'new' | null>(null);
  const needle = query.trim().toLowerCase();
  const shown = (students ?? []).filter((s) => s.name.toLowerCase().includes(needle));

  return (
    <section>
      <div className="stack">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени" />
        <button className="add" onClick={() => setEditing('new')}>
          + Ученик
        </button>
      </div>
      {students === null ? (
        <Skeleton rows={4} />
      ) : (
        <ul className="list">
          {shown.map((s) => (
            <StudentItem key={s.id} student={s} onSelect={setEditing} />
          ))}
          {shown.length === 0 && <li className="empty">Никого нет</li>}
        </ul>
      )}
      {editing && (
        <StudentForm
          student={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </section>
  );
}
