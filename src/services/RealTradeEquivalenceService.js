export const TRADE_QUANTITY_LIMITS = {
  OG: 10,
  Secret: 20,
  'Brainrot God': 30,
  Mythic: 50,
  Legendary: 100,
  Epic: 150,
  Rare: 250,
  Common: 500
};

const DEFAULT_RESULT_LIMIT = 10;
const DEFAULT_COMBINATION_LIMIT = 10;
const MAX_COMBINATION_CANDIDATES = 60;
const LOW_CONFIDENCE = new Set(['low', 'unknown', 'experimental']);
const STRICT_DIFF_THRESHOLD = 40;
const FALLBACK_DIFF_THRESHOLD = 80;

const normalMutation = {
  slug: 'normal',
  name: 'Normal',
  marketMultiplier: null,
  incomeMultiplier: 1
};

const hasPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const toNumber = (value) => hasPositiveNumber(value) ? Number(value) : null;
const getPetKey = (pet) => pet?.slug || pet?.id || pet?.name;

const demandScore = (pet) => {
  if (Number.isFinite(Number(pet?.demandScore))) return Number(pet.demandScore);
  const label = pet?.demandLabel || pet?.demand || 'unknown';
  return {
    very_low: 1,
    low: 2,
    medium: 3,
    high: 4,
    very_high: 5,
    unknown: 3
  }[label] || 3;
};

const getMarketValue = (pet) => {
  const direct = toNumber(pet?.communityTradeValue ?? pet?.baseTradeValue ?? pet?.tradeValue);
  if (direct) return direct;
  const min = toNumber(pet?.tradeValueMin);
  const max = toNumber(pet?.tradeValueMax);
  if (min && max) return (min + max) / 2;
  return min ?? max ?? null;
};

const getMarketRange = (pet) => ({
  min: toNumber(pet?.tradeValueMin),
  max: toNumber(pet?.tradeValueMax)
});

const getMarketMultiplier = (mutation = normalMutation) => {
  const multiplier = Number(mutation?.marketMultiplier ?? mutation?.tradeValueMultiplier);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
};

const getQuantityLimit = (pet) => {
  const rarityLimit = TRADE_QUANTITY_LIMITS[pet?.rarity] || 50;
  const existCount = toNumber(pet?.existCount);
  const maxBySupply = existCount ? Math.max(1, Math.floor(existCount * 0.01)) : rarityLimit;
  return Math.max(1, Math.min(rarityLimit, maxBySupply));
};

const classify = (referenceValue, targetValue, pet, selectedPet) => {
  const difference = targetValue - referenceValue;
  const differencePercent = (difference / referenceValue) * 100;
  const demandDelta = Math.abs(demandScore(pet) - demandScore(selectedPet));
  const confidence = pet?.marketConfidence || pet?.valueConfidence || 'unknown';
  const status = pet?.marketStatus || pet?.marketStatusLegacy || pet?.marketStatus || 'unavailable';

  if (status === 'conflicting') return { key: 'review', label: 'Resultado em revisao' };
  if (LOW_CONFIDENCE.has(confidence)) return { key: 'review', label: 'Estimativa de baixa confianca' };
  if (Math.abs(differencePercent) <= 5 && demandDelta <= 1) return { key: 'fair', label: 'Troca justa' };
  if (differencePercent > 5) return { key: 'large_win', label: 'Vantagem para voce' };
  return { key: 'large_loss', label: 'Desvantagem para voce' };
};

const buildRejection = ({ pet, mutation = normalMutation, calculatedQuantity, allowedQuantity, reason }) => ({
  reason,
  petSlug: pet?.slug,
  petName: pet?.name,
  rarity: pet?.rarity,
  mutationSlug: mutation?.slug || 'normal',
  calculatedQuantity,
  allowedQuantity
});

const uniqueByPet = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getPetKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const RealTradeEquivalenceService = {
  getMarketValue,
  getMarketRange,
  getQuantityLimit,

  resolveMarket(pet) {
    const value = getMarketValue(pet);
    if (!value) {
      return {
        value: null,
        sourceType: 'unavailable',
        confidence: pet?.marketConfidence || pet?.valueConfidence || 'unknown',
        warning: 'Este pet possui dados de renda, mas ainda nao possui valor real de troca confirmado.'
      };
    }
    return {
      value,
      sourceType: 'market',
      confidence: pet?.marketConfidence || pet?.valueConfidence || 'unknown',
      warning: ''
    };
  },

  getComparablePets(brainrots, selectedPet) {
    const selectedKey = getPetKey(selectedPet);
    return uniqueByPet(brainrots || [])
      .filter((pet) => getPetKey(pet) !== selectedKey)
      .filter((pet) => pet?.slug && pet?.name)
      .filter((pet) => getMarketValue(pet) != null)
      .sort((a, b) => Math.abs(getMarketValue(a) - getMarketValue(selectedPet)) - Math.abs(getMarketValue(b) - getMarketValue(selectedPet)));
  },

  getBestQuantityResult(referenceValue, pet, selectedPet, mutation = normalMutation, rejected = [], diffThreshold = STRICT_DIFF_THRESHOLD) {
    const baseValue = getMarketValue(pet);
    if (!baseValue) return null;
    const multiplier = getMarketMultiplier(mutation);
    const unitValue = baseValue * multiplier;
    const calculatedQuantity = Math.max(1, Math.round(referenceValue / unitValue));
    const allowedQuantity = getQuantityLimit(pet);
    const existCount = toNumber(pet.existCount);
    const maxQuantity = existCount ? Math.min(allowedQuantity, existCount) : allowedQuantity;
    const tradeLimit = (pet.rarity === 'Secret' || pet.rarity === 'OG' || pet.rarity === 'Brainrot God')
      ? Math.min(3, maxQuantity)
      : maxQuantity;

    if (tradeLimit < 1) {
      rejected.push(buildRejection({
        pet,
        mutation,
        calculatedQuantity,
        allowedQuantity: tradeLimit,
        reason: 'UNREALISTIC_QUANTITY'
      }));
      return null;
    }

    if (calculatedQuantity > maxQuantity) {
      rejected.push(buildRejection({
        pet,
        mutation,
        calculatedQuantity,
        allowedQuantity: maxQuantity,
        reason: 'UNREALISTIC_QUANTITY'
      }));
    }

    if (calculatedQuantity > tradeLimit) {
      rejected.push(buildRejection({
        pet,
        mutation,
        calculatedQuantity,
        allowedQuantity: tradeLimit,
        reason: 'RARE_PET_BULK_TRADE'
      }));
    }

    const quantities = Array.from(new Set([
      calculatedQuantity - 1,
      calculatedQuantity,
      calculatedQuantity + 1,
      tradeLimit,
      Math.max(1, tradeLimit - 1)
    ]))
      .filter((quantity) => quantity >= 1 && quantity <= tradeLimit);

    return quantities
      .map((quantity) => {
        const targetValue = unitValue * quantity;
        const difference = targetValue - referenceValue;
        const differencePercent = (difference / referenceValue) * 100;
        if (Math.abs(differencePercent) > diffThreshold) return null;
        return {
          type: 'single',
          pets: [{
            pet,
            quantity,
            mutation,
            baseValue,
            valueSource: 'market',
            valueConfidence: pet.marketConfidence || pet.valueConfidence || 'unknown',
            valueWarning: '',
            multiplier,
            unitValue,
            value: targetValue,
            tradeValueMin: pet.tradeValueMin ?? null,
            tradeValueMax: pet.tradeValueMax ?? null
          }],
          value: targetValue,
          targetValue,
          difference,
          differencePercent,
          outcome: classify(referenceValue, targetValue, pet, selectedPet),
          reason: `Quantidade limitada por raridade/oferta: calculado x${calculatedQuantity}, permitido ate x${maxQuantity}.`
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent))[0] || null;
  },

  buildSingleResults(referenceValue, candidates, selectedPet, limit = DEFAULT_RESULT_LIMIT, rejected = [], diffThreshold = STRICT_DIFF_THRESHOLD) {
    return candidates
      .map((pet) => this.getBestQuantityResult(referenceValue, pet, selectedPet, normalMutation, rejected, diffThreshold))
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent))
      .slice(0, limit);
  },

  buildCombinationResults(referenceValue, candidates, selectedPet, limit = DEFAULT_COMBINATION_LIMIT, diffThreshold = STRICT_DIFF_THRESHOLD, allowWideDifference = false) {
    const base = candidates
      .slice()
      .sort((a, b) => Math.abs(getMarketValue(a) - referenceValue / 2) - Math.abs(getMarketValue(b) - referenceValue / 2))
      .slice(0, MAX_COMBINATION_CANDIDATES);
    const results = [];

    for (let a = 0; a < base.length; a += 1) {
      for (let b = a + 1; b < base.length; b += 1) {
        const first = base[a];
        const second = base[b];
        const firstValue = getMarketValue(first);
        const secondValue = getMarketValue(second);
        if (!firstValue || !secondValue) continue;
        const targetValue = firstValue + secondValue;
        const difference = targetValue - referenceValue;
        const differencePercent = (difference / referenceValue) * 100;
        if (Math.abs(differencePercent) > diffThreshold) continue;
        results.push({
          type: 'combo-2',
          pets: [first, second].map((pet) => ({
            pet,
            quantity: 1,
            mutation: normalMutation,
            baseValue: getMarketValue(pet),
            valueSource: 'market',
            valueConfidence: pet.marketConfidence || pet.valueConfidence || 'unknown',
            valueWarning: '',
            multiplier: 1,
            unitValue: getMarketValue(pet),
            value: getMarketValue(pet)
          })),
          value: targetValue,
          targetValue,
          difference,
          differencePercent,
          outcome: classify(referenceValue, targetValue, first, selectedPet),
          reason: 'Combinacao pequena de dois pets com valor comunitario proximo.'
        });
      }
    }

    return results
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent))
      .slice(0, limit);
  },

  findEquivalents({ selectedPet, mutation = normalMutation, quantity = 1, allPets = [], singleLimit = DEFAULT_RESULT_LIMIT, comboLimit = DEFAULT_COMBINATION_LIMIT }) {
    const safeQuantity = Number(quantity);
    const selectedMarket = this.resolveMarket(selectedPet);
    const selectedMultiplier = getMarketMultiplier(mutation);
    const selectedMutationUsesMarketMultiplier = selectedMultiplier !== 1;
    const selectedBaseValue = selectedMarket.value;
    const selectedUnitValue = selectedBaseValue ? selectedBaseValue * selectedMultiplier : null;
    const referenceValue = selectedUnitValue && Number.isInteger(safeQuantity) && safeQuantity > 0
      ? selectedUnitValue * safeQuantity
      : null;
    const rejected = [];
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
    const diagnostics = [];

    if (!selectedPet) diagnostics.push('Pesquise um pet para descobrir o que ele pode valer.');
    if (!Number.isInteger(safeQuantity) || safeQuantity < 1) diagnostics.push('Informe uma quantidade inteira maior que zero.');
    if (selectedPet && selectedMarket.value == null) diagnostics.push(selectedMarket.warning);
    if (mutation?.slug && mutation.slug !== 'normal' && !selectedMutationUsesMarketMultiplier) {
      diagnostics.push('Impacto de mercado da mutacao em revisao. O valor real usa o valor normal do pet.');
    }

    if (!referenceValue) {
      return {
        selectedPet,
        selectedBaseValue,
        selectedUnitValue,
        selectedTotal: null,
        referenceValue: null,
        selectedValueSource: selectedMarket.sourceType,
        selectedConfidence: selectedMarket.confidence,
        comparisonMode: 'market',
        mutation,
        quantity: safeQuantity,
        marginUsed: null,
        groups: emptyGroups,
        individualResults: [],
        combinationResults: [],
        results: [],
        rejected,
        warnings: diagnostics,
        diagnostics
      };
    }

    diagnostics.push('Valor real de troca usa somente valores comunitarios confirmados/faixas de mercado; renda e custo ficam separados.');
    const candidates = this.getComparablePets(allPets, selectedPet);
    const singles = this.buildSingleResults(referenceValue, candidates, selectedPet, singleLimit, rejected);
    const combinations = this.buildCombinationResults(referenceValue, candidates, selectedPet, comboLimit);
    let results = [...singles, ...combinations]
      .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent));

    if (!results.length && candidates.length) {
      const fallbackSingles = this.buildSingleResults(referenceValue, candidates, selectedPet, singleLimit, rejected, FALLBACK_DIFF_THRESHOLD);
      const fallbackCombinations = this.buildCombinationResults(referenceValue, candidates, selectedPet, comboLimit, FALLBACK_DIFF_THRESHOLD);
      const fallbackResults = [...fallbackSingles, ...fallbackCombinations]
        .sort((a, b) => Math.abs(a.differencePercent) - Math.abs(b.differencePercent));

      if (fallbackResults.length) {
        results = fallbackResults;
        diagnostics.push('Sem resultados estritos suficientes; exibindo aproximacoes mais proximas de valor de troca.');
      }
    }

    if (!results.length) {
      diagnostics.push('Nao encontramos uma equivalencia realista com este pet. Tente combinar outros Brainrots de valor proximo.');
    } else {
      diagnostics.push('Exibindo apenas sugestoes dentro dos limites realistas de quantidade.');
    }
    if (rejected.length) diagnostics.push(`${rejected.length} sugestoes irreais foram rejeitadas por limite de quantidade/oferta.`);

    return {
      selectedPet,
      selectedBaseValue,
      selectedUnitValue,
      selectedTotal: referenceValue,
      referenceValue,
      selectedValueSource: selectedMarket.sourceType,
      selectedConfidence: selectedMarket.confidence,
      comparisonMode: 'market',
      mutation,
      quantity: safeQuantity,
      marginUsed: null,
      individualResults: singles,
      combinationResults: combinations,
      rejected,
      warnings: diagnostics,
      results,
      groups: {
        closest: singles.slice(0, 5),
        smallWins: singles.filter((item) => item.outcome.key === 'large_win'),
        smallLosses: singles.filter((item) => item.outcome.key === 'large_loss'),
        combinations,
        sameRarity: singles.filter((item) => item.pets[0].pet.rarity === selectedPet?.rarity),
        sameDemand: singles.filter((item) => item.pets[0].pet.demand && item.pets[0].pet.demand === selectedPet?.demand),
        lowestCount: singles.filter((item) => item.pets[0].pet.existCount != null)
          .sort((a, b) => Number(a.pets[0].pet.existCount) - Number(b.pets[0].pet.existCount))
          .slice(0, 5),
        tradeOnly: singles.filter((item) => item.pets[0].pet.availability === 'trade_only'),
        mutated: singles.filter((item) => item.pets.some((pet) => pet.mutation?.slug && pet.mutation.slug !== 'normal'))
      },
      diagnostics
    };
  }
};
