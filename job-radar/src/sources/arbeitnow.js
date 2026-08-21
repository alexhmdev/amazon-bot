import { getJSON } from '../lib/http.js';
import { makeJob } from '../core/normalize.js';

/**
 * Arbeitnow - API publica, mayoria de vacantes en Europa/Alemania.
 * Desactivada por defecto en profile.json (util solo si buscas EU).
 */
export const name = 'arbeitnow';

export async function fetchJobs() {
  const { data, error } = await getJSON('https://www.arbeitnow.com/api/job-board-api');
  if (error || !data?.data) return { jobs: [], error: error ?? 'respuesta invalida' };

  const jobs = data.data.map((job) =>
    makeJob({
      source: name,
      externalId: job.slug,
      title: job.title,
      company: job.company_name,
      url: job.url,
      description: job.description,
      location: job.remote ? `Remote / ${job.location}` : job.location,
      employmentType: (job.job_types ?? []).join(' '),
      tags: job.tags ?? [],
      postedAt: job.created_at ? job.created_at * 1000 : null,
      locationRestrictions: job.remote ? ['remote'] : [job.location],
    })
  );

  return { jobs, error: null };
}
