import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/env.js';

/** Carga profile.json (tu perfil real) o cae al ejemplo avisando. */
export function loadProfile() {
  const real = resolve(ROOT, 'profile.json');
  const example = resolve(ROOT, 'profile.example.json');

  if (existsSync(real)) {
    return { profile: JSON.parse(readFileSync(real, 'utf8')), isExample: false };
  }
  if (existsSync(example)) {
    return { profile: JSON.parse(readFileSync(example, 'utf8')), isExample: true };
  }
  throw new Error('No encontré profile.json ni profile.example.json en job-radar/');
}
