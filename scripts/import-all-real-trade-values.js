import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGameNumber } from '../src/utils/parseGameNumber.js';
import { slugify } from '../src/utils/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const inputJsonArg = process.argv.find((arg) => arg.startsWith('--input-json='));
const inputCsvArg = process.argv.find((arg) => arg.startsWith('--input-csv='));
const now = new Date().toISOString();
const outputFile = resolve(root, 'src', 'data', 'brainrot-real-trade-values.json');
const reportFile = resolve(root, 'docs', 'real-trade-values-import-report.md');

const readJson = (file, fallback = []) => {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) return fallback;
  return JSON.parse(readFileSync(absolute, 'utf8') || JSON.stringify(fallback));
};
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return parseGameNumber(value) ?? (Number.isFinite(Number(value)) ? Number(value) : null);
};
const normalizeStatus = (value, hasValue) => {
  if (['confirmed', 'estimated', 'conflicting', 'unavailable'].includes(value)) return value;
  return hasValue ? 'estimated' : 'unavailable';
};

const parseDelimitedFile = (file, delimiter) => {
  const absolute = resolve(root, file);
  const lines = readFileSync(absolute, 'utf8').split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(delimiter).map((header) => header.trim());
  return lines.map((line) => {
    const values = line.split(delimiter).map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
};

const loadManualImports = () => {
  if (inputJsonArg) return JSON.parse(readFileSync(resolve(root, inputJsonArg.split('=')[1]), 'utf8'));
  if (inputCsvArg) return parseDelimitedFile(inputCsvArg.split('=')[1], ',');
  return [];
};

const brainrots = readJson('src/data/brainrots.json');
const legacyMarket = readJson('src/data/brainrot-market-values.json');
const existingReal = readJson('src/data/brainrot-real-trade-values.json');
const manualRows = loadManualImports();
const bySlug = new Map();
const historyBySlug = new Map(existingReal.map((record) => [record.brainrotSlug, record]));

const normalizeSources = (record) => {
  const sources = record.marketSources || record.sources || [];
  return sources.map((source) => {
    if (typeof source === 'string') return { sourceName: source, sourceUrl: null, value: null, verifiedAt: now, confidence: 'unknown' };
    return {
      sourceName: source.sourceName || source.name || 'Fonte comunitaria',
      sourceUrl: source.sourceUrl || source.url || null,
      value: toNumber(source.value ?? record.communityTradeValue ?? record.baseTradeValue ?? record.tradeValue),
      verifiedAt: source.verifiedAt || record.marketVerifiedAt || record.verifiedAt || now,
      confidence: source.confidence || record.marketConfidence || record.confidence || 'medium'
    };
  });
};

const normalizeRecord = (pet, record = {}) => {
  const value = toNumber(record.communityTradeValue ?? record.baseTradeValue ?? record.tradeValue ?? record.value);
  const min = toNumber(record.tradeValueMin);
  const max = toNumber(record.tradeValueMax);
  const hasValue = value != null || min != null || max != null;
  const previous = historyBySlug.get(pet.slug);
  return {
    brainrotSlug: pet.slug,
    name: pet.name,
    rarity: pet.rarity,
    communityTradeValue: value,
    tradeValueMin: min,
    tradeValueMax: max,
    demandScore: Number.isFinite(Number(record.demandScore)) ? Number(record.demandScore) : null,
    demandLabel: record.demandLabel || record.demand || 'unknown',
    trend: record.trend || 'unknown',
    existCount: toNumber(record.existCount),
    existCountType: record.existCountType || 'unknown',
    existCountSource: record.existCountSource || null,
    existCountVerifiedAt: record.existCountVerifiedAt || null,
    existCountConfidence: record.existCountConfidence || 'unknown',
    existCountDisputed: Boolean(record.existCountDisputed),
    marketSources: normalizeSources(record),
    marketVerifiedAt: record.marketVerifiedAt || record.verifiedAt || normalizeSources(record).find((source) => source.verifiedAt)?.verifiedAt || null,
    marketConfidence: record.marketConfidence || record.confidence || (hasValue ? 'medium' : 'unknown'),
    marketStatus: normalizeStatus(record.marketStatus || record.status, hasValue),
    formerTradeValues: previous?.formerTradeValues || [],
    notes: hasValue ? '' : 'Valor real de troca ainda nao confirmado por fonte comunitaria.'
  };
};

for (const pet of brainrots) {
  bySlug.set(pet.slug, normalizeRecord(pet));
}

for (const record of legacyMarket) {
  const slug = record.brainrotSlug || slugify(record.name);
  const pet = brainrots.find((item) => item.slug === slug);
  if (!pet) continue;
  bySlug.set(slug, normalizeRecord(pet, record));
}

for (const row of manualRows) {
  const slug = row.brainrotSlug || row.slug || slugify(row.name);
  const pet = brainrots.find((item) => item.slug === slug);
  if (!pet) continue;
  const previous = bySlug.get(slug);
  const incoming = normalizeRecord(pet, row);
  const previousValue = previous?.communityTradeValue;
  if (previousValue != null && incoming.communityTradeValue != null && Number(previousValue) !== Number(incoming.communityTradeValue)) {
    incoming.formerTradeValues = [
      ...(previous.formerTradeValues || []),
      {
        value: previousValue,
        replacedAt: now,
        source: previous.marketSources?.[0]?.sourceName || 'snapshot anterior'
      }
    ];
  }
  bySlug.set(slug, incoming);
}

const output = brainrots.map((pet) => bySlug.get(pet.slug));
const withValue = output.filter((record) => record.communityTradeValue != null || record.tradeValueMin != null || record.tradeValueMax != null).length;
const withExistCount = output.filter((record) => record.existCount != null && record.existCountConfidence !== 'unknown').length;
const unavailable = output.length - withValue;
const report = [
  '# Importacao de valores reais de troca',
  '',
  `Data: ${now}`,
  `Dry run: ${dryRun ? 'sim' : 'nao'}`,
  `Pets processados: ${output.length}`,
  `Com valor comunitario: ${withValue}`,
  `Sem valor real: ${unavailable}`,
  `Com existCount confiavel: ${withExistCount}`,
  `Importacao manual: ${manualRows.length}`,
  '',
  '## Sem valor real',
  '',
  ...output.filter((record) => record.marketStatus === 'unavailable').map((record) => `- ${record.brainrotSlug} | ${record.name}`)
].join('\n');

if (!dryRun) {
  mkdirSync(dirname(outputFile), { recursive: true });
  mkdirSync(dirname(reportFile), { recursive: true });
  writeJson(outputFile, output);
  writeFileSync(reportFile, `${report}\n`);
} else {
  console.log(report);
}
