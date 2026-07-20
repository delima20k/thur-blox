# Coupons

## Estrutura

Os cupons de exemplo estao em `src/data/grow-garden-2/store-coupons.example.json` e ficam desativados:

- `WELCOME10`: 10%, `active=false`.
- `SEED5`: R$ 5,00, `active=false`.

## Validacao

O frontend envia somente o codigo. O backend deve validar ativo, datas, limites, produtos aplicaveis, pedido minimo e calcular desconto em centavos.

## Regras

- Codigos normalizados em maiusculas.
- Cupons nao cumulativos por padrao.
- Percentual deve ser maior que 0 e no maximo 100.
- Valor fixo deve ser inteiro positivo em centavos.
- Data final nao pode ser anterior a inicial.
