import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK_IMAGE = '/assets/brainrots/fallback/brainrot-placeholder.webp';
const brainrots = JSON.parse(readFileSync('src/data/brainrots.json', 'utf8'));
const images = JSON.parse(readFileSync('src/data/brainrot-images.json', 'utf8'));
const brainrotSlugs = new Set(brainrots.map((pet) => pet.slug));
const imageSlugs = new Set(images.map((entry) => entry.brainrotSlug));

const toLocalPath = (imagePath) => {
  if (!imagePath) return imagePath;
  if (imagePath.startsWith('/assets/')) return `public${imagePath}`;
  if (imagePath.startsWith('public/assets/')) return imagePath;
  return imagePath;
};

const readSignature = (path) => {
  if (!existsSync(path)) return null;
  const buffer = readFileSync(path);
  if (buffer.length < 12) return { mime: 'invalid', hash: null };
  const ascii = buffer.toString('ascii', 0, 16);
  const hash = createHash('sha256').update(buffer).digest('hex');
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { mime: 'image/webp', hash };
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return { mime: 'image/jpeg', hash };
  if (ascii.startsWith('\x89PNG')) return { mime: 'image/png', hash };
  if (buffer.toString('utf8', 0, 64).includes('<html') || buffer.toString('utf8', 0, 64).includes('<!DOCTYPE')) {
    return { mime: 'text/html', hash };
  }
  return { mime: 'unknown', hash };
};

const collectFiles = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((file) => join(dir, file));
};

let sharp = null;
try {
  const sharpModule = await import('sharp');
  sharp = sharpModule.default;
} catch {
  sharp = null;
}

const missingImageEntries = brainrots
  .filter((pet) => !imageSlugs.has(pet.slug))
  .map((pet) => pet.slug);
const imageWithoutPet = images
  .filter((entry) => !brainrotSlugs.has(entry.brainrotSlug))
  .map((entry) => entry.brainrotSlug);
const invalidPaths = [];
const fallbackUsage = [];
const hashes = new Map();
const duplicateImages = [];

for (const entry of images) {
  for (const [size, imagePath] of Object.entries(entry.images || {})) {
    const localPath = toLocalPath(imagePath);
    if (!imagePath || !existsSync(localPath)) {
      invalidPaths.push({ slug: entry.brainrotSlug, size, imagePath, reason: 'Arquivo inexistente' });
      continue;
    }

    if (imagePath.includes('/fallback/')) {
      fallbackUsage.push(entry.brainrotSlug);
      continue;
    }

    const stat = statSync(localPath);
    const signature = readSignature(localPath);
    if (signature?.mime !== 'image/webp') {
      invalidPaths.push({ slug: entry.brainrotSlug, size, imagePath, reason: `MIME invalido: ${signature?.mime || 'desconhecido'}` });
    }
    if (stat.size <= 32) {
      invalidPaths.push({ slug: entry.brainrotSlug, size, imagePath, reason: 'Arquivo pequeno demais' });
    }
    if (sharp) {
      const metadata = await sharp(localPath).metadata();
      const expected = size === 'thumbnail' ? 128 : size === 'card' ? 256 : 512;
      if (metadata.width !== expected || metadata.height !== expected) {
        invalidPaths.push({ slug: entry.brainrotSlug, size, imagePath, reason: `Dimensao ${metadata.width}x${metadata.height}, esperado ${expected}x${expected}` });
      }
    }
    if (signature?.hash) {
      const previous = hashes.get(signature.hash);
      if (previous && previous.slug !== entry.brainrotSlug) {
        duplicateImages.push({ hash: signature.hash, first: previous.slug, second: entry.brainrotSlug, size });
      } else {
        hashes.set(signature.hash, { slug: entry.brainrotSlug, size });
      }
    }
  }
}

const knownSlugs = new Set(images.map((entry) => entry.brainrotSlug));
const orphanFiles = [
  ...collectFiles('public/assets/brainrots/128'),
  ...collectFiles('public/assets/brainrots/256'),
  ...collectFiles('public/assets/brainrots/512')
].filter((file) => {
  const slug = file.split(/[\\/]/).pop()?.replace(/\.webp$/i, '');
  return slug && !knownSlugs.has(slug);
});
const duplicateReviewCount = images.filter((entry) => String(entry.notes || '').includes('Imagem duplicada')).length;

const report = {
  totalBrainrots: brainrots.length,
  totalImageEntries: images.length,
  missingImageEntries,
  imageWithoutPet,
  invalidPaths,
  fallbackUsage: [...new Set(fallbackUsage)],
  duplicateImages,
  duplicateReviewCount,
  orphanFiles,
  sharpAvailable: Boolean(sharp),
  valid: missingImageEntries.length === 0
    && imageWithoutPet.length === 0
    && invalidPaths.length === 0
    && duplicateImages.length === 0
    && orphanFiles.length === 0
};

writeFileSync('docs/brainrots-images-report.md', `# Brainrots Images Report

- total de Brainrots: ${report.totalBrainrots}
- total de paginas encontradas: ${images.filter((entry) => entry.wikiPageUrl || entry.sourcePage).length}
- total de imagens encontradas: ${images.filter((entry) => entry.originalImageUrl || entry.originalSourceUrl).length}
- total baixado: ${images.filter((entry) => entry.status === 'downloaded').length}
- total ja existente: ${images.filter((entry) => entry.status === 'existing').length}
- total usando fallback: ${report.fallbackUsage.length}
- total sem pagina: ${images.filter((entry) => entry.status === 'page_not_found').length}
- total sem imagem: ${images.filter((entry) => entry.status === 'image_not_found').length}
- total com redirecionamento: ${images.filter((entry) => entry.redirectFrom).length}
- total em revisao de licenca: ${images.filter((entry) => entry.usageStatus === 'review').length}
- imagens duplicadas aceitas: ${report.duplicateImages.length}
- duplicacoes detectadas e enviadas para revisao: ${report.duplicateReviewCount}
- arquivos invalidos: ${report.invalidPaths.length}
- arquivos orfaos: ${report.orphanFiles.length}
- validador de dimensoes sharp: ${report.sharpAvailable ? 'disponivel' : 'indisponivel'}
- fontes: Steal a Brainrot Wiki API
- data da coleta: ${new Date().toISOString()}

## Observacao

Fallback local e aceito para registros ainda em revisao. Imagens reais devem ser locais, WebP e ligadas por slug.
`);

console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
