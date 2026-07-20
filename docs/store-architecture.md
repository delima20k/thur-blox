# Store Architecture

## Diagnostico

O projeto atual e um frontend Vite/PWA estatico. Nao ha backend/BFF, banco de dados, Supabase, Firebase, Vercel Functions, autenticacao administrativa ou provedor Pix configurado.

## Decisao

A loja fica bloqueada por `COMMERCE_ENABLED=false`. O frontend mostra catalogo, checkout de teste e contratos de operacao, mas nao cria pedidos reais, nao confirma pagamento e nao salva pedidos em `localStorage`.

## Fluxo alvo

Frontend -> API/BFF -> banco de dados -> gateway Pix -> webhook -> banco de dados -> painel administrativo protegido.

## Artefatos criados

- Configuracao: `src/config/store-commerce-config.js`.
- Produtos comerciais bloqueados: `src/data/grow-garden-2/store-products.json`.
- Migration alvo: `migrations/202607010001_store_schema.sql`.
- Contrato do gateway: `server/store/PaymentGateway.js`.

## Endpoints alvo

- `POST /api/store/orders`
- `POST /api/store/orders/:orderCode/payment/pix`
- `GET /api/store/orders/:orderCode/status`
- `POST /api/webhooks/payments/:provider`

Nenhum endpoint real foi criado porque o repositorio ainda nao possui servidor.
