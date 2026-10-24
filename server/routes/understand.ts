import { HttpError, type Body, type Result } from '../http.js';

const MODEL = process.env.WORKERS_AI_TEXT_MODEL ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

const SYSTEM = `Ты разбираешь фразы инструктора по вождению о записи учеников на занятия.
Для каждого занятия выведи одну строку в формате: [ДЕНЬ] ЧЧ:ММ Имя [МИНУТЫ]
Правила:
1. ДЕНЬ пиши только если он назван: сегодня, завтра, послезавтра, пн, вт, ср, чт, пт, сб, вс или ДД.ММ для конкретной даты. Если день не назван, ДЕНЬ не пиши.
2. Если занятие назначено на несколько дней («в понедельник, среду и пятницу», «с понедельника по пятницу», «завтра и послезавтра»), выведи отдельную строку для каждого дня.
3. Время только в 24-часовом формате ЧЧ:ММ. «6 вечера» это 18:00, «8 утра» это 08:00, «в половине двенадцатого» это 11:30, «без пятнадцати десять» это 09:45.
4. Если названы начало и конец («с 6 до 8», «с 18:00 по 20:00»), начало берётся из первого времени, а МИНУТЫ равны разнице. Если названа длительность («на полтора часа», «90 минут»), переведи её в минуты. Если длительность не названа, МИНУТЫ не пиши.
5. Имя ученика пиши в именительном падеже: «Михаила» значит «Михаил», «Олю» значит «Оля». Фамилию или уточнение сохраняй, если названы. Если ученик однозначно совпадает с одним из известных, пиши его имя так, как оно записано в списке. Если подходят несколько учеников с одним именем, пиши только имя без фамилии.
6. Слова «запиши», «поставь», «добавь» игнорируй.
7. Если время занятия не названо, это занятие пропусти.
8. Выведи только строки занятий, без нумерации, пояснений и кавычек.
Пример 1. Фраза: «запиши с 6 часов вечера до 8 часов вечера Михаила и в десять утра Олю на полтора часа».
18:00 Михаил 120
10:00 Оля 90
Пример 2. Фраза: «Ивана в понедельник и среду в 9 утра на два часа».
пн 09:00 Иван 120
ср 09:00 Иван 120`;

type Reply = {
  result?: { response?: unknown; choices?: { message?: { content?: string } }[] };
  errors?: { message?: string }[];
};

export async function understand(body: Body): Promise<Result> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw new HttpError(503, 'NOT_CONFIGURED', 'Разбор речи не настроен');
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : '';
  if (!text) throw new HttpError(400, 'VALIDATION_ERROR', 'Пустой текст');
  const today =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date().toISOString().slice(0, 10);
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const names = (Array.isArray(body.students) ? body.students : [])
    .filter((name): name is string => typeof name === 'string')
    .slice(0, 80)
    .map((name) => name.slice(0, 100));
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: `${SYSTEM}\nСегодня: ${weekday}, ${today.split('-').reverse().join('.')}.\nИзвестные ученики: ${names.join(', ') || 'нет'}` },
        { role: 'user', content: text },
      ],
      max_tokens: 300,
      temperature: 0,
    }),
  });
  const data = (await response.json().catch(() => null)) as Reply | null;
  if (!response.ok || !data?.result) {
    throw new HttpError(502, 'UNDERSTAND_FAILED', data?.errors?.[0]?.message ?? 'Не удалось разобрать текст');
  }
  const answer =
    typeof data.result.response === 'string' ? data.result.response : (data.result.choices?.[0]?.message?.content ?? '');
  const lines = answer
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•\s]+/, '').replace(/^\d+[.)]\s+/, ''))
    .filter((line) => /^(?:\S+\s+)?\d{1,2}:\d{2}\s+\S/.test(line))
    .slice(0, 20);
  return { status: 200, body: { lines } };
}
