import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const catalog = JSON.parse(readFileSync('src/data/grow-garden-2/store-products.json', 'utf8'));
const imageSourcesPath = 'src/data/grow-garden-2/store-image-sources.json';
const canvasSize = 640;

const referenceImages = {
  'hypno-bloom-seed': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-hypno-bloom-seed1.png',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Hypno Bloom Seed'
  },
  'dragon-breath-seed': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-dragons-breath-seed1.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Dragon Breath Seed',
    sourceCrop: { left: 70, top: 46, width: 205, height: 322 }
  },
  'moon-bloom-seed': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-moon-bloom-seed1.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Moon Bloom Seed'
  },
  'ghost-pepper-seed': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-ghost-pepper-seed1.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Ghost Pepper Seed'
  },
  '2x-venom-spitter-seed': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-venom-spitter-seed1.png',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Venom Spitter Seed'
  },
  '10x-rainbow-seed': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-rainbow-seed10.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Rainbow Seed'
  },
  '10x-mega-seed': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-mega-seed10.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Mega Seed'
  },
  raccoon: {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-raccoon.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Raccoon',
    sourceCrop: { left: 126, top: 20, width: 168, height: 342 }
  },
  'dragon-fly': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-golden-dragonfly.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Dragonfly',
    sourceCrop: { left: 14, top: 42, width: 360, height: 256 }
  },
  unicorn: {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-unicorn.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Unicorn',
    sourceCrop: { left: 42, top: 42, width: 316, height: 274 }
  },
  'big-unicorn': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-big-unicorn.png?v=1',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Big Unicorn',
    sourceCrop: { left: 24, top: 28, width: 330, height: 300 }
  },
  'super-rarojice-serpent': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-ice-serpent.png?v=2',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Ice Serpent',
    sourceCrop: { left: 24, top: 50, width: 386, height: 230 }
  },
  '20x-super-watering-can': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-super-watering-can1.png',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Super Watering Can',
    sourceCrop: { left: 42, top: 34, width: 282, height: 300 }
  },
  '20x-super-sprinkler': {
    sourceUrl: 'https://www.bloxb.com/uploads/images/goods/grow-a-garden-2/all-server-super-sprinkler1.png?v=3',
    sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
    sourceName: 'BLOXB Grow a Garden 2 Shop Super Sprinkler',
    sourceCrop: { left: 48, top: 54, width: 286, height: 274 }
  }
};

const productBySlug = new Map(catalog.products.map((product) => [product.slug, product]));

const mirroredOutputPaths = (imagePath) => [
  join('public', imagePath.replace(/^\//, '')),
  imagePath.replace(/^\/assets\//, 'assets/')
];

const writeMirrored = (imagePath, buffer) => {
  for (const outputPath of mirroredOutputPaths(imagePath)) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, buffer);
  }
};

const fetchImage = async (sourceUrl) => {
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'DelimaBloxStoreImageImporter/1.0'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${sourceUrl}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

const normalizeReferenceImage = async (input, sourceCrop = null) => {
  let prepared = input;
  if (sourceCrop) {
    const metadata = await sharp(input).metadata();
    const left = Math.min(sourceCrop.left, Math.max(0, metadata.width - 1));
    const top = Math.min(sourceCrop.top, Math.max(0, metadata.height - 1));
    const width = Math.min(sourceCrop.width, metadata.width - left);
    const height = Math.min(sourceCrop.height, metadata.height - top);
    prepared = await sharp(input).extract({ left, top, width, height }).png().toBuffer();
  }
  const trimmed = await sharp(prepared)
    .trim({ background: '#ffffff', threshold: 12 })
    .resize({
      width: 520,
      height: 360,
      fit: 'inside',
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: canvasSize,
      height: 420,
      channels: 4,
      background: '#00000000'
    }
  })
    .composite([{ input: trimmed, gravity: 'center' }])
    .webp({ quality: 92, nearLossless: true })
    .toBuffer();
};

const quantityBadgeSvg = (quantity) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="136" height="136" viewBox="0 0 136 136">
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#000" flood-opacity=".55"/>
    </filter>
    <g filter="url(#shadow)">
      <circle cx="68" cy="68" r="56" fill="#d8ff00"/>
      <circle cx="68" cy="68" r="45" fill="#111607"/>
      <text x="68" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="900" fill="#d8ff00">${quantity}x</text>
    </g>
  </svg>
`);

const composePackageImage = async (baseBuffer, quantity) => sharp(baseBuffer)
  .composite([{ input: quantityBadgeSvg(quantity), left: 468, top: 30 }])
  .webp({ quality: 92, nearLossless: true })
  .toBuffer();

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const imageSources = {};
const normalizedByProduct = new Map();

for (const [slug, reference] of Object.entries(referenceImages)) {
  const product = productBySlug.get(slug);
  if (!product) throw new Error(`Unknown store product slug: ${slug}`);
  const sourceBuffer = await fetchImage(reference.sourceUrl);
  const normalized = await normalizeReferenceImage(sourceBuffer, reference.sourceCrop);
  normalizedByProduct.set(slug, normalized);
  writeMirrored(product.image, normalized);
  imageSources[product.image] = {
    sourceType: 'external_reference_image',
    sourceName: reference.sourceName,
    sourcePage: reference.sourcePage,
    sourceUrl: reference.sourceUrl,
    importedAt: new Date().toISOString(),
    sha256: sha256(normalized)
  };
}

const sharedImageProducts = [
  ['20x-rainbow-seed', '10x-rainbow-seed'],
  ['20x-mega-seed', '10x-mega-seed']
];
for (const [targetSlug, sourceSlug] of sharedImageProducts) {
  const target = productBySlug.get(targetSlug);
  const source = productBySlug.get(sourceSlug);
  imageSources[target.image] = imageSources[source.image];
}

const packageSources = [
  ['5x-hypno-bloom-seed', 'hypno-bloom-seed', 5],
  ['5x-moon-bloom-seed', 'moon-bloom-seed', 5],
  ['10x-dragon-breath-seed', 'dragon-breath-seed', 10],
  ['5x-dragon-breath-seed', 'dragon-breath-seed', 5]
];
for (const [packageSlug, sourceSlug, quantity] of packageSources) {
  const product = productBySlug.get(packageSlug);
  const source = productBySlug.get(sourceSlug);
  const packageBuffer = await composePackageImage(normalizedByProduct.get(sourceSlug), quantity);
  writeMirrored(product.image, packageBuffer);
  imageSources[product.image] = {
    ...imageSources[source.image],
    sourceType: 'external_reference_image_with_quantity_badge',
    packageQuantity: quantity,
    derivedFrom: source.image,
    sha256: sha256(packageBuffer)
  };
}

const comboProduct = productBySlug.get('10x-super-sprinkler-10x-super-watering-can');
const sprinkler = normalizedByProduct.get('20x-super-sprinkler');
const wateringCan = normalizedByProduct.get('20x-super-watering-can');
const combo = await sharp({
  create: {
    width: canvasSize,
    height: 420,
    channels: 4,
    background: '#00000000'
  }
})
  .composite([
    {
      input: await sharp(sprinkler).resize({ width: 390, height: 300, fit: 'inside' }).png().toBuffer(),
      left: 58,
      top: 64
    },
    {
      input: await sharp(wateringCan).resize({ width: 390, height: 300, fit: 'inside' }).png().toBuffer(),
      left: 248,
      top: 78
    }
  ])
  .webp({ quality: 92, nearLossless: true })
  .toBuffer();
writeMirrored(comboProduct.image, combo);
imageSources[comboProduct.image] = {
  sourceType: 'external_reference_composite',
  sourceName: 'BLOXB Grow a Garden 2 Shop Super Sprinkler + Super Watering Can',
  sourcePage: 'https://www.bloxb.com/grow-a-garden-2-shop',
  sourceUrl: [
    referenceImages['20x-super-sprinkler'].sourceUrl,
    referenceImages['20x-super-watering-can'].sourceUrl
  ],
  importedAt: new Date().toISOString(),
  derivedFrom: [
    productBySlug.get('20x-super-sprinkler').image,
    productBySlug.get('20x-super-watering-can').image
  ],
  sha256: sha256(combo)
};

mkdirSync(dirname(imageSourcesPath), { recursive: true });
writeFileSync(imageSourcesPath, `${JSON.stringify({ imageSources }, null, 2)}\n`);

console.log(`Imported ${Object.keys(imageSources).length} Grow a Garden 2 store reference images.`);
