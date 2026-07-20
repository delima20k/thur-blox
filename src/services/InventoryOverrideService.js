export const INVENTORY_OVERRIDES_STORAGE_KEY = 'thur_blox_inventory_overrides_v1';
export const STOCK_STATUS = Object.freeze({
  AVAILABLE: 'available',
  OUT_OF_STOCK: 'out_of_stock',
  HIDDEN: 'hidden'
});

const getDefaultStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
};

export const normalizeStockStatus = ({ status, stock, saleEnabled }) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === STOCK_STATUS.HIDDEN) return STOCK_STATUS.HIDDEN;
  if (stock <= 0) return STOCK_STATUS.OUT_OF_STOCK;
  if (saleEnabled === true) return STOCK_STATUS.AVAILABLE;
  return STOCK_STATUS.OUT_OF_STOCK;
};

export const normalizeStockStatusValue = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'sold_out') return STOCK_STATUS.OUT_OF_STOCK;
  if ([STOCK_STATUS.AVAILABLE, STOCK_STATUS.OUT_OF_STOCK, STOCK_STATUS.HIDDEN].includes(normalized)) return normalized;
  return STOCK_STATUS.OUT_OF_STOCK;
};

export const parseStockValue = (availableStock) => {
  const value = String(availableStock ?? '').trim();
  if (!/^\d+$/.test(value)) throw new Error('Estoque deve ser um numero inteiro maior ou igual a zero.');
  const stock = Number(value);
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Estoque deve ser um numero inteiro maior ou igual a zero.');
  return stock;
};

export const normalizeStockState = ({ availableStock, saleEnabled, stockStatus }) => {
  const stock = parseStockValue(availableStock);
  const enabled = saleEnabled === true;
  const requestedStatus = normalizeStockStatusValue(stockStatus);

  if (requestedStatus === STOCK_STATUS.HIDDEN) {
    return {
      availableStock: stock,
      saleEnabled: false,
      stockStatus: STOCK_STATUS.HIDDEN
    };
  }

  if (stock <= 0) {
    return {
      availableStock: stock,
      saleEnabled: false,
      stockStatus: STOCK_STATUS.OUT_OF_STOCK
    };
  }

  if (requestedStatus === STOCK_STATUS.AVAILABLE || enabled) {
    return {
      availableStock: stock,
      saleEnabled: true,
      stockStatus: STOCK_STATUS.AVAILABLE
    };
  }

  return {
    availableStock: stock,
    saleEnabled: false,
    stockStatus: STOCK_STATUS.OUT_OF_STOCK
  };
};

const validateOverride = ({ availableStock, saleEnabled, stockStatus }) => {
  const stock = parseStockValue(availableStock);
  const requestedStatus = normalizeStockStatusValue(stockStatus);
  if (![STOCK_STATUS.AVAILABLE, STOCK_STATUS.OUT_OF_STOCK, STOCK_STATUS.HIDDEN].includes(requestedStatus)) {
    throw new Error('Status de estoque invalido.');
  }
  if (requestedStatus === STOCK_STATUS.AVAILABLE && stock <= 0) {
    throw new Error('Status Disponivel exige estoque maior que zero.');
  }
  if (saleEnabled === true && stock <= 0) {
    throw new Error('Venda ativa exige estoque maior que zero.');
  }
  return normalizeStockState({ availableStock, saleEnabled, stockStatus: requestedStatus });
};

export class InventoryOverrideService {
  constructor({ storage = getDefaultStorage() } = {}) {
    this.storage = storage;
  }

  loadOverrides() {
    if (!this.storage) return {};
    try {
      const parsed = JSON.parse(this.storage.getItem(INVENTORY_OVERRIDES_STORAGE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([, override]) => override?.source === 'localStorage'));
    } catch {
      return {};
    }
  }

  saveOverrides(overrides) {
    if (!this.storage) return;
    this.storage.setItem(INVENTORY_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides || {}));
  }

  applyToProducts(products) {
    const overrides = this.loadOverrides();
    return products.map((product) => this.applyToProduct(product, overrides[product.slug]));
  }

  applyToProduct(product, override) {
    if (!override) return product;
    const normalized = normalizeStockState({
      availableStock: Number.isInteger(override.availableStock) ? override.availableStock : product.availableStock,
      saleEnabled: override.saleEnabled === true,
      stockStatus: override.stockStatus
    });
    const { availableStock, saleEnabled, stockStatus } = normalized;
    return {
      ...product,
      availableStock,
      saleEnabled,
      stockStatus,
      commerce: product.commerce ? {
        ...product.commerce,
        availableStock,
        saleEnabled,
        stockStatus
      } : product.commerce
    };
  }

  validateProductOverride({ availableStock, saleEnabled, stockStatus }) {
    return validateOverride({ availableStock, saleEnabled, stockStatus });
  }

  saveProductOverride(productSlug, { availableStock, saleEnabled, stockStatus }) {
    const normalized = validateOverride({ availableStock, saleEnabled, stockStatus });
    const overrides = this.loadOverrides();
    overrides[productSlug] = {
      ...normalized,
      source: 'localStorage',
      updatedAt: new Date().toISOString()
    };
    this.saveOverrides(overrides);
    return overrides[productSlug];
  }

  saveProductOverrides(changesBySlug) {
    const entries = Object.entries(changesBySlug || {});
    const overrides = this.loadOverrides();
    const saved = {};
    const errors = {};
    const timestamp = new Date().toISOString();

    entries.forEach(([productSlug, change]) => {
      try {
        const normalized = validateOverride(change || {});
        overrides[productSlug] = {
          ...normalized,
          source: 'localStorage',
          updatedAt: timestamp
        };
        saved[productSlug] = overrides[productSlug];
      } catch (error) {
        errors[productSlug] = error.message || 'Nao foi possivel salvar este produto.';
      }
    });

    if (Object.keys(saved).length > 0) this.saveOverrides(overrides);
    return { saved, errors };
  }

  removeOverrides(productSlugs = []) {
    if (!this.storage || !Array.isArray(productSlugs) || productSlugs.length === 0) return;
    const overrides = this.loadOverrides();
    let changed = false;
    productSlugs.forEach((productSlug) => {
      if (Object.prototype.hasOwnProperty.call(overrides, productSlug)) {
        delete overrides[productSlug];
        changed = true;
      }
    });
    if (changed) this.saveOverrides(overrides);
  }

  saveLegacyProductOverride(productSlug, { availableStock, saleEnabled, stockStatus }) {
    const stock = Number.parseInt(availableStock, 10);
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Estoque deve ser um número inteiro maior ou igual a zero.');
    const enabled = saleEnabled === true;
    const status = normalizeStockStatus({ status: stockStatus, stock, saleEnabled: enabled });
    const overrides = this.loadOverrides();
    overrides[productSlug] = {
      availableStock: stock,
      saleEnabled: enabled && status === STOCK_STATUS.AVAILABLE && stock > 0,
      stockStatus: status,
      source: 'localStorage',
      updatedAt: new Date().toISOString()
    };
    this.saveOverrides(overrides);
    return overrides[productSlug];
  }
}
