import { getJSON } from '../lib/http.js';
import { makeJob } from '../core/normalize.js';

/**
 * Remotive - API publica gratuita.
 * Terminos: enlazar de vuelta a la URL de Remotive y citarla como fuente.
 * Piden un maximo de ~4 llamadas al dia, por eso hacemos una sola.
 * Docs: https://remotive.com/api-documentation
 */
export const name = 'remotive';

export async function fetchJobs() {
  const { data, error } = await getJSON('https://remotive.com/api/remote-jobs');
  if (error || !data?.jobs) return { jobs: [], error: error ?? 'respuesta invalida' };

  const jobs = data.jobs.map((job) =>
    makeJob({
      source: name,
      externalId: job.id,
      title: job.title,
      company: job.company_name,
      url: job.url,
      description: job.description,
      location: job.candidate_required_location,
      employmentType: job.job_type,
      tags: job.tags ?? [],
      postedAt: job.publication_date,
      salaryText: job.salary ?? '',
      locationRestrictions: job.candidate_required_location
        ? job.candidate_required_location.split(',').map((s) => s.trim())
        : [],
    })
  );

  return { jobs, error: null };
}
