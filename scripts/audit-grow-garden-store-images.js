import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const catalogPath = join(projectRoot, 'src/data/grow-garden-2/store-products.json');
const imageSourcesPath = join(projectRoot, 'src/data/grow-garden-2/store-image-sources.json');
const docsPath = join(projectRoot, 'docs/grow-garden-store-images-audit.md');
const publicPrefix = '/assets/grow-a-garden-2/store/';
const allowedExtensions = new Set(['.webp', '.png', '.jpg', '.jpeg']);
const allowedSourceTypes = new Set([
  'external_reference_image',
  'external_reference_image_with_quantity_badge',
  'external_reference_composite'
]);
const allowedSharedImages = new Map([
  ['/assets/grow-a-garden-2/store/seeds/rainbow-seed.webp', new Set(['10x-rainbow-seed', '20x-rainbow-seed'])],
  ['/assets/grow-a-garden-2/store/seeds/mega-seed.webp', new Set(['10x-mega-seed', '20x-mega-seed'])]
]);
const replacedArtificialFiles = [
  '/assets/grow-a-garden-2/store/seeds/hypno-bloom-seed.webp',
  '/assets/grow-a-garden-2/store/seeds/dragon-breath-seed.webp',
  '/assets/grow-a-garden-2/store/seeds/moon-bloom-seed.webp',
  '/assets/grow-a-garden-2/store/seeds/ghost-pepper-seed.webp',
  '/assets/grow-a-garden-2/store/seeds/venom-spitter-seed.webp',
  '/assets/grow-a-garden-2/store/seeds/rainbow-seed.webp',
  '/assets/grow-a-garden-2/store/seeds/mega-seed.webp',
  '/assets/grow-a-garden-2/store/pets/raccoon.webp',
  '/assets/grow-a-garden-2/store/pets/dragon-fly.webp',
  '/assets/grow-a-garden-2/store/pets/unicorn.webp',
  '/assets/grow-a-garden-2/store/pets/big-unicorn.webp',
  '/assets/grow-a-garden-2/store/pets/super-rarojice-serpent.webp',
  '/assets/grow-a-garden-2/store/gears/super-watering-can.webp',
  '/assets/grow-a-garden-2/store/gears/super-sprinkler.webp',
  '/assets/grow-a-garden-2/store/gears/super-sprinkler-watering-can.webp',
  '/assets/grow-a-garden-2/store/packages/5x-hypno-bloom-seed.webp',
  '/assets/grow-a-garden-2/store/packages/5x-moon-bloom-seed.webp',
  '/assets/grow-a-garden-2/store/packages/10x-dragon-breath-seed.webp',
  '/assets/grow-a-garden-2/store/packages/5x-dragon-breath-seed.webp'
];

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const walkFiles = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    return [entryPath];
  });
};

const publicAssetFile = (imagePath) => join(projectRoot, 'public', imagePath.replace(/^\//, ''));
const rootAssetFile = (imagePath) => join(projectRoot, imagePath.replace(/^\/assets\//, 'assets/'));
const publicImagePathFromFile = (filePath, baseDir) => `/${relative(baseDir, filePath).split(sep).join('/')}`;
const hashFile = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const catalog = readJson(catalogPath);
const imageSourceData = existsSync(imageSourcesPath) ? readJson(imageSourcesPath) : { imageSources: {} };
const imageSources = imageSourceData.imageSources || {};
const products = catalog.products || [];
const issues = [];
const warnings = [];
const productsByImage = new Map();
let validImages = 0;
let fallbackImages = 0;
let invalidExtensions = 0;
let missingImages = 0;

for (const product of products) {
  if (!product.image || /placeholder|missing/i.test(product.image)) {
    fallbackImages += 1;
    issues.push(`${product.slug}: imagem vazia ou placeholder (${product.image || 'sem valor'})`);
    continue;
  }

  if (!product.image.startsWith(publicPrefix)) {
    issues.push(`${product.slug}: caminho deve comecar com ${publicPrefix}`);
  }

  const extension = extname(product.image).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    invalidExtensions += 1;
    issues.push(`${product.slug}: extensao invalida (${extension || 'sem extensao'})`);
  }

  const publicFile = publicAssetFile(product.image);
  const rootFile = rootAssetFile(product.image);
  const missingTargets = [publicFile, rootFile].filter((filePath) => !existsSync(filePath));
  if (missingTargets.length) {
    missingImages += 1;
    issues.push(`${product.slug}: arquivo ausente em ${missingTargets.map((filePath) => relative(projectRoot, filePath)).join(', ')}`);
    continue;
  }

  const metadata = await sharp(publicFile).metadata().catch((error) => {
    issues.push(`${product.slug}: imagem invalida (${error.message})`);
    return null;
  });
  if (metadata && (!metadata.width || !metadata.height)) {
    issues.push(`${product.slug}: imagem sem dimensoes validas`);
  }

  validImages += 1;
  const imageSource = imageSources[product.image];
  if (!imageSource) {
    issues.push(`${product.slug}: imagem sem metadados de origem real (${product.image})`);
  } else if (!allowedSourceTypes.has(imageSource.sourceType)) {
    issues.push(`${product.slug}: origem invalida para imagem (${imageSource.sourceType})`);
  } else if (/generated|synthetic|manual|placeholder|svg/i.test(`${imageSource.sourceType} ${imageSource.sourceName || ''}`)) {
    issues.push(`${product.slug}: origem artificial detectada em metadados`);
  }

  const current = productsByImage.get(product.image) || [];
  current.push(product.slug);
  productsByImage.set(product.image, current);
}

const duplicateIssues = [];
for (const [imagePath, slugs] of productsByImage.entries()) {
  if (slugs.length <= 1) continue;
  const allowedSlugs = allowedSharedImages.get(imagePath);
  const isAllowed = allowedSlugs
    && slugs.length === allowedSlugs.size
    && slugs.every((slug) => allowedSlugs.has(slug));
  if (!isAllowed) {
    duplicateIssues.push(`${imagePath}: ${slugs.join(', ')}`);
  }
}
issues.push(...duplicateIssues.map((item) => `duplicidade nao permitida em ${item}`));

const referencedImages = new Set(products.map((product) => product.image).filter(Boolean));
const publicStoreDir = join(projectRoot, 'public/assets/grow-a-garden-2/store');
const rootStoreDir = join(projectRoot, 'assets/grow-a-garden-2/store');
const publicOrphans = walkFiles(publicStoreDir)
  .map((filePath) => publicImagePathFromFile(filePath, join(projectRoot, 'public')))
  .filter((imagePath) => !referencedImages.has(imagePath));
const rootOrphans = walkFiles(rootStoreDir)
  .map((filePath) => publicImagePathFromFile(filePath, projectRoot).replace(/^\/assets\//, '/assets/'))
  .filter((imagePath) => !referencedImages.has(imagePath));
const orphanFiles = [...publicOrphans, ...rootOrphans];
if (orphanFiles.length) {
  warnings.push(`arquivos orfaos: ${orphanFiles.join(', ')}`);
}

const hashMismatches = [];
const sourceHashMismatches = [];
for (const imagePath of referencedImages) {
  const publicFile = publicAssetFile(imagePath);
  const rootFile = rootAssetFile(imagePath);
  if (!existsSync(publicFile) || !existsSync(rootFile)) continue;
  if (hashFile(publicFile) !== hashFile(rootFile)) {
    hashMismatches.push(imagePath);
  }
  const imageSource = imageSources[imagePath];
  if (imageSource?.sha256 && hashFile(publicFile) !== imageSource.sha256) {
    sourceHashMismatches.push(imagePath);
  }
}
issues.push(...hashMismatches.map((imagePath) => `public/assets e assets divergem para ${imagePath}`));
issues.push(...sourceHashMismatches.map((imagePath) => `hash nao bate com store-image-sources.json para ${imagePath}`));

const imageSourcesMissingFromCatalog = Object.keys(imageSources).filter((imagePath) => !referencedImages.has(imagePath));
if (imageSourcesMissingFromCatalog.length) {
  warnings.push(`metadados sem produto no catalogo: ${imageSourcesMissingFromCatalog.join(', ')}`);
}

const report = [
  '# Grow Garden Store Images Audit',
  '',
  `- Total de produtos: ${products.length}`,
  `- Produtos com imagem valida: ${validImages}`,
  `- Imagens ausentes: ${missingImages}`,
  `- Imagens fallback/placeholder: ${fallbackImages}`,
  `- Extensoes invalidas: ${invalidExtensions}`,
  `- Duplicidades nao permitidas: ${duplicateIssues.length}`,
  `- Arquivos orfaos: ${orphanFiles.length}`,
  `- Divergencias public/assets x assets: ${hashMismatches.length}`,
  `- Divergencias com metadados de origem: ${sourceHashMismatches.length}`,
  `- Imagens com metadados de origem: ${Object.keys(imageSources).length}`,
  '',
  '## Imagens Referenciadas',
  ...products.map((product) => {
    const imageSource = imageSources[product.image];
    return `- ${product.slug}: ${product.image || 'sem imagem'} (${imageSource?.sourceType || 'sem origem'})`;
  }),
  '',
  '## Arquivos Artificiais Substituidos',
  ...replacedArtificialFiles.map((imagePath) => `- ${imagePath}`),
  '',
  '## Reutilizacoes Permitidas',
  ...[...allowedSharedImages.entries()].map(([imagePath, slugs]) => `- ${imagePath}: ${[...slugs].join(', ')}`),
  '',
  '## Problemas',
  ...(issues.length ? issues.map((issue) => `- ${issue}`) : ['- nenhum']),
  '',
  '## Avisos',
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- nenhum'])
].join('\n');

mkdirSync(dirname(docsPath), { recursive: true });
writeFileSync(docsPath, `${report}\n`);

console.log('Grow Garden store image audit');
console.log(`totalProducts: ${products.length}`);
console.log(`validImages: ${validImages}`);
console.log(`missingImages: ${missingImages}`);
console.log(`fallbackImages: ${fallbackImages}`);
console.log(`invalidExtensions: ${invalidExtensions}`);
console.log(`duplicateIssues: ${duplicateIssues.length}`);
console.log(`orphanFiles: ${orphanFiles.length}`);
console.log(`hashMismatches: ${hashMismatches.length}`);
console.log(`sourceHashMismatches: ${sourceHashMismatches.length}`);
console.log(`sourceMetadata: ${Object.keys(imageSources).length}`);
console.log(`report: ${relative(projectRoot, docsPath)}`);

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
