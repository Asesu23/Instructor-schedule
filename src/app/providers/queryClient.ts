import { QueryClient, onlineManager } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { CACHE_MAX_AGE_MS } from './persistence';

const MAX_RETRIES = 2;

onlineManager.setOnline(navigator.onLine);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE_MS,
      networkMode: 'always',
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        onlineManager.isOnline() && !(error instanceof ApiError && error.status < 500) && failureCount < MAX_RETRIES,
    },
    mutations: {
      networkMode: 'always',
      retry: false,
    },
  },
});
