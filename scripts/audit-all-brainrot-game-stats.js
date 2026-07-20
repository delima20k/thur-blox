import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const readJson = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

const brainrots = readJson('src/data/brainrots.json');
const gameStats = readJson('src/data/brainrot-game-stats.json');
const images = readJson('src/data/brainrot-images.json');
const imageSlugs = new Set(images.map((entry) => entry.brainrotSlug).filter(Boolean));
const statsBySlug = new Map(gameStats.map((entry) => [entry.brainrotSlug, entry]));
const rows = [];

const hasPositiveNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) > 0;

let withCost = 0;
let withIncome = 0;
let withoutCost = 0;
let withoutIncome = 0;
let withSource = 0;
let conflicts = 0;
let invalid = 0;
let incomeComparable = 0;
const pending = [];

for (const pet of brainrots) {
  const stat = statsBySlug.get(pet.slug);
  const cost = stat?.purchaseCost ?? pet.purchaseCost ?? null;
  const income = stat?.baseIncomePerSecond ?? pet.baseIncomePerSecond ?? pet.incomePerSecond ?? null;
  const sourceCount = stat?.sources?.length || 0;
  const conflict = stat?.status === 'conflicting';
  const isInvalid = stat?.status === 'invalid';
  const pendingReason = hasPositiveNumber(income)
    ? ''
    : stat ? `renda-base pendente (${stat.status || 'review'})` : 'sem registro em brainrot-game-stats.json';
  if (hasPositiveNumber(cost)) withCost += 1;
  else withoutCost += 1;
  if (hasPositiveNumber(income)) {
    withIncome += 1;
    incomeComparable += 1;
  } else {
    withoutIncome += 1;
  }
  if (sourceCount) withSource += 1;
  if (conflict) conflicts += 1;
  if (isInvalid) invalid += 1;
  if (pendingReason) pending.push(`- ${pet.slug} | ${pet.name} | ${pet.rarity} | ${pendingReason}`);
  rows.push(`| ${pet.slug} | ${pet.name} | ${pet.rarity} | ${cost ?? 'null'} | ${income ?? 'null'} | ${sourceCount ? 'sim' : 'nao'} | ${stat?.confidence || 'unknown'} | ${stat?.status || 'missing'} | ${hasPositiveNumber(income) ? 'sim' : 'nao'} | ${pendingReason || (conflict ? 'conflito' : '')} |`);
}

const report = [
  '# Auditoria completa dos dados-base de Brainrots',
  '',
  `Data: ${new Date().toISOString()}`,
  '',
  '## Resumo',
  '',
  `- Total de pets: ${brainrots.length}`,
  `- Total com custo: ${withCost}`,
  `- Total com renda-base: ${withIncome}`,
  `- Total sem custo: ${withoutCost}`,
  `- Total sem renda: ${withoutIncome}`,
  `- Total com conflito: ${conflicts}`,
  `- Total invalido: ${invalid}`,
  `- Total com fonte: ${withSource}`,
  `- Total apto para comparacao por renda: ${incomeComparable}`,
  '',
  '## Pendentes',
  '',
  ...pending,
  '',
  '## Linhas',
  '',
  '| slug | nome | raridade | custo | renda-base | fonte | confianca | status | comparavel por renda | pendencia |',
  '| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |',
  ...rows
].join('\n');

const output = resolve(root, 'docs', 'all-brainrot-game-stats-audit.md');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${report}\n`);
console.log(JSON.stringify({ total: brainrots.length, withCost, withIncome, withoutCost, withoutIncome, conflicts, invalid, withSource, incomeComparable }, null, 2));
