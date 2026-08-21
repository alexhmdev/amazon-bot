import { getJSON } from '../lib/http.js';
import { makeJob } from '../core/normalize.js';

/**
 * Jobicy - API publica de empleos remotos. Es la unica que filtra por region
 * (geo=latam), asi que suele traer lo mas aplicable desde Mexico.
 * Terminos: creditar a Jobicy con enlace directo a la vacante original.
 * Docs: https://jobi.cy/apidocs
 */
export const name = 'jobicy';

const FEEDS = [
  { geo: 'latam', industry: 'engineering' },
  { geo: 'latam', industry: 'dev' },
  { geo: 'anywhere', industry: 'engineering' },
  { geo: 'anywhere', industry: 'dev' },
];

export async function fetchJobs() {
  const jobs = [];
  let error = null;

  for (const feed of FEEDS) {
    const url = `https://jobicy.com/api/v2/remote-jobs?count=50&geo=${feed.geo}&industry=${feed.industry}`;
    const { data, error: feedError } = await getJSON(url, { retries: 1 });

    if (feedError || !data?.jobs) {
      error = feedError ?? error;
      continue;
    }

    for (const job of data.jobs) {
      jobs.push(
        makeJob({
          source: name,
          externalId: job.id,
          title: job.jobTitle,
          company: job.companyName,
          url: job.url,
          description: job.jobDescription || job.jobExcerpt,
          location: job.jobGeo,
          employmentType: (job.jobType ?? []).join(' '),
          seniority: (job.jobLevel ?? '') || '',
          tags: job.jobIndustry ?? [],
          postedAt: job.pubDate,
          salaryMin: job.salaryMin || null,
          salaryMax: job.salaryMax || null,
          currency: job.salaryCurrency || null,
          salaryPeriod: job.salaryPeriod || null,
          locationRestrictions: job.jobGeo ? [job.jobGeo] : [],
        })
      );
    }
  }

  return { jobs, error: jobs.length ? null : error };
}
