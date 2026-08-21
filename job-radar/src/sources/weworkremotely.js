import { makeJob } from '../core/normalize.js';
import { decodeEntities } from '../lib/html.js';

/**
 * We Work Remotely - feeds RSS publicos por categoria.
 * No hay JSON, asi que parseamos el XML con expresiones regulares:
 * la estructura del feed es plana y estable (title/link/region/description).
 */
export const name = 'weworkremotely';

const FEEDS = [
  'remote-programming-jobs',
  'remote-front-end-programming-jobs',
  'remote-full-stack-programming-jobs',
  'remote-contract-jobs',
];

const tag = (block, name) => {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!match) return '';
  return decodeEntities(match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
};

export async function fetchJobs() {
  const jobs = [];
  const seen = new Set();
  let error = null;

  for (const feed of FEEDS) {
    try {
      const res = await fetch(`https://weworkremotely.com/categories/${feed}.rss`, {
        headers: { 'User-Agent': 'job-radar/1.0 personal job search' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { error = `HTTP ${res.status}`; continue; }

      const xml = await res.text();
      for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const link = tag(block, 'link');
        if (!link || seen.has(link)) continue;
        seen.add(link);

        // WWR titula "Empresa: Puesto"
        const rawTitle = tag(block, 'title');
        const [company, ...titleParts] = rawTitle.split(':');
        const title = titleParts.join(':').trim() || rawTitle;
        const region = tag(block, 'region');

        jobs.push(
          makeJob({
            source: name,
            externalId: link,
            title,
            company: company.trim(),
            url: link,
            description: tag(block, 'description'),
            location: region,
            employmentType: tag(block, 'type') || (feed.includes('contract') ? 'contract' : ''),
            tags: [tag(block, 'category')].filter(Boolean),
            postedAt: tag(block, 'pubDate') || null,
            locationRestrictions: region ? [region] : [],
          })
        );
      }
    } catch (err) {
      error = err.message;
    }
  }

  return { jobs, error: jobs.length ? null : error };
}
