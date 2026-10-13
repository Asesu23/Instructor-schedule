import { useSession } from '@/features/auth';
import { LoginPage } from '@/pages/login';
import { Spinner } from '@/shared/ui';
import { AppShell } from './ui/AppShell';

export function App() {
  const { status, expired, signedIn } = useSession();

  if (status === 'loading') return <Spinner />;
  if (status === 'out') return <LoginPage onDone={signedIn} />;
  return (
    <>
      <AppShell />
      {expired && <LoginPage overlay onDone={signedIn} />}
    </>
  );
}
