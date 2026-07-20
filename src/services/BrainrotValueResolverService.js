import { VALUE_ESTIMATION_CONFIG } from '../config/value-estimation-config.js';

const hasNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

const toNumber = (value) => (hasNumber(value) ? Number(value) : null);

const median = (values) => {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const roundValue = (value) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 100) return Math.max(1, Math.round(value));
  if (value < 1000) return Math.round(value / 5) * 5;
  if (value < 100000) return Math.round(value / 50) * 50;
  return Math.round(value / 500) * 500;
};

export const BrainrotValueResolverService = {
  configure(brainrots = []) {
    const knownValues = brainrots
      .map((pet) => this.getCommunityValue(pet)?.value)
      .filter((value) => Number.isFinite(value) && value > 0);
    const globalMedian = median(knownValues);
    const rarityMedians = {};

    for (const pet of brainrots) {
      if (!pet?.rarity) continue;
      const value = this.getCommunityValue(pet)?.value;
      if (!Number.isFinite(value) || value <= 0) continue;
      if (!rarityMedians[pet.rarity]) rarityMedians[pet.rarity] = [];
      rarityMedians[pet.rarity].push(value);
    }

    this.cache = {
      globalMedian,
      rarityMedians: Object.fromEntries(
        Object.entries(rarityMedians).map(([rarity, values]) => [rarity, median(values)])
      )
    };
    return this;
  },

  getCommunityValue(pet) {
    const baseTradeValue = toNumber(pet?.baseTradeValue);
    if (baseTradeValue && baseTradeValue > 0) {
      return {
        value: baseTradeValue,
        sourceType: 'community',
        confidence: pet.valueConfidence || 'high',
        warning: ''
      };
    }

    const tradeValue = toNumber(pet?.tradeValue);
    if (tradeValue && tradeValue > 0) {
      return {
        value: tradeValue,
        sourceType: 'community',
        confidence: pet.valueConfidence || 'medium',
        warning: ''
      };
    }

    const min = toNumber(pet?.tradeValueMin);
    const max = toNumber(pet?.tradeValueMax);
    if (min && max && min > 0 && max > 0) {
      return {
        value: (min + max) / 2,
        sourceType: 'range',
        confidence: pet.valueConfidence || 'medium',
        warning: 'Valor calculado pela media da faixa conhecida.'
      };
    }

    return null;
  },

  getRarityMedian(rarity) {
    const configured = this.cache || {};
    if (configured.rarityMedians?.[rarity]) return configured.rarityMedians[rarity];
    const globalMedian = configured.globalMedian || 550;
    const multiplier = VALUE_ESTIMATION_CONFIG.rarityFallbackMultipliers[rarity] || 1;
    return globalMedian * multiplier;
  },

  estimateFromSignals(pet, sourceType) {
    const rarityBase = this.getRarityMedian(pet?.rarity);
    if (!Number.isFinite(rarityBase) || rarityBase <= 0) return null;

    const cost = toNumber(pet?.purchaseCost);
    const income = toNumber(pet?.incomePerSecond ?? pet?.baseIncomePerSecond);
    const { costDivisor, incomeDivisor, maxScore } = VALUE_ESTIMATION_CONFIG.normalization;
    const { cost: costWeight, income: incomeWeight, rarity: rarityWeight } = VALUE_ESTIMATION_CONFIG.estimateWeights;

    const costScore = cost ? Math.min(Math.log10(cost / costDivisor + 1), maxScore) : 0;
    const incomeScore = income ? Math.min(Math.log10(income / incomeDivisor + 1), maxScore) : 0;
    const score = 1 + costScore * costWeight + incomeScore * incomeWeight + rarityWeight;
    const value = roundValue(rarityBase * score);
    if (!value) return null;

    return {
      value,
      sourceType,
      confidence: 'experimental',
      warning: VALUE_ESTIMATION_CONFIG.warnings.experimental
    };
  },

  resolve(pet) {
    const community = this.getCommunityValue(pet);
    if (community) {
      return {
        ...community,
        value: community.value
      };
    }

    const hasCost = hasNumber(pet?.purchaseCost) && Number(pet.purchaseCost) > 0;
    const hasIncome = hasNumber(pet?.incomePerSecond ?? pet?.baseIncomePerSecond)
      && Number(pet?.incomePerSecond ?? pet?.baseIncomePerSecond) > 0;

    if (hasCost && hasIncome) return this.estimateFromSignals(pet, 'cost_income_estimate');
    if (hasIncome) return this.estimateFromSignals(pet, 'income_estimate');
    if (hasCost) return this.estimateFromSignals(pet, 'cost_estimate');

    const rarityValue = roundValue(this.getRarityMedian(pet?.rarity));
    if (rarityValue) {
      return {
        value: rarityValue,
        sourceType: 'rarity_estimate',
        confidence: 'experimental',
        warning: VALUE_ESTIMATION_CONFIG.warnings.experimental
      };
    }

    return {
      value: null,
      sourceType: 'unavailable',
      confidence: 'unknown',
      warning: VALUE_ESTIMATION_CONFIG.warnings.unavailable
    };
  }
};
