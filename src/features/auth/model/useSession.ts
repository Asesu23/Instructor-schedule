import { useEffect, useState } from 'react';
import { ApiError } from '@/shared/api';
import { authApi } from '../api/authApi';

export function useSession() {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    authApi.session().then(
      () => setStatus('in'),
      (error) => setStatus(error instanceof ApiError && error.status === 401 ? 'out' : 'in'),
    );
  }, []);

  return { status, signedIn: () => setStatus('in') };
}
