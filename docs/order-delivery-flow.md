# Order Delivery Flow

## Status

`order_status`: draft, awaiting_payment, paid, preparing_delivery, ready_for_delivery, delivered, cancelled, refunded, disputed.

`payment_status`: pending, confirmed, expired, cancelled, refunded, failed, disputed.

`delivery_status`: pending, contacting_customer, scheduled, delivering, delivered, failed, cancelled.

## Fluxo

Pedido criado -> aguardando pagamento -> pagamento confirmado por webhook -> preparando entrega -> contatando cliente -> entrega em andamento -> entregue.

## Entrega manual

Ao marcar como entregue, o painel admin deve exigir administrador, data/hora, quantidade entregue, confirmacao e observacao/evidencia opcional.
