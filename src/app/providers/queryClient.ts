import { MutationCache, QueryClient, onlineManager } from '@tanstack/react-query';
import { registerLessonMutations } from '@/features/lesson-editor';
import { registerStudentMutations } from '@/features/student-editor';
import { ApiError, startNetworkMonitor } from '@/shared/api';
import { errorMessage, reportSyncFailure } from '@/shared/lib';
import { CACHE_MAX_AGE_MS } from './persistence';

const MAX_RETRIES = 2;
const MAX_SERVER_RETRIES = 5;
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 60_000;

const retryDelay = (failureCount: number) =>
  Math.min(RETRY_BASE_MS * 2 ** failureCount, RETRY_CAP_MS) + Math.random() * RETRY_BASE_MS;

const retryWrite = (failureCount: number, error: unknown) =>
  error instanceof ApiError ? error.status >= 500 && failureCount < MAX_SERVER_RETRIES : true;

const retryRead = (failureCount: number, error: unknown) =>
  onlineManager.isOnline() && !(error instanceof ApiError && error.status < 500) && failureCount < MAX_RETRIES;

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => reportSyncFailure(`Не удалось отправить изменение: ${errorMessage(error)}`),
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: CACHE_MAX_AGE_MS,
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: true,
      retry: retryRead,
      retryDelay,
    },
    mutations: {
      networkMode: 'online',
      gcTime: CACHE_MAX_AGE_MS,
      retry: retryWrite,
      retryDelay,
    },
  },
});

registerLessonMutations(queryClient);
registerStudentMutations(queryClient);
startNetworkMonitor();
