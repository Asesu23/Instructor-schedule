import { LoginForm } from '@/features/auth';

export function LoginPage({ onDone, overlay = false }: { onDone: () => void; overlay?: boolean }) {
  if (!overlay) return <LoginForm onDone={onDone} />;
  return (
    <div className="modal">
      <LoginForm onDone={onDone} hint="Сессия истекла. Данные сохранены и будут отправлены после входа." />
    </div>
  );
}
