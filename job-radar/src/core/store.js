import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/env.js';

const DATA_DIR = resolve(ROOT, 'data');
const DB_FILE = resolve(DATA_DIR, 'jobs.json');

export const STATUSES = ['new', 'shortlist', 'applied', 'interview', 'rejected', 'discarded'];

const slug = (text = '') =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

/** La misma vacante suele estar en varios agregadores: empresa + puesto la identifica. */
const dupKey = (job) => `${slug(job.company)}|${slug(job.title)}`;

export function load() {
  if (!existsSync(DB_FILE)) return { jobs: {}, meta: { runs: 0, lastRun: null } };
  try {
    return JSON.parse(readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { jobs: {}, meta: { runs: 0, lastRun: null } };
  }
}

export function save(db) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_FILE); // escritura atomica: no se corrompe si se interrumpe
}

/**
 * Mezcla los resultados de una busqueda con lo ya guardado.
 * Nunca pisa el estado manual (applied, shortlist...) ni el historial.
 */
export function upsertMany(db, scoredJobs) {
  const now = new Date().toISOString();
  const byDup = new Map();
  for (const [id, job] of Object.entries(db.jobs)) byDup.set(dupKey(job), id);

  const fresh = [];
  let updated = 0;

  for (const job of scoredJobs) {
    const existingId = db.jobs[job.id] ? job.id : byDup.get(dupKey(job));

    if (existingId) {
      const existing = db.jobs[existingId];
      existing.lastSeen = now;
      existing.score = job.score;
      existing.reasons = job.reasons;
      existing.matchedSkills = job.matchedSkills;
      if (!existing.alsoOn?.includes(job.source) && job.source !== existing.source) {
        existing.alsoOn = [...new Set([...(existing.alsoOn ?? []), job.source])];
      }
      updated++;
      continue;
    }

    const record = {
      id: job.id,
      source: job.source,
      title: job.title,
      company: job.company,
      url: job.url,
      location: job.location,
      employmentType: job.employmentType,
      seniority: job.seniority,
      salaryText: job.salaryText,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      salaryPeriod: job.salaryPeriod,
      tags: job.tags.slice(0, 12),
      postedAt: job.postedAt,
      score: job.score,
      reasons: job.reasons,
      matchedSkills: job.matchedSkills,
      excerpt: job.text.slice(0, 600),
      status: 'new',
      notified: false,
      firstSeen: now,
      lastSeen: now,
      alsoOn: [],
      notes: '',
    };

    db.jobs[job.id] = record;
    byDup.set(dupKey(job), job.id);
    fresh.push(record);
  }

  db.meta.runs = (db.meta.runs ?? 0) + 1;
  db.meta.lastRun = now;

  return { fresh, updated };
}

export function query(db, { status, minScore = 0, limit = Infinity, source, exclude = [] } = {}) {
  return Object.values(db.jobs)
    .filter((job) => (status ? job.status === status : true))
    .filter((job) => !exclude.includes(job.status))
    .filter((job) => job.score >= minScore)
    .filter((job) => (source ? job.source.startsWith(source) : true))
    .sort((a, b) => b.score - a.score || (b.postedAt ?? '').localeCompare(a.postedAt ?? ''))
    .slice(0, limit);
}

export function findById(db, partialId) {
  if (db.jobs[partialId]) return db.jobs[partialId];
  const matches = Object.values(db.jobs).filter((job) => job.id.includes(partialId));
  return matches.length === 1 ? matches[0] : null;
}
