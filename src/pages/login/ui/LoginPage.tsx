import { LoginForm } from '@/features/auth';

export function LoginPage({ onDone }: { onDone: () => void }) {
  return <LoginForm onDone={onDone} />;
}
