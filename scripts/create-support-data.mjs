import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const wikiSource = {
  name: 'Steal a Brainrot Wiki',
  sourceType: 'wiki',
  url: 'https://stealabrainrot.fandom.com/wiki/'
};

const mutationNames = [
  ['normal', 'Normal', 'Normal', 1, 'normal'],
  ['gold', 'Gold', 'Dourado', 1.25, 'normal'],
  ['diamond', 'Diamond', 'Diamante', 1.5, 'normal'],
  ['rainbow', 'Rainbow', 'Arco-iris', 10, 'normal'],
  ['bloodrot', 'Bloodrot', 'Bloodrot', 2, 'event'],
  ['candy', 'Candy', 'Candy', 4, 'event'],
  ['lava', 'Lava', 'Lava', 6, 'event'],
  ['galaxy', 'Galaxy', 'Galaxia', 6, 'event'],
  ['yin-yang', 'Yin Yang', 'Yin Yang', 7.5, 'event'],
  ['radioactive', 'Radioactive', 'Radioativo', 8.5, 'event'],
  ['cursed', 'Cursed', 'Amaldicoado', null, 'unknown'],
  ['cyber', 'Cyber', 'Cyber', null, 'unknown']
];

const brainrots = JSON.parse(readFileSync('src/data/brainrots.json', 'utf8'));

const mutations = mutationNames.map(([slug, name, displayNamePtBr, incomeMultiplier, availability]) => ({
  id: slug,
  slug,
  name,
  displayNamePtBr,
  incomeMultiplier,
  tradeValueMultiplier: null,
  obtainable: availability !== 'unavailable',
  availability,
  eventName: availability === 'event' ? 'Event/Admin rotation' : null,
  description: null,
  icon: null,
  sources: [wikiSource],
  verifiedAt: '2026-06-30',
  confidence: incomeMultiplier == null ? 'unknown' : 'medium',
  compatibility: {
    compatibleBrainrotSlugs: [],
    incompatibleBrainrotSlugs: [],
    compatibleRarities: [],
    incompatibleRarities: [],
    exclusiveWith: []
  },
  active: true
}));

const brainrotImages = brainrots.map((pet) => ({
  brainrotSlug: pet.slug,
  images: {
    thumbnail: '/assets/brainrots/fallback/brainrot-placeholder.webp',
    card: '/assets/brainrots/fallback/brainrot-placeholder.webp',
    detail: '/assets/brainrots/fallback/brainrot-placeholder.webp'
  },
  originalSourceUrl: null,
  sourceName: null,
  sourceType: 'unknown',
  sourcePage: null,
  imageAuthor: null,
  license: null,
  usageStatus: 'review',
  verifiedAt: null,
  confidence: 'unknown',
  notes: 'Fallback usado ate uma imagem confiavel ser validada.'
}));

const missingData = brainrots
  .filter((pet) => (
    pet.tradeValue == null
    || pet.purchaseCost == null
    || (pet.incomePerSecond == null && pet.baseIncomePerSecond == null)
    || pet.existCount == null
  ))
  .map((pet) => ({
    slug: pet.slug,
    name: pet.name,
    missing: [
      pet.tradeValue == null && pet.tradeValueMin == null && pet.tradeValueMax == null ? 'tradeValue' : null,
      pet.purchaseCost == null ? 'purchaseCost' : null,
      pet.incomePerSecond == null && pet.baseIncomePerSecond == null ? 'incomePerSecond' : null,
      pet.existCount == null ? 'existCount' : null
    ].filter(Boolean)
  }));

const missingImages = brainrots.map((pet) => ({
  slug: pet.slug,
  name: pet.name,
  reason: 'Imagem confiavel ainda nao validada; fallback em uso.'
}));

const mutationsReview = mutations
  .filter((mutation) => mutation.confidence !== 'high')
  .map((mutation) => ({
    slug: mutation.slug,
    name: mutation.name,
    reason: mutation.tradeValueMultiplier == null
      ? 'Impacto no valor de troca em revisao.'
      : 'Registro aguardando fonte oficial.'
  }));

const writes = [
  ['src/data/mutations.json', mutations],
  ['src/data/brainrot-images.json', brainrotImages],
  ['src/data/brainrots-missing-data.json', missingData],
  ['src/data/brainrots-missing-images.json', missingImages],
  ['src/data/mutations-review.json', mutationsReview]
];

for (const [file, value] of writes) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

for (const dir of [
  'public/assets/brainrots/128',
  'public/assets/brainrots/256',
  'public/assets/brainrots/512',
  'public/assets/brainrots/fallback',
  'assets/brainrots/fallback',
  'public/assets/mutations'
]) {
  mkdirSync(dir, { recursive: true });
}

const placeholderWebp = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
writeFileSync('public/assets/brainrots/fallback/brainrot-placeholder.webp', Buffer.from(placeholderWebp, 'base64'));
writeFileSync('assets/brainrots/fallback/brainrot-placeholder.webp', Buffer.from(placeholderWebp, 'base64'));
