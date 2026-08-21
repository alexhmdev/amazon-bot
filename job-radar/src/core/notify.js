/**
 * Aviso por WhatsApp usando la API REST de Twilio (misma cuenta que amazon-bot).
 * Se llama directo con fetch para no depender del SDK.
 */
export function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_NUMBER &&
    process.env.PHONE_TO_NOTIFY
  );
}

export function buildMessage(jobs) {
  const lines = [`🎯 ${jobs.length} vacante(s) nuevas para ti:`, ''];

  for (const job of jobs) {
    lines.push(`▸ ${job.score}/100 · ${job.title}`);
    lines.push(`  ${job.company}${job.location ? ` — ${job.location}` : ''}`);
    if (job.salaryText) lines.push(`  💵 ${job.salaryText}`);
    lines.push(`  ${job.url}`);
    lines.push('');
  }

  lines.push('Fuentes: Remotive, Remote OK, Himalayas y bolsas oficiales de empresa.');
  return lines.join('\n');
}

export async function sendWhatsApp(body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const params = new URLSearchParams({
    From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    To: `whatsapp:${process.env.PHONE_TO_NOTIFY}`,
    Body: body,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export async function notifyNewJobs(jobs, { minScore = 70, maxJobs = 5 } = {}) {
  const candidates = jobs
    .filter((job) => job.score >= minScore && !job.notified)
    .slice(0, maxJobs);

  if (!candidates.length) return { sent: 0, reason: 'ninguna vacante supera el mínimo' };
  if (!twilioConfigured()) return { sent: 0, reason: 'Twilio no configurado (revisa .env)' };

  await sendWhatsApp(buildMessage(candidates));
  for (const job of candidates) job.notified = true;

  return { sent: candidates.length, reason: null };
}
