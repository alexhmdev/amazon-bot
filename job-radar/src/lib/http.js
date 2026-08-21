const USER_AGENT =
  'job-radar/1.0 (+https://github.com/alexhmdev/amazon-bot) personal job search';

/**
 * fetch con timeout y reintentos con backoff exponencial.
 * Devuelve null en vez de lanzar: si una fuente falla, las demas siguen.
 */
export async function getJSON(url, { timeout = 20000, retries = 2, headers = {} } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      });

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        return { error: `HTTP ${res.status}`, data: null };
      }
      return { error: null, data: await res.json() };
    } catch (err) {
      if (attempt === retries) return { error: err.message, data: null };
      await sleep(1000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return { error: 'unreachable', data: null };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
