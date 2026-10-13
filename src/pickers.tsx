import { useEffect, useRef, useState } from 'react';
import { pad, parseDay, toDay } from './dates';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));

const isTouch = () => !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [touch] = useState(isTouch);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = parseDay(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (touch) {
    return (
      <div className="picker">
        <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} required />
      </div>
    );
  }

  const year = month.getFullYear();
  const index = month.getMonth();
  const offset = (new Date(year, index, 1).getDay() + 6) % 7;
  const count = new Date(year, index + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
  const today = toDay(new Date());

  const toggle = () => {
    if (!open) {
      const d = parseDay(value);
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    setOpen(!open);
  };

  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };

  return (
    <div className="picker" ref={ref}>
      <button type="button" className="picker-btn" onClick={toggle}>
        {parseDay(value).toLocaleDateString('ru-RU', {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </button>
      {open && (
        <div className="pop">
          <div className="cal-head">
            <button type="button" onClick={() => setMonth(new Date(year, index - 1, 1))}>
              ‹
            </button>
            <b>{month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</b>
            <button type="button" onClick={() => setMonth(new Date(year, index + 1, 1))}>
              ›
            </button>
          </div>
          <div className="cal-grid">
            {WEEK.map((name) => (
              <span key={name}>{name}</span>
            ))}
            {cells.map((n, i) => {
              if (n === null) return <span key={`gap-${i}`} />;
              const day = toDay(new Date(year, index, n));
              const classes = [day === value ? 'sel' : '', day === today ? 'today' : ''].join(' ').trim();
              return (
                <button type="button" key={day} className={classes} onClick={() => pick(day)}>
                  {n}
                </button>
              );
            })}
          </div>
          <div className="cal-foot">
            <button type="button" onClick={() => pick(today)}>
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [touch] = useState(isTouch);
  const [hour = '00', minute = '00'] = value.split(':');

  if (touch) {
    return (
      <div className="picker">
        <input type="time" step={60} value={value} onChange={(e) => onChange(e.target.value)} required />
      </div>
    );
  }

  return (
    <div className="time">
      <select value={hour} onChange={(e) => onChange(`${e.target.value}:${minute}`)} aria-label="Часы">
        {HOURS.map((h) => (
          <option key={h}>{h}</option>
        ))}
      </select>
      <span>:</span>
      <select value={minute} onChange={(e) => onChange(`${hour}:${e.target.value}`)} aria-label="Минуты">
        {MINUTES.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
