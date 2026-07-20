export function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
  const text = String(value);
  if (['null', 'undefined', String(0 / 0), 'null' + 'null'].includes(text.trim())) return fallback;
  return text;
}
