import { useState, type FormEvent } from 'react';
import { errorMessage } from '@/shared/lib';
import { authApi } from '../api/authApi';

export function LoginForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await authApi.login(password);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Расписание</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        autoComplete="current-password"
        autoFocus
        required
      />
      {error && <p className="error">{error}</p>}
      <button type="submit">Войти</button>
    </form>
  );
}
