export const STORE_COMMERCE_CONFIG = Object.freeze({
  commerceEnabled: true,
  testCheckoutEnabled: false,
  orderStorageMode: 'local',
  paymentEnvironment: 'production',
  apiBaseUrl: '/api',
  paymentProvider: null,
  pix: Object.freeze({
    mode: 'manual',
    key: 'delimathur668@gmail.com',
    keyType: 'email',
    receiverName: 'THUR BLOX',
    receiverCity: 'SAO PAULO'
  }),
  storeName: 'THUR BLOX',
  requiredProductionDocuments: [
    'permissao-para-vender-itens',
    'regras-atuais-roblox',
    'regras-grow-a-garden-2',
    'politica-de-entrega',
    'politica-de-reembolso',
    'responsavel-pela-loja',
    'termos-de-uso',
    'politica-de-privacidade'
  ]
});
