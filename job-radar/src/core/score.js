const DAY = 24 * 60 * 60 * 1000;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Coincidencia por palabra completa: "node" no debe matchear "nodemon". */
function includesTerm(haystack, term) {
  const escaped = escapeRegExp(term.toLowerCase());
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#]|$)`, 'i').test(haystack);
}

function matchedTerms(haystack, terms = []) {
  return terms.filter((term) => includesTerm(haystack, term));
}

/** Lleva cualquier sueldo a una cifra anual aproximada para poder comparar. */
function toAnnual(amount, period) {
  if (!amount) return null;
  switch ((period ?? '').toLowerCase()) {
    case 'hourly': return amount * 40 * 52;
    case 'daily': return amount * 5 * 52;
    case 'weekly': return amount * 52;
    case 'monthly': return amount * 12;
    default: return amount;
  }
}

const CLAMP = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Puntua una vacante contra el perfil. Devuelve score 0-100, el detalle de
 * por que sumo o resto, y si quedo descartada (y por que).
 */
export function scoreJob(job, profile) {
  const reasons = [];
  const title = job.title.toLowerCase();
  const searchable = `${title}\n${job.location}\n${job.tags.join(' ')}\n${job.text}`.toLowerCase();

  // --- Descartes duros ---------------------------------------------------
  const maxAgeDays = profile.search?.maxAgeDays ?? 30;
  if (job.postedAt && Date.now() - new Date(job.postedAt).getTime() > maxAgeDays * DAY) {
    return { score: 0, rejected: true, rejectReason: `publicada hace más de ${maxAgeDays} días`, reasons, matchedSkills: [] };
  }

  // Los dealbreakers van en dos cubetas a proposito: buscar "hybrid" en toda la
  // descripcion descarta vacantes 100% remotas que solo mencionan "hybrid cloud".
  const dealbreakers = Array.isArray(profile.dealbreakers)
    ? { inTitleOrLocation: [], anywhere: profile.dealbreakers }
    : (profile.dealbreakers ?? {});

  const header = `${title}\n${job.location}\n${job.locationRestrictions.join(' ')}`.toLowerCase();
  const headerHit = (dealbreakers.inTitleOrLocation ?? []).find((term) => includesTerm(header, term));
  if (headerHit) {
    return { score: 0, rejected: true, rejectReason: `dealbreaker en título/ubicación: "${headerHit}"`, reasons, matchedSkills: [] };
  }

  const textHit = (dealbreakers.anywhere ?? []).find((term) => includesTerm(searchable, term));
  if (textHit) {
    return { score: 0, rejected: true, rejectReason: `dealbreaker: "${textHit}"`, reasons, matchedSkills: [] };
  }

  const rejectedSeniority = (profile.seniority?.reject ?? []).find((level) => includesTerm(title, level));
  if (rejectedSeniority) {
    return { score: 0, rejected: true, rejectReason: `seniority fuera de rango: "${rejectedSeniority}"`, reasons, matchedSkills: [] };
  }

  // Filtro de relevancia: sin puesto objetivo y sin skills tuyas, no es tu vacante.
  const core = profile.skills?.core ?? [];
  const titleHit = (profile.targetTitles ?? []).find((target) => title.includes(target.toLowerCase()));
  const coreInTitle = matchedTerms(title, core);
  const coreInBody = matchedTerms(searchable, core).filter((skill) => !coreInTitle.includes(skill));

  if (!titleHit && !coreInTitle.length && coreInBody.length < 2) {
    return { score: 0, rejected: true, rejectReason: 'no coincide con tu stack ni con los puestos que buscas', reasons, matchedSkills: [] };
  }

  // --- Puntuacion --------------------------------------------------------
  let score = 0;

  if (titleHit) {
    score += 25;
    reasons.push(`+25 el puesto coincide con "${titleHit}"`);
  }

  if (coreInTitle.length) {
    const points = Math.min(coreInTitle.length * 8, 24);
    score += points;
    reasons.push(`+${points} skills clave en el título: ${coreInTitle.join(', ')}`);
  }

  if (coreInBody.length) {
    const points = Math.min(coreInBody.length * 5, 25);
    score += points;
    reasons.push(`+${points} skills clave en la descripción: ${coreInBody.join(', ')}`);
  }

  const nice = matchedTerms(searchable, profile.skills?.nice ?? []);
  if (nice.length) {
    const points = Math.min(nice.length * 2, 10);
    score += points;
    reasons.push(`+${points} skills deseables: ${nice.join(', ')}`);
  }

  // Tipo de contrato: para un segundo empleo, part-time/contract vale oro.
  const employmentBonus = profile.employmentPreference?.[job.employmentType];
  if (employmentBonus) {
    score += employmentBonus;
    reasons.push(`+${employmentBonus} tipo de contrato: ${job.employmentType}`);
  }
  if (job.employmentType === 'unknown' && /part[\s-]?time|20 hours|contract/i.test(searchable)) {
    score += 5;
    reasons.push('+5 la descripción menciona medio tiempo o contrato');
  }

  // Compatibilidad geografica y de horario.
  const accepted = (profile.search?.acceptedRegions ?? []).map((r) => r.toLowerCase());
  const restrictions = job.locationRestrictions ?? [];
  const utcOffset = profile.location?.utcOffset;

  if (job.timezones?.length && utcOffset !== undefined) {
    if (job.timezones.includes(utcOffset)) {
      score += 12;
      reasons.push(`+12 tu zona horaria (UTC${utcOffset}) está permitida`);
    } else {
      score -= 20;
      reasons.push(`-20 tu zona horaria (UTC${utcOffset}) no está en el rango pedido`);
    }
  }

  if (!restrictions.length) {
    score += 6;
    reasons.push('+6 sin restricción de país declarada');
  } else {
    const ok = restrictions.some((place) => accepted.some((region) => place.includes(region)));
    if (ok) {
      score += 10;
      reasons.push(`+10 ubicación compatible: ${restrictions.slice(0, 3).join(', ')}`);
    } else {
      score -= 25;
      reasons.push(`-25 restringida a: ${restrictions.slice(0, 3).join(', ')}`);
    }
  }

  // Señales de texto libre: fuentes como Hacker News o WWR no traen metadatos,
  // pero el propio anuncio dice si contrata en todo el mundo o solo en EE.UU.
  if (/remote\s*\(?\s*(global|worldwide|anywhere)|worldwide|work from anywhere|globally distributed|\blatam\b|latin america/i.test(searchable)) {
    score += 12;
    reasons.push('+12 el anuncio dice que contrata en cualquier parte del mundo / LATAM');
  } else if (/remote\s*\(?\s*(us|usa|u\.s\.)\b|us[- ]only|united states only|must be based in the us/i.test(searchable)) {
    score -= 15;
    reasons.push('-15 el anuncio limita el remoto a EE.UU.');
  }

  // Sueldo.
  const minAnnual = profile.salary?.minAnnual;
  const jobAnnual = toAnnual(job.salaryMin, job.salaryPeriod);
  if (jobAnnual && minAnnual) {
    if (jobAnnual >= minAnnual) {
      score += 8;
      reasons.push(`+8 sueldo publicado (${Math.round(jobAnnual / 1000)}k) sobre tu mínimo`);
    } else {
      score -= 12;
      reasons.push(`-12 sueldo publicado (${Math.round(jobAnnual / 1000)}k) bajo tu mínimo`);
    }
  } else if (job.salaryText || job.salaryMin) {
    score += 3;
    reasons.push('+3 publica sueldo');
  }

  // Recencia: una vacante de hoy tiene mucha menos competencia acumulada.
  if (job.postedAt) {
    const ageDays = (Date.now() - new Date(job.postedAt).getTime()) / DAY;
    if (ageDays <= 2) { score += 10; reasons.push('+10 publicada en las últimas 48h'); }
    else if (ageDays <= 7) { score += 5; reasons.push('+5 publicada esta semana'); }
    else if (ageDays > 14) { score -= 5; reasons.push('-5 lleva más de 2 semanas publicada'); }
  }

  const matchedSkills = [...new Set([...coreInTitle, ...coreInBody, ...nice])];
  const finalScore = CLAMP(Math.round(score), 0, 100);

  return {
    score: finalScore,
    rejected: false,
    rejectReason: null,
    reasons,
    matchedSkills,
  };
}

/** Puntua, descarta y ordena. Devuelve tambien las descartadas para auditar el filtro. */
export function rankJobs(jobs, profile) {
  const scored = [];
  const rejected = [];

  for (const job of jobs) {
    const result = scoreJob(job, profile);
    const entry = { ...job, ...result };
    if (result.rejected) rejected.push(entry);
    else scored.push(entry);
  }

  scored.sort((a, b) => b.score - a.score || (b.postedAt ?? '').localeCompare(a.postedAt ?? ''));
  return { scored, rejected };
}
