import type { QueryClient } from '@tanstack/react-query';

export const OUTBOX_SCOPE = { id: 'outbox' };

export const hasPendingWrites = (client: QueryClient) => client.isMutating() > 0;

export const isLastPendingWrite = (client: QueryClient) => client.isMutating() <= 1;
