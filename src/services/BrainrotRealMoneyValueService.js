const DEFAULT_CURRENCY = 'BRL';

const isValidCents = (value) => Number.isInteger(value) && value > 0;

const normalizeSlug = (value) => String(value || '').trim().toLowerCase();

const normalizeEntry = (entry = {}, currency = DEFAULT_CURRENCY) => {
  const slug = normalizeSlug(entry.slug);
  const exactPriceInCents = isValidCents(entry.recommendedPriceInCents)
    ? entry.recommendedPriceInCents
    : (isValidCents(entry.priceInCents) ? entry.priceInCents : null);
  const min = isValidCents(entry.priceMinInCents) ? entry.priceMinInCents : null;
  const max = isValidCents(entry.priceMaxInCents) ? entry.priceMaxInCents : null;
  const hasRange = min != null && max != null && min <= max;

  return {
    slug,
    name: entry.name || slug,
    saleEnabled: entry.saleEnabled === true,
    priceInCents: isValidCents(entry.priceInCents) ? entry.priceInCents : null,
    priceMinInCents: min,
    priceMaxInCents: max,
    recommendedPriceInCents: isValidCents(entry.recommendedPriceInCents) ? entry.recommendedPriceInCents : null,
    marketStatus: entry.marketStatus || 'unverified',
    sourceType: entry.sourceType || 'manual',
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    verifiedAt: entry.verifiedAt || null,
    notes: entry.notes || null,
    currency,
    hasPrice: exactPriceInCents != null || hasRange,
    displayMode: exactPriceInCents != null ? 'exact' : (hasRange ? 'range' : 'unavailable'),
    displayPriceInCents: exactPriceInCents
  };
};

export class BrainrotRealMoneyValueService {
  constructor(data = {}) {
    this.dataVersion = data?.dataVersion || null;
    this.currency = data?.currency || DEFAULT_CURRENCY;
    this.updatedAt = data?.updatedAt || null;
    const items = Array.isArray(data?.items) ? data.items : [];
    this.items = items.map((entry) => normalizeEntry(entry, this.currency)).filter((entry) => entry.slug);
    this.bySlug = new Map(this.items.map((entry) => [entry.slug, entry]));
  }

  static configure(data = {}) {
    return new BrainrotRealMoneyValueService(data);
  }

  getValue(petOrSlug) {
    const slug = normalizeSlug(typeof petOrSlug === 'string' ? petOrSlug : petOrSlug?.slug);
    if (!slug) return this.buildUnavailable(null);
    return this.bySlug.get(slug) || this.buildUnavailable(slug);
  }

  buildUnavailable(slug) {
    return normalizeEntry({
      slug,
      name: slug,
      marketStatus: 'unverified',
      sourceType: 'manual'
    }, this.currency);
  }

  formatValue(entry) {
    const value = entry || this.buildUnavailable(null);
    if (value.displayMode === 'exact') return BrainrotRealMoneyValueService.formatCents(value.displayPriceInCents, value.currency);
    if (value.displayMode === 'range') {
      return `${BrainrotRealMoneyValueService.formatCents(value.priceMinInCents, value.currency)} - ${BrainrotRealMoneyValueService.formatCents(value.priceMaxInCents, value.currency)}`;
    }
    return 'Valor em reais ainda nao cadastrado';
  }

  static formatCents(valueInCents, currency = DEFAULT_CURRENCY) {
    if (!isValidCents(valueInCents)) return 'Valor em reais ainda nao cadastrado';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valueInCents / 100).replace(/\u00A0/g, ' ');
  }
}
