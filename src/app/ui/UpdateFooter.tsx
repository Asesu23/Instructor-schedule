import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { appVersion, checkNow } from '../providers/appUpdate';
import './updateFooter.css';

export function UpdateFooter() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!Capacitor.isNativePlatform()) return null;

  const run = async () => {
    setBusy(true);
    setMessage('Проверяю...');
    setMessage(await checkNow());
    setBusy(false);
  };

  return (
    <footer className="version">
      <small>Версия {appVersion}</small>
      <button type="button" disabled={busy} onClick={() => void run()}>
        Проверить обновление
      </button>
      {message && <small>{message}</small>}
    </footer>
  );
}
