import { useEffect, useRef, useState } from 'react';
import { api } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { encodeWav, toBase64 } from './wav';

const RATE = 16000;
const MAX_MS = 30000;
const SILENCE_MS = 1600;
const NO_SPEECH_MS = 8000;
const TICK_MS = 100;

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

function watchSilence(media: MediaStream, onDone: (spoke: boolean) => void) {
  const context = new AudioContext();
  void context.resume();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  context.createMediaStreamSource(media).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let calibrating = 3;
  let noise = 0;
  let spoke = false;
  let loud = 0;
  let quiet = 0;
  let elapsed = 0;
  const timer = window.setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) sum += ((value - 128) / 128) ** 2;
    const level = Math.sqrt(sum / data.length);
    elapsed += TICK_MS;
    if (calibrating > 0) {
      noise = Math.max(noise, Math.min(level, 0.05));
      calibrating -= 1;
      return;
    }
    if (level > Math.max(0.02, noise * 2.5)) {
      loud += TICK_MS;
      quiet = 0;
      if (loud >= 300) spoke = true;
    } else if (spoke) {
      quiet += TICK_MS;
    }
    if ((spoke && quiet >= SILENCE_MS) || (!spoke && elapsed >= NO_SPEECH_MS)) onDone(spoke);
  }, TICK_MS);
  return () => {
    window.clearInterval(timer);
    void context.close();
  };
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
  const watcher = useRef<(() => void) | null>(null);
  const silent = useRef(false);
  const startedAt = useRef(0);
  const handler = useRef(onPhrase);

  useEffect(() => {
    handler.current = onPhrase;
  });

  const release = () => {
    window.clearTimeout(timer.current);
    watcher.current?.();
    watcher.current = null;
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
    silent.current = false;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      startedAt.current = Date.now();
      const chunks: Blob[] = [];
      const next = new MediaRecorder(media);
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = async () => {
        release();
        if (silent.current || Date.now() - startedAt.current < 1000) {
          silent.current = false;
          setError('Голос не слышен, нажмите «Голос» и повторите');
          setStatus('idle');
          return;
        }
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
      watcher.current = watchSilence(media, (spoke) => {
        silent.current = !spoke;
        stop();
      });
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
