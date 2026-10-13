import { persister } from './persistence';
import { queryClient } from './queryClient';

export async function clearCache() {
  queryClient.clear();
  await persister.removeClient();
}
