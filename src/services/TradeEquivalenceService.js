import { TradeValueCalculatorService } from './TradeValueCalculatorService.js';
import { BrainrotValueResolverService } from './BrainrotValueResolverService.js';
import { RealTradeEquivalenceService } from './RealTradeEquivalenceService.js';

export const RARITY_ORDER = [
  'Common',
  'Rare',
  'Epic',
  'Legendary',
  'Mythic',
  'Brainrot God',
  'Secret',
  'OG'
];

export const TRADE_THRESHOLDS = {
  fair: 5,
  smallDifference: 15
};

export const SCARCITY_LABELS = {
  extremely_low_supply: 'Extremamente escasso',
  very_low_supply: 'Muito escasso',
  low_supply: 'Escasso',
  medium_supply: 'Quantidade media',
  high_supply: 'Grande quantidade',
  unknown: 'Quantidade desconhecida'
};

const RESULT_MARGINS = [5, 10, 15, 25, 40];
const DEFAULT_RESULT_LIMIT = 10;
const DEFAULT_COMBINATION_LIMIT = 10;
const MAX_COMBINATION_CANDIDATES = 100;

const getPetKey = (pet) => pet?.slug || pet?.id || pet?.name;
const getIncomeValue = (pet) => {
  const value = pet?.baseIncomePerSecond ?? pet?.incomePerSecond;
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(value);
};

const getComparableValue = (pet, resolver = null, comparisonMode = 'community') => {
  if (comparisonMode === 'income') return getIncomeValue(pet);
  if (resolver) return resolver.resolve(pet)?.value ?? null;
  return TradeValueCalculatorService.getBaseTradeValue(pet);
};
const getComparisonMultiplier = (mutation, comparisonMode = 'community') => {
  if (comparisonMode === 'income') {
    const incomeMultiplier = Number(mutation?.incomeMultiplier);
    return Number.isFinite(incomeMultiplier) && incomeMultiplier > 0 ? incomeMultiplier : 1;
  }
  return TradeValueCalculatorService.getMutationMultiplier(mutation);
};
const normalMutation = {
  slug: 'normal',
  name: 'Normal',
  incomeMultiplier: 1,
  estimatedValueMultiplier: 1,
  percentageIncrease: 0
};

const uniqueByPet = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getPetKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const TradeEquivalenceService = {
  normalizeText(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  },

  normalizeSlug(value) {
    return this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  toValidValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  },

  getBaseValue(brainrot) {
    return getComparableValue(brainrot);
  },

  getMutation(brainrot, mutationName = 'Normal') {
    const mutations = Array.isArray(brainrot?.mutations) ? brainrot.mutations : [];
    const normalizedName = this.normalizeText(mutationName || 'Normal');
    return mutations.find((mutation) => this.normalizeText(mutation.name) === normalizedName)
      || mutations.find((mutation) => this.normalizeText(mutation.name) === 'normal')
      || normalMutation;
  },

  getMutationMultiplier(mutation) {
    return TradeValueCalculatorService.getMutationMultiplier(mutation);
  },

  calculatePetValue(brainrot, quantity = 1, mutation = null) {
    return TradeValueCalculatorService.calculate({
      brainrot,
      quantity,
      mutation: mutation || normalMutation
    });
  },

  getOutcome(diffPercent) {
    if (diffPercent == null) return { key: 'review', label: 'Valor em revisao' };
    if (diffPercent >= -TRADE_THRESHOLDS.fair && diffPercent <= TRADE_THRESHOLDS.fair) {
      return { key: 'fair', label: 'Troca justa estimada' };
    }
    if (diffPercent > TRADE_THRESHOLDS.fair && diffPercent <= TRADE_THRESHOLDS.smallDifference) {
      return { key: 'small_win', label: 'Voce recebe um pouco mais' };
    }
    if (diffPercent >= -TRADE_THRESHOLDS.smallDifference && diffPercent < -TRADE_THRESHOLDS.fair) {
      return { key: 'small_loss', label: 'Voce recebe um pouco menos' };
    }
    if (diffPercent > TRADE_THRESHOLDS.smallDifference) {
      return { key: 'large_win', label: 'Voce recebe mais valor' };
    }
    return { key: 'large_loss', label: 'Voce recebe menos valor' };
  },

  compareValues(referenceValue, targetValue) {
    if (referenceValue == null || targetValue == null || referenceValue <= 0) return null;
    const difference = targetValue - referenceValue;
    const differencePercent = (difference / referenceValue) * 100;
    return {
      targetValue,
      difference,
      differencePercent,
      outcome: this.getOutcome(differencePercent)
    };
  },

  getComparablePets(brainrots, selectedPet, resolver = null, comparisonMode = 'community') {
    const selectedKey = getPetKey(selectedPet);
    return uniqueByPet(brainrots)
      .filter((pet) => getPetKey(pet) !== selectedKey)
      .filter((pet) => pet?.slug && pet?.name)
      .filter((pet) => {
        const value = getComparableValue(pet, resolver, comparisonMode);
        return Number.isFinite(value) && value > 0;
      })
      .sort((a, b) => getComparableValue(b, resolver, comparisonMode) - getComparableValue(a, resolver, comparisonMode));
  },

  getBestQuantityResult(referenceValue, pet, mutation = normalMutation, resolver = null, comparisonMode = 'community') {
    const resolvedValue = resolver?.resolve(pet);
    const baseValue = getComparableValue(pet, resolver, comparisonMode);
    if (!Number.isFinite(baseValue) || baseValue <= 0) return null;
    const multiplier = getComparisonMultiplier(mutation, comparisonMode);
    const unitValue = baseValue * multiplier;
    if (!unitValue || unitValue <= 0) return null;
    const roughQuantity = Math.max(1, Math.round(referenceValue / unitValue));
    const quantities = [roughQuantity - 1, roughQuantity, roughQuantity + 1]
      .filter((quantity) => quantity >= 1);
    return quantities
      .map((quantity) => {
        const targetValue = unitValue * quantity;
        const comparison = this.compareValues(referenceValue, targetValue);
        if (!comparison) return null;
        return {
          type: 'single',
          pets: [{
            pet,
            quantity,
            mutation,
            baseValue,
            valueSource: comparisonMode === 'income' ? 'income' : resolvedValue?.sourceType || 'community',
            valueConfidence: comparisonMode === 'income' ? pet.gameStatsConfidence || 'medium' : resolvedValue?.confidence || pet.valueConfidence || 'unknown',
            valueWarning: comparisonMode === 'income' ? '' : resolvedValue?.warning || '',
            multiplier,
            unitValue,
            value: targetValue
          }],
          value: targetValue,
          reason: `Quantidade aproximada calculada automaticamente: x${quantity}.`,
          ...comparison
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent))[0] || null;
  },

  buildSingleResults(referenceValue, candidates, mutations = [normalMutation], limit = DEFAULT_RESULT_LIMIT, resolver = null, comparisonMode = 'community') {
    const activeMutations = (mutations || [normalMutation])
      .filter((mutation) => mutation?.active !== false)
      .filter((mutation) => Number.isFinite(getComparisonMultiplier(mutation, comparisonMode)) && getComparisonMultiplier(mutation, comparisonMode) > 0);
    const candidateMutations = activeMutations.length ? activeMutations : [normalMutation];
    return candidates
      .flatMap((pet) => candidateMutations.map((mutation) => this.getBestQuantityResult(referenceValue, pet, mutation, resolver, comparisonMode)))
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent))
      .slice(0, limit);
  },

  buildCombinationResults(referenceValue, candidates, limit = DEFAULT_COMBINATION_LIMIT, resolver = null, comparisonMode = 'community') {
    const base = candidates
      .slice()
      .sort((a, b) => Math.abs(getComparableValue(a, resolver, comparisonMode) - referenceValue / 2) - Math.abs(getComparableValue(b, resolver, comparisonMode) - referenceValue / 2))
      .slice(0, MAX_COMBINATION_CANDIDATES);
    const results = [];

    for (let a = 0; a < base.length; a += 1) {
      for (let b = a + 1; b < base.length; b += 1) {
        const first = base[a];
        const second = base[b];
        const firstResolved = resolver?.resolve(first);
        const secondResolved = resolver?.resolve(second);
        const firstUnit = getComparableValue(first, resolver, comparisonMode);
        const secondUnit = getComparableValue(second, resolver, comparisonMode);
        if (!firstUnit || !secondUnit) continue;
        const total = firstUnit + secondUnit;
        const comparison = this.compareValues(referenceValue, total);
        if (!comparison) continue;
        results.push({
          type: 'combo-2',
          pets: [
            {
              pet: first,
              quantity: 1,
              mutation: normalMutation,
              baseValue: firstUnit,
              valueSource: comparisonMode === 'income' ? 'income' : firstResolved?.sourceType || 'community',
              valueConfidence: comparisonMode === 'income' ? first.gameStatsConfidence || 'medium' : firstResolved?.confidence || first.valueConfidence || 'unknown',
              valueWarning: comparisonMode === 'income' ? '' : firstResolved?.warning || '',
              multiplier: 1,
              unitValue: firstUnit,
              value: firstUnit
            },
            {
              pet: second,
              quantity: 1,
              mutation: normalMutation,
              baseValue: secondUnit,
              valueSource: comparisonMode === 'income' ? 'income' : secondResolved?.sourceType || 'community',
              valueConfidence: comparisonMode === 'income' ? second.gameStatsConfidence || 'medium' : secondResolved?.confidence || second.valueConfidence || 'unknown',
              valueWarning: comparisonMode === 'income' ? '' : secondResolved?.warning || '',
              multiplier: 1,
              unitValue: secondUnit,
              value: secondUnit
            }
          ],
          value: total,
          reason: 'Combinacao simples de dois pets normais.',
          ...comparison
        });
      }
    }

    return results
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent))
      .slice(0, limit);
  },

  findEquivalences(selected, brainrots, options = {}) {
    const selectedPet = selected.pet || selected.selectedPet;
    const quantity = Number(selected.quantity);
    const selectedMutation = selected.mutation || normalMutation;
    const comparisonMode = options.comparisonMode || selected.comparisonMode || 'community';
    if (comparisonMode === 'market' || comparisonMode === 'community') {
      return RealTradeEquivalenceService.findEquivalents({
        selectedPet,
        mutation: selectedMutation,
        quantity,
        allPets: brainrots || [],
        singleLimit: options.singleLimit || DEFAULT_RESULT_LIMIT,
        comboLimit: options.comboLimit || DEFAULT_COMBINATION_LIMIT
      });
    }
    const resolver = options.valueResolver || BrainrotValueResolverService.configure(brainrots || []);
    const selectedResolvedValue = selected.selectedResolvedValue || resolver.resolve(selectedPet);
    const selectedBaseValue = comparisonMode === 'income'
      ? getIncomeValue(selectedPet)
      : selectedResolvedValue?.value ?? null;
    const selectedUnitValue = Number.isFinite(selectedBaseValue)
      ? selectedBaseValue * getComparisonMultiplier(selectedMutation, comparisonMode)
      : null;
    const referenceValue = Number.isFinite(selectedUnitValue) && Number.isInteger(quantity) && quantity > 0
      ? selectedUnitValue * quantity
      : null;
    const diagnostics = [];
    const emptyGroups = {
      closest: [],
      smallWins: [],
      smallLosses: [],
      combinations: [],
      sameRarity: [],
      sameDemand: [],
      lowestCount: [],
      tradeOnly: [],
      mutated: []
    };

    if (!selectedPet) diagnostics.push('Pesquise um pet para descobrir o que ele pode valer.');
    if (!Number.isInteger(quantity) || quantity < 1) diagnostics.push('Informe uma quantidade inteira maior que zero.');
    if (comparisonMode === 'income' && selectedPet && selectedBaseValue == null) diagnostics.push('Este pet ainda nao possui renda-base cadastrada.');
    if (comparisonMode !== 'income' && selectedPet && selectedResolvedValue?.sourceType === 'unavailable') diagnostics.push(selectedResolvedValue.warning);
    if (comparisonMode !== 'income' && selectedPet && selectedResolvedValue?.sourceType && selectedResolvedValue.sourceType !== 'community') {
      diagnostics.push(selectedResolvedValue.warning);
    }
    if (selectedPet && (comparisonMode === 'income' ? selectedBaseValue != null : selectedResolvedValue?.value != null)) {
      diagnostics.push(comparisonMode === 'income'
        ? 'Renda calculada com base no multiplicador da mutacao.'
        : 'Valor estimado com base no multiplicador da mutacao. O mercado real pode variar.');
      if (comparisonMode !== 'income') diagnostics.push('Este valor e uma estimativa matematica. O mercado real pode variar.');
    }

    if (referenceValue == null) {
      return {
        selectedPet,
        selectedBaseValue,
        selectedUnitValue,
        selectedTotal: null,
        referenceValue: null,
        selectedValueSource: comparisonMode === 'income' ? 'income' : selectedResolvedValue?.sourceType || 'unavailable',
        selectedConfidence: comparisonMode === 'income' ? selectedPet?.gameStatsConfidence || 'unknown' : selectedResolvedValue?.confidence || 'unknown',
        comparisonMode,
        mutation: selectedMutation,
        quantity,
        marginUsed: null,
        groups: emptyGroups,
        individualResults: [],
        combinationResults: [],
        results: [],
        warnings: diagnostics,
        diagnostics
      };
    }

    const candidates = this.getComparablePets(brainrots || [], selectedPet, resolver, comparisonMode);
    if (!candidates.length) {
      return {
        selectedPet,
        selectedBaseValue,
        selectedUnitValue,
        selectedTotal: referenceValue,
        referenceValue,
        selectedValueSource: comparisonMode === 'income' ? 'income' : selectedResolvedValue?.sourceType || 'unavailable',
        selectedConfidence: comparisonMode === 'income' ? selectedPet?.gameStatsConfidence || 'unknown' : selectedResolvedValue?.confidence || 'unknown',
        comparisonMode,
        mutation: selectedMutation,
        quantity,
        marginUsed: null,
        groups: emptyGroups,
        individualResults: [],
        combinationResults: [],
        results: [],
        warnings: ['Nenhum candidato possui valor-base para comparar.'],
        diagnostics: ['Nenhum candidato possui valor-base para comparar.']
      };
    }

    const singles = this.buildSingleResults(referenceValue, candidates, options.mutations || [normalMutation], options.singleLimit || DEFAULT_RESULT_LIMIT, resolver, comparisonMode);
    const combinations = this.buildCombinationResults(referenceValue, candidates, options.comboLimit || DEFAULT_COMBINATION_LIMIT, resolver, comparisonMode);
    const allResults = [...singles, ...combinations]
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent));
    const marginUsed = RESULT_MARGINS.find((margin) => allResults.some((item) => Math.abs(item.differencePercent) <= margin)) || null;
    if (marginUsed) diagnostics.push(`Exibindo resultados dentro de uma margem de ${marginUsed}%.`);
    else diagnostics.push('Exibindo os resultados matematicamente mais proximos disponiveis.');

    return {
      selectedPet,
      selectedBaseValue,
      selectedUnitValue,
      selectedTotal: referenceValue,
      referenceValue,
      selectedValueSource: comparisonMode === 'income' ? 'income' : selectedResolvedValue?.sourceType || 'community',
      selectedConfidence: comparisonMode === 'income' ? selectedPet.gameStatsConfidence || 'unknown' : selectedResolvedValue?.confidence || selectedPet.valueConfidence || 'unknown',
      comparisonMode,
      mutation: selectedMutation,
      quantity,
      marginUsed,
      individualResults: singles,
      combinationResults: combinations,
      warnings: diagnostics,
      results: allResults,
      groups: {
        closest: singles.slice(0, 5),
        smallWins: singles.filter((item) => item.outcome.key === 'small_win'),
        smallLosses: singles.filter((item) => item.outcome.key === 'small_loss'),
        combinations,
        sameRarity: singles.filter((item) => item.pets[0].pet.rarity === selectedPet.rarity),
        sameDemand: singles.filter((item) => item.pets[0].pet.demand && item.pets[0].pet.demand === selectedPet.demand),
        lowestCount: singles.filter((item) => item.pets[0].pet.existCount != null)
          .sort((a, b) => Number(a.pets[0].pet.existCount) - Number(b.pets[0].pet.existCount))
          .slice(0, 5),
        tradeOnly: singles.filter((item) => item.pets[0].pet.availability === 'trade_only'),
        mutated: singles.filter((item) => item.pets.some((pet) => pet.mutation?.slug && pet.mutation.slug !== 'normal'))
      },
      diagnostics
    };
  },

  findEquivalents({ selectedPet, selectedResolvedValue, mutation, quantity, allPets, mutations, valueResolver, comparisonMode }) {
    return this.findEquivalences({ selectedPet, selectedResolvedValue, mutation, quantity, comparisonMode }, allPets, {
      singleLimit: DEFAULT_RESULT_LIMIT,
      comboLimit: DEFAULT_COMBINATION_LIMIT,
      mutations,
      valueResolver,
      selectedResolvedValue,
      comparisonMode
    });
  },

  validateBrainrots(brainrots) {
    const slugs = new Map();
    const names = new Map();
    const issues = {
      duplicateSlugs: [],
      duplicateNames: [],
      missingValue: [],
      missingImage: [],
      rarityConflicts: []
    };

    for (const pet of brainrots) {
      const slug = pet.slug || this.normalizeSlug(pet.name);
      const name = this.normalizeText(pet.name);
      if (slugs.has(slug)) issues.duplicateSlugs.push(slug);
      if (names.has(name)) issues.duplicateNames.push(pet.name);
      slugs.set(slug, pet);
      names.set(name, pet);
      if (getComparableValue(pet) == null) issues.missingValue.push(pet.name);
      if (!pet.image) issues.missingImage.push(pet.name);
    }

    return issues;
  },

  sortByRarityThenName(a, b) {
    const rarityDiff = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    if (rarityDiff !== 0) return rarityDiff;
    return a.name.localeCompare(b.name, 'pt-BR');
  }
};
