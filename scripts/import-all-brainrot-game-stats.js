import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/utils/slugify.js';
import { parseGameNumber } from '../src/utils/parseGameNumber.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const all = args.has('--all');
const missingOnly = args.has('--missing-only');
const dryRun = args.has('--dry-run');
const inputJsonArg = process.argv.find((arg) => arg.startsWith('--input-json='));
const inputCsvArg = process.argv.find((arg) => arg.startsWith('--input-csv='));
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const timeoutArg = process.argv.find((arg) => arg.startsWith('--timeout-ms='));
const retriesArg = process.argv.find((arg) => arg.startsWith('--retries='));
const concurrency = Math.max(1, Math.min(6, Number(concurrencyArg?.split('=')[1]) || 3));
const requestTimeoutMs = Math.max(5000, Number(timeoutArg?.split('=')[1] ?? 15000));
const retryCount = Math.max(0, Math.min(5, Number(retriesArg?.split('=')[1] ?? 3)));
const cacheFile = resolve(root, '.tmp', 'brainrot-game-stats-api-cache.json');
const outputFile = resolve(root, 'src', 'data', 'brainrot-game-stats.json');
const reportFile = resolve(root, 'docs', 'brainrot-game-stats-import-report.md');
const apiUrl = 'https://stealabrainrot.fandom.com/api.php';
const wikiBaseUrl = 'https://stealabrainrot.fandom.com/wiki/';
const validStatuses = new Set(['confirmed', 'conflicting', 'unavailable', 'invalid', 'review']);
const validRarities = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Brainrot God', 'Secret', 'OG'];

const readJson = (file, fallback = []) => {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) return fallback;
  return JSON.parse(readFileSync(absolute, 'utf8') || JSON.stringify(fallback));
};
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const now = new Date().toISOString();

const brainrots = readJson('src/data/brainrots.json');
const currentStats = existsSync(outputFile) ? JSON.parse(readFileSync(outputFile, 'utf8')) : [];
const statsBySlug = new Map(currentStats.map((entry) => [entry.brainrotSlug, entry]));
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const reportRows = [];
const conflicts = [];
const redirects = [];
const missingPages = [];

const normalizeTitle = (name) => String(name || '').trim().replace(/\s+/g, '_');
const cleanText = (value) => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#36;/g, '$')
  .replace(/\{\{[^{}]*\}\}/g, ' ')
  .replace(/\[\[|\]\]/g, '')
  .replace(/'''?/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const pageUrl = (title) => `${wikiBaseUrl}${encodeURIComponent(normalizeTitle(title))}`;
const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const statusOrReview = (status) => validStatuses.has(status) ? status : 'review';
const normalizeRarity = (value, fallback) => {
  const text = String(value || '');
  return validRarities.find((rarity) => new RegExp(`\\b${rarity.replace(' ', '\\s+')}\\b`, 'i').test(text))
    || fallback
    || 'unknown';
};

const fetchWithRetry = async (url, retries = retryCount) => {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
          'user-agent': 'BrainrotTrocasDataImporter/1.0'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await delay(400 * (2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
};

const getCachedJson = async (key, url) => {
  if (cache[key]) return cache[key];
  const response = await fetchWithRetry(url);
  const data = await response.json();
  cache[key] = data;
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeJson(cacheFile, cache);
  return data;
};

const fetchPage = async (pet) => {
  const title = normalizeTitle(pet.name);
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'wikitext|text|displaytitle',
    redirects: 'true',
    format: 'json',
    origin: '*'
  });
  const key = `parse:${title}`;
  const data = await getCachedJson(key, `${apiUrl}?${params.toString()}`);
  if (data?.error) {
    if (data.error.code === 'missingtitle') missingPages.push(pet.slug);
    throw new Error(data.error.info || data.error.code || 'Pagina inexistente');
  }
  const pageTitle = data?.parse?.title || pet.name;
  if (slugify(pageTitle) !== slugify(pet.name)) redirects.push({ slug: pet.slug, from: pet.name, to: pageTitle });
  return data;
};

const extractRawPageText = (pageData) => {
  const parse = pageData?.parse || {};
  return [
    parse.wikitext?.['*'] || '',
    parse.text?.['*'] || '',
    parse.displaytitle || ''
  ].join('\n');
};

const fieldPatterns = (names) => names.flatMap((name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`\\|\\s*${escaped}\\s*=\\s*([^\\n\\r|<]+)`, 'i'),
    new RegExp(`${escaped}\\s*[:=]\\s*([^\\n\\r|<]+)`, 'i'),
    new RegExp(`${escaped}\\s+([^\\n\\r|<]{1,40})`, 'i')
  ];
});

const extractField = (rawText, names) => {
  const text = cleanText(rawText);
  for (const pattern of fieldPatterns(names)) {
    const match = text.match(pattern);
    if (!match) continue;
    const cleaned = cleanText(match[1]).split(/[;,]/)[0].trim();
    if (cleaned) return cleaned;
  }
  return null;
};

const extractNumbersByShape = (rawText) => {
  const text = cleanText(rawText);
  const incomeMatch = text.match(/\$?\s*[0-9]+(?:[.,][0-9]+)?\s*[KMBT]?\s*\/\s*s/i);
  const moneyMatches = [...text.matchAll(/\$?\s*[0-9]+(?:[.,][0-9]+)?\s*[KMBT]?(?!\s*\/\s*s)/gi)]
    .map((match) => match[0])
    .filter((value) => parseGameNumber(value) != null);
  return {
    incomeText: incomeMatch?.[0] || null,
    costText: moneyMatches[0] || null
  };
};

const parsePage = (pet, pageData) => {
  const rawText = extractRawPageText(pageData);
  const shaped = extractNumbersByShape(rawText);
  const costText = extractField(rawText, ['Cost', 'Price', 'Buy Price', 'Purchase Cost', 'Spawn Price']) || shaped.costText;
  const incomeText = extractField(rawText, ['Income', 'Income/s', 'Money per second', 'Cash per second', 'Base Income', 'Generation']) || shaped.incomeText;
  const rarity = normalizeRarity(extractField(rawText, ['Rarity']), pet.rarity);
  const availability = extractField(rawText, ['Availability', 'Obtainable', 'Status']) || pet.availability || 'unknown';
  const purchaseCost = parseGameNumber(costText);
  const baseIncomePerSecond = parseGameNumber(incomeText);
  const source = {
    name: 'Steal a Brainrot Wiki',
    page: pageData?.parse?.title || pet.name,
    url: pageUrl(pageData?.parse?.title || pet.name),
    verifiedAt: now
  };
  return {
    brainrotSlug: pet.slug || slugify(pet.name),
    name: pet.name,
    rarity,
    purchaseCost,
    baseIncomePerSecond,
    availability,
    sources: [source],
    confidence: isPositiveNumber(baseIncomePerSecond) ? 'high' : 'unknown',
    status: isPositiveNumber(baseIncomePerSecond) ? 'confirmed' : 'review'
  };
};

const mergeRecord = (pet, previous = {}, parsed = {}) => {
  const slug = pet.slug || slugify(pet.name);
  const previousCost = previous.purchaseCost ?? pet.purchaseCost ?? null;
  const previousIncome = previous.baseIncomePerSecond ?? pet.baseIncomePerSecond ?? pet.incomePerSecond ?? null;
  const nextCost = parsed.purchaseCost ?? previousCost ?? null;
  const nextIncome = parsed.baseIncomePerSecond ?? previousIncome ?? null;
  const recordConflicts = [];
  if (parsed.purchaseCost != null && previousCost != null && Number(parsed.purchaseCost) !== Number(previousCost)) {
    recordConflicts.push(`purchaseCost: atual=${previousCost}, importado=${parsed.purchaseCost}`);
  }
  if (parsed.baseIncomePerSecond != null && previousIncome != null && Number(parsed.baseIncomePerSecond) !== Number(previousIncome)) {
    recordConflicts.push(`baseIncomePerSecond: atual=${previousIncome}, importado=${parsed.baseIncomePerSecond}`);
  }
  if (recordConflicts.length) conflicts.push({ slug, name: pet.name, issues: recordConflicts });

  const sources = parsed.sources?.length ? parsed.sources : previous.sources || [];
  return {
    brainrotSlug: slug,
    name: pet.name,
    rarity: parsed.rarity || previous.rarity || pet.rarity || 'unknown',
    purchaseCost: nextCost,
    baseIncomePerSecond: nextIncome,
    availability: parsed.availability || previous.availability || pet.availability || 'unknown',
    sources,
    confidence: isPositiveNumber(nextIncome) ? (previous.confidence !== 'unknown' ? previous.confidence : parsed.confidence || 'medium') : 'unknown',
    status: recordConflicts.length ? 'conflicting' : isPositiveNumber(nextIncome) ? 'confirmed' : statusOrReview(parsed.status || previous.status || 'review')
  };
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
  return null;
};

const shouldImport = (pet) => {
  const slug = pet.slug || slugify(pet.name);
  const existing = statsBySlug.get(slug);
  if (all) return true;
  if (missingOnly) return !existing || existing.baseIncomePerSecond == null || existing.purchaseCost == null;
  return false;
};

const nextStats = new Map(currentStats.map((entry) => [entry.brainrotSlug, {
  ...entry,
  status: statusOrReview(entry.status)
}]));

const manualImports = loadManualImports();
if (manualImports) {
  for (const row of manualImports) {
    const slug = row.brainrotSlug || row.slug || slugify(row.name);
    const pet = brainrots.find((item) => item.slug === slug);
    if (!pet) continue;
    const parsed = {
      brainrotSlug: slug,
      name: pet.name,
      rarity: row.rarity || pet.rarity,
      purchaseCost: parseGameNumber(row.purchaseCost ?? row.cost),
      baseIncomePerSecond: parseGameNumber(row.baseIncomePerSecond ?? row.incomePerSecond ?? row.income),
      availability: row.availability || pet.availability || 'unknown',
      sources: row.source ? [{ name: row.source, verifiedAt: now }] : [],
      confidence: row.confidence || 'medium',
      status: row.status || 'confirmed'
    };
    nextStats.set(slug, mergeRecord(pet, nextStats.get(slug), parsed));
    reportRows.push(`- MANUAL ${pet.name}: custo=${parsed.purchaseCost ?? 'null'}, renda=${parsed.baseIncomePerSecond ?? 'null'}`);
  }
}

const queue = manualImports ? [] : brainrots.filter(shouldImport);
let cursor = 0;

const worker = async () => {
  while (cursor < queue.length) {
    const pet = queue[cursor];
    cursor += 1;
    try {
      const pageData = await fetchPage(pet);
      const parsed = parsePage(pet, pageData);
      const merged = mergeRecord(pet, nextStats.get(parsed.brainrotSlug), parsed);
      nextStats.set(parsed.brainrotSlug, merged);
      reportRows.push(`- OK ${pet.name}: custo=${merged.purchaseCost ?? 'null'}, renda=${merged.baseIncomePerSecond ?? 'null'}, status=${merged.status}`);
    } catch (error) {
      const slug = pet.slug || slugify(pet.name);
      nextStats.set(slug, mergeRecord(pet, nextStats.get(slug), {
        brainrotSlug: slug,
        name: pet.name,
        rarity: pet.rarity,
        purchaseCost: null,
        baseIncomePerSecond: null,
        availability: pet.availability || 'unknown',
        sources: [],
        confidence: 'unknown',
        status: 'unavailable'
      }));
      reportRows.push(`- ERRO ${pet.name}: ${error.message}`);
    }
  }
};

await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));

const output = brainrots.map((pet) => {
  const slug = pet.slug || slugify(pet.name);
  return mergeRecord(pet, nextStats.get(slug), {});
});

const confirmed = output.filter((item) => isPositiveNumber(item.baseIncomePerSecond)).length;
const withCost = output.filter((item) => isPositiveNumber(item.purchaseCost)).length;
const summary = [
  '# Importacao de dados do jogo',
  '',
  `Data: ${now}`,
  `Modo: ${all ? '--all' : missingOnly ? '--missing-only' : manualImports ? 'manual' : 'nenhum'}`,
  `Dry run: ${dryRun ? 'sim' : 'nao'}`,
  `Concorrencia: ${concurrency}`,
  `Timeout por requisicao: ${requestTimeoutMs}ms`,
  `Retries: ${retryCount}`,
  `Pets processados: ${reportRows.length}`,
  `Total final com custo: ${withCost}`,
  `Total final com renda-base: ${confirmed}`,
  `Conflitos: ${conflicts.length}`,
  `Redirecionamentos: ${redirects.length}`,
  `Paginas ausentes: ${missingPages.length}`,
  '',
  '## Redirecionamentos',
  '',
  ...redirects.map((item) => `- ${item.slug}: ${item.from} -> ${item.to}`),
  '',
  '## Conflitos',
  '',
  ...conflicts.map((item) => `- ${item.slug}: ${item.issues.join('; ')}`),
  '',
  '## Linhas',
  '',
  ...reportRows
].join('\n');

if (!dryRun) {
  writeJson(outputFile, output);
  mkdirSync(dirname(reportFile), { recursive: true });
  writeFileSync(reportFile, `${summary}\n`);
} else {
  console.log(summary);
}
