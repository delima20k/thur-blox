import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const getArgValue = (prefix) => process.argv.find((arg) => arg.startsWith(`${prefix}=`))?.slice(prefix.length + 1);
const inputDir = resolve(projectRoot, getArgValue('--input') ?? 'public/assets/brainrots/original-from-game');
const dryRun = args.has('--dry-run');
const cropDir = resolve(projectRoot, '.tmp/brainrot-card-crops');
const mapPath = resolve(projectRoot, 'src/data/user-screenshot-image-map.json');
const reportPath = resolve(projectRoot, 'docs/user-screenshot-brainrot-images-report.md');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function listImageFiles(folder) {
  if (!existsSync(folder)) return [];
  const entries = await readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && imageExtensions.has(extname(entry.name).toLowerCase()))
    .map((entry) => join(folder, entry.name));
}

function cardGrid(metadata) {
  const columns = 3;
  const cardWidth = Math.max(110, Math.floor(metadata.width / columns) - 8);
  const cardHeight = Math.max(120, Math.floor(cardWidth * 1.26));
  const rows = Math.max(1, Math.floor(metadata.height / cardHeight));
  const crops = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = Math.max(0, Math.floor(column * (metadata.width / columns)));
      const top = Math.max(0, Math.floor(row * cardHeight));
      const width = Math.min(cardWidth, metadata.width - left);
      const height = Math.min(cardHeight, metadata.height - top);
      if (width >= 80 && height >= 80) crops.push({ left, top, width, height });
    }
  }

  return crops;
}

async function main() {
  const screenshots = await listImageFiles(inputDir);
  const existingMap = await readJson(mapPath, []);
  const mapBySlug = new Map(existingMap.map((entry) => [entry.brainrotSlug, entry]));
  const generated = [];

  if (!dryRun) await mkdir(cropDir, { recursive: true });

  for (const screenshot of screenshots) {
    const metadata = await sharp(screenshot).metadata();
    const crops = cardGrid(metadata);
    for (const [index, crop] of crops.entries()) {
      const screenshotName = basename(screenshot, extname(screenshot));
      const slug = `${screenshotName}-card-${String(index + 1).padStart(2, '0')}`;
      const outputPath = join(cropDir, `${slug}.webp`);
      if (!dryRun) {
        await sharp(screenshot)
          .extract(crop)
          .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 92 })
          .toFile(outputPath);
      }
      generated.push({ slug, screenshot, crop, outputPath });
      if (!mapBySlug.has(slug)) {
        mapBySlug.set(slug, {
          brainrotSlug: slug,
          displayedName: slug,
          sourceScreenshot: screenshot,
          crop,
          previewPath: `.tmp/brainrot-card-crops/${slug}.webp`,
          reviewStatus: 'needs_review',
          notes: 'Auto-cropped preview. Rename brainrotSlug to the canonical slug and set reviewStatus to approved after visual review.'
        });
      }
    }
  }

  const nextMap = Array.from(mapBySlug.values()).sort((a, b) => a.brainrotSlug.localeCompare(b.brainrotSlug));
  if (!dryRun && screenshots.length > 0) await writeFile(mapPath, `${JSON.stringify(nextMap, null, 2)}\n`);

  const report = [
    '# User Screenshot Brainrot Images',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Input folder: ${inputDir}`,
    `Dry run: ${dryRun ? 'yes' : 'no'}`,
    `Screenshot files found: ${screenshots.length}`,
    `Card previews generated: ${dryRun ? 0 : generated.length}`,
    `Map entries: ${nextMap.length}`,
    '',
    screenshots.length === 0
      ? 'No screenshot image files were available in the input folder. Inline chat images cannot be cropped from the filesystem until they are saved as image files.'
      : 'Review each preview before setting reviewStatus to approved. Approved entries can be published with scripts/process-approved-brainrot-images.js.'
  ].join('\n');

  await mkdir(resolve(projectRoot, 'docs'), { recursive: true });
  await writeFile(reportPath, `${report}\n`);

  console.log(JSON.stringify({
    inputDir,
    dryRun,
    screenshots: screenshots.length,
    generated: dryRun ? 0 : generated.length,
    mapEntries: nextMap.length,
    reportPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
