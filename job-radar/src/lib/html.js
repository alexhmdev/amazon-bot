const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-', '&rsquo;': "'",
};

/** Convierte la descripcion HTML de las vacantes en texto plano buscable. */
export function stripHTML(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncate(text = '', max = 280) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function escapeHTML(text = '') {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/** Greenhouse devuelve el HTML doblemente escapado (&lt;div&gt;): hay que decodificar antes de limpiar. */
export function decodeEntities(text = '') {
  return String(text)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}
