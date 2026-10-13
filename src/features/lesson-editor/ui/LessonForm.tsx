import { useState, type FormEvent } from 'react';
import { lessonApi, type Lesson } from '@/entities/lesson';
import { StudentPicker, type Student } from '@/entities/student';
import { toDay, toTime, useFormAction } from '@/shared/lib';
import { DateField, FormModal, TimeField } from '@/shared/ui';

const DURATION_PRESETS = [30, 45, 60, 90, 120];

export function LessonForm({
  lesson,
  day,
  students,
  onClose,
  onSaved,
}: {
  lesson: Lesson | null;
  day: string;
  students: Student[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const start = lesson ? new Date(lesson.startAt) : null;
  const [studentId, setStudentId] = useState(lesson?.studentId ?? '');
  const [date, setDate] = useState(start ? toDay(start) : day);
  const [time, setTime] = useState(start ? toTime(start) : '10:00');
  const [duration, setDuration] = useState(String(lesson?.durationMin ?? 60));
  const [note, setNote] = useState(lesson?.note ?? '');
  const { error, run } = useFormAction(onSaved);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      studentId,
      startAt: new Date(`${date}T${time}`).toISOString(),
      durationMin: Number(duration),
      note,
    };
    run(() => (lesson ? lessonApi.update(lesson.id, body) : lessonApi.create(body)));
  };

  return (
    <FormModal onClose={onClose} onSubmit={save}>
      <h2>{lesson ? 'Занятие' : 'Новое занятие'}</h2>
      {students.length === 0 && <p className="error">Сначала добавьте ученика на вкладке «Ученики»</p>}
      <div className="field">
        <span>Ученик</span>
        <StudentPicker students={students} value={studentId} onChange={setStudentId} autoFocus={!lesson} />
      </div>
      <div className="field">
        <span>Дата</span>
        <DateField value={date} onChange={setDate} />
      </div>
      <div className="field">
        <span>Начало</span>
        <TimeField value={time} onChange={setTime} />
      </div>
      <div className="field">
        <span>Длительность, мин</span>
        <input
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          value={duration}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDuration(e.target.value)}
          aria-label="Длительность, мин"
          required
        />
        <div className="chips">
          {DURATION_PRESETS.map((n) => (
            <button
              type="button"
              key={n}
              className={Number(duration) === n ? 'on' : ''}
              onClick={() => setDuration(String(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label>
        Заметка
        <input value={note} maxLength={500} placeholder="Заметка" onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" disabled={students.length === 0 || !studentId}>
          Сохранить
        </button>
        {lesson && (
          <button type="button" className="danger" onClick={() => run(() => lessonApi.remove(lesson.id))}>
            Удалить
          </button>
        )}
        <button type="button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </FormModal>
  );
}
