export const VALUE_ESTIMATION_CONFIG = {
  rarityFallbackMultipliers: {
    Common: 0.18,
    Rare: 0.32,
    Epic: 0.62,
    Legendary: 1,
    Mythic: 1.65,
    'Brainrot God': 2.8,
    Secret: 4.6,
    OG: 7.5
  },
  estimateWeights: {
    cost: 0.42,
    income: 0.48,
    rarity: 0.1
  },
  normalization: {
    costDivisor: 1000000,
    incomeDivisor: 10000,
    maxScore: 8
  },
  warnings: {
    experimental: 'Este pet nao possui valor comunitario verificado. O resultado abaixo usa uma estimativa matematica.',
    unavailable: 'Nao foi possivel estimar este pet com os dados atuais.'
  }
};
