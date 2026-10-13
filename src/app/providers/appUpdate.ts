import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import { persister } from './persistence';

const REPO = import.meta.env.VITE_UPDATE_REPO;
const VERSION = import.meta.env.VITE_APP_VERSION;
const BUNDLE_NAME = 'dist.zip';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

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
  if (known) return known.status === 'pending' ? known : undefined;
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
