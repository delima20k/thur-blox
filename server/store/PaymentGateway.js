import crypto from 'node:crypto';
import { PixPayloadService } from './PixPayloadService.js';

export class PaymentGateway {
  async createPixPayment() {
    throw new Error('PaymentGateway.createPixPayment must be implemented by the selected backend provider.');
  }

  async getPaymentStatus() {
    throw new Error('PaymentGateway.getPaymentStatus must be implemented by the selected backend provider.');
  }

  async cancelPayment() {
    throw new Error('PaymentGateway.cancelPayment must be implemented by the selected backend provider.');
  }

  async refundPayment() {
    throw new Error('PaymentGateway.refundPayment must be implemented by the selected backend provider.');
  }

  verifyWebhook() {
    throw new Error('PaymentGateway.verifyWebhook must validate provider signatures in the backend.');
  }

  parseWebhookEvent() {
    throw new Error('PaymentGateway.parseWebhookEvent must parse provider events in the backend.');
  }
}

const toHeaderValue = (headers, name) => {
  if (!headers) return '';
  return String(headers[name] || headers[name.toLowerCase()] || '').trim();
};

const normalizePaymentStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (['confirmed', 'received', 'received_in_cash', 'paid', 'approved'].includes(normalized)) return 'confirmed';
  if (['expired', 'overdue'].includes(normalized)) return 'expired';
  if (['cancelled', 'canceled'].includes(normalized)) return 'cancelled';
  if (['refunded', 'chargeback'].includes(normalized)) return 'refunded';
  if (['failed', 'rejected', 'denied'].includes(normalized)) return 'failed';
  return 'pending';
};

const centsFromValue = (value) => {
  if (Number.isInteger(value)) return value;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
};

export class SandboxPixPaymentGateway extends PaymentGateway {
  constructor({
    provider = 'asaas',
    environment = 'sandbox',
    pixKey,
    pixKeyType = 'email',
    receiverName,
    receiverCity,
    webhookToken = '',
    chargeTtlMs = 30 * 60 * 1000,
    now = () => new Date()
  } = {}) {
    super();
    this.provider = provider;
    this.environment = environment;
    this.pixKey = pixKey;
    this.pixKeyType = pixKeyType;
    this.receiverName = receiverName;
    this.receiverCity = receiverCity;
    this.webhookToken = webhookToken;
    this.chargeTtlMs = chargeTtlMs;
    this.now = now;
    this.charges = new Map();
    this.idempotency = new Map();
    this.pixPayloadService = new PixPayloadService();
  }

  async createPixPayment({ order, idempotencyKey } = {}) {
    if (!order?.orderCode) throw new Error('ORDER_REQUIRED');
    if (!Number.isInteger(order.totalInCents) || order.totalInCents <= 0) throw new Error('INVALID_PAYMENT_AMOUNT');

    const safeIdempotencyKey = String(idempotencyKey || `pix:${order.orderCode}:${order.totalInCents}`).trim();
    if (this.idempotency.has(safeIdempotencyKey)) {
      return this.idempotency.get(safeIdempotencyKey);
    }

    const txid = String(order.orderCode).replace(/[^A-Z0-9]/gi, '').slice(0, 25);
    const payload = this.pixPayloadService.createPayload({
      pixKey: this.pixKey,
      amountInCents: order.totalInCents,
      txid,
      receiverName: this.receiverName,
      receiverCity: this.receiverCity,
      description: order.orderCode
    });

    const paymentId = `pix_${crypto.createHash('sha256').update(`${safeIdempotencyKey}:${txid}`).digest('hex').slice(0, 18)}`;
    const expiresAt = new Date(this.now().getTime() + this.chargeTtlMs).toISOString();
    const charge = {
      paymentId,
      provider: this.provider,
      environment: this.environment,
      status: 'pending',
      amountInCents: order.totalInCents,
      currency: 'BRL',
      externalReference: order.orderCode,
      txid: payload.txid,
      pixKeyType: this.pixKeyType,
      qrCodePayload: payload.pixCopyPaste,
      copyPasteCode: payload.pixCopyPaste,
      qrCodeImageUrl: `/api/orders/${encodeURIComponent(order.orderCode)}/pix-qr.svg`,
      expiresAt,
      idempotencyKey: safeIdempotencyKey,
      createdAt: this.now().toISOString()
    };

    this.charges.set(paymentId, charge);
    this.idempotency.set(safeIdempotencyKey, charge);
    return charge;
  }

  async getPaymentStatus(paymentId) {
    return this.charges.get(paymentId) || null;
  }

  async cancelPayment(paymentId) {
    const charge = this.charges.get(paymentId);
    if (!charge) return null;
    charge.status = 'cancelled';
    charge.cancelledAt = this.now().toISOString();
    return charge;
  }

  verifyWebhook({ headers = {} } = {}) {
    if (!this.webhookToken) return { ok: true };
    const bearer = toHeaderValue(headers, 'authorization').replace(/^Bearer\s+/i, '');
    const token = toHeaderValue(headers, 'x-thur-webhook-token')
      || toHeaderValue(headers, 'x-asaas-webhook-token')
      || bearer;
    const tokenBuffer = Buffer.from(token || '');
    const expectedBuffer = Buffer.from(this.webhookToken);
    return tokenBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
      ? { ok: true }
      : { ok: false, reason: 'INVALID_WEBHOOK_TOKEN' };
  }

  parseWebhookEvent(body = {}) {
    const payment = body.payment || body.data || body;
    const paymentId = payment.paymentId || payment.id || payment.chargeId;
    const externalReference = payment.externalReference || payment.external_reference || payment.reference || payment.orderCode;
    const amountInCents = centsFromValue(payment.amountInCents ?? payment.value ?? payment.amount);
    return {
      eventId: body.eventId || body.id || `${paymentId || externalReference}:${body.event || payment.status || 'payment'}`,
      eventType: body.event || body.type || 'PAYMENT_UPDATED',
      paymentId,
      externalReference,
      amountInCents,
      currency: payment.currency || 'BRL',
      status: normalizePaymentStatus(payment.status || payment.paymentStatus || body.status),
      raw: body
    };
  }
}
