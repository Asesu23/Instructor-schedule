import { useState } from 'react';
import { useLessonCache, type Lesson } from '@/entities/lesson';
import type { Student } from '@/entities/student';
import { useSaveLesson } from '@/features/lesson-editor';
import { useSaveStudent } from '@/features/student-editor';
import { api } from '@/shared/api';
import { errorMessage, newId, toTime, useOnline } from '@/shared/lib';
import { NEEDS_TIME, parseQuickEntry, type QuickLine } from '../model/parseQuickEntry';
import { useSpeech } from '../model/useSpeech';
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

const spokenLines = (phrase: string) =>
  phrase
    .split(/(?<=[.!?;])\s+|\n/)
    .map((line) => line.replace(/,/g, ' ').replace(/[.!?;]+$/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

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
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const online = useOnline();
  const cache = useLessonCache();
  const saveStudent = useSaveStudent();
  const saveLesson = useSaveLesson();
  const append = (items: string[]) => setText((current) => [current.trimEnd(), ...items].filter(Boolean).join('\n'));

  const understand = async (input: string) => {
    const reply = await api<{ lines: string[] }>('/understand', 'POST', {
      text: input,
      students: students.map((s) => s.name),
    });
    return reply.lines;
  };

  const speech = useSpeech(async (phrase) => {
    setThinking(true);
    try {
      const result = await understand(phrase);
      append(result.length ? result : spokenLines(phrase));
    } catch {
      append(spokenLines(phrase));
    } finally {
      setThinking(false);
    }
  });

  const parsed = parseQuickEntry(text, day, students, duration).map((line) => {
    const pick = line.options ? picks[line.raw] : undefined;
    if (!pick) return line;
    const student = line.options?.find((s) => s.id === pick);
    return { ...line, options: undefined, student, name: student?.name ?? line.name };
  });
  const lines = withOverlaps(parsed, cache.findOverlap);
  const ready = lines.filter((l) => !l.error && !l.options);
  const unclear = lines.filter((l) => l.error === NEEDS_TIME).map((l) => l.raw);

  const clarify = async () => {
    setThinking(true);
    setError('');
    try {
      const result = await understand(unclear.join('\n'));
      if (result.length === 0) {
        setError('Не получилось разобрать. Начните строку со времени, например 10:30 Иван');
      } else {
        setText((current) =>
          [
            ...current
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l && !unclear.includes(l)),
            ...result,
          ].join('\n'),
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setThinking(false);
    }
  };

  const submit = async () => {
    if (busy || thinking || ready.length === 0) return;
    speech.stop();
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
      setPicks({});
      setBusy(false);
    }
  };

  return (
    <div className="quick">
      <textarea
        value={text}
        rows={Math.min(8, Math.max(3, text.split('\n').length))}
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
                    {toTime(new Date(line.startAt!))} -{' '}
                    {toTime(new Date(new Date(line.startAt!).getTime() + line.durationMin! * 60000))}
                  </b>
                  <span>{line.name}</span>
                  {line.options && <em>какой именно?</em>}
                  {!line.student && !line.options && <em>новый</em>}
                  {line.note && <small>{line.note}</small>}
                  {line.options && (
                    <div className="chips">
                      {line.options.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="chip"
                          onClick={() => setPicks((p) => ({ ...p, [line.raw]: s.id }))}
                        >
                          {s.name}
                          {s.note && <small>{s.note}</small>}
                        </button>
                      ))}
                      <button type="button" className="chip" onClick={() => setPicks((p) => ({ ...p, [line.raw]: 'new' }))}>
                        + Новый
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {(error || speech.error) && <p className="error">{error || speech.error}</p>}
      {speech.status === 'recording' && <small>Говорите по одному занятию с паузой, затем нажмите «Стоп»</small>}
      <div className="row">
        <button className="add" disabled={!online || busy || thinking || ready.length === 0} onClick={() => void submit()}>
          {ready.length > 1 ? `Записать (${ready.length})` : 'Записать'}
        </button>
        {speech.supported && (
          <button
            type="button"
            className={speech.status === 'recording' ? 'on' : ''}
            disabled={!online || thinking || speech.status === 'sending'}
            onClick={speech.toggle}
          >
            {speech.status === 'recording'
              ? 'Стоп'
              : speech.status === 'sending'
                ? 'Распознаю...'
                : thinking
                  ? 'Разбираю...'
                  : 'Голос'}
          </button>
        )}
        {unclear.length > 0 && (
          <button type="button" disabled={!online || thinking} onClick={() => void clarify()}>
            Разобрать
          </button>
        )}
      </div>
    </div>
  );
}
