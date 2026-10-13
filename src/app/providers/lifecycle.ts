import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BackgroundTask } from '@capawesome/capacitor-background-task';
import { persister } from './persistence';

export function registerLifecycle() {
  const save = () => void persister.flush();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);

  if (!Capacitor.isNativePlatform()) return;

  void App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) return;
    const taskId = await BackgroundTask.beforeExit(async () => {
      await persister.flush();
      BackgroundTask.finish({ taskId });
    });
  });
}
