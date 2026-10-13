import { useState } from 'react';
import { parseDay, toDay } from '@/shared/lib';
import { isTouch } from './device';
import { Pop, useDismiss } from './popover';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const formatDay = (day: string) =>
  parseDay(day).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export function DateField({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  const [touch] = useState(isTouch);
  const [month, setMonth] = useState(() => {
    const d = parseDay(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const { open, setOpen, ref } = useDismiss();

  if (touch) {
    return (
      <div className="picker native">
        <span className="picker-face">{formatDay(value)}</span>
        <input type="date" min={min} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} required />
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
        {formatDay(value)}
      </button>
      {open && (
        <Pop anchor={ref}>
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
                <button
                  type="button"
                  key={day}
                  className={classes}
                  disabled={min !== undefined && day < min}
                  onClick={() => pick(day)}
                >
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
        </Pop>
      )}
    </div>
  );
}
