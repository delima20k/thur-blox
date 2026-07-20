import { readFileSync, writeFileSync } from 'node:fs';

const brainrots = JSON.parse(readFileSync('src/data/brainrots.json', 'utf8'));
const marketValues = JSON.parse(readFileSync('src/data/brainrot-market-values.json', 'utf8'));
const marketSlugs = new Set(marketValues.map((value) => value.brainrotSlug));

for (const pet of brainrots) {
  pet.tradeValue = null;
  pet.tradeValueMin = null;
  pet.tradeValueMax = null;
  pet.demand = null;
  pet.valueSource = [];
  pet.valueSources = [];
  pet.valueVerifiedAt = null;
  pet.valueConfidence = 'unknown';
}

const missingMarketValues = brainrots
  .filter((pet) => !marketSlugs.has(pet.slug))
  .map((pet) => ({
    brainrotSlug: pet.slug,
    name: pet.name,
    reason: 'Nenhuma fonte comunitaria confiavel encontrada',
    searchedSources: ['Game.Guide'],
    status: 'review'
  }));

writeFileSync('src/data/brainrots.json', `${JSON.stringify(brainrots, null, 2)}\n`);
writeFileSync('src/data/brainrots-missing-market-values.json', `${JSON.stringify(missingMarketValues, null, 2)}\n`);
