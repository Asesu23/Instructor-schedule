import { isConnectionError } from './errors';
import { useOnline } from './useOnline';

export function useStaleData(query: { data: unknown; error: unknown }) {
  const online = useOnline();
  return query.data !== undefined && (!online || (query.error != null && isConnectionError(query.error)));
}
