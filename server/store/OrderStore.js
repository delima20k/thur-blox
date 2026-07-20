import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class OrderStore {
  constructor({ storePath = '.tmp/store/orders.json' } = {}) {
    this.storePath = storePath;
    this.store = this.readStore();
  }

  readStore() {
    if (!existsSync(this.storePath)) return { orders: [] };
    try {
      const parsed = JSON.parse(readFileSync(this.storePath, 'utf8'));
      return { orders: Array.isArray(parsed.orders) ? parsed.orders : [] };
    } catch {
      return { orders: [] };
    }
  }

  writeStore() {
    mkdirSync(dirname(this.storePath), { recursive: true });
    writeFileSync(this.storePath, `${JSON.stringify(this.store, null, 2)}\n`);
  }

  create(order) {
    const safeOrder = {
      ...order,
      customer_user_id: order.customerUserId || order.customer_user_id || null,
      customer_email: order.email || '',
      customer_name: order.customerName || '',
      public_code: order.orderCode,
      createdAt: order.createdAt || new Date().toISOString()
    };
    this.store.orders.unshift(safeOrder);
    this.writeStore();
    return safeOrder;
  }

  findByCode(orderCode) {
    const code = String(orderCode || '').trim().toUpperCase();
    return this.store.orders.find((order) => order.orderCode === code) || null;
  }

  listAll() {
    return [...this.store.orders];
  }

  updateStatus(orderCode, patch) {
    const code = String(orderCode || '').trim().toUpperCase();
    const order = this.store.orders.find((item) => item.orderCode === code);
    if (!order) return null;
    Object.assign(order, patch, { updatedAt: new Date().toISOString() });
    this.writeStore();
    return order;
  }
}
