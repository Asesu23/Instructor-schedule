import { useState } from 'react';
import { useStudents } from '@/entities/student';
import { ThemeToggle } from '@/features/theme-toggle';
import { HistoryPage } from '@/pages/history';
import { SchedulePage } from '@/pages/schedule';
import { StudentsPage } from '@/pages/students';
import { useOnline } from '@/shared/lib';
import { ErrorBanner, StaleBanner } from '@/shared/ui';

type View = 'day' | 'students' | 'history';

const TABS: { id: View; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'students', label: 'Ученики' },
  { id: 'history', label: 'История' },
];

export function AppShell() {
  const [view, setView] = useState<View>('day');
  const { students, error, dismissError, stale } = useStudents();
  const online = useOnline();

  return (
    <div className="app">
      <header>
        <nav>
          {TABS.map((tab) => (
            <button key={tab.id} className={view === tab.id ? 'on' : ''} onClick={() => setView(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>
        <ThemeToggle />
      </header>
      {!online && <p className="error">Нет связи</p>}
      <ErrorBanner message={error} onDismiss={dismissError} />
      {view === 'students' && <StaleBanner visible={stale} />}
      {view === 'day' && <SchedulePage students={students} />}
      {view === 'students' && <StudentsPage students={students} />}
      {view === 'history' && <HistoryPage students={students} />}
    </div>
  );
}
