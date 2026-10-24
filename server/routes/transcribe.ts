import { HttpError, type Body, type Result } from '../http.js';

const MAX_AUDIO_CHARS = 3_000_000;
const MODEL = '@cf/openai/whisper-large-v3-turbo';
const PROMPT = 'Расписание занятий: 10:00 Иван. 11:30 Оля 90 минут. 13:00 Петя полтора часа.';

const HALLUCINATION = /субтитр|dimatorzok|семкин|егорова|продолжение следует|спасибо за просмотр|подписывайтесь|thanks for watching|amara\.org|расписание занятий:/i;

type CloudflareReply = { result?: { text?: string }; errors?: { message?: string }[] };

export async function transcribe(body: Body): Promise<Result> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw new HttpError(503, 'NOT_CONFIGURED', 'Распознавание речи не настроено');
  const audio = typeof body.audio === 'string' ? body.audio : '';
  if (!audio || audio.length > MAX_AUDIO_CHARS) throw new HttpError(400, 'VALIDATION_ERROR', 'Некорректная запись');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, language: 'ru', initial_prompt: PROMPT, vad_filter: true, condition_on_previous_text: false }),
  });
  const data = (await response.json().catch(() => null)) as CloudflareReply | null;
  if (!response.ok || !data?.result) {
    throw new HttpError(502, 'TRANSCRIBE_FAILED', data?.errors?.[0]?.message ?? 'Не удалось распознать речь');
  }
  const text = (data.result.text ?? '').trim();
  return { status: 200, body: { text: HALLUCINATION.test(text) ? '' : text } };
}
