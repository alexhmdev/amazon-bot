import { createHash } from 'node:crypto';
import { stripHTML } from '../lib/html.js';

/** Id corto y estable: la misma vacante siempre cae en el mismo registro. */
export function hashId(source, key) {
  return `${source}-${createHash('sha1').update(String(key)).digest('hex').slice(0, 8)}`;
}

const EMPLOYMENT_ALIASES = [
  [/part[\s_-]?time|medio tiempo|20\s*(h|hrs|hours)/i, 'part-time'],
  [/contract(or)?|contrato|b2b|c2c/i, 'contract'],
  [/freelance|freelancer/i, 'freelance'],
  [/intern(ship)?|becari/i, 'internship'],
  [/temporary|temporal/i, 'temporary'],
  [/full[\s_-]?time|tiempo completo/i, 'full-time'],
];

export function normalizeEmployment(raw = '') {
  for (const [pattern, value] of EMPLOYMENT_ALIASES) {
    if (pattern.test(raw)) return value;
  }
  return raw ? String(raw).toLowerCase() : 'unknown';
}

const SENIORITY_ALIASES = [
  [/\b(intern|becario)\b/i, 'internship'],
  [/\b(junior|jr\.?|entry[\s-]?level|trainee)\b/i, 'junior'],
  [/\b(principal|staff|architect|head of|director|vp)\b/i, 'principal'],
  [/\b(senior|sr\.?|ssr)\b/i, 'senior'],
  [/\b(mid[\s-]?level|semi[\s-]?senior|intermediate)\b/i, 'mid'],
];

export function normalizeSeniority(...inputs) {
  const haystack = inputs.flat().filter(Boolean).join(' ');
  for (const [pattern, value] of SENIORITY_ALIASES) {
    if (pattern.test(haystack)) return value;
  }
  return 'unknown';
}

/**
 * Construye el objeto Job unificado que consume el resto del pipeline.
 * Toda fuente nueva solo tiene que devolver esta forma.
 */
export function makeJob({
  source,
  externalId,
  title,
  company,
  url,
  description = '',
  location = '',
  employmentType = '',
  seniority = '',
  tags = [],
  postedAt = null,
  salaryText = '',
  salaryMin = null,
  salaryMax = null,
  currency = null,
  salaryPeriod = null,
  timezones = [],
  locationRestrictions = [],
}) {
  const text = stripHTML(description);
  return {
    id: hashId(source, externalId || url),
    source,
    title: String(title || '').trim(),
    company: String(company || '').trim(),
    url,
    location: String(location || '').trim(),
    employmentType: normalizeEmployment(employmentType),
    seniority: normalizeSeniority(seniority, title),
    tags: tags.filter(Boolean).map((t) => String(t).toLowerCase()),
    postedAt: postedAt ? new Date(postedAt).toISOString() : null,
    salaryText,
    salaryMin,
    salaryMax,
    currency,
    salaryPeriod,
    timezones,
    locationRestrictions: locationRestrictions.map((l) => String(l).toLowerCase()),
    text,
    haystack: [title, company, location, tags.join(' '), text].join('\n').toLowerCase(),
  };
}
