export const COUPON_STORAGE_KEY = 'thur_blox_admin_coupons_v1';

const VALID_CATEGORIES = new Set(['seeds', 'pets', 'gears', 'packages']);
const CATEGORY_ALIASES = Object.freeze({
  seed: 'seeds',
  seeds: 'seeds',
  semente: 'seeds',
  sementes: 'seeds',
  pet: 'pets',
  pets: 'pets',
  gear: 'gears',
  gears: 'gears',
  equipamento: 'gears',
  equipamentos: 'gears',
  pacote: 'packages',
  pacotes: 'packages',
  package: 'packages',
  packages: 'packages'
});

const getDefaultStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
};

const createId = () => `coupon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class CouponAdminService {
  constructor({ storage = getDefaultStorage(), now = () => new Date() } = {}) {
    this.storage = storage;
    this.now = now;
  }

  list() {
    if (!this.storage) return [];
    try {
      const coupons = JSON.parse(this.storage.getItem(COUPON_STORAGE_KEY) || '[]');
      return Array.isArray(coupons) ? coupons.filter((coupon) => coupon.archived !== true) : [];
    } catch {
      return [];
    }
  }

  listAll() {
    if (!this.storage) return [];
    try {
      const coupons = JSON.parse(this.storage.getItem(COUPON_STORAGE_KEY) || '[]');
      return Array.isArray(coupons) ? coupons : [];
    } catch {
      return [];
    }
  }

  save(coupons) {
    if (!this.storage) return;
    this.storage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupons));
  }

  upsert(input, { products = [], adminEmail = '' } = {}) {
    const coupon = this.normalize(input, { products, adminEmail });
    const coupons = this.listAll();
    const index = coupons.findIndex((item) => item.id === coupon.id || item.code === coupon.code);
    const nowIso = this.now().toISOString();
    const nextCoupon = {
      ...coupon,
      id: coupon.id || coupons[index]?.id || createId(),
      usedCount: Number.isInteger(coupon.usedCount) ? coupon.usedCount : coupons[index]?.usedCount || 0,
      createdAt: coupons[index]?.createdAt || nowIso,
      createdBy: coupons[index]?.createdBy || adminEmail,
      updatedAt: nowIso
    };
    if (index >= 0) coupons[index] = nextCoupon;
    else coupons.unshift(nextCoupon);
    this.save(coupons);
    return nextCoupon;
  }

  toggle(couponId) {
    const coupons = this.listAll();
    const coupon = coupons.find((item) => item.id === couponId);
    if (!coupon) throw new Error('Cupom nao encontrado.');
    coupon.active = coupon.active !== true;
    coupon.updatedAt = this.now().toISOString();
    this.save(coupons);
    return coupon;
  }

  archive(couponId) {
    const coupons = this.listAll();
    const coupon = coupons.find((item) => item.id === couponId);
    if (!coupon) throw new Error('Cupom nao encontrado.');
    coupon.active = false;
    coupon.archived = true;
    coupon.updatedAt = this.now().toISOString();
    this.save(coupons);
    return coupon;
  }

  normalize(input, { products = [], adminEmail = '' } = {}) {
    const code = String(input.code || '').trim().toUpperCase();
    if (!code) throw new Error('Codigo do cupom e obrigatorio.');
    if (/\s/.test(code)) throw new Error('Codigo do cupom nao pode ter espacos.');
    const type = String(input.type || input.discountType || 'percent').toLowerCase();
    const value = Number.parseInt(input.value ?? input.discountValue ?? input.amountInCents, 10);
    if (!Number.isInteger(value) || value <= 0) throw new Error('Valor do desconto deve ser maior que zero.');
    if (!['percent', 'percentage', 'fixed'].includes(type)) throw new Error('Tipo de desconto invalido.');
    if (type !== 'fixed' && value > 100) throw new Error('Desconto percentual deve ser no maximo 100.');

    const startsAt = String(input.startsAt || '').trim() || null;
    const expiresAt = String(input.expiresAt || '').trim() || null;
    if (startsAt && expiresAt && new Date(expiresAt).getTime() < new Date(startsAt).getTime()) {
      throw new Error('Data final nao pode ser menor que data inicial.');
    }
    const maxUses = this.nullableNonNegativeInteger(input.maxUses ?? input.totalUsageLimit, 'Limite de uso');
    const maxUsesPerCustomer = this.nullableNonNegativeInteger(input.maxUsesPerCustomer ?? input.usageLimitPerCustomer, 'Limite por cliente');
    const categories = this.normalizeCategories(input.categories || input.appliesTo?.categories || input.applicableCategories || []);
    const productSlugs = this.normalizeProductSlugs(input.productSlugs || input.appliesTo?.productSlugs || input.applicableProductSlugs || [], products);
    const discountType = type === 'fixed' ? 'fixed' : 'percentage';
    const discountValue = discountType === 'fixed' ? value : value;

    return {
      id: input.id || '',
      code,
      description: String(input.description || '').trim() || `${discountType === 'fixed' ? 'Desconto fixo' : `${value}% de desconto`}`,
      type: discountType === 'fixed' ? 'fixed' : 'percent',
      value: discountType === 'fixed' ? null : value,
      amountInCents: discountType === 'fixed' ? value : null,
      discountType,
      discountValue,
      active: input.active === true,
      startsAt,
      expiresAt,
      maxUses,
      totalUsageLimit: maxUses,
      usedCount: Number.isInteger(input.usedCount) ? input.usedCount : 0,
      maxUsesPerCustomer,
      usageLimitPerCustomer: maxUsesPerCustomer,
      appliesTo: {
        categories,
        productSlugs
      },
      applicableCategories: categories,
      applicableProductSlugs: productSlugs,
      archived: input.archived === true,
      createdBy: input.createdBy || adminEmail
    };
  }

  nullableNonNegativeInteger(value, label) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const number = Number.parseInt(text, 10);
    if (!Number.isInteger(number) || number < 0) throw new Error(`${label} nao pode ser negativo.`);
    return number;
  }

  normalizeCategories(value) {
    const list = Array.isArray(value) ? value : String(value || '').split(',');
    const categories = [...new Set(list.map((item) => {
      const key = String(item || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '-');
      return CATEGORY_ALIASES[key] || key;
    }).filter(Boolean))];
    const invalid = categories.find((category) => !VALID_CATEGORIES.has(category));
    if (invalid) throw new Error('Categoria de cupom invalida.');
    return categories;
  }

  normalizeProductSlugs(value, products) {
    const list = Array.isArray(value) ? value : String(value || '').split(',');
    const slugs = [...new Set(list.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
    if (slugs.length === 0) return [];
    const productSlugs = new Set(products.map((product) => String(product.slug || '').trim().toLowerCase()));
    const invalid = slugs.find((slug) => !productSlugs.has(slug));
    if (invalid) throw new Error(`Produto inexistente no cupom: ${invalid}.`);
    return slugs;
  }
}
