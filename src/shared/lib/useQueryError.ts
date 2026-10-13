import { useState } from 'react';
import { errorMessage } from './errors';

export function useQueryError(query: { error: unknown; errorUpdatedAt: number }) {
  const [dismissedAt, setDismissedAt] = useState(0);
  const error = query.error && query.errorUpdatedAt > dismissedAt ? errorMessage(query.error) : '';

  return { error, dismissError: () => setDismissedAt(query.errorUpdatedAt) };
}
