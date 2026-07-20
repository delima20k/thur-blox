import { slugify } from '../utils/slugify.js';

const hasNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTradeValue = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().replace(',', '.');
  if (!normalized || normalized === 'N/A' || normalized === 'UNKNOWN') return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const cloneWithoutMarketValue = (pet) => ({
  ...pet,
  slug: pet.slug || slugify(pet.name),
  baseTradeValue: null,
  tradeValue: null,
  tradeValueMin: null,
  tradeValueMax: null,
  demand: null,
  trend: 'unknown',
  marketStatus: 'unavailable',
  valueSource: [],
  valueSources: [],
  valueVerifiedAt: null,
  valueConfidence: 'unknown'
});

let mergedBrainrots = [];
let mergedBySlug = new Map();

export const BrainrotDataService = {
  parseTradeValue,

  merge({ brainrots = [], marketValues = [], gameStats = [], images = [] }) {
    const imageSlugs = new Set(images.map((entry) => entry.brainrotSlug).filter(Boolean));
    const petsBySlug = new Map();
    const marketBySlug = new Map();
    const gameStatsBySlug = new Map();
    const diagnostics = this.validate({ brainrots, marketValues, images });

    for (const pet of brainrots) {
      const petSlug = pet.slug || slugify(pet.name);
      petsBySlug.set(petSlug, cloneWithoutMarketValue({ ...pet, slug: petSlug }));
    }

    for (const value of marketValues) {
      const valueSlug = value.brainrotSlug || slugify(value.name);
      if (!valueSlug || marketBySlug.has(valueSlug)) continue;
      marketBySlug.set(valueSlug, value);
    }

    for (const stat of gameStats) {
      const statSlug = stat.brainrotSlug || slugify(stat.name);
      if (!statSlug || gameStatsBySlug.has(statSlug)) continue;
      gameStatsBySlug.set(statSlug, stat);
    }

    const merged = [...petsBySlug.values()].map((pet) => {
      const value = marketBySlug.get(pet.slug);
      const stat = gameStatsBySlug.get(pet.slug);
      const statCost = toFiniteNumber(stat?.purchaseCost);
      const statIncome = toFiniteNumber(stat?.baseIncomePerSecond);
      const petCost = toFiniteNumber(pet.purchaseCost);
      const petIncome = toFiniteNumber(pet.baseIncomePerSecond) ?? toFiniteNumber(pet.incomePerSecond);
      const statSources = (stat?.sources || []).map((source) => (typeof source === 'string' ? { name: source } : source));
      const gameStatsVerifiedAt = statSources.find((source) => source.verifiedAt)?.verifiedAt || stat?.verifiedAt || null;
      const gameStatsPatch = stat ? {
        purchaseCost: statCost ?? petCost,
        baseIncomePerSecond: statIncome ?? petIncome,
        incomePerSecond: statIncome ?? petIncome,
        source: statSources,
        sources: statSources,
        verifiedAt: gameStatsVerifiedAt,
        confidence: stat.confidence || 'unknown',
        status: stat.status || 'review',
        gameStatsSources: statSources,
        gameStatsVerifiedAt,
        gameStatsConfidence: stat.confidence || 'unknown',
        gameStatsStatus: stat.status || 'review',
        availability: stat.availability && stat.availability !== 'unknown' ? stat.availability : pet.availability
      } : {};

      if (!value) {
        return {
          ...pet,
          ...gameStatsPatch,
          communityTradeValue: null,
          imageStatus: imageSlugs.has(pet.slug) ? 'registered' : 'missing'
        };
      }

      const communityTradeValue = parseTradeValue(value.communityTradeValue ?? value.baseTradeValue ?? value.tradeValue ?? value.marketValue ?? value.value);
      const baseTradeValue = communityTradeValue;
      const tradeValue = baseTradeValue;
      const tradeValueMin = parseTradeValue(value.tradeValueMin);
      const tradeValueMax = parseTradeValue(value.tradeValueMax);
      const normalizedSources = (value.marketSources || value.sources || []).map((source) => {
        if (typeof source === 'string') return { name: source };
        if (source.sourceName || source.sourceUrl) {
          return {
            name: source.sourceName || 'Fonte comunitaria',
            url: source.sourceUrl || null,
            value: source.value ?? null,
            verifiedAt: source.verifiedAt || null,
            confidence: source.confidence || value.marketConfidence || value.confidence || 'unknown'
          };
        }
        return source;
      });
      const verifiedAt = normalizedSources.find((source) => source.verifiedAt)?.verifiedAt || value.marketVerifiedAt || value.verifiedAt || null;

      return {
        ...pet,
        ...gameStatsPatch,
        communityTradeValue,
        baseTradeValue,
        tradeValue,
        tradeValueMin,
        tradeValueMax,
        demand: value.demandLabel || value.demand || 'unknown',
        demandLabel: value.demandLabel || value.demand || 'unknown',
        demandScore: value.demandScore ?? null,
        trend: value.trend || 'unknown',
        marketStatus: value.marketStatus || value.status || 'community_estimate',
        valueSource: normalizedSources,
        valueSources: normalizedSources,
        marketSources: normalizedSources,
        valueVerifiedAt: verifiedAt,
        marketVerifiedAt: verifiedAt,
        valueConfidence: value.marketConfidence || value.confidence || 'unknown',
        marketConfidence: value.marketConfidence || value.confidence || 'unknown',
        existCount: value.existCount ?? pet.existCount ?? null,
        existCountType: value.existCountType || pet.existCountType || 'unknown',
        existCountSource: value.existCountSource || pet.existCountSource || null,
        existCountVerifiedAt: value.existCountVerifiedAt || pet.existCountVerifiedAt || null,
        existCountConfidence: value.existCountConfidence || pet.existCountConfidence || 'unknown',
        existCountDisputed: value.existCountDisputed ?? pet.existCountDisputed ?? false,
        imageStatus: imageSlugs.has(pet.slug) ? 'registered' : 'missing'
      };
    });

    mergedBrainrots = merged;
    mergedBySlug = new Map(merged.map((pet) => [pet.slug, pet]));

    return { brainrots: merged, diagnostics };
  },

  getAll() {
    return mergedBrainrots;
  },

  getBySlug(slug) {
    return mergedBySlug.get(slug) || null;
  },

  validate({ brainrots = [], marketValues = [], images = [] }) {
    const petSlugs = new Map();
    const marketSlugs = new Map();
    const imageSlugs = new Set(images.map((entry) => entry.brainrotSlug).filter(Boolean));
    const issues = {
      emptySlugs: [],
      duplicateSlugs: [],
      valueWithoutPet: [],
      petWithoutValue: [],
      nameMismatches: [],
      rarityConflicts: [],
      nonNumericValues: [],
      petWithoutImage: []
    };

    for (const pet of brainrots) {
      const slug = pet.slug || slugify(pet.name);
      if (!slug) issues.emptySlugs.push(pet.name || '(sem nome)');
      if (petSlugs.has(slug)) issues.duplicateSlugs.push(slug);
      petSlugs.set(slug, pet);
      if (!imageSlugs.has(slug)) issues.petWithoutImage.push(slug);
    }

    for (const value of marketValues) {
      const slug = value.brainrotSlug || slugify(value.name);
      if (!slug) issues.emptySlugs.push(value.name || '(valor sem nome)');
      if (marketSlugs.has(slug)) issues.duplicateSlugs.push(slug);
      marketSlugs.set(slug, value);
      const pet = petSlugs.get(slug);
      if (!pet) {
        issues.valueWithoutPet.push(slug);
      } else if (value.name && slugify(value.name) !== slugify(pet.name)) {
        issues.nameMismatches.push({ slug, petName: pet.name, valueName: value.name });
      }
      if (
        (value.communityTradeValue != null || value.baseTradeValue != null || value.tradeValue != null || value.marketValue != null || value.value != null)
          && !hasNumber(parseTradeValue(value.communityTradeValue ?? value.baseTradeValue ?? value.tradeValue ?? value.marketValue ?? value.value))
        || value.tradeValueMin != null && !hasNumber(parseTradeValue(value.tradeValueMin))
        || value.tradeValueMax != null && !hasNumber(parseTradeValue(value.tradeValueMax))
      ) {
        issues.nonNumericValues.push(slug);
      }
    }

    for (const slug of petSlugs.keys()) {
      if (!marketSlugs.has(slug)) issues.petWithoutValue.push(slug);
    }

    return issues;
  }
};
