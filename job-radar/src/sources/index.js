import * as remotive from './remotive.js';
import * as remoteok from './remoteok.js';
import * as himalayas from './himalayas.js';
import * as arbeitnow from './arbeitnow.js';
import * as jobicy from './jobicy.js';
import * as weworkremotely from './weworkremotely.js';
import * as hackernews from './hackernews.js';
import * as ats from './ats.js';

export const SOURCES = { remotive, remoteok, jobicy, weworkremotely, hackernews, himalayas, arbeitnow, ats };

/** Consulta en paralelo todas las fuentes activadas en profile.sources. */
export async function fetchAll(enabled = {}) {
  const active = Object.entries(SOURCES).filter(([key]) => enabled[key] !== false);

  const results = await Promise.all(
    active.map(async ([key, source]) => {
      const started = Date.now();
      try {
        const { jobs, error } = await source.fetchJobs();
        return { key, jobs, error, ms: Date.now() - started };
      } catch (err) {
        return { key, jobs: [], error: err.message, ms: Date.now() - started };
      }
    })
  );

  return results;
}
