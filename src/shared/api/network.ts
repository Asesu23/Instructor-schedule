import { Network } from '@capacitor/network';
import { onlineManager } from '@tanstack/react-query';
import { apiUrl } from './config';

const PROBE_TIMEOUT_MS = 6000;
const OFFLINE_POLL_MS = 15000;

let reportOffline: () => void = () => undefined;

export const reportNetworkFailure = () => reportOffline();

async function probe() {
  try {
    const response = await Promise.race([
      fetch(apiUrl('/ping'), { cache: 'no-store' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS)),
    ]);
    return response.status === 200;
  } catch {
    return false;
  }
}

export function startNetworkMonitor() {
  onlineManager.setEventListener((setOnline) => {
    let poll: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };

    const apply = (online: boolean) => {
      if (stopped) return;
      setOnline(online);
      if (online) stopPolling();
      else poll ??= setInterval(() => void check(), OFFLINE_POLL_MS);
    };

    const check = async () => apply(await probe());

    const onStatus = (connected: boolean) => {
      if (connected) void check();
      else apply(false);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    reportOffline = () => apply(false);

    const handle = Network.addListener('networkStatusChange', (status) => onStatus(status.connected));
    void Network.getStatus().then((status) => onStatus(status.connected));
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      stopPolling();
      reportOffline = () => undefined;
      document.removeEventListener('visibilitychange', onVisible);
      void handle.then((listener) => listener.remove());
    };
  });
}
