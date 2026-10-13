import { useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError, isSessionExpired, markAuthorized, subscribeSession } from '@/shared/api';
import { authApi } from '../api/authApi';

const CHECK_TIMEOUT_MS = 3000;

export function useSession() {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading');
  const expired = useSyncExternalStore(subscribeSession, isSessionExpired);

  useEffect(() => {
    const timer = setTimeout(() => setStatus((current) => (current === 'loading' ? 'in' : current)), CHECK_TIMEOUT_MS);
    authApi.session().then(
      () => setStatus('in'),
      (error) => setStatus(error instanceof ApiError && error.status === 401 ? 'out' : 'in'),
    );
    return () => clearTimeout(timer);
  }, []);

  return {
    status,
    expired,
    signedIn: () => {
      setStatus('in');
      markAuthorized();
    },
  };
}
