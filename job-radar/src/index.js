#!/usr/bin/env node
import { loadEnv } from './lib/env.js';
import { loadProfile } from './core/config.js';
import { fetchAll } from './sources/index.js';
import { rankJobs } from './core/score.js';
import { load, save, upsertMany, query, findById, STATUSES } from './core/store.js';
import { notifyNewJobs } from './core/notify.js';
import { writeReport } from './core/report.js';
import { buildLetter } from './core/letter.js';

loadEnv();

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
};

const scoreColor = (score) => (score >= 75 ? c.green : score >= 55 ? c.yellow : c.dim);

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(args[i]);
  }
  return { flags, positional };
}

function printJob(job, index) {
  const paint = scoreColor(job.score);
  const rank = index === undefined ? '' : c.dim(`${String(index + 1).padStart(2)}. `);
  console.log(`${rank}${paint(c.bold(String(job.score).padStart(3)))} ${c.bold(job.title)}`);
  const place = job.location?.length > 70 ? `${job.location.slice(0, 70)}…` : job.location;
  console.log(`    ${job.company}${place ? c.dim(` · ${place}`) : ''}`);
  const bits = [job.employmentType, job.seniority, job.status, job.source].filter((b) => b && b !== 'unknown');
  if (job.salaryText) bits.push(c.green(job.salaryText));
  console.log(`    ${c.dim(bits.join(' · '))}`);
  console.log(`    ${c.blue(job.url)}`);
  console.log(`    ${c.dim(`id: ${job.id}`)}`);
  console.log('');
}

// --- comandos ------------------------------------------------------------

async function cmdSearch(flags) {
  const { profile, isExample } = loadProfile();
  if (isExample) {
    console.log(c.yellow('⚠  Usando profile.example.json. Copia a profile.json y ponlo con TUS datos.\n'));
  }

  console.log(c.bold(`🛰  Buscando vacantes para: ${profile.headline ?? profile.name}\n`));

  const results = await fetchAll(profile.sources ?? {});
  const all = [];
  for (const { key, jobs, error, ms } of results) {
    const status = error ? c.red(`error: ${String(error).slice(0, 60)}`) : c.green(`${jobs.length} vacantes`);
    console.log(`  ${key.padEnd(10)} ${status} ${c.dim(`${ms}ms`)}`);
    all.push(...jobs);
  }

  const { scored, rejected } = rankJobs(all, profile);
  const minScore = Number(flags.min ?? profile.search?.minScore ?? 45);
  const relevant = scored.filter((job) => job.score >= minScore);

  console.log(
    `\n${c.bold(String(all.length))} revisadas · ${c.dim(`${rejected.length} descartadas por filtros`)} · ` +
    `${c.bold(c.green(String(relevant.length)))} con score ≥ ${minScore}\n`
  );

  const db = load();
  const { fresh, updated } = upsertMany(db, relevant);
  console.log(`${c.green(`${fresh.length} nuevas`)} · ${c.dim(`${updated} ya conocidas`)}\n`);

  const limit = Number(flags.limit ?? 15);
  const top = query(db, { minScore, limit, exclude: ['discarded', 'rejected', 'applied'] });
  console.log(c.bold(`── Top ${Math.min(limit, top.length)} ─────────────────────────────\n`));
  top.forEach(printJob);

  if (flags.notify) {
    try {
      const { sent, reason } = await notifyNewJobs(Object.values(db.jobs), {
        minScore: Number(process.env.NOTIFY_MIN_SCORE ?? 70),
        maxJobs: Number(process.env.NOTIFY_MAX_JOBS ?? 5),
      });
      console.log(sent ? c.green(`📲 WhatsApp enviado con ${sent} vacante(s).`) : c.dim(`Sin aviso: ${reason}`));
    } catch (err) {
      console.log(c.red(`No pude enviar el WhatsApp: ${err.message}`));
    }
  }

  save(db);
  const file = writeReport(query(db, { minScore: 0, limit: 300 }), db.meta);
  console.log(c.dim(`\nReporte HTML: ${file}`));
}

function cmdList(flags) {
  const db = load();
  const jobs = query(db, {
    status: flags.status,
    minScore: Number(flags.min ?? 0),
    limit: Number(flags.limit ?? 20),
    source: flags.source,
  });
  if (!jobs.length) return console.log(c.dim('Nada guardado todavía. Corre: npm run search'));
  jobs.forEach(printJob);
  console.log(c.dim(`${jobs.length} vacante(s).`));
}

function cmdShow(positional) {
  const db = load();
  const job = findById(db, positional[0]);
  if (!job) return console.log(c.red('No encontré esa vacante (revisa el id).'));

  console.log(`\n${c.bold(job.title)} — ${job.company}`);
  console.log(`${c.blue(job.url)}\n`);
  console.log(`Score ${scoreColor(job.score)(job.score)} · ${job.status} · ${job.employmentType} · ${job.seniority}`);
  if (job.salaryText) console.log(`Sueldo: ${job.salaryText}`);
  console.log(`Visto por primera vez: ${new Date(job.firstSeen).toLocaleString('es-MX')}`);
  console.log(`\n${c.bold('Por qué puntuó así:')}`);
  for (const reason of job.reasons ?? []) console.log(`  ${reason}`);
  console.log(`\n${c.bold('Extracto:')}\n${c.dim(job.excerpt)}\n`);
}

function cmdMark(positional, flags) {
  const [id, status] = positional;
  if (!STATUSES.includes(status)) {
    return console.log(c.red(`Estado inválido. Usa uno de: ${STATUSES.join(', ')}`));
  }
  const db = load();
  const job = findById(db, id);
  if (!job) return console.log(c.red('No encontré esa vacante (revisa el id).'));

  job.status = status;
  if (status === 'applied') job.appliedAt = new Date().toISOString();
  if (flags.note) job.notes = String(flags.note);
  save(db);
  console.log(c.green(`✓ ${job.title} @ ${job.company} → ${status}`));
}

function cmdLetter(positional) {
  const db = load();
  const job = findById(db, positional[0]);
  if (!job) return console.log(c.red('No encontré esa vacante (revisa el id).'));
  const { profile } = loadProfile();
  console.log(`\n${buildLetter(job, profile)}\n`);
}

function cmdStats() {
  const db = load();
  const jobs = Object.values(db.jobs);
  if (!jobs.length) return console.log(c.dim('Sin datos todavía. Corre: npm run search'));

  const byStatus = {};
  for (const job of jobs) byStatus[job.status] = (byStatus[job.status] ?? 0) + 1;

  console.log(`\n${c.bold('Embudo')}`);
  for (const status of STATUSES) {
    if (byStatus[status]) console.log(`  ${status.padEnd(10)} ${String(byStatus[status]).padStart(4)}`);
  }

  const applied = jobs.filter((j) => j.status === 'applied' || j.status === 'interview');
  const interviews = jobs.filter((j) => j.status === 'interview');
  console.log(`\n  Aplicadas: ${applied.length} · Entrevistas: ${interviews.length}` +
    (applied.length ? ` · Tasa de respuesta: ${Math.round((interviews.length / applied.length) * 100)}%` : ''));
  console.log(c.dim(`\n  Búsquedas ejecutadas: ${db.meta.runs ?? 0} · última: ${db.meta.lastRun ?? '—'}\n`));
}

function cmdReport() {
  const db = load();
  const file = writeReport(query(db, { limit: 300 }), db.meta);
  console.log(c.green(`Reporte generado: ${file}`));
}

function help() {
  console.log(`
${c.bold('Job Radar')} — encuentra y organiza vacantes que encajan con tu perfil

  ${c.bold('npm run search')} [--min 60] [--limit 20] [--notify]
      Consulta todas las fuentes, puntúa, guarda las nuevas y regenera el reporte.
      --notify manda las mejores por WhatsApp (Twilio).

  ${c.bold('npm run list')} [--status new] [--min 70] [--limit 20] [--source himalayas]
  ${c.bold('npm start -- show')} <id>            Detalle y desglose del score
  ${c.bold('npm start -- mark')} <id> <estado>   ${STATUSES.join(' | ')}
  ${c.bold('npm start -- letter')} <id>          Borrador de mensaje de aplicación
  ${c.bold('npm run report')}                    Regenera report.html
  ${c.bold('npm run stats')}                     Embudo: aplicadas, entrevistas, tasa de respuesta
`);
}

const [command, ...rest] = process.argv.slice(2);
const { flags, positional } = parseFlags(rest);

const commands = {
  search: () => cmdSearch(flags),
  list: () => cmdList(flags),
  show: () => cmdShow(positional),
  mark: () => cmdMark(positional, flags),
  letter: () => cmdLetter(positional),
  report: () => cmdReport(),
  stats: () => cmdStats(),
  help: () => help(),
};

try {
  await (commands[command] ?? help)();
} catch (err) {
  console.error(c.red(`\n✗ ${err.message}`));
  process.exitCode = 1;
}
