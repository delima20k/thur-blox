const MULTIPLIERS = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  t: 1_000_000_000_000
};

export function parseGameNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const text = value
    .trim()
    .replace(/\$/g, '')
    .replace(/\s+/g, '')
    .replace(/\/s$/i, '')
    .toLowerCase();

  if (!text || text === 'n/a' || text === 'na' || text === 'unknown' || text === '-') return null;

  const match = text.match(/^([0-9]+(?:[.,][0-9]+)?)([kmbt])?$/i);
  if (!match) return null;

  const number = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  const multiplier = MULTIPLIERS[match[2]] || 1;
  return number * multiplier;
}
