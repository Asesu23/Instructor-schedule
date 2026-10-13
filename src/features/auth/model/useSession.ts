import { useEffect, useState } from 'react';
import { authApi } from '../api/authApi';

export function useSession() {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    authApi.session().then(
      () => setStatus('in'),
      () => setStatus('out'),
    );
  }, []);

  return { status, signedIn: () => setStatus('in') };
}
