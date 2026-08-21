/**
 * Borrador de mensaje de aplicacion. No inventa nada: solo cruza lo que TU
 * pusiste en profile.json con las skills que la vacante realmente pide.
 * La idea es que lo edites, no que lo mandes tal cual.
 */
export function buildLetter(job, profile) {
  const skills = (job.matchedSkills ?? [])
    .filter((skill) => (profile.skills?.core ?? []).includes(skill))
    .slice(0, 4);
  const skillList = skills.length ? skills.join(', ') : (profile.skills?.core ?? []).slice(0, 3).join(', ');

  return `Asunto: ${job.title} — ${profile.name}

Hola equipo de ${job.company}:

Vi la vacante de ${job.title} y quiero postularme. ${profile.coverLetter?.pitch ?? ''}

Coincido con lo que piden en ${skillList}. ${
    job.matchedSkills?.length
      ? `Vi que la descripción menciona ${job.matchedSkills.slice(0, 5).join(', ')}; es justo el stack en el que trabajo a diario.`
      : ''
  }

Disponibilidad: ${profile.coverLetter?.availability ?? 'a convenir'}.
Zona horaria: UTC${profile.location?.utcOffset ?? ''} (${profile.location?.country ?? ''}).

Aquí está mi trabajo:
- GitHub: ${profile.github ?? '—'}
- LinkedIn: ${profile.linkedin ?? '—'}${profile.portfolio ? `\n- Portafolio: ${profile.portfolio}` : ''}

Quedo atento,
${profile.name}
${profile.email ?? ''}

--- Antes de enviar ---
[ ] Cambia la primera línea por algo concreto del producto de ${job.company}
[ ] Verifica que cumples los requisitos duros de la vacante
[ ] Vacante: ${job.url}`;
}
