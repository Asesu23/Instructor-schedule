import type { VercelRequest, VercelResponse } from '@vercel/node';

const REPO = process.env.UPDATE_REPO ?? 'Asesu23/Instructor-schedule';
const MAX_BYTES = 4_000_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const tag = String(req.query.tag ?? '');
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Некорректная версия' });
    return;
  }
  try {
    const upstream = await fetch(`https://github.com/${REPO}/releases/download/${tag}/dist.zip`, { redirect: 'follow' });
    if (!upstream.ok) {
      res.status(502).json({ error: 'UPSTREAM', message: `GitHub ответил ${upstream.status}` });
      return;
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      res.status(502).json({ error: 'UPSTREAM', message: 'Файл слишком большой' });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
    res.status(200).send(bytes);
  } catch {
    res.status(502).json({ error: 'UPSTREAM', message: 'GitHub недоступен' });
  }
}
