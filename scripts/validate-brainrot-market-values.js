import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const brainrots = readJson('src/data/brainrots.json');
const marketValues = readJson('src/data/brainrot-market-values.json');

const petSlugs = new Set();
const duplicatePetSlugs = new Set();
const marketSlugs = new Set();
const duplicateMarketSlugs = new Set();
const issues = {
  petWithoutSlug: [],
  valueWithoutSlug: [],
  duplicatePetSlugs: [],
  duplicateMarketSlugs: [],
  petWithoutMarketValue: [],
  marketValueWithoutPet: [],
  stringBaseTradeValue: [],
  nullBaseTradeValue: [],
  nanBaseTradeValue: [],
  zeroBaseTradeValue: [],
  negativeBaseTradeValue: [],
  oldValueFieldsWithDifferentValue: [],
  garamaSlugMismatch: []
};

for (const pet of brainrots) {
  if (!pet.slug) issues.petWithoutSlug.push(pet.name || '(sem nome)');
  if (petSlugs.has(pet.slug)) duplicatePetSlugs.add(pet.slug);
  petSlugs.add(pet.slug);
}

for (const record of marketValues) {
  const slug = record.brainrotSlug;
  if (!slug) issues.valueWithoutSlug.push(record.name || '(valor sem nome)');
  if (marketSlugs.has(slug)) duplicateMarketSlugs.add(slug);
  marketSlugs.add(slug);
  if (slug && !petSlugs.has(slug)) issues.marketValueWithoutPet.push(slug);

  if (typeof record.baseTradeValue === 'string') issues.stringBaseTradeValue.push(slug);
  if (record.baseTradeValue == null) issues.nullBaseTradeValue.push(slug);
  const numeric = Number(record.baseTradeValue);
  if (!Number.isFinite(numeric)) issues.nanBaseTradeValue.push(slug);
  else if (numeric === 0) issues.zeroBaseTradeValue.push(slug);
  else if (numeric < 0) issues.negativeBaseTradeValue.push(slug);

  for (const field of ['tradeValue', 'marketValue', 'value']) {
    if (record[field] != null && Number(record[field]) !== numeric) {
      issues.oldValueFieldsWithDifferentValue.push({ slug, field, value: record[field], baseTradeValue: record.baseTradeValue });
    }
  }

  if (record.name === 'Garama and Madundung' && slug !== 'garama-and-madundung') {
    issues.garamaSlugMismatch.push(slug);
  }
}

for (const slug of petSlugs) {
  if (!marketSlugs.has(slug)) issues.petWithoutMarketValue.push(slug);
}

issues.duplicatePetSlugs = Array.from(duplicatePetSlugs);
issues.duplicateMarketSlugs = Array.from(duplicateMarketSlugs);

const fatalIssueCount = [
  issues.petWithoutSlug,
  issues.valueWithoutSlug,
  issues.duplicatePetSlugs,
  issues.duplicateMarketSlugs,
  issues.marketValueWithoutPet,
  issues.stringBaseTradeValue,
  issues.nullBaseTradeValue,
  issues.nanBaseTradeValue,
  issues.zeroBaseTradeValue,
  issues.negativeBaseTradeValue,
  issues.oldValueFieldsWithDifferentValue,
  issues.garamaSlugMismatch
].reduce((total, list) => total + list.length, 0);

const garama = marketValues.find((record) => record.brainrotSlug === 'garama-and-madundung');
if (!garama || garama.baseTradeValue !== 550) {
  issues.garamaSlugMismatch.push('garama-and-madundung value must be 550');
}

console.log(JSON.stringify({
  totalPets: brainrots.length,
  totalMarketValues: marketValues.length,
  petsWithoutMarketValue: issues.petWithoutMarketValue.length,
  fatalIssueCount,
  issues,
  valid: fatalIssueCount === 0 && garama?.baseTradeValue === 550
}, null, 2));

if (fatalIssueCount > 0 || garama?.baseTradeValue !== 550) {
  process.exitCode = 1;
}
