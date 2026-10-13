import { useState } from 'react';
import { errorMessage } from './errors';

export function useFormAction(onSuccess: () => void) {
  const [error, setError] = useState('');

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return { error, run };
}
