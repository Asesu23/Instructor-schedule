import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { pad, parseDay, toDay } from './dates';

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => pad(i * 5));

const isTouch = () => !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const parseTime = (text: string) => {
  const value = text.trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value) ?? /^(\d{1,2})(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
};

function useDismiss() {
  const [open, setOpen] = useState(false);
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

  return { open, setOpen, ref };
}

function Pop({
  anchor,
  className,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    const place = () => {
      const trigger = anchor.current?.getBoundingClientRect();
      const pop = ref.current;
      if (!trigger || !pop) return;
      const margin = 8;
      const gap = 4;
      const below = window.innerHeight - trigger.bottom - margin - gap;
      const above = trigger.top - margin - gap;
      const up = pop.scrollHeight + 2 > below && above > below;
      const left = Math.max(margin, Math.min(trigger.left, window.innerWidth - pop.offsetWidth - margin));
      setStyle(
        up
          ? { left, bottom: window.innerHeight - trigger.top + gap, maxHeight: above }
          : { left, top: trigger.bottom + gap, maxHeight: below },
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  return (
    <div
      ref={ref}
      className={`pop ${className ?? ''}`.trim()}
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [touch] = useState(isTouch);
  const [month, setMonth] = useState(() => {
    const d = parseDay(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const { open, setOpen, ref } = useDismiss();

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
        </Pop>
      )}
    </div>
  );
}

export function TimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [touch] = useState(isTouch);
  const [draft, setDraft] = useState(value);
  const { open, setOpen, ref } = useDismiss();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (touch) {
    return (
      <div className="picker">
        <input type="time" step={60} value={value} onChange={(e) => onChange(e.target.value)} required />
      </div>
    );
  }

  const [hour = '00', minute = '00'] = value.split(':');

  const commit = () => {
    const parsed = parseTime(draft);
    if (parsed) {
      onChange(parsed);
      setDraft(parsed);
    } else {
      setDraft(value);
    }
  };

  return (
    <div className="picker" ref={ref}>
      <input
        value={draft}
        inputMode="numeric"
        placeholder="ЧЧ:ММ"
        maxLength={5}
        autoComplete="off"
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          commit();
          if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          commit();
          setOpen(false);
        }}
      />
      {open && (
        <Pop anchor={ref}>
          <div className="time-label">Часы</div>
          <div className="time-grid">
            {HOURS.map((h) => (
              <button
                type="button"
                key={h}
                className={h === hour ? 'sel' : ''}
                onClick={() => onChange(`${h}:${minute}`)}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="time-label">Минуты</div>
          <div className="time-grid">
            {MINUTE_STEPS.map((m) => (
              <button
                type="button"
                key={m}
                className={m === minute ? 'sel' : ''}
                onClick={() => {
                  onChange(`${hour}:${m}`);
                  setOpen(false);
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </Pop>
      )}
    </div>
  );
}
