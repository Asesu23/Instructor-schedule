import { Capacitor } from '@capacitor/core';

export function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (Capacitor.isNativePlatform()) {
    void navigator.serviceWorker.getRegistrations().then((list) => list.forEach((item) => void item.unregister()));
    void caches.keys().then((keys) => keys.forEach((key) => void caches.delete(key)));
    return;
  }

  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
