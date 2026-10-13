import { useEffect } from 'react';
import { useIsRestoring } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { LoginPage } from '@/pages/login';
import { Spinner } from '@/shared/ui';
import { clearCache } from './providers/clearCache';
import { AppShell } from './ui/AppShell';

export function App() {
  const { status, signedIn } = useSession();
  const restoring = useIsRestoring();

  useEffect(() => {
    if (status === 'out' && !restoring) void clearCache();
  }, [status, restoring]);

  if (status === 'loading') return <Spinner />;
  if (status === 'out') return <LoginPage onDone={signedIn} />;
  return <AppShell />;
}
