import { del, get, set } from 'idb-keyval';
import type { Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { lessonKeys } from '@/entities/lesson';
import { studentKeys } from '@/entities/student';

export const CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
export const CACHE_BUSTER = 'v1';

const STORAGE_KEY = 'instructor-schedule-query-cache';
const WRITE_THROTTLE_MS = 1000;
const PERSISTED_ROOTS: ReadonlySet<unknown> = new Set([lessonKeys.all[0], studentKeys.all[0]]);

export const shouldPersistQuery = (query: Query) =>
  query.state.status === 'success' && PERSISTED_ROOTS.has(query.queryKey[0]);

function createIdbPersister(): Persister {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PersistedClient | undefined;

  const flush = () => {
    const client = pending;
    timer = undefined;
    pending = undefined;
    if (client) set(STORAGE_KEY, client).catch(() => undefined);
  };

  return {
    persistClient: (client) => {
      pending = client;
      timer ??= setTimeout(flush, WRITE_THROTTLE_MS);
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(STORAGE_KEY);
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      try {
        await del(STORAGE_KEY);
      } catch {
        return;
      }
    },
  };
}

export const persister = createIdbPersister();
