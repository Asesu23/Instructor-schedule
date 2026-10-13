import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type Lesson, type Student } from './api';
import { shiftDay, toDay, toTime } from './dates';
import { DateField, TimeField } from './pickers';
import { StudentField } from './StudentField';

const endOf = (l: Lesson) => new Date(l.startAt).getTime() + l.durationMin * 60000;

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Нет связи с сервером');

function Skeleton({ rows }: { rows: number }) {
  return (
    <ul className="list" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="skeleton" />
      ))}
    </ul>
  );
}

export function App() {
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    api('/session').then(
      () => setAuth('in'),
      () => setAuth('out'),
    );
  }, []);

  if (auth === 'loading') return <div className="spinner" role="status" aria-label="Загрузка" />;
  if (auth === 'out') return <Login onDone={() => setAuth('in')} />;
  return <Main />;
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

function Main() {
  const [view, setView] = useState<'day' | 'students' | 'history'>('day');
  const [day, setDay] = useState(toDay(new Date()));
  const [lessons, setLessons] = useState<{ day: string; items: Lesson[] } | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const dayRef = useRef(day);
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null);
  const [error, setError] = useState('');

  const loadStudents = useCallback(
    () =>
      api<Student[]>('/students')
        .then(setStudents)
        .catch((e) => {
          setError(message(e));
          setStudents((prev) => prev ?? []);
        }),
    [],
  );

  const loadLessons = useCallback(() => {
    const from = new Date(`${day}T00:00`).toISOString();
    const to = new Date(`${shiftDay(day, 1)}T00:00`).toISOString();
    return api<Lesson[]>(`/lessons?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((items) => {
        if (dayRef.current === day) setLessons({ day, items });
      })
      .catch((e) => {
        setError(message(e));
        if (dayRef.current === day) setLessons((prev) => (prev?.day === day ? prev : { day, items: [] }));
      });
  }, [day]);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const current = lessons?.day === day ? lessons.items.filter((l) => endOf(l) > now) : null;

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
          <button className={view === 'history' ? 'on' : ''} onClick={() => setView('history')}>
            История
          </button>
        </nav>
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
            <DateField value={day} onChange={setDay} />
            <button onClick={() => setDay(shiftDay(day, 1))}>›</button>
            <button onClick={() => setDay(toDay(new Date()))}>Сегодня</button>
          </div>
          <h2 className="day">{dayLabel}</h2>
          {current === null ? (
            <Skeleton rows={3} />
          ) : (
            <ul className="list">
              {current.map((l) => {
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
              {current.length === 0 && <li className="empty">Занятий нет</li>}
            </ul>
          )}
          <button className="add" onClick={() => setEditing('new')}>
            + Занятие
          </button>
        </section>
      ) : view === 'students' ? (
        <Students students={students} reload={loadStudents} />
      ) : (
        <History students={students} />
      )}
      {editing && students && (
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

function History({ students }: { students: Student[] | null }) {
  const [items, setItems] = useState<Lesson[] | null>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const from = new Date('2000-01-01T00:00').toISOString();
    const to = new Date().toISOString();
    return api<Lesson[]>(`/lessons?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((rows) => setItems(rows.filter((l) => endOf(l) <= Date.now()).reverse()))
      .catch((e) => {
        setError(message(e));
        setItems((prev) => prev ?? []);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = new Map<string, Lesson[]>();
  for (const l of items ?? []) {
    const key = toDay(new Date(l.startAt));
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  return (
    <section>
      {error && (
        <p className="error" onClick={() => setError('')}>
          {error}
        </p>
      )}
      {items === null ? (
        <Skeleton rows={4} />
      ) : items.length === 0 ? (
        <ul className="list">
          <li className="empty">Прошедших занятий нет</li>
        </ul>
      ) : (
        [...groups].map(([key, list]) => (
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
              {list.map((l) => {
                const start = new Date(l.startAt);
                const end = new Date(endOf(l));
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
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
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
  const [studentId, setStudentId] = useState(lesson?.studentId ?? '');
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
        <div className="field">
          <span>Ученик</span>
          <StudentField students={students} value={studentId} onChange={setStudentId} autoFocus={!lesson} />
        </div>
        <div className="field">
          <span>Дата</span>
          <DateField value={date} onChange={setDate} />
        </div>
        <div className="field">
          <span>Начало</span>
          <TimeField value={time} onChange={setTime} />
        </div>
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
            placeholder="Заметка"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={students.length === 0 || !studentId}>
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

function Students({ students, reload }: { students: Student[] | null; reload: () => void }) {
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
            <li key={s.id} onClick={() => setEditing(s)}>
              <b>{s.name}</b>
              {s.note && <small>{s.note}</small>}
            </li>
          ))}
          {shown.length === 0 && <li className="empty">Никого нет</li>}
        </ul>
      )}
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
          Имя и фамилия
          <input
            value={name}
            maxLength={100}
            placeholder="Иван Иванов"
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Заметка
          <input
            value={note}
            maxLength={500}
            placeholder="Заметка"
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
