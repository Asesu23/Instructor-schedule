import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import { apiUrl } from '@/shared/api';
import { persister } from './persistence';

const REPO = import.meta.env.VITE_UPDATE_REPO;
const VERSION = import.meta.env.VITE_APP_VERSION;
const BUNDLE_NAME = 'dist.zip';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const STARTUP_APPLY_MS = 20 * 1000;
const startedAt = Date.now();

type Release = {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
};

const reason = (e: unknown) => (e as { message?: string }).message ?? String(e);

const enabled = Capacitor.isNativePlatform() && Boolean(REPO) && Boolean(VERSION);

let pending: BundleInfo | undefined;
let checking = false;
let lastCheckAt = 0;

export async function markUpdateReady() {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorUpdater.notifyAppReady().catch(() => undefined);
}

async function fetchRelease(): Promise<Release> {
  let failure = '';
  for (const url of [apiUrl('/update/latest'), `https://api.github.com/repos/${REPO}/releases/latest`]) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (response.ok) return (await response.json()) as Release;
      failure = String(response.status);
    } catch (e) {
      failure = reason(e);
    }
  }
  throw new Error(failure);
}

async function dropFailed(version: string) {
  const { bundles } = await CapacitorUpdater.list();
  await Promise.all(
    bundles
      .filter((bundle) => bundle.version === version && bundle.status !== 'pending')
      .map((bundle) => CapacitorUpdater.delete({ id: bundle.id }).catch(() => undefined)),
  );
}

async function prepareBundle(release: Release) {
  const asset = release.assets.find((item) => item.name === BUNDLE_NAME);
  if (!asset) return undefined;
  const { bundles } = await CapacitorUpdater.list();
  const ready = bundles.find((bundle) => bundle.version === release.tag_name && bundle.status === 'pending');
  if (ready) return ready;
  await dropFailed(release.tag_name).catch(() => undefined);
  const sources = [apiUrl(`/update/bundle?tag=${encodeURIComponent(release.tag_name)}`), asset.browser_download_url];
  const failures: string[] = [];
  for (const url of sources) {
    try {
      return await CapacitorUpdater.download({ url, version: release.tag_name });
    } catch (e) {
      failures.push(reason(e));
      await dropFailed(release.tag_name).catch(() => undefined);
    }
  }
  throw new Error(failures.join(' | '));
}

export async function checkForUpdate() {
  if (!enabled || checking || pending || Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return;
  checking = true;
  lastCheckAt = Date.now();
  try {
    const release = await fetchRelease();
    if (release.tag_name === VERSION) return;
    pending = await prepareBundle(release);
    if (pending && Date.now() - startedAt < STARTUP_APPLY_MS) await applyPendingUpdate();
  } catch {
    return;
  } finally {
    checking = false;
  }
}

export async function applyPendingUpdate() {
  if (!pending) return;
  const bundle = pending;
  pending = undefined;
  try {
    await persister.flush();
    await CapacitorUpdater.set(bundle);
  } catch {
    return;
  }
}

export const appVersion = VERSION || 'dev';

export async function checkNow(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'Обновления работают только в приложении';
  if (!REPO || !VERSION) return 'У этой сборки нет номера версии, обновления выключены. Поставьте APK из GitHub Releases';
  let release: Release;
  try {
    release = await fetchRelease();
  } catch (e) {
    return `Не удалось получить список релизов (${reason(e)})`;
  }
  if (release.tag_name === VERSION) return `Установлена последняя версия ${VERSION}`;
  if (!release.assets.some((item) => item.name === BUNDLE_NAME)) return `В релизе ${release.tag_name} нет файла ${BUNDLE_NAME}`;
  try {
    const bundle = pending ?? (await prepareBundle(release));
    if (!bundle) return `Не удалось подготовить обновление ${release.tag_name}`;
    pending = undefined;
    await persister.flush();
    await CapacitorUpdater.set(bundle);
    return `Обновляю до ${release.tag_name}...`;
  } catch (e) {
    return `Не удалось обновить (${reason(e)})`;
  }
}
