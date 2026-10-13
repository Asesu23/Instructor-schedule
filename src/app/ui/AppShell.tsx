import { useState } from 'react';
import { useStudents } from '@/entities/student';
import { HistoryPage } from '@/pages/history';
import { SchedulePage } from '@/pages/schedule';
import { StudentsPage } from '@/pages/students';
import { ErrorBanner, StaleBanner, SyncFailures, SyncStatus } from '@/shared/ui';

type View = 'day' | 'students' | 'history';

const TABS: { id: View; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'students', label: 'Ученики' },
  { id: 'history', label: 'История' },
];

export function AppShell() {
  const [view, setView] = useState<View>('day');
  const { students, error, dismissError, stale } = useStudents();

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
      </header>
      <SyncStatus />
      <SyncFailures />
      <ErrorBanner message={error} onDismiss={dismissError} />
      {view === 'students' && <StaleBanner visible={stale} />}
      {view === 'day' && <SchedulePage students={students} />}
      {view === 'students' && <StudentsPage students={students} />}
      {view === 'history' && <HistoryPage students={students} />}
    </div>
  );
}
