# Grow a Garden 2 Access Control

As abas `Admin` e `Acompanhar pedido` usam validacao no backend/BFF via:

- `POST /api/access/admin/verify`
- `POST /api/access/order-tracking/verify`

Configure em ambiente local/servidor:

- `ADMIN_ACCESS_PASSWORD`
- `ORDER_TRACKING_PASSWORD`

Ou, preferencialmente, configure hashes:

- `ADMIN_ACCESS_PASSWORD_HASH`
- `ORDER_TRACKING_PASSWORD_HASH`

Nao use prefixo `VITE_` para essas variaveis. Senhas com prefixo de frontend entram no bundle e deixam de ser segredo.

Antes de publicar:

- trocar a senha temporaria por senha forte;
- preferir autenticacao administrativa real;
- nao publicar senha em GitHub;
- manter validacao, tokens e rate limit no backend;
- proteger todas as rotas administrativas com autorizacao de escopo `admin`.
