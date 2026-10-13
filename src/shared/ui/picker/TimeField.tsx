import { useEffect, useState } from 'react';
import { pad } from '@/shared/lib';
import { isTouch } from './device';
import { Pop, useDismiss } from './popover';

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => pad(i * 5));

const parseTime = (text: string) => {
  const value = text.trim();
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value) ?? /^(\d{1,2})(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
};

export function TimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [touch] = useState(isTouch);
  const [draft, setDraft] = useState(value);
  const { open, setOpen, ref } = useDismiss();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (touch) {
    return (
      <div className="picker native">
        <span className="picker-face">{value}</span>
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
