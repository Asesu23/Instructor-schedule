import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

type RecognitionResult = { isFinal: boolean; 0?: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const isNative = Capacitor.isNativePlatform();

const getCtor = () => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const webMessage = (code: string) => {
  if (code === 'not-allowed') return 'Нет доступа к микрофону';
  if (code === 'audio-capture') return 'Микрофон не найден';
  if (code === 'network' || code === 'service-not-allowed' || code === 'language-not-supported') {
    return `Этот браузер не поддерживает распознавание речи (${code}), откройте сайт в Chrome`;
  }
  return `Не удалось распознать речь (${code})`;
};

export function useSpeech(onPhrase: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const handler = useRef(onPhrase);

  useEffect(() => {
    handler.current = onPhrase;
  });

  useEffect(
    () => () => {
      recognition.current?.abort();
      if (isNative) SpeechRecognition.stop().catch(() => undefined);
    },
    [],
  );

  const startNative = async () => {
    setError('');
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        setError('На телефоне нет службы распознавания речи (нужно приложение Google)');
        return;
      }
      const permission = await SpeechRecognition.requestPermissions();
      if (permission.speechRecognition !== 'granted') {
        setError('Нет доступа к микрофону');
        return;
      }
      setListening(true);
      const { matches } = await SpeechRecognition.start({
        language: 'ru-RU',
        maxResults: 1,
        partialResults: false,
        popup: false,
      });
      const text = matches?.[0];
      if (text?.trim()) handler.current(text);
    } catch (e) {
      setError(`Не расслышал, повторите (${(e as { message?: string }).message ?? String(e)})`);
    } finally {
      setListening(false);
    }
  };

  const startWeb = () => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const next = new Ctor();
    next.lang = 'ru-RU';
    next.continuous = true;
    next.interimResults = false;
    next.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.isFinal ? result[0]?.transcript : undefined;
        if (text?.trim()) handler.current(text);
      }
    };
    next.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(webMessage(event.error));
    };
    next.onend = () => setListening(false);
    recognition.current = next;
    setError('');
    setListening(true);
    next.start();
  };

  const stop = () => {
    if (isNative) {
      SpeechRecognition.stop()
        .catch(() => undefined)
        .then(() => setListening(false));
    } else {
      recognition.current?.stop();
    }
  };

  return {
    supported: isNative || Boolean(getCtor()),
    listening,
    error,
    stop,
    toggle: () => {
      if (listening) stop();
      else if (isNative) void startNative();
      else startWeb();
    },
  };
}
