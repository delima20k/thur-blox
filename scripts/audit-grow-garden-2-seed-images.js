import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const seedsPath = join(projectRoot, 'src/data/grow-garden-2/seeds.json');
const imagesPath = join(projectRoot, 'src/data/grow-garden-2/seed-images.json');
const assetsDir = join(projectRoot, 'public/assets/grow-garden-2/seeds');
const docsPath = join(projectRoot, 'docs/grow-garden-2-seed-images-audit.md');
const legacyMockPath = join(projectRoot, 'src/data/grow-garden-seeds.js');
const forbiddenSlugs = new Set([
  'sunflower-seed',
  'moonberry-seed',
  'firepea-seed',
  'crystal-leaf-seed',
  'frostmoss-seed'
]);

const seedsData = JSON.parse(readFileSync(seedsPath, 'utf8'));
const imageEntries = JSON.parse(readFileSync(imagesPath, 'utf8'));
const seeds = Array.isArray(seedsData.seeds) ? seedsData.seeds : [];
const imageBySlug = new Map(imageEntries.map((entry) => [entry.seedSlug, entry]));
const seedBySlug = new Map(seeds.map((seed) => [seed.slug, seed]));
const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir).filter((file) => file.endsWith('.webp')) : [];
const assetSlugs = new Set(assetFiles.map((file) => file.replace(/\.webp$/, '')));
const placeholderImage = '/assets/grow-garden-2/seeds/seed-placeholder.webp';

const realImageSeeds = seeds.filter((seed) => ['real', 'confirmed', 'allowed'].includes(String(seed.imageStatus || '').toLowerCase()));
const placeholderSeeds = seeds.filter((seed) => seed.image === placeholderImage || seed.imageStatus === 'pending');
const seedsWithoutImage = seeds.filter((seed) => !seed.image);
const slugsWithoutImageEntry = seeds.filter((seed) => !imageBySlug.has(seed.slug));
const slugsWithMissingFile = seeds.filter((seed) => {
  if (!seed.image || !seed.image.startsWith('/assets/grow-garden-2/seeds/')) return true;
  const fileName = seed.image.split('/').pop();
  return !existsSync(join(assetsDir, fileName));
});
const filesWithoutSeed = assetFiles
  .map((file) => file.replace(/\.webp$/, ''))
  .filter((slug) => slug !== 'seed-placeholder' && !seedBySlug.has(slug));
const repeatedImages = [...seeds.reduce((map, seed) => {
  if (!seed.image || seed.image === placeholderImage) return map;
  const list = map.get(seed.image) || [];
  list.push(seed.slug);
  map.set(seed.image, list);
  return map;
}, new Map()).entries()].filter(([, slugs]) => slugs.length > 1);
const fictionalSeeds = seeds.filter((seed) => forbiddenSlugs.has(seed.slug));
const legacyMockExists = existsSync(legacyMockPath);

const report = [
  '# Auditoria de imagens de sementes - Grow a Garden 2',
  '',
  `Gerado em: ${new Date().toISOString()}`,
  '',
  '## Resumo',
  '',
  `- Total de seeds na base: ${seeds.length}`,
  `- Total com imagem real/confirmada: ${realImageSeeds.length}`,
  `- Total com placeholder: ${placeholderSeeds.length}`,
  `- Seeds sem imagem: ${seedsWithoutImage.length}`,
  `- Seeds sem entrada em seed-images.json: ${slugsWithoutImageEntry.length}`,
  `- Seeds com arquivo ausente: ${slugsWithMissingFile.length}`,
  `- Arquivos sem seed correspondente: ${filesWithoutSeed.length}`,
  `- Imagens repetidas indevidamente: ${repeatedImages.length}`,
  `- Seeds ficticias remanescentes: ${fictionalSeeds.length}`,
  `- Arquivo legado mock ainda existe: ${legacyMockExists ? 'sim' : 'nao'}`,
  '',
  '## Seeds com imagem real/confirmada',
  '',
  ...realImageSeeds.map((seed) => `- ${seed.name} (${seed.slug}) -> ${seed.image}`),
  '',
  '## Seeds com placeholder',
  '',
  ...placeholderSeeds.map((seed) => `- ${seed.name} (${seed.slug})`),
  '',
  '## Problemas',
  '',
  `- Sem imagem: ${seedsWithoutImage.map((seed) => seed.slug).join(', ') || 'nenhum'}`,
  `- Sem entrada em seed-images: ${slugsWithoutImageEntry.map((seed) => seed.slug).join(', ') || 'nenhum'}`,
  `- Arquivo ausente: ${slugsWithMissingFile.map((seed) => seed.slug).join(', ') || 'nenhum'}`,
  `- Arquivos sem seed: ${filesWithoutSeed.join(', ') || 'nenhum'}`,
  `- Imagens repetidas: ${repeatedImages.map(([image, slugs]) => `${image} (${slugs.join(', ')})`).join('; ') || 'nenhum'}`,
  `- Seeds ficticias: ${fictionalSeeds.map((seed) => seed.slug).join(', ') || 'nenhum'}`
].join('\n');

writeFileSync(docsPath, `${report}\n`);

const failures = [
  seeds.length === 0 ? 'A base de seeds esta vazia.' : null,
  seedsWithoutImage.length ? 'Existem seeds sem image.' : null,
  slugsWithoutImageEntry.length ? 'Existem seeds sem entrada em seed-images.json.' : null,
  slugsWithMissingFile.length ? 'Existem seeds apontando para arquivo ausente.' : null,
  filesWithoutSeed.length ? 'Existem arquivos sem seed correspondente.' : null,
  repeatedImages.length ? 'Existem imagens repetidas indevidamente.' : null,
  fictionalSeeds.length ? 'Existem seeds ficticias remanescentes.' : null,
  legacyMockExists ? 'Arquivo legado de mock ainda existe.' : null
].filter(Boolean);

console.log(report);

if (failures.length) {
  console.error('\nFalhas encontradas:\n- ' + failures.join('\n- '));
  process.exit(1);
}
