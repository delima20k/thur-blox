const DEFAULT_STORAGE_KEY = 'brainrot-trocas:favorites';
const FAVORITES_CHANGED_EVENT = 'brainrot:favorites-changed';

const getStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
};

const normalizeSlug = (value) => {
  if (typeof value !== 'string') return null;
  const slug = value.trim();
  return slug.length ? slug : null;
};

export class FavoritesService {
  constructor(storageKey = DEFAULT_STORAGE_KEY) {
    this.storageKey = storageKey;
    if (typeof window !== 'undefined' && window.localStorage) {
      // perform migration once at construction
      this._migratePerUserKeys();
    }
  }

  // Safe migration: if older per-user keys exist (braintrade:favorites:*),
  // merge them into the global key without deleting originals.
  _migratePerUserKeys() {
    const storage = getStorage();
    if (!storage) return;
    try {
      const keys = Object.keys(storage).filter((k) => k && k.startsWith('braintrade:favorites:'));
      if (!keys.length) return;
      const merged = new Map();
      // existing global entries
      const existing = JSON.parse(storage.getItem(DEFAULT_STORAGE_KEY) || '[]');
      (Array.isArray(existing) ? existing : []).forEach((e) => {
        const slug = typeof e === 'string' ? e : e?.slug;
        if (slug) merged.set(slug, e);
      });
      keys.forEach((k) => {
        try {
          const parsed = JSON.parse(storage.getItem(k) || '[]');
          (Array.isArray(parsed) ? parsed : []).forEach((item) => {
            const slug = typeof item === 'string' ? item : item?.slug;
            if (slug && !merged.has(slug)) merged.set(slug, item);
          });
        } catch (e) { /* ignore malformed */ }
      });
      const out = Array.from(merged.values()).slice(0, 200);
      storage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(out));
    } catch (e) {
      // swallow
    }
  }

  readRaw() {
    const storage = getStorage();
    if (!storage) return [];
    try {
      const parsed = JSON.parse(storage.getItem(this.storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  normalizeEntries(entries = this.readRaw(), validSlugs = null) {
    const validSet = validSlugs ? new Set(validSlugs) : null;
    const seen = new Set();
    return entries.reduce((items, entry) => {
      const slug = normalizeSlug(typeof entry === 'string' ? entry : entry?.slug);
      if (!slug || seen.has(slug)) return items;
      if (validSet && !validSet.has(slug)) return items;
      seen.add(slug);
      items.push({
        slug,
        addedAt: typeof entry === 'object' && entry?.addedAt ? entry.addedAt : new Date(0).toISOString()
      });
      return items;
    }, []);
  }

  persist(entries) {
    const storage = getStorage();
    if (storage) storage.setItem(this.storageKey, JSON.stringify(entries));
  }

  emitChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: { favorites: this.getAll() } }));
    }
  }

  getEntries(validSlugs = null) {
    const entries = this.normalizeEntries(this.readRaw(), validSlugs);
    if (validSlugs) this.persist(entries);
    return entries;
  }

  getAll(validSlugs = null) {
    return this.getEntries(validSlugs).map((entry) => entry.slug);
  }

  has(slug) {
    const normalized = normalizeSlug(slug);
    return !!normalized && this.getAll().includes(normalized);
  }

  add(slug) {
    const normalized = normalizeSlug(slug);
    if (!normalized) return false;
    const entries = this.getEntries();
    if (entries.some((entry) => entry.slug === normalized)) return true;
    entries.unshift({ slug: normalized, addedAt: new Date().toISOString() });
    this.persist(entries);
    this.emitChange();
    return true;
  }

  remove(slug) {
    const normalized = normalizeSlug(slug);
    if (!normalized) return false;
    const entries = this.getEntries();
    const nextEntries = entries.filter((entry) => entry.slug !== normalized);
    if (nextEntries.length === entries.length) return false;
    this.persist(nextEntries);
    this.emitChange();
    return false;
  }

  toggle(slug) {
    return this.has(slug) ? this.remove(slug) : this.add(slug);
  }

  clear() {
    this.persist([]);
    this.emitChange();
  }

  pruneInvalid(validSlugs) {
    return this.getAll(validSlugs);
  }
}

export const favoritesService = new FavoritesService();
export { FAVORITES_CHANGED_EVENT };
