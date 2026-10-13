import { HttpError } from './http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export const parseOptionalId = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (!isUuid(value)) throw new HttpError(400, 'VALIDATION_ERROR', 'Некорректный идентификатор');
  return value;
};

export const requireId = (id: string | undefined) => {
  if (!id || !UUID.test(id)) throw new HttpError(404, 'NOT_FOUND', 'Не найдено');
  return id;
};

export const parseText = (value: unknown, field: string, max: number, required: boolean) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new HttpError(400, 'VALIDATION_ERROR', `Поле «${field}» обязательно`);
  if (text.length > max) throw new HttpError(400, 'VALIDATION_ERROR', `Поле «${field}» длиннее ${max} символов`);
  return text || null;
};
