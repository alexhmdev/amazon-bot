import { getJSON, sleep } from '../lib/http.js';
import { makeJob } from '../core/normalize.js';

/**
 * Himalayas - API publica. Solo acepta limit/offset (20 por pagina, mas
 * recientes primero), asi que paginamos y filtramos en local.
 * Es la fuente mas rica: trae tipo de contrato, seniority, sueldo y
 * restricciones de pais/zona horaria.
 */
export const name = 'himalayas';

const PAGE_SIZE = 20;

export async function fetchJobs({ pages = 12 } = {}) {
  const jobs = [];
  let error = null;

  for (let page = 0; page < pages; page++) {
    const url = `https://himalayas.app/jobs/api?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const { data, error: pageError } = await getJSON(url);

    if (pageError || !data?.jobs?.length) {
      error = pageError;
      break;
    }

    for (const job of data.jobs) {
      jobs.push(
        makeJob({
          source: name,
          externalId: job.guid ?? job.applicationLink,
          title: job.title,
          company: job.companyName,
          url: job.applicationLink ?? job.guid,
          description: job.description || job.excerpt,
          employmentType: job.employmentType,
          seniority: (job.seniority ?? []).join(' '),
          tags: [...(job.categories ?? []), ...(job.parentCategories ?? [])],
          postedAt: job.pubDate ? job.pubDate * 1000 : null,
          salaryMin: job.minSalary,
          salaryMax: job.maxSalary,
          currency: job.currency,
          salaryPeriod: job.salaryPeriod,
          timezones: job.timezoneRestrictions ?? [],
          locationRestrictions: job.locationRestrictions ?? [],
          location: (job.locationRestrictions ?? []).join(', ') || 'Remote',
        })
      );
    }

    if (data.jobs.length < PAGE_SIZE) break;
    await sleep(300); // no golpear la API
  }

  return { jobs, error };
}
