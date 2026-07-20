# Pix Integration

## Status

Pix real esta desativado. `COMMERCE_ENABLED=false` e `PAYMENT_ENVIRONMENT=sandbox` em `.env.example`.

## Provedor

Nenhum provedor foi escolhido. A abstracao `PaymentGateway` aceita um adaptador futuro para Asaas ou Mercado Pago, mas apenas um deve ser implementado primeiro.

## Regras

- A chave da API e o segredo do webhook devem existir somente no backend.
- O frontend nunca deve receber segredo, payload interno do gateway ou credencial administrativa.
- O cliente nao pode confirmar o proprio pagamento.
- O pagamento deve ser confirmado por webhook validado e idempotente.

## Tela Pix alvo

Depois que o backend criar uma cobranca sandbox, a resposta publica deve conter apenas codigo do pedido, status pendente, QR Code, Pix copia e cola e expiracao.
