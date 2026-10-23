import { useEffect, useRef, useState } from 'react';
import { api } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { encodeWav, toBase64 } from './wav';

const RATE = 16000;
const MAX_MS = 30000;

type Status = 'idle' | 'recording' | 'sending';

async function toWavBase64(blob: Blob) {
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  void context.close();
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return toBase64(encodeWav(rendered.getChannelData(0), RATE));
}

const micMessage = (e: unknown) => {
  const name = (e as { name?: string }).name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Нет доступа к микрофону';
  if (name === 'NotFoundError') return 'Микрофон не найден';
  return `Не удалось включить микрофон (${name || 'ошибка'})`;
};

export function useSpeech(onPhrase: (text: string) => void) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const handler = useRef(onPhrase);

  useEffect(() => {
    handler.current = onPhrase;
  });

  const release = () => {
    window.clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      const current = recorder.current;
      if (current) {
        current.onstop = null;
        if (current.state === 'recording') current.stop();
      }
      release();
    },
    [],
  );

  const stop = () => {
    const current = recorder.current;
    if (current?.state === 'recording') current.stop();
  };

  const start = async () => {
    setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: Blob[] = [];
      const next = new MediaRecorder(media);
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = async () => {
        release();
        setStatus('sending');
        try {
          const audio = await toWavBase64(new Blob(chunks, { type: next.mimeType }));
          const { text } = await api<{ text: string }>('/transcribe', 'POST', { audio });
          if (text.trim()) handler.current(text);
          else setError('Не расслышал, повторите');
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setStatus('idle');
        }
      };
      recorder.current = next;
      next.start();
      setStatus('recording');
      timer.current = window.setTimeout(() => {
        if (next.state === 'recording') next.stop();
      }, MAX_MS);
    } catch (e) {
      release();
      setError(micMessage(e));
      setStatus('idle');
    }
  };

  return {
    supported: typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
    status,
    error,
    stop,
    toggle: () => {
      if (status === 'recording') stop();
      else if (status === 'idle') void start();
    },
  };
}
