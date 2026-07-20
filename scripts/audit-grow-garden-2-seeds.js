import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(process.cwd());
const seedsPath = resolve(projectRoot, 'src', 'data', 'grow-garden-2', 'seeds.json');
const imagesPath = resolve(projectRoot, 'src', 'data', 'grow-garden-2', 'seed-images.json');

const report = [];

if (!existsSync(seedsPath)) {
  console.error('Arquivo seeds.json não encontrado');
  process.exit(1);
}
if (!existsSync(imagesPath)) {
  console.error('Arquivo seed-images.json não encontrado');
  process.exit(1);
}

const seedsContent = JSON.parse(readFileSync(seedsPath, 'utf8'));
const imagesContent = JSON.parse(readFileSync(imagesPath, 'utf8'));
const seeds = Array.isArray(seedsContent.seeds) ? seedsContent.seeds : [];
const images = Array.isArray(imagesContent) ? imagesContent : [];
const slugs = new Set();
const duplicateSlugs = [];
const imageFiles = new Map();
const imageMissing = [];
const badPrices = [];
const badRarities = [];
const missingSources = [];
const mockStrings = ['mock', 'sample', 'demo', 'fallback', 'test', 'fake'];

seeds.forEach((seed) => {
  if (!seed.slug || !seed.name) {
    report.push(`Seed inválida: slug=${seed.slug} name=${seed.name}`);
  }
  if (slugs.has(seed.slug)) duplicateSlugs.push(seed.slug);
  slugs.add(seed.slug);

  if (seed.image) {
    imageFiles.set(seed.image, (imageFiles.get(seed.image) || 0) + 1);
  }

  if (seed.purchasePrice != null && typeof seed.purchasePrice !== 'number') badPrices.push(seed.slug);
  if (seed.priceMin != null && typeof seed.priceMin !== 'number') badPrices.push(seed.slug);
  if (seed.priceMax != null && typeof seed.priceMax !== 'number') badPrices.push(seed.slug);

  const rarity = String(seed.rarity || '').toLowerCase();
  const allowedRarities = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'super', 'em revisão']);
  if (seed.rarity && !allowedRarities.has(rarity)) badRarities.push(seed.slug);

  if (!Array.isArray(seed.sources) || seed.sources.length === 0) missingSources.push(seed.slug);
  if (Array.isArray(seed.sources)) {
    seed.sources.forEach((source) => {
      if (!source.name || !source.verifiedAt) missingSources.push(seed.slug);
    });
  }
  if (typeof seed.name === 'string' && mockStrings.some((needle) => seed.name.toLowerCase().includes(needle))) {
    report.push(`Nome suspeito de mock: ${seed.slug} (${seed.name})`);
  }
  if (typeof seed.description === 'string' && mockStrings.some((needle) => seed.description.toLowerCase().includes(needle))) {
    report.push(`Descrição suspeita de mock: ${seed.slug} (${seed.name})`);
  }
});

const imagesBySlug = new Map(images.map((entry) => [entry.seedSlug, entry]));
const missingImageRecords = seeds.filter((seed) => !imagesBySlug.has(seed.slug)).map((seed) => seed.slug);
const duplicatedImages = [...imageFiles.entries()].filter(([, count]) => count > 1).map(([file]) => file);

if (duplicateSlugs.length) report.push(`Slugs duplicados: ${duplicateSlugs.join(', ')}`);
if (missingImageRecords.length) report.push(`Seeds sem image record: ${missingImageRecords.join(', ')}`);
if (duplicatedImages.length) report.push(`Imagens duplicadas: ${duplicatedImages.join(', ')}`);
if (badPrices.length) report.push(`Preços não numéricos: ${[...new Set(badPrices)].join(', ')}`);
if (badRarities.length) report.push(`Raridades inválidas: ${[...new Set(badRarities)].join(', ')}`);
if (missingSources.length) report.push(`Seeds sem fonte ou data: ${[...new Set(missingSources)].join(', ')}`);

const realNames = new Set(['Girassol Brilhante', 'Fruta da Lua', 'Ervilha Flamejante', 'Folha de Cristal']);
const fakeSeeds = seeds.filter((seed) => realNames.has(seed.name));
if (fakeSeeds.length) report.push(`Seeds fictícias encontradas: ${fakeSeeds.map((seed) => seed.slug).join(', ')}`);

console.log('Audit Grow Garden 2 Seeds');
console.log('Total seeds', seeds.length);
console.log('Total image entries', images.length);
console.log('Faltando image entry', missingImageRecords.length);
console.log('Duplicados de slug', duplicateSlugs.length);
console.log('Duplicados de imagem', duplicatedImages.length);
console.log('Preços inválidos', badPrices.length);
console.log('Raridades inválidas', badRarities.length);
console.log('Fontes/datas faltando', missingSources.length);
if (report.length) {
  console.log('---');
  report.forEach((line) => console.log(line));
  process.exit(1);
}
console.log('Nenhum problema encontrado na auditoria de seeds.');
