const FALLBACK_IMAGE = '/assets/brainrots/fallback/brainrot-placeholder.webp';
const imageCache = new Map();
const missingSlugs = new Set();
const SIZE_KEYS = {
  thumbnail: 'thumbnail',
  card: 'card',
  detail: 'detail',
  128: 'thumbnail',
  256: 'card',
  512: 'detail'
};

const safeImagePath = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return null;
  if (!value.startsWith('/assets/brainrots/')) return null;
  return value;
};

export const BrainrotImageService = {
  configure(imageEntries = []) {
    imageCache.clear();
    missingSlugs.clear();
    for (const entry of imageEntries || []) {
      if (entry.brainrotSlug) {
        imageCache.set(entry.brainrotSlug, entry);
      }
    }
  },

  getImage(slug, size = 'card') {
    const entry = imageCache.get(slug);
    const key = SIZE_KEYS[size] || 'card';
    const image = safeImagePath(entry?.images?.[key])
      || safeImagePath(entry?.images?.card)
      || safeImagePath(entry?.images?.thumbnail);
    if (!image) {
      if (slug) missingSlugs.add(slug);
      return FALLBACK_IMAGE;
    }
    return image;
  },

  getMetadata(slug) {
    return imageCache.get(slug) || null;
  },

  getMissingSlugs() {
    return [...missingSlugs];
  },

  fallback() {
    return FALLBACK_IMAGE;
  },

  isFallback(path) {
    return !path || path === FALLBACK_IMAGE || path.includes('/fallback/');
  }
};
