import { useEffect, useRef, useState } from 'react';

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

const getCtor = () => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function useSpeech(onPhrase: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const handler = useRef(onPhrase);

  useEffect(() => {
    handler.current = onPhrase;
  });

  useEffect(() => () => recognition.current?.abort(), []);

  const stop = () => recognition.current?.stop();

  const start = () => {
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
      setError(event.error === 'not-allowed' ? 'Нет доступа к микрофону' : 'Не удалось распознать речь');
    };
    next.onend = () => setListening(false);
    recognition.current = next;
    setError('');
    setListening(true);
    next.start();
  };

  return { supported: Boolean(getCtor()), listening, error, stop, toggle: () => (listening ? stop() : start()) };
}
