import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { extname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { slugify } from '../src/utils/slugify.js';

const WIKI_API = 'https://stealabrainrot.fandom.com/api.php';
const WIKI_ORIGIN = 'https://stealabrainrot.fandom.com';
const CACHE_PATH = '.tmp/brainrot-image-api-cache.json';
const REPORT_PATH = 'docs/brainrots-images-report.md';
const MISSING_PATH = 'src/data/brainrots-missing-images.json';
const IMAGE_INDEX_PATH = 'src/data/brainrot-images.json';
const FALLBACK_IMAGE = '/assets/brainrots/fallback/brainrot-placeholder.webp';
const USER_AGENT = 'BrainrotTrocas/0.1 image-linker (local development; respectful cache)';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const REQUEST_DELAY_MS = 700;
const MAX_RETRIES = 3;
const PRIORITY_SLUGS = [
  'strawberry-elephant',
  'skibidi-toilet',
  'meowl',
  'headless-horseman',
  'john-pork',
  'spyder-elephant',
  'griffin',
  'cerberus',
  'antonio',
  'signore-carapace',
  'elefanto-frigo',
  'love-love-bear',
  'dug-dug-dug',
  'garama-and-madundung'
];

const args = new Set(process.argv.slice(2));
const getArgValue = (prefix) => {
  const entry = [...args].find((arg) => arg.startsWith(`${prefix}=`));
  return entry ? entry.slice(prefix.length + 1) : null;
};

const options = {
  all: args.has('--all'),
  dryRun: args.has('--dry-run'),
  missingOnly: args.has('--missing-only'),
  slug: getArgValue('--slug')
};

if (!options.all && !options.missingOnly && !options.slug) {
  options.missingOnly = true;
}

const readJson = (path, fallback) => {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
};

const writeJson = (path, value) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const ensureDirs = () => {
  [
    '.tmp',
    'public/assets/brainrots/original',
    'public/assets/brainrots/128',
    'public/assets/brainrots/256',
    'public/assets/brainrots/512',
    'public/assets/brainrots/fallback',
    'assets/brainrots/128',
    'assets/brainrots/256',
    'assets/brainrots/512',
    'assets/brainrots/fallback'
  ].forEach((dir) => mkdirSync(dir, { recursive: true }));
};

const normalizeTitle = (value) => slugify(String(value || '').replace(/_/g, ' '));
const wikiSearchUrl = (name) => `${WIKI_API}?action=query&format=json&origin=*&list=search&srnamespace=0&srlimit=10&srsearch=${encodeURIComponent(name)}`;
const wikiPageUrl = (title) => `${WIKI_ORIGIN}/wiki/${encodeURIComponent(title).replace(/%20/g, '_')}`;

const cache = readJson(CACHE_PATH, {});
const cacheGet = (key) => {
  const entry = cache[key];
  if (!entry || Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
  return entry.value;
};
const cacheSet = (key, value) => {
  cache[key] = { cachedAt: Date.now(), value };
};

const requestJson = async (url) => {
  const cached = cacheGet(url);
  if (cached) return cached;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await sleep(REQUEST_DELAY_MS * attempt);
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      cacheSet(url, data);
      return data;
    } catch (error) {
      lastError = error;
      await sleep(REQUEST_DELAY_MS * attempt * 2);
    }
  }
  throw lastError;
};

const requestBuffer = async (url) => {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await sleep(REQUEST_DELAY_MS * attempt);
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`INVALID_IMAGE_MIME ${contentType}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.toString('utf8', 0, 32).includes('<!DOCTYPE') || buffer.toString('utf8', 0, 32).includes('<html')) {
        throw new Error('INVALID_IMAGE_HTML');
      }
      return { buffer, contentType };
    } catch (error) {
      lastError = error;
      await sleep(REQUEST_DELAY_MS * attempt * 2);
    }
  }
  throw lastError;
};

const pageImageUrl = (title) => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    redirects: '1',
    prop: 'pageimages|info',
    inprop: 'url',
    piprop: 'original|thumbnail',
    pithumbsize: '512',
    titles: title
  });
  return `${WIKI_API}?${params.toString()}`;
};

const collectCategoryTitles = async () => {
  const titles = new Map();
  let cmcontinue = null;
  do {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      list: 'categorymembers',
      cmtitle: 'Category:Brainrots',
      cmnamespace: '0',
      cmlimit: '500'
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);
    const data = await requestJson(`${WIKI_API}?${params.toString()}`);
    for (const member of data?.query?.categorymembers || []) {
      titles.set(normalizeTitle(member.title), member.title);
    }
    cmcontinue = data?.continue?.cmcontinue || null;
  } while (cmcontinue);
  return titles;
};

const extractPage = (data) => {
  const pages = Object.values(data?.query?.pages || {});
  const page = pages[0] || null;
  const redirect = data?.query?.redirects?.[0] || null;
  if (!page || page.missing) return { page: null, redirect };
  return { page, redirect };
};

const queryPage = async (title) => extractPage(await requestJson(pageImageUrl(title)));

const searchPage = async (pet) => {
  const data = await requestJson(wikiSearchUrl(pet.name));
  const candidates = data?.query?.search || [];
  const exact = candidates.find((candidate) => normalizeTitle(candidate.title) === pet.slug);
  if (!exact) return { page: null, redirect: null, correctedTitle: null };
  const result = await queryPage(exact.title);
  return { ...result, correctedTitle: exact.title };
};

const imageUrlFromPage = (page) => page?.original?.source || page?.thumbnail?.source || null;

const sourceExtension = (contentType, url) => {
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('webp')) return '.webp';
  const ext = extname(new URL(url).pathname).toLowerCase();
  return ext || '.img';
};

const loadSharp = async () => {
  try {
    const sharpModule = await import('sharp');
    return sharpModule.default;
  } catch {
    return null;
  }
};

const processImage = async ({ sharp, slug, buffer, contentType, sourceUrl }) => {
  const ext = sourceExtension(contentType, sourceUrl);
  const originalPath = join('public/assets/brainrots/original', `${slug}${ext}`);
  writeFileSync(originalPath, buffer);

  if (!sharp) {
    return {
      processed: false,
      reason: 'Dependencia sharp ausente para converter e validar dimensoes.'
    };
  }

  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    return { processed: false, reason: 'Imagem sem dimensoes legiveis.' };
  }

  for (const size of [128, 256, 512]) {
    const output = await sharp(buffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false
      })
      .webp({ quality: 88 })
      .toBuffer();
    writeFileSync(`public/assets/brainrots/${size}/${slug}.webp`, output);
    writeFileSync(`assets/brainrots/${size}/${slug}.webp`, output);
  }

  return { processed: true, reason: null };
};

const existingIsValidated = (entry) => entry?.status === 'downloaded'
  && entry?.images?.thumbnail
  && !entry.images.thumbnail.includes('/fallback/');

const buildFallbackEntry = (pet, extra = {}) => ({
  brainrotSlug: pet.slug,
  brainrotName: pet.name,
  wikiTitle: extra.wikiTitle || null,
  wikiPageUrl: extra.wikiPageUrl || null,
  originalImageUrl: extra.originalImageUrl || null,
  images: {
    thumbnail: FALLBACK_IMAGE,
    card: FALLBACK_IMAGE,
    detail: FALLBACK_IMAGE
  },
  sourceName: extra.sourceName || null,
  sourceType: extra.sourceType || 'unknown',
  license: extra.license || null,
  usageStatus: 'review',
  verifiedAt: extra.verifiedAt || null,
  confidence: extra.confidence || 'unknown',
  status: extra.status || 'manual_review',
  notes: extra.notes || 'Fallback usado ate uma imagem confiavel ser validada.'
});

const buildDownloadedEntry = (pet, page, imageUrl, redirect) => ({
  brainrotSlug: pet.slug,
  brainrotName: pet.name,
  wikiTitle: page.title,
  wikiPageUrl: page.fullurl || wikiPageUrl(page.title),
  originalImageUrl: imageUrl,
  images: {
    thumbnail: `/assets/brainrots/128/${pet.slug}.webp`,
    card: `/assets/brainrots/256/${pet.slug}.webp`,
    detail: `/assets/brainrots/512/${pet.slug}.webp`
  },
  sourceName: 'Steal a Brainrot Wiki',
  sourceType: 'wiki',
  license: 'review',
  usageStatus: 'review',
  verifiedAt: new Date().toISOString(),
  confidence: normalizeTitle(page.title) === pet.slug ? 'high' : 'medium',
  status: 'downloaded',
  redirectFrom: redirect?.from || null,
  redirectTo: redirect?.to || null
});

const hashFile = (path) => {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
};

const writeReport = ({ brainrots, imageEntries, missingEntries, stats, duplicateHashes }) => {
  const report = `# Brainrots Images Report

- total de Brainrots: ${brainrots.length}
- total de paginas encontradas: ${stats.pagesFound}
- total de imagens encontradas: ${stats.imagesFound}
- total baixado: ${stats.downloaded}
- total ja existente: ${stats.existing}
- total usando fallback: ${imageEntries.filter((entry) => entry.images?.card === FALLBACK_IMAGE).length}
- total sem pagina: ${stats.pageNotFound}
- total sem imagem: ${stats.imageNotFound}
- total com redirecionamento: ${stats.redirected}
- total em revisao de licenca: ${imageEntries.filter((entry) => entry.usageStatus === 'review').length}
- imagens duplicadas: ${duplicateHashes.length}
- arquivos invalidos: ${stats.invalidImage}
- fontes: Steal a Brainrot Wiki API, Category:Brainrots
- data da coleta: ${new Date().toISOString()}

## Observacoes

O indice e ligado por slug e a interface usa somente arquivos locais ou fallback local. URLs externas da wiki ficam registradas apenas como fonte. Imagens continuam com licenca em revisao ate a pagina do arquivo confirmar autor/licenca individual.
`;
  writeFileSync(REPORT_PATH, report);
  writeJson(MISSING_PATH, missingEntries);
};

const main = async () => {
  ensureDirs();
  const brainrots = readJson('src/data/brainrots.json', []);
  const existingEntries = readJson(IMAGE_INDEX_PATH, []);
  const existingBySlug = new Map(existingEntries.map((entry) => [entry.brainrotSlug, entry]));
  const sharp = await loadSharp();

  const categoryTitles = await collectCategoryTitles();
  let selected = brainrots;
  if (options.slug) selected = selected.filter((pet) => pet.slug === options.slug);
  if (options.missingOnly && !options.all) {
    selected = selected.filter((pet) => {
      const entry = existingBySlug.get(pet.slug);
      return !entry || entry.images?.card === FALLBACK_IMAGE || entry.status !== 'downloaded';
    });
  }
  selected = selected.sort((a, b) => {
    const priorityDiff = PRIORITY_SLUGS.indexOf(b.slug) - PRIORITY_SLUGS.indexOf(a.slug);
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  const updatedBySlug = new Map(existingBySlug);
  const missingEntries = [];
  const stats = {
    pagesFound: 0,
    imagesFound: 0,
    downloaded: 0,
    existing: 0,
    pageNotFound: 0,
    imageNotFound: 0,
    redirected: 0,
    invalidImage: 0
  };

  for (const pet of selected) {
    const existing = existingBySlug.get(pet.slug);
    if (existingIsValidated(existing)) {
      stats.existing += 1;
      continue;
    }

    const categoryTitle = categoryTitles.get(pet.slug);
    const directTitle = categoryTitle || pet.name;
    let { page, redirect } = await queryPage(directTitle);
    let correctedTitle = null;
    if (!page) {
      const searched = await searchPage(pet);
      page = searched.page;
      redirect = searched.redirect;
      correctedTitle = searched.correctedTitle;
    }

    if (!page || normalizeTitle(page.title) !== pet.slug && correctedTitle == null && !categoryTitle) {
      stats.pageNotFound += 1;
      const reason = page ? 'Titulo da pagina nao confirmado como o mesmo Brainrot.' : 'Pagina nao encontrada';
      updatedBySlug.set(pet.slug, buildFallbackEntry(pet, {
        status: page ? 'manual_review' : 'page_not_found',
        wikiTitle: page?.title || null,
        wikiPageUrl: page?.fullurl || null,
        notes: reason
      }));
      missingEntries.push({
        brainrotSlug: pet.slug,
        brainrotName: pet.name,
        wikiSearchUrl: wikiSearchUrl(pet.name),
        reason,
        status: 'manual_review'
      });
      continue;
    }

    stats.pagesFound += 1;
    if (redirect) stats.redirected += 1;
    const imageUrl = imageUrlFromPage(page);
    if (!imageUrl) {
      stats.imageNotFound += 1;
      updatedBySlug.set(pet.slug, buildFallbackEntry(pet, {
        status: 'image_not_found',
        wikiTitle: page.title,
        wikiPageUrl: page.fullurl || wikiPageUrl(page.title),
        sourceName: 'Steal a Brainrot Wiki',
        sourceType: 'wiki',
        verifiedAt: new Date().toISOString(),
        notes: 'Pagina encontrada, mas a API nao retornou imagem principal.'
      }));
      missingEntries.push({
        brainrotSlug: pet.slug,
        brainrotName: pet.name,
        wikiSearchUrl: wikiSearchUrl(pet.name),
        reason: 'Imagem nao encontrada',
        status: 'manual_review'
      });
      continue;
    }

    stats.imagesFound += 1;
    if (options.dryRun) {
      updatedBySlug.set(pet.slug, buildFallbackEntry(pet, {
        status: 'license_review',
        wikiTitle: page.title,
        wikiPageUrl: page.fullurl || wikiPageUrl(page.title),
        originalImageUrl: imageUrl,
        sourceName: 'Steal a Brainrot Wiki',
        sourceType: 'wiki',
        verifiedAt: new Date().toISOString(),
        confidence: normalizeTitle(page.title) === pet.slug ? 'high' : 'medium',
        notes: 'Dry run: imagem identificada, download nao executado.'
      }));
      continue;
    }

    try {
      const download = await requestBuffer(imageUrl);
      const processed = await processImage({
        sharp,
        slug: pet.slug,
        buffer: download.buffer,
        contentType: download.contentType,
        sourceUrl: imageUrl
      });
      if (!processed.processed) {
        updatedBySlug.set(pet.slug, buildFallbackEntry(pet, {
          status: 'manual_review',
          wikiTitle: page.title,
          wikiPageUrl: page.fullurl || wikiPageUrl(page.title),
          originalImageUrl: imageUrl,
          sourceName: 'Steal a Brainrot Wiki',
          sourceType: 'wiki',
          verifiedAt: new Date().toISOString(),
          confidence: 'medium',
          notes: processed.reason
        }));
        missingEntries.push({
          brainrotSlug: pet.slug,
          brainrotName: pet.name,
          wikiSearchUrl: wikiSearchUrl(pet.name),
          reason: processed.reason,
          status: 'manual_review'
        });
        continue;
      }
      stats.downloaded += 1;
      updatedBySlug.set(pet.slug, buildDownloadedEntry(pet, page, imageUrl, redirect));
    } catch (error) {
      stats.invalidImage += 1;
      updatedBySlug.set(pet.slug, buildFallbackEntry(pet, {
        status: 'invalid_image',
        wikiTitle: page.title,
        wikiPageUrl: page.fullurl || wikiPageUrl(page.title),
        originalImageUrl: imageUrl,
        sourceName: 'Steal a Brainrot Wiki',
        sourceType: 'wiki',
        verifiedAt: new Date().toISOString(),
        notes: error.message
      }));
      missingEntries.push({
        brainrotSlug: pet.slug,
        brainrotName: pet.name,
        wikiSearchUrl: wikiSearchUrl(pet.name),
        reason: error.message,
        status: 'manual_review'
      });
    }
  }

  for (const pet of brainrots) {
    if (!updatedBySlug.has(pet.slug)) {
      updatedBySlug.set(pet.slug, buildFallbackEntry(pet));
    }
  }

  let imageEntries = brainrots.map((pet) => updatedBySlug.get(pet.slug));
  const hashes = new Map();
  const duplicateHashes = [];
  for (const entry of imageEntries) {
    if (entry.images?.card === FALLBACK_IMAGE) continue;
    const hash = hashFile(`public${entry.images.card}`);
    if (!hash) continue;
    if (hashes.has(hash)) duplicateHashes.push([hashes.get(hash), entry.brainrotSlug]);
    else hashes.set(hash, entry.brainrotSlug);
  }

  if (duplicateHashes.length) {
    const duplicateSlugs = new Set(duplicateHashes.map((pair) => pair[1]));
    imageEntries = imageEntries.map((entry) => {
      if (!duplicateSlugs.has(entry.brainrotSlug)) return entry;
      for (const size of [128, 256, 512]) {
        for (const root of ['public/assets/brainrots', 'assets/brainrots']) {
          const generatedPath = `${root}/${size}/${entry.brainrotSlug}.webp`;
          if (existsSync(generatedPath)) unlinkSync(generatedPath);
        }
      }
      missingEntries.push({
        brainrotSlug: entry.brainrotSlug,
        brainrotName: entry.brainrotName,
        wikiSearchUrl: wikiSearchUrl(entry.brainrotName || entry.brainrotSlug),
        reason: 'Imagem duplicada com outro Brainrot; requer revisao manual',
        status: 'manual_review'
      });
      return {
        ...entry,
        images: {
          thumbnail: FALLBACK_IMAGE,
          card: FALLBACK_IMAGE,
          detail: FALLBACK_IMAGE
        },
        usageStatus: 'review',
        confidence: 'unknown',
        status: 'manual_review',
        notes: 'Imagem duplicada com outro Brainrot; requer revisao manual antes de uso.'
      };
    });
  }

  if (!options.dryRun) {
    writeJson(IMAGE_INDEX_PATH, imageEntries);
    writeReport({ brainrots, imageEntries, missingEntries, stats, duplicateHashes });
    writeJson(CACHE_PATH, cache);
  }

  console.log(JSON.stringify({
    selected: selected.length,
    dryRun: options.dryRun,
    sharpAvailable: Boolean(sharp),
    ...stats,
    fallback: imageEntries.filter((entry) => entry.images?.card === FALLBACK_IMAGE).length,
    manualReview: missingEntries.length,
    duplicateImages: duplicateHashes.length
  }, null, 2));
};

main().catch((error) => {
  writeJson(CACHE_PATH, cache);
  console.error(error);
  process.exit(1);
});
