import { readFileSync, writeFileSync } from 'node:fs';

const normalizeSlug = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const sourceBrainrots = JSON.parse(readFileSync('src/data/brainrots.json', 'utf8'));
const legacyBrainrots = JSON.parse(readFileSync('data/brainrots.json', 'utf8'));
const legacyByName = new Map(
  legacyBrainrots.map((item) => [String(item.name).trim().toLowerCase(), item])
);
const seenSlugs = new Map();

const normalMutation = {
  name: 'Normal',
  incomeMultiplier: 1,
  tradeValueMultiplier: null,
  source: null,
  verifiedAt: null,
  confidence: 'unknown'
};

const enrichedBrainrots = sourceBrainrots.map((item) => {
  const legacy = legacyByName.get(String(item.name).trim().toLowerCase()) || {};
  const baseSlug = legacy.slug || normalizeSlug(item.name);
  const seenCount = seenSlugs.get(baseSlug) || 0;
  const slug = seenCount > 0 ? `${baseSlug}-${seenCount + 1}` : baseSlug;
  seenSlugs.set(baseSlug, seenCount + 1);

  return {
    id: legacy.id || slug,
    slug,
    name: item.name,
    rarity: item.rarity,
    categories: legacy.categories || [],
    image: legacy.image || '/assets/icons/icon-192.png',
    imageSource: legacy.imageSource || 'placeholder',
    imageLicense: legacy.imageLicense || 'temporary generic placeholder',
    purchaseCost: legacy.purchaseCost ?? null,
    baseIncomePerSecond: legacy.baseIncomePerSecond ?? null,
    tradeValue: legacy.tradeValue ?? null,
    tradeValueMin: legacy.tradeValueMin ?? null,
    tradeValueMax: legacy.tradeValueMax ?? null,
    incomePerSecond: legacy.incomePerSecond ?? legacy.baseIncomePerSecond ?? null,
    demand: legacy.demand ?? legacy.demandLabel ?? null,
    demandScore: legacy.demandScore ?? null,
    demandLabel: legacy.demandLabel ?? null,
    valueSource: legacy.valueSource || [],
    valueVerifiedAt: legacy.valueVerifiedAt ?? null,
    valueConfidence: legacy.valueConfidence || 'unknown',
    obtainable: legacy.obtainable ?? null,
    availability: legacy.availability || (
      legacy.obtainable === false ? 'unavailable' : legacy.obtainable === true ? 'available' : 'unknown'
    ),
    acquisitionMethod: legacy.acquisitionMethod ?? null,
    eventName: legacy.eventName ?? null,
    limitedQuantity: legacy.limitedQuantity ?? null,
    releaseDate: legacy.releaseDate ?? null,
    mutations: Array.isArray(legacy.mutations) && legacy.mutations.length
      ? legacy.mutations
      : [normalMutation],
    existCount: legacy.existCount ?? legacy.limitedQuantity ?? null,
    existCountType: legacy.existCountType || 'unknown',
    existCountSource: legacy.existCountSource ?? null,
    existCountVerifiedAt: legacy.existCountVerifiedAt ?? null,
    existCountConfidence: legacy.existCountConfidence || 'unknown',
    existCountDisputed: legacy.existCountDisputed ?? false,
    scarcityLevel: legacy.scarcityLevel || 'unknown',
    sources: legacy.sources || ['Steal a Brainrot Wiki MediaWiki API'],
    confidence: legacy.confidence || 'review',
    lastVerifiedAt: legacy.lastVerifiedAt || '2026-06-30T01:41:58Z',
    active: legacy.active ?? true
  };
});

writeFileSync('src/data/brainrots.json', `${JSON.stringify(enrichedBrainrots, null, 2)}\n`);
