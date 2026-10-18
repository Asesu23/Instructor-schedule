import { useState } from 'react';
import { useLessonCache, type Lesson } from '@/entities/lesson';
import type { Student } from '@/entities/student';
import { useSaveLesson } from '@/features/lesson-editor';
import { useSaveStudent } from '@/features/student-editor';
import { errorMessage, newId, toTime, useOnline } from '@/shared/lib';
import { parseQuickEntry, type QuickLine } from '../model/parseQuickEntry';
import './quick-entry.css';

const STORAGE_KEY = 'quick-entry-duration';

const savedDuration = () => {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return value >= 5 && value <= 480 ? value : 60;
  } catch {
    return 60;
  }
};

const rememberDuration = (value: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    return;
  }
};

const withOverlaps = (lines: QuickLine[], known: (startAt: string, durationMin: number) => Lesson | undefined) => {
  const taken: { start: number; end: number }[] = [];
  return lines.map((line) => {
    if (line.error) return line;
    const start = new Date(line.startAt!).getTime();
    const end = start + line.durationMin! * 60000;
    const lesson = known(line.startAt!, line.durationMin!);
    if (lesson) return { ...line, error: `Пересекается: ${toTime(new Date(lesson.startAt))} ${lesson.studentName}` };
    if (taken.some((t) => t.start < end && t.end > start)) return { ...line, error: 'Пересекается с другой строкой' };
    taken.push({ start, end });
    return line;
  });
};

export function QuickEntry({ day, students }: { day: string; students: Student[] }) {
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(savedDuration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const online = useOnline();
  const cache = useLessonCache();
  const saveStudent = useSaveStudent();
  const saveLesson = useSaveLesson();

  const lines = withOverlaps(parseQuickEntry(text, day, students, duration), cache.findOverlap);
  const ready = lines.filter((l) => !l.error);

  const submit = async () => {
    if (busy || ready.length === 0) return;
    setBusy(true);
    setError('');
    const created = new Map<string, string>();
    const done = new Set<string>();
    try {
      for (const line of ready) {
        const key = line.name!.toLowerCase();
        let studentId = line.student?.id ?? created.get(key);
        if (!studentId) {
          studentId = newId();
          await saveStudent.mutateAsync({ id: studentId, isNew: true, body: { name: line.name!, note: '' } });
          created.set(key, studentId);
        }
        saveLesson.mutate({
          id: newId(),
          isNew: true,
          body: { studentId, startAt: line.startAt!, durationMin: line.durationMin!, note: line.note ?? '' },
        });
        done.add(line.raw);
        rememberDuration(line.durationMin!);
        setDuration(line.durationMin!);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setText(
        text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !done.has(l))
          .join('\n'),
      );
      setBusy(false);
    }
  };

  return (
    <div className="quick">
      <textarea
        value={text}
        rows={Math.min(8, Math.max(2, text.split('\n').length))}
        placeholder={'10 Иван\n11:30 Оля 90\n13 Петя 1.5ч, парковка'}
        aria-label="Быстрая запись"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void submit();
        }}
      />
      {lines.length > 0 && (
        <ul>
          {lines.map((line, i) => (
            <li key={i} className={line.error ? 'bad' : undefined}>
              {line.error ? (
                <>
                  <span>{line.raw}</span>
                  <small>{line.error}</small>
                </>
              ) : (
                <>
                  <b>
                    {toTime(new Date(line.startAt!))} - {toTime(new Date(new Date(line.startAt!).getTime() + line.durationMin! * 60000))}
                  </b>
                  <span>{line.name}</span>
                  {!line.student && <em>новый</em>}
                  {line.note && <small>{line.note}</small>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
      <button className="add" disabled={!online || busy || ready.length === 0} onClick={() => void submit()}>
        {ready.length > 1 ? `Записать (${ready.length})` : 'Записать'}
      </button>
    </div>
  );
}
