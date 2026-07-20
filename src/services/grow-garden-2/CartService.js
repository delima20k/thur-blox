const CART_STORAGE_KEY = 'thur-blox:grow-garden-cart';
const CART_IMAGE_FALLBACK = '/assets/grow-garden-2/seeds/seed-placeholder.webp';

const safeQuantity = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : 1;
};

export class CartService {
  constructor({ storage = globalThis.localStorage, storageKey = CART_STORAGE_KEY, getProductBySlug = null } = {}) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.getProductBySlug = typeof getProductBySlug === 'function' ? getProductBySlug : null;
  }

  setProductResolver(getProductBySlug) {
    this.getProductBySlug = typeof getProductBySlug === 'function' ? getProductBySlug : null;
  }

  getItems() {
    try {
      const value = this.storage?.getItem(this.storageKey);
      if (!value) return [];
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        this.clear();
        return [];
      }
      const normalized = this.normalizeItems(parsed, { allowPartial: true });
      if (normalized.length !== parsed.length || JSON.stringify(normalized) !== value) {
        this.save(normalized, { allowPartial: true });
      }
      return normalized;
    } catch (error) {
      console.error('INVALID_CART_STORAGE', error);
      this.clear();
      return [];
    }
  }

  load() {
    return this.getItems();
  }

  save(items, options = {}) {
    const safeItems = this.normalizeItems(items, options);
    this.storage?.setItem(this.storageKey, JSON.stringify(safeItems));
    return safeItems;
  }

  clear() {
    this.storage?.removeItem(this.storageKey);
  }

  normalizeProduct(product) {
    const commerce = product?.commerce || product || {};
    const productSlug = String(product?.productSlug || product?.slug || product?.seedSlug || commerce.slug || commerce.seedSlug || '').trim();
    if (!productSlug) return null;
    const unitPriceInCents = Number.isInteger(product?.unitPriceInCents)
      ? product.unitPriceInCents
      : (Number.isInteger(commerce.priceInCents) ? commerce.priceInCents : commerce.salePriceInCents);
    if (!Number.isInteger(unitPriceInCents) || unitPriceInCents < 0) return null;
    const stockValue = Number.isInteger(product?.availableStock)
      ? product.availableStock
      : (Number.isInteger(commerce.availableStock) ? commerce.availableStock : 99);
    return {
      productSlug,
      productName: String(product?.productName || product?.name || commerce.name || productSlug),
      image: String(product?.image || product?.imageUrl || commerce.image || commerce.imageUrl || CART_IMAGE_FALLBACK),
      category: String(product?.category || commerce.category || 'Produto'),
      unitPriceInCents,
      quantity: safeQuantity(product?.quantity),
      availableStock: Math.max(0, stockValue)
    };
  }

  normalizeItem(item, { allowPartial = false } = {}) {
    const productSlug = String(item?.productSlug || item?.slug || item?.seedSlug || '').trim();
    if (!productSlug) return null;
    const product = this.getProductBySlug?.(productSlug);
    const normalized = this.normalizeProduct(product ? { ...product, quantity: item.quantity } : item);
    if (normalized) return normalized;
    return allowPartial ? { productSlug, quantity: safeQuantity(item.quantity) } : null;
  }

  normalizeItems(items = [], options = {}) {
    const bySlug = new Map();
    items.forEach((item) => {
      const normalized = this.normalizeItem(item, options);
      if (!normalized) return;
      const current = bySlug.get(normalized.productSlug);
      const quantity = (current?.quantity || 0) + safeQuantity(normalized.quantity);
      bySlug.set(normalized.productSlug, { ...normalized, quantity });
    });
    return [...bySlug.values()];
  }

  addItem(product, quantity = 1) {
    return this.save([...this.getItems(), { ...product, quantity }]);
  }

  add(items, productSlug, quantity = 1) {
    return this.save([...this.normalizeItems(items, { allowPartial: true }), { productSlug, quantity }], { allowPartial: true });
  }

  updateQuantity(itemsOrSlug, productSlugOrQuantity, maybeQuantity) {
    const legacyMode = Array.isArray(itemsOrSlug);
    const items = legacyMode ? itemsOrSlug : this.getItems();
    const productSlug = legacyMode ? productSlugOrQuantity : itemsOrSlug;
    const quantity = legacyMode ? maybeQuantity : productSlugOrQuantity;
    const safeItems = this.normalizeItems(items, { allowPartial: true })
      .map((item) => item.productSlug === productSlug ? { ...item, quantity: safeQuantity(quantity) } : item);
    return this.save(safeItems, { allowPartial: true });
  }

  removeItem(productSlug) {
    return this.save(this.getItems().filter((item) => item.productSlug !== productSlug));
  }

  remove(items, productSlug) {
    return this.save(this.normalizeItems(items, { allowPartial: true }).filter((item) => item.productSlug !== productSlug), { allowPartial: true });
  }

  getTotalQuantity(items = this.getItems()) {
    return this.normalizeItems(items, { allowPartial: true }).reduce((total, item) => total + safeQuantity(item.quantity), 0);
  }

  getSubtotalInCents(items = this.getItems()) {
    return this.normalizeItems(items).reduce((total, item) => total + (item.unitPriceInCents || 0) * safeQuantity(item.quantity), 0);
  }

  count(items) {
    return this.getTotalQuantity(items);
  }
}

export { CART_STORAGE_KEY };
