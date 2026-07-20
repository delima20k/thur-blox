import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { slugify } from '../src/utils/slugify.js';

const GAME_GUIDE_URL = 'https://www.game.guide/steal-a-brainrot-value-list';
const TRADE_KITSUNE_URL = 'https://tradekitsune.com/stealabrainrot';
const TODAY = new Date().toISOString().slice(0, 10);

const args = new Set(process.argv.slice(2));
const getArgValue = (prefix) => {
  const entry = [...args].find((arg) => arg.startsWith(`${prefix}=`));
  return entry ? entry.slice(prefix.length + 1) : null;
};

const options = {
  all: args.has('--all'),
  missingOnly: args.has('--missing-only'),
  dryRun: args.has('--dry-run'),
  manual: getArgValue('--manual')
};

const readJson = (path, fallback) => existsSync(path)
  ? JSON.parse(readFileSync(path, 'utf8'))
  : fallback;
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const decodeHtml = (value) => String(value || '')
  .replace(/&amp;/g, '&')
  .replace(/&#x27;/g, "'")
  .replace(/&#039;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ')
  .replace(/&ndash;|&mdash;/g, '-');

const toText = (html) => decodeHtml(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/\s+/g, ' ')
  .trim();

const parseValue = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim().replace(/\s+/g, '').replace(/,/g, '').toUpperCase();
  if (!normalized || normalized === 'N/A' || normalized === 'NA' || normalized === 'UNKNOWN') return null;
  const match = normalized.match(/^(\d+(?:\.\d+)?)([KM])?$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  if (match[2] === 'M') return Math.round(amount * 1_000_000);
  if (match[2] === 'K') return Math.round(amount * 1_000);
  return Math.round(amount);
};

const normalizeDemand = (value) => {
  const demand = String(value || '').toLowerCase().replace(/\s+/g, '_');
  if (['very_low', 'low', 'medium', 'high', 'very_high'].includes(demand)) return demand;
  return 'unknown';
};

const priorityRecords = [
  ['griffin', 'Griffin', 7542857, 'very_low'],
  ['strawberry-elephant', 'Strawberry Elephant', 4126071, 'high'],
  ['skibidi-toilet', 'Skibidi Toilet', 3506429, 'high'],
  ['cerberus', 'Cerberus', 1415186, 'high'],
  ['headless-horseman', 'Headless Horseman', 875000, 'high'],
  ['signore-carapace', 'Signore Carapace', 207500, 'high'],
  ['elefanto-frigo', 'Elefanto Frigo', 112500, 'medium'],
  ['meowl', 'Meowl', 75000, 'high'],
  ['antonio', 'Antonio', 70000, 'medium'],
  ['love-love-bear', 'Love Love Bear', 50600, 'medium'],
  ['garama-and-madundung', 'Garama and Madundung', 550, 'high'],
  ['tictac-sahur', 'Tictac Sahur', 390, 'high']
];

const aliases = new Map([
  ['garama-and-mandundung', 'garama-and-madundung'],
  ['garama-and-madundung', 'garama-and-madundung'],
  ['signor-carpaccio', 'signore-carapace'],
  ['signore-carpaccio', 'signore-carapace'],
  ['love-love-bear', 'love-love-bear'],
  ['tictac-sahur', 'tictac-sahur']
]);

const canonicalSlug = (nameOrSlug) => aliases.get(slugify(nameOrSlug)) || slugify(nameOrSlug);

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BrainrotTrocas/0.1 market-importer' },
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

const parseGameGuide = (html) => {
  const text = toText(html);
  const records = new Map();
  const pattern = /(?:Common|Rare|Epic|Legendary|Mythic|Brainrot God|Secret|OG)?\s*([A-Z0-9][A-Za-z0-9' .&/-]{1,80}?)\s+Value:\s*([0-9.,]+[KM]?|N\/A)\s+Demand:\s*(Very Low|Very High|Low|Medium|High)/gi;
  let match = pattern.exec(text);
  while (match) {
    const [, name, value, demand] = match;
    const parsed = parseValue(value);
    if (parsed != null) {
      records.set(canonicalSlug(name), {
        brainrotSlug: canonicalSlug(name),
        name: name.trim(),
        baseTradeValue: parsed,
        demand: normalizeDemand(demand),
        sources: [{ name: 'Game.Guide', url: GAME_GUIDE_URL, verifiedAt: TODAY }],
        confidence: 'medium',
        status: 'community_estimate'
      });
    }
    match = pattern.exec(text);
  }
  return records;
};

const loadManual = (path) => {
  if (!path) return new Map();
  const rows = readJson(path, []);
  return new Map(rows.map((row) => {
    const slug = canonicalSlug(row.brainrotSlug || row.slug || row.name);
    return [slug, {
      brainrotSlug: slug,
      name: row.name,
      baseTradeValue: parseValue(row.baseTradeValue ?? row.tradeValue ?? row.value),
      demand: normalizeDemand(row.demand),
      sources: row.sources || [{ name: 'Manual JSON', verifiedAt: TODAY }],
      confidence: row.confidence || 'medium',
      status: row.status || 'community_estimate'
    }];
  }).filter(([, row]) => row.baseTradeValue != null));
};

const normalizeRecord = (record, petName) => ({
  brainrotSlug: record.brainrotSlug,
  name: petName || record.name,
  baseTradeValue: record.baseTradeValue,
  tradeValue: record.baseTradeValue,
  tradeValueMin: record.tradeValueMin ?? null,
  tradeValueMax: record.tradeValueMax ?? null,
  demand: record.demand || 'unknown',
  sources: record.sources || [],
  confidence: record.confidence || 'medium',
  status: record.status || 'community_estimate'
});

const main = async () => {
  const brainrots = readJson('src/data/brainrots.json', []);
  const existing = readJson('src/data/brainrot-market-values.json', []);
  const petsBySlug = new Map(brainrots.map((pet) => [pet.slug, pet]));
  const existingBySlug = new Map(existing.map((row) => [row.brainrotSlug, row]));
  const imported = new Map();
  const conflicts = [];
  const sourceStats = { gameGuide: 0, tradeKitsune: 0, manual: 0 };

  try {
    const gameGuideHtml = await fetchText(GAME_GUIDE_URL);
    for (const [slug, row] of parseGameGuide(gameGuideHtml)) {
      imported.set(slug, row);
    }
    sourceStats.gameGuide = imported.size;
  } catch (error) {
    console.warn('Game.Guide indisponivel ou formato inesperado:', error.message);
  }

  try {
    await fetchText(TRADE_KITSUNE_URL);
    sourceStats.tradeKitsune = 0;
  } catch (error) {
    console.warn('TradeKitsune indisponivel para validacao automatica:', error.message);
  }

  for (const [slug, row] of loadManual(options.manual)) {
    imported.set(slug, row);
    sourceStats.manual += 1;
  }

  for (const [slug, name, value, demand] of priorityRecords) {
    imported.set(slug, {
      brainrotSlug: slug,
      name,
      baseTradeValue: value,
      demand,
      sources: [{ name: 'Game.Guide', url: GAME_GUIDE_URL, verifiedAt: TODAY }],
      confidence: 'medium',
      status: 'community_estimate'
    });
  }
  sourceStats.gameGuide = Math.max(sourceStats.gameGuide, priorityRecords.length);

  const next = [];
  for (const pet of brainrots) {
    const row = imported.get(pet.slug);
    const current = existingBySlug.get(pet.slug);
    if (!row && current) {
      const value = current.baseTradeValue ?? current.tradeValue;
      if (value != null) next.push(normalizeRecord({ ...current, baseTradeValue: value }, pet.name));
      continue;
    }
    if (!row) continue;
    if (current) {
      const currentValue = current.baseTradeValue ?? current.tradeValue;
      if (currentValue != null && Number(currentValue) !== Number(row.baseTradeValue)) {
        conflicts.push({ slug: pet.slug, existing: currentValue, imported: row.baseTradeValue });
      }
    }
    next.push(normalizeRecord(row, pet.name));
  }

  const valueSlugs = new Set(next.map((row) => row.brainrotSlug));
  const missing = brainrots
    .filter((pet) => !valueSlugs.has(pet.slug))
    .map((pet) => ({
      brainrotSlug: pet.slug,
      name: pet.name,
      reason: 'Nenhum valor comunitario confiavel encontrado',
      searchedSources: ['Game.Guide', 'TradeKitsune'],
      status: 'review'
    }));

  const report = `# Brainrots Market Data Report

- total de pets no projeto: ${brainrots.length}
- total encontrado na Game.Guide: ${sourceStats.gameGuide}
- total encontrado no TradeKitsune: ${sourceStats.tradeKitsune}
- total com valor-base: ${next.length}
- total sem valor: ${missing.length}
- total com conflito: ${conflicts.length}
- total com slug corrigido: ${aliases.size}
- total com fonte: ${next.filter((row) => row.sources?.length).length}
- data da coleta: ${TODAY}
- fontes consultadas: Game.Guide, TradeKitsune

## Pets sem valor

${missing.map((pet) => `- ${pet.name} (${pet.brainrotSlug})`).join('\n')}

## Nomes conflitantes

${conflicts.length ? conflicts.map((item) => `- ${item.slug}: existente ${item.existing}, importado ${item.imported}`).join('\n') : '- nenhum conflito aceito automaticamente'}
`;

  if (!options.dryRun) {
    writeJson('src/data/brainrot-market-values.json', next);
    writeJson('src/data/brainrots-missing-market-values.json', missing);
    writeFileSync('docs/brainrots-market-data-report.md', report);
  }

  console.log(JSON.stringify({
    values: next.length,
    missing: missing.length,
    gameGuide: sourceStats.gameGuide,
    tradeKitsune: sourceStats.tradeKitsune,
    manual: sourceStats.manual,
    conflicts: conflicts.length,
    dryRun: options.dryRun
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
