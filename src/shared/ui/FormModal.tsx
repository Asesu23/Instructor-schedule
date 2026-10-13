import type { FormEvent, ReactNode } from 'react';

export function FormModal({
  onClose,
  onSubmit,
  children,
}: {
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <div className="modal" onClick={onClose}>
      <form className="card" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        {children}
      </form>
    </div>
  );
}
