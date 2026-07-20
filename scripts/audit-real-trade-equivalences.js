import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrainrotDataService } from '../src/services/BrainrotDataService.js';
import { RealTradeEquivalenceService } from '../src/services/RealTradeEquivalenceService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const readJson = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

const brainrots = readJson('src/data/brainrots.json');
const gameStats = readJson('src/data/brainrot-game-stats.json');
const realTradeValues = readJson('src/data/brainrot-real-trade-values.json');
const { brainrots: merged } = BrainrotDataService.merge({
  brainrots,
  marketValues: realTradeValues,
  gameStats,
  images: []
});

let withValue = 0;
let withoutValue = 0;
let withExistCount = 0;
let rejectedTotal = 0;
let maxSuggestedQuantity = 0;
let petsWithCandidates = 0;
const rows = [];
const rejectedRows = [];

for (const pet of merged) {
  const result = RealTradeEquivalenceService.findEquivalents({
    selectedPet: pet,
    quantity: 1,
    mutation: { slug: 'normal', name: 'Normal' },
    allPets: merged
  });
  const hasValue = pet.communityTradeValue != null || pet.tradeValueMin != null || pet.tradeValueMax != null;
  const maxQuantity = result.results.reduce((max, item) => Math.max(max, ...item.pets.map((entry) => entry.quantity)), 0);
  if (hasValue) withValue += 1;
  else withoutValue += 1;
  if (pet.existCount != null && pet.existCountConfidence !== 'unknown') withExistCount += 1;
  if (result.results.length) petsWithCandidates += 1;
  rejectedTotal += result.rejected?.length || 0;
  maxSuggestedQuantity = Math.max(maxSuggestedQuantity, maxQuantity);
  for (const rejected of result.rejected || []) {
    rejectedRows.push(`| ${pet.slug} | ${rejected.petSlug} | ${rejected.reason} | ${rejected.calculatedQuantity} | ${rejected.allowedQuantity} |`);
  }
  rows.push(`| ${pet.slug} | ${pet.name} | ${pet.rarity} | ${pet.communityTradeValue ?? 'null'} | ${pet.tradeValueMin ?? 'null'} | ${pet.tradeValueMax ?? 'null'} | ${pet.demandLabel || pet.demand || 'unknown'} | ${pet.existCount ?? 'null'} | ${pet.valueVerifiedAt || pet.marketVerifiedAt || 'null'} | ${pet.valueConfidence || pet.marketConfidence || 'unknown'} | ${result.results.length} | ${maxQuantity || 'null'} | ${result.rejected?.length || 0} | ${hasValue ? 'ok' : 'sem valor real'} |`);
}

const report = [
  '# Auditoria de equivalencias reais de troca',
  '',
  `Data: ${new Date().toISOString()}`,
  '',
  '## Resumo',
  '',
  `- Total de pets: ${merged.length}`,
  `- Pets com valor comunitario: ${withValue}`,
  `- Pets sem valor real: ${withoutValue}`,
  `- Pets com existCount confiavel: ${withExistCount}`,
  `- Pets com candidatos realistas: ${petsWithCandidates}`,
  `- Sugestoes rejeitadas: ${rejectedTotal}`,
  `- Maior quantidade sugerida: ${maxSuggestedQuantity}`,
  '',
  '## Linhas',
  '',
  '| slug | nome | raridade | valor | min | max | demanda | existCount | data | confianca | candidatos | maior quantidade | rejeitadas | status |',
  '| --- | --- | --- | ---: | ---: | ---: | --- | ---: | --- | --- | ---: | ---: | ---: | --- |',
  ...rows,
  '',
  '## Rejeicoes',
  '',
  '| pet selecionado | candidato | motivo | quantidade calculada | quantidade permitida |',
  '| --- | --- | --- | ---: | ---: |',
  ...rejectedRows
].join('\n');

const output = resolve(root, 'docs', 'real-trade-equivalence-audit.md');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${report}\n`);
console.log(JSON.stringify({
  total: merged.length,
  withValue,
  withoutValue,
  withExistCount,
  petsWithCandidates,
  rejectedTotal,
  maxSuggestedQuantity
}, null, 2));
