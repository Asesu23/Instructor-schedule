import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Student } from './api';

export function StudentField({
  students,
  value,
  onChange,
  autoFocus,
}: {
  students: Student[];
  value: string;
  onChange: (id: string) => void;
  autoFocus?: boolean;
}) {
  const selected = students.find((s) => s.id === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = students.filter((s) => {
    const name = s.name.toLowerCase();
    return tokens.every((token) => name.includes(token));
  });

  useEffect(() => {
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (student: Student) => {
    onChange(student.id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="combo">
      <input
        ref={inputRef}
        className={selected ? 'filled' : ''}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        placeholder={selected?.name ?? 'Найти ученика'}
        onFocus={() => {
          setQuery('');
          setActive(Math.max(0, students.findIndex((s) => s.id === value)));
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="combo-list" ref={listRef} role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {shown.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={s.id === value}
              className={`${i === active ? 'active' : ''} ${s.id === value ? 'sel' : ''}`.trim()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
            >
              {s.name}
              {s.note && <small>{s.note}</small>}
            </li>
          ))}
          {shown.length === 0 && <li className="empty">Никого не найдено</li>}
        </ul>
      )}
    </div>
  );
}
