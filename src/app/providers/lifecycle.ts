import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BackgroundTask } from '@capawesome/capacitor-background-task';
import { applyPendingUpdate, checkForUpdate } from './appUpdate';
import { persister } from './persistence';

export function registerLifecycle() {
  const save = () => void persister.flush();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);

  if (!Capacitor.isNativePlatform()) return;

  void checkForUpdate();

  void App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      await applyPendingUpdate();
      void checkForUpdate();
      return;
    }
    const taskId = await BackgroundTask.beforeExit(async () => {
      await persister.flush();
      BackgroundTask.finish({ taskId });
    });
  });
}
