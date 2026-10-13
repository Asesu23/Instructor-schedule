import { useState } from 'react';
import { errorMessage, isConnectionError } from './errors';

export function useQueryError(query: { data: unknown; error: unknown; errorUpdatedAt: number }) {
  const [dismissedAt, setDismissedAt] = useState(0);
  const hasCachedData = query.data !== undefined && isConnectionError(query.error);
  const error = query.error && !hasCachedData && query.errorUpdatedAt > dismissedAt ? errorMessage(query.error) : '';

  return { error, dismissError: () => setDismissedAt(query.errorUpdatedAt) };
}
