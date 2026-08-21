import { getJSON } from '../lib/http.js';
import { makeJob } from '../core/normalize.js';

/**
 * Remote OK - API publica gratuita (~100 vacantes mas recientes).
 * Terminos: enlazar de vuelta a la URL de Remote OK y citarla como fuente.
 */
export const name = 'remoteok';

export async function fetchJobs() {
  const { data, error } = await getJSON('https://remoteok.com/api');
  if (error || !Array.isArray(data)) return { jobs: [], error: error ?? 'respuesta invalida' };

  // El primer elemento del array es el aviso legal, no una vacante.
  const jobs = data
    .filter((entry) => entry?.id && entry?.position)
    .map((job) =>
      makeJob({
        source: name,
        externalId: job.id,
        title: job.position,
        company: job.company,
        url: job.url ?? `https://remoteok.com/l/${job.id}`,
        description: job.description,
        location: job.location,
        tags: job.tags ?? [],
        postedAt: job.date ?? (job.epoch ? job.epoch * 1000 : null),
        salaryMin: job.salary_min || null,
        salaryMax: job.salary_max || null,
        currency: job.salary_min ? 'USD' : null,
        salaryPeriod: job.salary_min ? 'annual' : null,
        locationRestrictions: job.location ? [job.location] : [],
      })
    );

  return { jobs, error: null };
}
