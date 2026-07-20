# Store Security

## Bloqueios aplicados

- `COMMERCE_ENABLED=false`.
- Produtos com `saleEnabled=false`.
- `priceInCents=null`.
- `availableStock=0`.
- Checkout nao cria pedido real sem backend.
- Nenhum segredo usa prefixo `VITE_`.

## Requisitos do backend

- Validacao de preco, estoque, cupom e quantidade.
- Idempotencia para pedido, Pix e webhook.
- Rate limit para pedido, consulta publica e cupons.
- Webhook com assinatura/segredo validado.
- Logs estruturados sem segredos.
- Queries parametrizadas.
- CORS restrito, limite de payload e headers de seguranca.

## Dados proibidos

Nao coletar senha Roblox, cookie Roblox, codigo de autenticacao, chave Pix privada do cliente ou dados desnecessarios.
