import { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { lessonApi, lessonKeys, useLessonCache, type Lesson } from '@/entities/lesson';
import type { Student } from '@/entities/student';
import { useSaveLesson } from '@/features/lesson-editor';
import { useSaveStudent } from '@/features/student-editor';
import { api } from '@/shared/api';
import { errorMessage, hasPendingWrites, newId, shiftDay, toDay, toTime, useOnline } from '@/shared/lib';
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

const dayLabel = (value: string) =>
  new Date(`${value}T00:00`).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'numeric' });

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
  const [changing, setChanging] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const online = useOnline();
  const cache = useLessonCache();
  const saveStudent = useSaveStudent();
  const saveLesson = useSaveLesson();
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const today = toDay(new Date());

  const append = (items: string[]) => setText((current) => [current.trimEnd(), ...items].filter(Boolean).join('\n'));

  const understand = async (input: string) => {
    const reply = await api<{ lines: string[] }>('/understand', 'POST', {
      text: input,
      today,
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

  const parsedRaw = parseQuickEntry(text, day, students, duration);
  const days = [...new Set(parsedRaw.flatMap((l) => (l.day ? [l.day] : [])))];

  useQueries({
    queries: days.map((d) => ({
      queryKey: lessonKeys.day(d),
      queryFn: () => {
        const cached = client.getQueryData<Lesson[]>(lessonKeys.day(d));
        if (cached && hasPendingWrites(client)) return cached;
        return lessonApi.range(new Date(`${d}T00:00`).toISOString(), new Date(`${shiftDay(d, 1)}T00:00`).toISOString());
      },
    })),
  });

  const parsed = parsedRaw.map((line) => {
    const pick = picks[line.raw];
    if (!pick || line.error) return line;
    if (pick === 'new') return { ...line, options: undefined, student: undefined, name: line.typed ?? line.name };
    const student = students.find((s) => s.id === pick);
    return student ? { ...line, options: undefined, student, name: student.name } : line;
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
      const skipped = lines.filter((l) => l.error && l.day && done.has(l.raw));
      if (skipped.length > 0) {
        setError(`Не записано: ${skipped.map((l) => `${dayLabel(l.day!)} (${l.error})`).join(', ')}`);
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
      setChanging('');
      setBusy(false);
    }
  };

  const seen = new Set<string>();

  return (
    <div className="quick">
      <textarea
        value={text}
        rows={Math.min(8, Math.max(3, text.split('\n').length))}
        placeholder={'10 Иван\n11:30 Оля 90\nв понедельник и среду в 18:00 Петя 1.5ч'}
        aria-label="Быстрая запись"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void submit();
        }}
      />
      {lines.length > 0 && (
        <ul>
          {lines.map((line, i) => {
            const first = !seen.has(line.raw);
            seen.add(line.raw);
            const showChooser = first && !line.error && (line.options || !line.student || changing === line.raw);
            return (
              <li key={i} className={line.error ? 'bad' : undefined}>
                {line.error ? (
                  <>
                    <span>{line.raw}</span>
                    <small>{line.error}</small>
                  </>
                ) : (
                  <>
                    <b>
                      {line.day !== day && <span className="when">{dayLabel(line.day!)}</span>}
                      {toTime(new Date(line.startAt!))} -{' '}
                      {toTime(new Date(new Date(line.startAt!).getTime() + line.durationMin! * 60000))}
                    </b>
                    <span>{line.name}</span>
                    {line.options && <em>какой именно?</em>}
                    {!line.student && !line.options && <em>новый</em>}
                    {line.note && <small>{line.note}</small>}
                    {first && line.student && changing !== line.raw && (
                      <button type="button" className="chip" onClick={() => setChanging(line.raw)}>
                        Другой
                      </button>
                    )}
                    {showChooser && (
                      <div className="chips">
                        {line.options?.map((s) => (
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
                        <select
                          className="pick"
                          value=""
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) setPicks((p) => ({ ...p, [line.raw]: value }));
                            setChanging('');
                          }}
                        >
                          <option value="">Другой ученик...</option>
                          {sorted.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.note ? `${s.name} (${s.note})` : s.name}
                            </option>
                          ))}
                          <option value="new">+ Новый ученик</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(error || speech.error) && <p className="error">{error || speech.error}</p>}
      {speech.status === 'recording' && <small>Говорите, запись остановится сама после паузы</small>}
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
