# delima blox

Aplicativo web PWA para consultar Brainrots do jogo Steal a Brainrot e comparar equivalencias de troca quando houver dados de mercado verificados.

## Estrutura do projeto

- `index.html` - pagina principal
- `styles.css` - estilos do app
- `app.js` - carregamento de dados e inicializacao
- `src/components/EquivalenceApp.js` - interface da calculadora/lista/fontes
- `src/services/` - servicos de equivalencia, valor, renda, imagens, formatacao e compatibilidade
- `src/data/brainrots.json` - base ativa de Brainrots
- `src/data/brainrot-market-values.json` - fotografia central de valores de troca por slug
- `src/data/brainrots-missing-market-values.json` - Brainrots ainda sem valor comunitario confiavel
- `src/data/mutations.json` - mutacoes globais
- `src/data/brainrot-images.json` - indice de imagens e fallback
- `data/brainrots.json` - base legada/parcial usada como referencia
- `public/assets/brainrots/fallback/` - fallback local de imagem
- `docs/` - relatorios de importacao, mercado, contagens, imagens e mutacoes
- `tests/` - testes automatizados

## Execucao local

1. Execute `npm install`.
2. Execute `npm run dev`.
3. Acesse o endereco mostrado no terminal, por padrao `http://localhost:5173`.

## Scripts

- `npm run dev` - inicia o servidor estatico local
- `npm test` - roda os testes automatizados
- `npm run build` - valida sintaxe dos arquivos principais
- `node scripts/generate-reports.mjs` - atualiza relatorios em `docs/`
- `node scripts/validate-brainrot-images.js` - valida o indice de imagens

## Pendencias de dados

Valores de troca, custo dentro do jogo, renda por segundo, demanda, disponibilidade detalhada, contagens existentes, imagens definitivas, compatibilidade de mutacoes e multiplicadores de mercado devem ser preenchidos somente com fonte confiavel. Enquanto isso, o app preserva `null`, mostra fallback e registra os itens em revisao.
