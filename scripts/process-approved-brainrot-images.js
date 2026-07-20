import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mapPath = resolve(projectRoot, 'src/data/user-screenshot-image-map.json');
const imageIndexPath = resolve(projectRoot, 'src/data/brainrot-images.json');
const outputRoots = [
  resolve(projectRoot, 'public/assets/brainrots'),
  resolve(projectRoot, 'assets/brainrots')
];
const sizes = [128, 256, 512];
const sourceExtensions = ['.webp', '.png', '.jpg', '.jpeg'];

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function findSource(entry) {
  const candidates = [
    entry.approvedSourcePath,
    entry.previewPath,
    `public/assets/brainrots/original-from-game/${entry.brainrotSlug}`,
    `.tmp/brainrot-card-crops/${entry.brainrotSlug}`
  ].filter(Boolean);

  for (const candidate of candidates) {
    const absolute = resolve(projectRoot, candidate);
    if (existsSync(absolute) && extname(absolute)) return absolute;
    if (!extname(absolute)) {
      for (const extension of sourceExtensions) {
        const withExtension = `${absolute}${extension}`;
        if (existsSync(withExtension)) return withExtension;
      }
    }
  }
  return null;
}

async function writeSizedImages(sourcePath, slug) {
  for (const root of outputRoots) {
    for (const size of sizes) {
      const folder = resolve(root, String(size));
      await mkdir(folder, { recursive: true });
      await sharp(sourcePath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 92 })
        .toFile(resolve(folder, `${slug}.webp`));
    }
  }
}

function upsertImageRecord(records, entry) {
  const nextRecord = {
    brainrotSlug: entry.brainrotSlug,
    brainrotName: entry.officialName ?? entry.displayedName ?? entry.brainrotSlug,
    wikiTitle: null,
    wikiPageUrl: null,
    originalImageUrl: entry.sourceScreenshot ?? entry.approvedSourcePath ?? null,
    images: {
      thumbnail: `/assets/brainrots/128/${entry.brainrotSlug}.webp`,
      card: `/assets/brainrots/256/${entry.brainrotSlug}.webp`,
      detail: `/assets/brainrots/512/${entry.brainrotSlug}.webp`
    },
    sourceName: 'User game screenshot',
    sourceType: 'user_game_screenshot',
    license: 'user_provided',
    usageStatus: 'provided_by_user',
    verifiedAt: new Date().toISOString(),
    confidence: 'manual',
    status: 'approved',
    redirectFrom: null,
    redirectTo: null
  };
  const index = records.findIndex((record) => record.brainrotSlug === entry.brainrotSlug);
  if (index >= 0) records[index] = { ...records[index], ...nextRecord };
  else records.push(nextRecord);
}

async function main() {
  const mapEntries = await readJson(mapPath, []);
  const approved = mapEntries.filter((entry) => entry.reviewStatus === 'approved');
  const imageRecords = await readJson(imageIndexPath, []);
  const processed = [];
  const skipped = [];

  for (const entry of approved) {
    const sourcePath = findSource(entry);
    if (!sourcePath) {
      skipped.push({ brainrotSlug: entry.brainrotSlug, reason: 'approved source file not found' });
      continue;
    }
    await writeSizedImages(sourcePath, entry.brainrotSlug);
    upsertImageRecord(imageRecords, entry);
    processed.push(entry.brainrotSlug);
  }

  if (processed.length > 0) {
    imageRecords.sort((a, b) => a.brainrotSlug.localeCompare(b.brainrotSlug));
    await writeFile(imageIndexPath, `${JSON.stringify(imageRecords, null, 2)}\n`);
  }

  console.log(JSON.stringify({
    approved: approved.length,
    processed: processed.length,
    skipped,
    imageIndexUpdated: processed.length > 0
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
