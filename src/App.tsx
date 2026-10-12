import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Lesson, type Student } from './api';

const pad = (n: number) => String(n).padStart(2, '0');
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const shiftDay = (day: string, delta: number) => {
  const d = new Date(`${day}T00:00`);
  d.setDate(d.getDate() + delta);
  return toDay(d);
};
const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Нет связи с сервером');

export function App() {
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    api('/session').then(
      () => setAuth('in'),
      () => setAuth('out'),
    );
  }, []);

  if (auth === 'loading') return <p className="center">Загрузка...</p>;
  if (auth === 'out') return <Login onDone={() => setAuth('in')} />;
  return <Main onLogout={() => setAuth('out')} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/login', 'POST', { password });
      onDone();
    } catch (err) {
      setError(message(err));
    }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Расписание</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        autoComplete="current-password"
        autoFocus
        required
      />
      {error && <p className="error">{error}</p>}
      <button type="submit">Войти</button>
    </form>
  );
}

function Main({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<'day' | 'students'>('day');
  const [day, setDay] = useState(toDay(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null);
  const [error, setError] = useState('');

  const loadStudents = useCallback(
    () =>
      api<Student[]>('/students')
        .then(setStudents)
        .catch((e) => setError(message(e))),
    [],
  );

  const loadLessons = useCallback(() => {
    const from = new Date(`${day}T00:00`).toISOString();
    const to = new Date(`${shiftDay(day, 1)}T00:00`).toISOString();
    return api<Lesson[]>(`/lessons?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(setLessons)
      .catch((e) => setError(message(e)));
  }, [day]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const logout = async () => {
    await api('/logout', 'POST').catch(() => undefined);
    onLogout();
  };

  const exportData = async () => {
    const data = await api('/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${toDay(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dayLabel = new Date(`${day}T00:00`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="app">
      <header>
        <nav>
          <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>
            День
          </button>
          <button className={view === 'students' ? 'on' : ''} onClick={() => setView('students')}>
            Ученики
          </button>
        </nav>
        <div className="tools">
          <button onClick={() => exportData().catch((e) => setError(message(e)))}>Экспорт</button>
          <button onClick={logout}>Выход</button>
        </div>
      </header>
      {error && (
        <p className="error" onClick={() => setError('')}>
          {error}
        </p>
      )}
      {view === 'day' ? (
        <section>
          <div className="daybar">
            <button onClick={() => setDay(shiftDay(day, -1))}>‹</button>
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
            <button onClick={() => setDay(shiftDay(day, 1))}>›</button>
            <button onClick={() => setDay(toDay(new Date()))}>Сегодня</button>
          </div>
          <h2>{dayLabel}</h2>
          <ul className="list">
            {lessons.map((l) => {
              const start = new Date(l.startAt);
              const end = new Date(start.getTime() + l.durationMin * 60000);
              return (
                <li key={l.id} onClick={() => setEditing(l)}>
                  <b>
                    {toTime(start)} - {toTime(end)}
                  </b>
                  <span>{l.studentName}</span>
                  {l.note && <small>{l.note}</small>}
                </li>
              );
            })}
            {lessons.length === 0 && <li className="empty">Занятий нет</li>}
          </ul>
          <button className="add" onClick={() => setEditing('new')}>
            + Занятие
          </button>
        </section>
      ) : (
        <Students students={students} reload={loadStudents} />
      )}
      {editing && (
        <LessonForm
          lesson={editing === 'new' ? null : editing}
          day={day}
          students={students}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadLessons();
          }}
        />
      )}
    </div>
  );
}

function LessonForm({
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
  const [studentId, setStudentId] = useState(lesson?.studentId ?? students[0]?.id ?? '');
  const [date, setDate] = useState(start ? toDay(start) : day);
  const [time, setTime] = useState(start ? toTime(start) : '10:00');
  const [duration, setDuration] = useState(String(lesson?.durationMin ?? 60));
  const [note, setNote] = useState(lesson?.note ?? '');
  const [error, setError] = useState('');

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(message(err));
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      studentId,
      startAt: new Date(`${date}T${time}`).toISOString(),
      durationMin: Number(duration),
      note,
    };
    run(() => (lesson ? api(`/lessons/${lesson.id}`, 'PUT', body) : api('/lessons', 'POST', body)));
  };

  return (
    <div className="modal" onClick={onClose}>
      <form className="card" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{lesson ? 'Занятие' : 'Новое занятие'}</h2>
        {students.length === 0 && <p className="error">Сначала добавьте ученика на вкладке «Ученики»</p>}
        <label>
          Ученик
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дата
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Начало
          <input type="time" step={60} value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          Длительность, мин
          <input
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />
        </label>
        <label>
          Заметка
          <input
            value={note}
            maxLength={500}
            placeholder="Без фамилий, телефонов и адресов"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={students.length === 0}>
            Сохранить
          </button>
          {lesson && (
            <button type="button" className="danger" onClick={() => run(() => api(`/lessons/${lesson.id}`, 'DELETE'))}>
              Удалить
            </button>
          )}
          <button type="button" onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

function Students({ students, reload }: { students: Student[]; reload: () => void }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Student | 'new' | null>(null);
  const needle = query.trim().toLowerCase();
  const shown = students.filter((s) => s.name.toLowerCase().includes(needle));

  return (
    <section>
      <div className="stack">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени" />
        <button className="add" onClick={() => setEditing('new')}>
          + Ученик
        </button>
      </div>
      <ul className="list">
        {shown.map((s) => (
          <li key={s.id} onClick={() => setEditing(s)}>
            <b>{s.name}</b>
            {s.note && <small>{s.note}</small>}
          </li>
        ))}
        {shown.length === 0 && <li className="empty">Никого нет</li>}
      </ul>
      {editing && (
        <StudentForm
          student={editing === 'new' ? null : editing}
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

function StudentForm({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(student?.name ?? '');
  const [note, setNote] = useState(student?.note ?? '');
  const [error, setError] = useState('');

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(message(err));
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const body = { name, note };
    run(() => (student ? api(`/students/${student.id}`, 'PUT', body) : api('/students', 'POST', body)));
  };

  return (
    <div className="modal" onClick={onClose}>
      <form className="card" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{student ? 'Ученик' : 'Новый ученик'}</h2>
        <label>
          Имя или ник
          <input
            value={name}
            maxLength={100}
            placeholder="Без фамилии"
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Заметка
          <input
            value={note}
            maxLength={500}
            placeholder="Без телефонов и адресов"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit">Сохранить</button>
          {student && (
            <button type="button" className="danger" onClick={() => run(() => api(`/students/${student.id}`, 'DELETE'))}>
              Удалить
            </button>
          )}
          <button type="button" onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
