import { del, get, set } from 'idb-keyval';
import type { Mutation, Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { lessonKeys } from '@/entities/lesson';
import { studentKeys } from '@/entities/student';

export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const CACHE_BUSTER = 'v2';

const STORAGE_KEY = 'instructor-schedule-query-cache';
const WRITE_THROTTLE_MS = 1000;
const PERSISTED_ROOTS: ReadonlySet<unknown> = new Set([lessonKeys.all[0], studentKeys.all[0]]);

export const shouldPersistQuery = (query: Query) =>
  query.state.status === 'success' && PERSISTED_ROOTS.has(query.queryKey[0]);

export const shouldPersistMutation = (mutation: Mutation) => mutation.state.status === 'pending';

const prepareForStorage = (client: PersistedClient): PersistedClient => ({
  ...client,
  clientState: {
    ...client.clientState,
    mutations: client.clientState.mutations.map((mutation) => ({
      ...mutation,
      state: { ...mutation.state, isPaused: true, failureCount: 0, failureReason: null, error: null },
    })),
  },
});

export type FlushablePersister = Persister & { flush: () => Promise<void> };

function createIdbPersister(): FlushablePersister {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PersistedClient | undefined;

  const flush = async () => {
    clearTimeout(timer);
    timer = undefined;
    const client = pending;
    pending = undefined;
    if (!client) return;
    try {
      await set(STORAGE_KEY, prepareForStorage(client));
    } catch {
      return;
    }
  };

  return {
    persistClient: (client) => {
      pending = client;
      timer ??= setTimeout(() => void flush(), WRITE_THROTTLE_MS);
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
    flush,
  };
}

export const persister = createIdbPersister();

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    return;
  }
}
