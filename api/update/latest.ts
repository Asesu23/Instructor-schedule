import type { VercelRequest, VercelResponse } from '@vercel/node';

const REPO = process.env.UPDATE_REPO ?? 'Asesu23/Instructor-schedule';

type Release = { tag_name?: string; assets?: { name?: string; browser_download_url?: string }[] };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'instructor-schedule' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const upstream = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (!upstream.ok) {
      res.status(502).json({ error: 'UPSTREAM', message: `GitHub ответил ${upstream.status}` });
      return;
    }
    const release = (await upstream.json()) as Release;
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      tag_name: release.tag_name,
      assets: (release.assets ?? []).map((asset) => ({
        name: asset.name,
        browser_download_url: asset.browser_download_url,
      })),
    });
  } catch {
    res.status(502).json({ error: 'UPSTREAM', message: 'GitHub недоступен' });
  }
}
