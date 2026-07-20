import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const outputDirs = [
  'public/assets/brainrots/original',
  'public/assets/brainrots/128',
  'public/assets/brainrots/256',
  'public/assets/brainrots/512',
  'public/assets/brainrots/fallback',
  'assets/brainrots/128',
  'assets/brainrots/256',
  'assets/brainrots/512',
  'assets/brainrots/fallback'
];

for (const dir of outputDirs) {
  mkdirSync(dir, { recursive: true });
}

const placeholderWebp = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
for (const path of [
  'public/assets/brainrots/fallback/brainrot-placeholder.webp',
  'assets/brainrots/fallback/brainrot-placeholder.webp'
]) {
  if (!existsSync(path)) {
    writeFileSync(path, Buffer.from(placeholderWebp, 'base64'));
  }
}

let sharp = null;
try {
  const sharpModule = await import('sharp');
  sharp = sharpModule.default;
} catch {
  sharp = null;
}

const sourceFiles = existsSync('public/assets/brainrots/original')
  ? readdirSync('public/assets/brainrots/original')
    .filter((file) => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(file).toLowerCase()))
  : [];
const imageIndex = existsSync('src/data/brainrot-images.json')
  ? JSON.parse(readFileSync('src/data/brainrot-images.json', 'utf8'))
  : [];
const allowedSlugs = new Set(imageIndex
  .filter((entry) => entry.status === 'downloaded' && !entry.images?.card?.includes('/fallback/'))
  .map((entry) => entry.brainrotSlug));

const processed = [];
const failed = [];

if (sharp) {
  for (const file of sourceFiles) {
    const slug = file.replace(extname(file), '');
    if (allowedSlugs.size && !allowedSlugs.has(slug)) continue;
    const sourcePath = join('public/assets/brainrots/original', file);
    try {
      const input = readFileSync(sourcePath);
      const metadata = await sharp(input).metadata();
      if (!metadata.width || !metadata.height) {
        failed.push({ file, reason: 'Imagem sem dimensoes legiveis' });
        continue;
      }
      for (const size of [128, 256, 512]) {
        const output = await sharp(input)
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
      processed.push(slug);
    } catch (error) {
      failed.push({ file, reason: error.message });
    }
  }
}

writeFileSync('docs/brainrots-image-processing-report.md', `# Brainrot Image Processing Report

- processador sharp: ${sharp ? 'disponivel' : 'indisponivel'}
- arquivos originais encontrados: ${sourceFiles.length}
- imagens processadas: ${processed.length}
- falhas: ${failed.length}

## Observacao

O processamento preserva proporcao e transparencia usando \`fit: contain\`, gerando WebP local em 128, 256 e 512 pixels. Sem \`sharp\`, o script garante apenas estrutura de pastas e fallback para evitar imagens quebradas ou HTML salvo como imagem.
`);

console.log(JSON.stringify({
  sharpAvailable: Boolean(sharp),
  originalFiles: sourceFiles.length,
  processed: processed.length,
  failed
}, null, 2));

if (failed.length) process.exitCode = 1;
