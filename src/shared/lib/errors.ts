import { ApiError } from '@/shared/api';

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Нет связи с сервером');

export const isConnectionError = (e: unknown) => !(e instanceof ApiError) || e.status >= 500;
