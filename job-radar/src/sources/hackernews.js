import { getJSON } from '../lib/http.js';
import { makeJob } from '../core/normalize.js';
import { decodeEntities, stripHTML } from '../lib/html.js';

/**
 * Hilo mensual "Ask HN: Who is hiring?" via la API publica de Algolia.
 * Cada comentario de primer nivel es una vacante puesta por la propia empresa:
 * es la mejor fuente de startups remotas y contratos por horas, y no aparece
 * en ningun agregador.
 */
export const name = 'hackernews';

const REMOTE_HINT = /\bremote\b|\bworldwide\b|\banywhere\b|\blatam\b|\bcontract\b/i;

async function findLatestThread() {
  const url =
    'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5';
  const { data } = await getJSON(url);
  return (data?.hits ?? []).find((hit) => /who is hiring/i.test(hit.title ?? ''));
}

export async function fetchJobs() {
  const story = await findLatestThread();
  if (!story) return { jobs: [], error: 'no encontré el hilo de "Who is hiring"' };

  const url = `https://hn.algolia.com/api/v1/search?tags=comment,story_${story.objectID}&hitsPerPage=500`;
  const { data, error } = await getJSON(url, { timeout: 30000 });
  if (error || !data?.hits) return { jobs: [], error: error ?? 'respuesta invalida' };

  const jobs = data.hits
    // Solo comentarios de primer nivel: los anidados son conversacion, no vacantes.
    .filter((hit) => String(hit.parent_id) === String(story.objectID) && hit.comment_text)
    .map((hit) => {
      const text = stripHTML(decodeEntities(hit.comment_text));
      const [firstLine = ''] = text.split('\n');
      const parts = firstLine.split(/\s*[|·—–]\s*/).filter(Boolean);
      const company = (parts[0] ?? 'Empresa en HN').slice(0, 60);
      const title = (parts.slice(1).join(' · ') || firstLine).slice(0, 120);
      const remoteBits = parts.filter((part) => REMOTE_HINT.test(part));

      return makeJob({
        source: name,
        externalId: hit.objectID,
        title: title || 'Vacante en Who is hiring',
        company,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        description: text,
        location: remoteBits.join(' · ') || (REMOTE_HINT.test(text) ? 'Remote' : ''),
        employmentType: /part[\s-]?time|contract|freelance/i.test(text) ? 'contract' : '',
        postedAt: hit.created_at,
        tags: ['hacker news', story.title],
        locationRestrictions: [],
      });
    })
    // Un puesto presencial en San Francisco no nos sirve: exigimos senal de remoto.
    .filter((job) => REMOTE_HINT.test(job.haystack));

  return { jobs, error: null };
}
