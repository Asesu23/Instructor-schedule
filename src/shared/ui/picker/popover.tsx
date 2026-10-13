import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

export function useDismiss() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

export function Pop({
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
