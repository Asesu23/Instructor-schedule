import { useSyncExternalStore } from 'react';

export type SyncFailure = { id: number; message: string };

let failures: SyncFailure[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const reportSyncFailure = (message: string) => {
  failures = [...failures, { id: nextId++, message }];
  emit();
};

export const dismissSyncFailure = (id: number) => {
  failures = failures.filter((failure) => failure.id !== id);
  emit();
};

export const useSyncFailures = () => useSyncExternalStore(subscribe, () => failures);
