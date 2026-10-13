import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';

const MAX_RETRIES = 2;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < MAX_RETRIES,
    },
    mutations: {
      retry: false,
    },
  },
});
