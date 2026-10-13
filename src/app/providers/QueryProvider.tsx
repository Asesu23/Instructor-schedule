import { useEffect, type ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
  persister,
  requestPersistentStorage,
  shouldPersistMutation,
  shouldPersistQuery,
} from './persistence';
import { queryClient } from './queryClient';

const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE_MS,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
    shouldDehydrateMutation: shouldPersistMutation,
  },
};

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
