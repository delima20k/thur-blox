import { readFileSync, writeFileSync } from 'node:fs';

const STOCK_STATUS = Object.freeze({
  AVAILABLE: 'available',
  OUT_OF_STOCK: 'out_of_stock',
  HIDDEN: 'hidden'
});

const parseStockInput = (availableStock) => {
  const value = String(availableStock ?? '').trim();
  if (!/^\d+$/.test(value)) throw new Error('Estoque deve ser um numero inteiro maior ou igual a zero.');
  const stock = Number(value);
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Estoque deve ser um numero inteiro maior ou igual a zero.');
  return stock;
};

const normalizeProductSlug = (productSlug) => String(productSlug || '').trim();

export const normalizeProductStockChange = ({ availableStock, saleEnabled, stockStatus }) => {
  const stock = parseStockInput(availableStock);
  const enabled = saleEnabled === true;
  const rawStatus = String(stockStatus || '').toLowerCase();
  const requestedStatus = rawStatus === 'sold_out' ? STOCK_STATUS.OUT_OF_STOCK : rawStatus;

  if (![STOCK_STATUS.AVAILABLE, STOCK_STATUS.OUT_OF_STOCK, STOCK_STATUS.HIDDEN].includes(requestedStatus)) {
    throw new Error('Status de estoque invalido.');
  }
  if (requestedStatus === STOCK_STATUS.AVAILABLE && stock <= 0) {
    throw new Error('Status Disponivel exige estoque maior que zero.');
  }
  if (enabled && stock <= 0) {
    throw new Error('Venda ativa exige estoque maior que zero.');
  }
  if (requestedStatus === STOCK_STATUS.HIDDEN) {
    return {
      availableStock: stock,
      saleEnabled: false,
      stockStatus: STOCK_STATUS.HIDDEN
    };
  }

  const normalizedStatus = stock <= 0
    ? STOCK_STATUS.OUT_OF_STOCK
    : (enabled || requestedStatus === STOCK_STATUS.AVAILABLE) ? STOCK_STATUS.AVAILABLE : STOCK_STATUS.OUT_OF_STOCK;

  return {
    availableStock: stock,
    saleEnabled: normalizedStatus === STOCK_STATUS.AVAILABLE,
    stockStatus: normalizedStatus
  };
};

export class ProductStockStore {
  constructor({ storePath, now = () => new Date() } = {}) {
    if (!storePath) throw new Error('storePath is required.');
    this.storePath = storePath;
    this.now = now;
  }

  readCatalog() {
    return JSON.parse(readFileSync(this.storePath, 'utf8'));
  }

  writeCatalog(data) {
    writeFileSync(this.storePath, `${JSON.stringify(data, null, 2)}\n`);
  }

  updateProductStock(productSlug, changes) {
    return this.updateProductStocks({ [productSlug]: changes });
  }

  updateProductStocks(changesBySlug) {
    const data = this.readCatalog();
    const products = Array.isArray(data.products) ? data.products : [];
    const bySlug = new Map(products
      .map((product) => [normalizeProductSlug(product.slug), product])
      .filter(([slug]) => Boolean(slug)));
    const saved = {};
    const errors = {};
    const timestamp = this.now().toISOString();

    Object.entries(changesBySlug || {}).forEach(([rawSlug, change]) => {
      const slug = normalizeProductSlug(rawSlug);
      if (!slug) {
        errors[rawSlug || 'produto-sem-slug'] = 'Produto sem identificador valido.';
        return;
      }
      const product = bySlug.get(slug);
      if (!product) {
        errors[slug] = `Produto nao encontrado na base local: ${slug}.`;
        return;
      }
      try {
        const normalized = normalizeProductStockChange(change || {});
        Object.assign(product, normalized);
        saved[slug] = {
          ...normalized,
          updatedAt: timestamp
        };
      } catch (error) {
        errors[slug] = error.message || 'Nao foi possivel salvar este produto.';
      }
    });

    if (Object.keys(saved).length > 0) {
      data.updatedAt = timestamp;
      this.writeCatalog(data);
    }

    return { saved, errors, products, catalog: data };
  }
}
