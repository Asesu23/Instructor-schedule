import { api } from '@/shared/api';

export const authApi = {
  session: () => api('/session'),
  login: (password: string) => api('/login', 'POST', { password }),
};
