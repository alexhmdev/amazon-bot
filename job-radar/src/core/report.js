import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escapeHTML, truncate } from '../lib/html.js';
import { ROOT } from '../lib/env.js';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—';

const scoreClass = (score) => (score >= 75 ? 'hot' : score >= 55 ? 'warm' : 'cold');

function salaryLabel(job) {
  if (job.salaryText) return job.salaryText;
  if (job.salaryMin && job.salaryMax) {
    return `${job.currency ?? ''} ${Math.round(job.salaryMin / 1000)}k–${Math.round(job.salaryMax / 1000)}k`;
  }
  if (job.salaryMin) return `${job.currency ?? ''} desde ${Math.round(job.salaryMin / 1000)}k`;
  return '';
}

function jobCard(job) {
  const salary = salaryLabel(job);
  return `
  <article class="card" data-status="${job.status}" data-score="${job.score}">
    <header>
      <span class="score ${scoreClass(job.score)}">${job.score}</span>
      <div>
        <h2><a href="${escapeHTML(job.url)}" target="_blank" rel="noopener">${escapeHTML(job.title)}</a></h2>
        <p class="company">${escapeHTML(job.company)}${job.location ? ` · ${escapeHTML(truncate(job.location, 90))}` : ''}</p>
      </div>
    </header>
    <ul class="meta">
      <li>${escapeHTML(job.employmentType)}</li>
      <li>${escapeHTML(job.seniority)}</li>
      <li>${fmtDate(job.postedAt)}</li>
      <li class="src">${escapeHTML(job.source)}</li>
      ${salary ? `<li class="pay">${escapeHTML(salary)}</li>` : ''}
      <li class="status">${escapeHTML(job.status)}</li>
    </ul>
    ${job.matchedSkills?.length ? `<p class="skills">${job.matchedSkills.map((s) => `<span>${escapeHTML(s)}</span>`).join('')}</p>` : ''}
    <p class="excerpt">${escapeHTML(truncate(job.excerpt ?? '', 260))}</p>
    <details><summary>Por qué puntuó ${job.score}</summary><ul class="why">${(job.reasons ?? [])
      .map((r) => `<li>${escapeHTML(r)}</li>`)
      .join('')}</ul>
      <p class="cli">Marcar: <code>npm start -- mark ${job.id} applied</code></p>
    </details>
  </article>`;
}

export function renderHTML(jobs, meta = {}) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Job Radar — ${jobs.length} vacantes</title>
<style>
  :root { color-scheme: light dark;
    --bg:#f6f7f9; --card:#fff; --text:#16181d; --muted:#6b7280; --line:#e5e7eb;
    --hot:#0f9d58; --warm:#d97706; --cold:#6b7280; --accent:#2563eb; }
  @media (prefers-color-scheme: dark) { :root {
    --bg:#0d1117; --card:#161b22; --text:#e6edf3; --muted:#8b949e; --line:#26303b;
    --hot:#3fb950; --warm:#d29922; --cold:#8b949e; --accent:#58a6ff; } }
  * { box-sizing:border-box }
  body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--text);
    font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  .wrap { max-width:900px; margin:0 auto }
  h1 { font-size:1.5rem; margin:0 0 4px }
  .sub { color:var(--muted); margin:0 0 20px; font-size:.9rem }
  .filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px }
  input, select { padding:8px 10px; border:1px solid var(--line); border-radius:8px;
    background:var(--card); color:var(--text); font:inherit }
  input { flex:1; min-width:200px }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px;
    padding:16px; margin-bottom:12px }
  .card header { display:flex; gap:12px; align-items:flex-start }
  h2 { font-size:1.05rem; margin:0 0 2px }
  a { color:var(--accent); text-decoration:none } a:hover { text-decoration:underline }
  .company { margin:0; color:var(--muted); font-size:.88rem }
  .score { flex:0 0 46px; height:46px; border-radius:10px; display:grid; place-items:center;
    font-weight:700; color:#fff; background:var(--cold) }
  .score.hot { background:var(--hot) } .score.warm { background:var(--warm) }
  .meta { list-style:none; display:flex; flex-wrap:wrap; gap:6px; padding:0; margin:12px 0 0 }
  .meta li { font-size:.75rem; color:var(--muted); border:1px solid var(--line);
    padding:2px 8px; border-radius:999px }
  .meta .pay { color:var(--hot); border-color:var(--hot) }
  .skills { margin:10px 0 0; display:flex; flex-wrap:wrap; gap:6px }
  .skills span { font-size:.72rem; background:var(--accent); color:#fff; padding:2px 8px; border-radius:6px; opacity:.9 }
  .excerpt { color:var(--muted); font-size:.85rem; margin:10px 0 0 }
  details { margin-top:10px; font-size:.82rem; color:var(--muted) }
  summary { cursor:pointer } .why { margin:8px 0 0 } .cli code { font-size:.78rem }
  footer { color:var(--muted); font-size:.78rem; text-align:center; margin-top:32px }
</style></head><body><div class="wrap">
<h1>Job Radar</h1>
<p class="sub">${jobs.length} vacantes · última búsqueda: ${meta.lastRun ? new Date(meta.lastRun).toLocaleString('es-MX') : '—'}</p>
<div class="filters">
  <input id="q" placeholder="Filtrar por texto (react, part-time, empresa…)">
  <select id="status"><option value="">Todos los estados</option>
    <option>new</option><option>shortlist</option><option>applied</option>
    <option>interview</option><option>rejected</option><option>discarded</option></select>
  <select id="min"><option value="0">Cualquier score</option><option value="55">55+</option>
    <option value="70">70+</option><option value="85">85+</option></select>
</div>
<div id="list">${jobs.map(jobCard).join('')}</div>
<footer>Vacantes de Remotive, Remote OK, Himalayas y bolsas oficiales (Greenhouse/Lever/Ashby).<br>
Cada enlace apunta a la publicación original en su fuente.</footer>
</div>
<script>
  const list = document.getElementById('list');
  const cards = [...list.children];
  const apply = () => {
    const q = document.getElementById('q').value.toLowerCase();
    const status = document.getElementById('status').value;
    const min = Number(document.getElementById('min').value);
    for (const card of cards) {
      const okText = !q || card.textContent.toLowerCase().includes(q);
      const okStatus = !status || card.dataset.status === status;
      const okScore = Number(card.dataset.score) >= min;
      card.style.display = okText && okStatus && okScore ? '' : 'none';
    }
  };
  for (const id of ['q', 'status', 'min']) document.getElementById(id).addEventListener('input', apply);
</script></body></html>`;
}

export function writeReport(jobs, meta) {
  const file = resolve(ROOT, 'report.html');
  writeFileSync(file, renderHTML(jobs, meta));
  return file;
}
