import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
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

const enabled = Capacitor.isNativePlatform() && Boolean(REPO) && Boolean(VERSION);

let pending: BundleInfo | undefined;
let checking = false;
let lastCheckAt = 0;

export async function markUpdateReady() {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorUpdater.notifyAppReady().catch(() => undefined);
}

async function prepareBundle(release: Release) {
  const asset = release.assets.find((item) => item.name === BUNDLE_NAME);
  if (!asset) return undefined;
  const { bundles } = await CapacitorUpdater.list();
  const known = bundles.find((bundle) => bundle.version === release.tag_name);
  if (known) {
    if (known.status === 'pending') return known;
    await CapacitorUpdater.delete({ id: known.id }).catch(() => undefined);
  }
  return CapacitorUpdater.download({ url: asset.browser_download_url, version: release.tag_name });
}

export async function checkForUpdate() {
  if (!enabled || checking || pending || Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return;
  checking = true;
  lastCheckAt = Date.now();
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return;
    const release = (await response.json()) as Release;
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

const reason = (e: unknown) => (e as { message?: string }).message ?? String(e);

export async function checkNow(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'Обновления работают только в приложении';
  if (!REPO || !VERSION) return 'У этой сборки нет номера версии, обновления выключены. Поставьте APK из GitHub Releases';
  let release: Release;
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (response.status === 404) return 'GitHub не нашёл релиз: репозиторий приватный или релизов ещё нет';
    if (response.status === 403) return 'GitHub временно ограничил запросы, повторите позже';
    if (!response.ok) return `GitHub ответил ${response.status}`;
    release = (await response.json()) as Release;
  } catch (e) {
    return `Нет связи с GitHub (${reason(e)})`;
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
