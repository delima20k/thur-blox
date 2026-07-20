import QRCode from 'qrcode';
import {
  buildPixPayload,
  validatePixPayloadCrc
} from '../../src/services/grow-garden-2/StoreCommerceService.js';

const PIX_ERROR_MESSAGES = Object.freeze({
  PIX_CONFIGURATION_MISSING: 'A configuracao Pix ainda esta incompleta.',
  PIX_RECEIVER_NAME_MISSING: 'Nome do recebedor Pix nao configurado.',
  PIX_RECEIVER_CITY_MISSING: 'Cidade do recebedor Pix nao configurada.',
  PIX_PAYLOAD_ERROR: 'Nao foi possivel gerar o codigo Pix.',
  PIX_QR_ERROR: 'Nao foi possivel gerar o QR Code.'
});

export class PixPayloadError extends Error {
  constructor(code, message = PIX_ERROR_MESSAGES[code] || code, details = {}) {
    super(message);
    this.name = 'PixPayloadError';
    this.code = code;
    this.details = details;
  }
}

export class PixPayloadService {
  constructor({ qrWidth = 280 } = {}) {
    this.qrWidth = qrWidth;
  }

  createPayload({ pixKey, receiverName, receiverCity, amountInCents, txid, description = '' } = {}) {
    if (!String(pixKey || '').trim()) {
      throw new PixPayloadError('PIX_CONFIGURATION_MISSING');
    }
    if (!String(receiverName || '').trim()) {
      throw new PixPayloadError('PIX_RECEIVER_NAME_MISSING');
    }
    if (!String(receiverCity || '').trim()) {
      throw new PixPayloadError('PIX_RECEIVER_CITY_MISSING');
    }

    const result = buildPixPayload({
      pixKey,
      receiverName,
      receiverCity,
      amountInCents,
      txid,
      description
    });
    if (!result.ok || !validatePixPayloadCrc(result.payload)) {
      throw new PixPayloadError('PIX_PAYLOAD_ERROR', result.reason || undefined, { result });
    }
    return {
      pixCopyPaste: result.payload,
      payload: result.payload,
      txid: result.txid,
      amount: result.amount,
      receiverName: result.receiverName,
      receiverCity: result.receiverCity,
      crcValid: true
    };
  }

  async generateQrCode(payload) {
    if (!validatePixPayloadCrc(payload)) {
      throw new PixPayloadError('PIX_PAYLOAD_ERROR');
    }
    try {
      return await QRCode.toString(payload, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 3,
        width: this.qrWidth,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (error) {
      throw new PixPayloadError('PIX_QR_ERROR', undefined, { cause: error });
    }
  }
}

export { PIX_ERROR_MESSAGES };
