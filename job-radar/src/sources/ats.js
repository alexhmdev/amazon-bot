import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getJSON, sleep } from '../lib/http.js';
import { makeJob } from '../core/normalize.js';
import { decodeEntities } from '../lib/html.js';
import { ROOT } from '../lib/env.js';

/**
 * Bolsas oficiales (Greenhouse / Lever / Ashby) de empresas concretas.
 * Son las APIs que la propia empresa expone para su pagina de empleos:
 * publicas, sin login y sin riesgo de bloqueo. Aqui aparecen las vacantes
 * antes que en cualquier agregador.
 */
export const name = 'ats';

const ADAPTERS = {
  greenhouse: {
    url: (token) => `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
    parse: (data, company) =>
      (data?.jobs ?? []).map((job) =>
        makeJob({
          source: `greenhouse:${company.token}`,
          externalId: job.id,
          title: job.title,
          company: job.company_name || company.name,
          url: job.absolute_url,
          description: decodeEntities(job.content ?? ''),
          location: job.location?.name ?? '',
          tags: (job.departments ?? []).map((d) => d.name),
          postedAt: job.first_published ?? job.updated_at,
          locationRestrictions: job.location?.name ? [job.location.name] : [],
        })
      ),
  },

  lever: {
    url: (token) => `https://api.lever.co/v0/postings/${token}?mode=json`,
    parse: (data, company) =>
      (Array.isArray(data) ? data : []).map((job) =>
        makeJob({
          source: `lever:${company.token}`,
          externalId: job.id,
          title: job.text,
          company: company.name,
          url: job.hostedUrl ?? job.applyUrl,
          description: job.descriptionPlain ?? job.description ?? '',
          location: job.categories?.location ?? '',
          employmentType: job.categories?.commitment ?? '',
          tags: [job.categories?.team, job.categories?.department].filter(Boolean),
          postedAt: job.createdAt ?? null,
          locationRestrictions: job.categories?.location ? [job.categories.location] : [],
        })
      ),
  },

  ashby: {
    url: (token) => `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`,
    parse: (data, company) =>
      (data?.jobs ?? []).map((job) =>
        makeJob({
          source: `ashby:${company.token}`,
          externalId: job.id,
          title: job.title,
          company: company.name,
          url: job.jobUrl ?? job.applyUrl,
          description: job.descriptionPlain ?? job.descriptionHtml ?? '',
          location: [job.location, job.isRemote ? 'Remote' : job.workplaceType]
            .filter(Boolean)
            .join(' · '),
          employmentType: job.employmentType ?? '',
          tags: [job.department, job.team].filter(Boolean),
          postedAt: job.publishedAt ?? null,
          salaryText: job.compensation?.compensationTierSummary ?? '',
          locationRestrictions: [
            job.location,
            ...(job.secondaryLocations ?? []).map((l) => l.location),
          ].filter(Boolean),
        })
      ),
  },
};

export function loadCompanies() {
  const file = resolve(ROOT, 'companies.json');
  return JSON.parse(readFileSync(file, 'utf8')).companies ?? [];
}

export async function fetchJobs() {
  const jobs = [];
  const failures = [];

  for (const company of loadCompanies()) {
    const adapter = ADAPTERS[company.ats];
    if (!adapter) {
      failures.push(`${company.name}: ATS desconocido (${company.ats})`);
      continue;
    }

    const { data, error } = await getJSON(adapter.url(company.token), { retries: 1 });
    if (error) {
      failures.push(`${company.name}: ${error}`);
    } else {
      jobs.push(...adapter.parse(data, company));
    }
    await sleep(200);
  }

  return { jobs, error: failures.length ? failures.join('; ') : null };
}
