import { ApiError } from '@/shared/api';

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : 'Нет связи с сервером');
