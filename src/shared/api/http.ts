import { apiUrl } from './config';
import { reportNetworkFailure } from './network';
import { authEpoch, markUnauthorized, waitForAuthorization } from './session';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const UNGUARDED = new Set(['/login', '/session', '/ping']);

async function send(path: string, method: string, body: unknown) {
  try {
    return await fetch(apiUrl(path), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    reportNetworkFailure();
    throw error;
  }
}

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const guarded = !UNGUARDED.has(path);
  let epoch = authEpoch();

  for (;;) {
    const res = await send(path, method, body);
    if (res.status === 401 && guarded) {
      if (epoch === authEpoch()) {
        markUnauthorized();
        await waitForAuthorization();
      }
      epoch = authEpoch();
      continue;
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'ERROR', data.message ?? 'Ошибка запроса');
    return data as T;
  }
}
