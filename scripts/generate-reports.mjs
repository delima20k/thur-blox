import { readFileSync, writeFileSync } from 'node:fs';
import { BrainrotDataService } from '../src/services/BrainrotDataService.js';
import { TradeEquivalenceService } from '../src/services/TradeEquivalenceService.js';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const rawBrainrots = readJson('src/data/brainrots.json');
const review = readJson('src/data/brainrots-review.json');
const mutations = readJson('src/data/mutations.json');
const images = readJson('src/data/brainrot-images.json');
const marketValues = readJson('src/data/brainrot-market-values.json');
const missingMarketValues = readJson('src/data/brainrots-missing-market-values.json');
const missingData = readJson('src/data/brainrots-missing-data.json');
const missingImages = readJson('src/data/brainrots-missing-images.json');
const { brainrots, diagnostics } = BrainrotDataService.merge({
  brainrots: rawBrainrots,
  marketValues,
  images
});
const issues = TradeEquivalenceService.validateBrainrots(brainrots);

const hasValue = (pet) => TradeEquivalenceService.getBaseValue(pet) != null;
const hasIncome = (pet) => pet.incomePerSecond != null || pet.baseIncomePerSecond != null;
const hasSource = (pet) => (Array.isArray(pet.valueSources) && pet.valueSources.length > 0)
  || (Array.isArray(pet.valueSource) && pet.valueSource.length > 0)
  || (Array.isArray(pet.sources) && pet.sources.length > 0);
const hasUpdatedData = (pet) => Boolean(pet.valueVerifiedAt || pet.lastVerifiedAt);
const complete = (pet) => hasValue(pet)
  && hasIncome(pet)
  && pet.purchaseCost != null
  && pet.existCount != null
  && pet.image
  && pet.valueVerifiedAt;
const strawberry = brainrots.find((pet) => pet.slug === 'strawberry-elephant');
const strawberryResult = TradeEquivalenceService.findEquivalences({
  selectedPet: strawberry,
  quantity: 1,
  mutation: TradeEquivalenceService.getMutation(strawberry, 'Normal')
}, brainrots);

const requiredNames = [
  'Meowl',
  'Skibidi Toilet',
  'Strawberry Elephant',
  'Headless Horseman',
  'John Pork',
  'Spyder Elephant',
  'Antonio',
  'Signore Carapace',
  'Elefanto Frigo',
  'Dug dug dug',
  'Garama and Madundung'
];

const requiredResults = requiredNames.map((name) => {
  const pet = brainrots.find((item) => item.name === name);
  return `- ${name}: ${pet ? `${pet.rarity}, slug ${pet.slug}, valor ${hasValue(pet) ? 'presente' : 'ausente'}, imagem ${pet.image ? 'fallback/pendente' : 'ausente'}` : 'ausente'}`;
}).join('\n');

const marketReport = `# Brainrots Market Data Report

- total de pets: ${brainrots.length}
- total com somente nome e raridade: ${brainrots.filter((pet) => Object.keys(pet).length <= 2).length}
- total com valor: ${brainrots.filter(hasValue).length}
- total sem valor: ${brainrots.filter((pet) => !hasValue(pet)).length}
- total com valor em uma fonte: ${marketValues.filter((value) => value.sources?.length === 1).length}
- total confirmado por duas fontes: ${marketValues.filter((value) => value.sources?.length >= 2).length}
- total com fontes conflitantes: ${marketValues.filter((value) => value.status === 'conflicting').length}
- total com custo dentro do jogo: ${brainrots.filter((pet) => pet.purchaseCost != null).length}
- total com renda: ${brainrots.filter(hasIncome).length}
- total com mutacoes: ${brainrots.filter((pet) => Array.isArray(pet.mutations) && pet.mutations.length > 0).length}
- total com imagens: ${brainrots.filter((pet) => Boolean(pet.image)).length}
- total com quantidade existente: ${brainrots.filter((pet) => pet.existCount != null).length}
- total com fontes: ${brainrots.filter(hasSource).length}
- total com data de verificacao: ${brainrots.filter(hasUpdatedData).length}
- total com dados completos: ${brainrots.filter(complete).length}
- total com dados parciais: ${missingData.length}
- total em revisao: ${brainrots.filter((pet) => pet.confidence === 'review' || pet.valueConfidence === 'unknown').length}
- total sem dados de mercado: ${brainrots.filter((pet) => !hasValue(pet) && !hasIncome(pet) && pet.purchaseCost == null).length}
- slugs duplicados: ${issues.duplicateSlugs.length ? issues.duplicateSlugs.join(', ') : 'nenhum'}
- nomes duplicados: ${issues.duplicateNames.length ? issues.duplicateNames.join(', ') : 'nenhum'}
- registros sem slug: ${brainrots.filter((pet) => !pet.slug).length}
- valores sem pet: ${diagnostics.valueWithoutPet.length}
- pets sem valor na base central: ${missingMarketValues.length}
- valores nao numericos corrigidos: ${diagnostics.nonNumericValues.length}
- data da pesquisa: 2026-06-23
- fontes consultadas: Game.Guide
- imagens sem pet: ${images.filter((entry) => !brainrots.some((pet) => pet.slug === entry.brainrotSlug)).length}
- conflitos de raridade: ${review.filter((item) => item.reason && item.reason.toLowerCase().includes('conflict')).map((item) => item.name).join(', ') || 'Fishing Event registrado no relatorio de importacao'}
- conflitos entre fontes: nenhum arquivo de fontes de valor divergentes foi encontrado

## Arquivos de dados

- Brainrots ativos: \`src/data/brainrots.json\`
- Brainrots legados ricos/parciais: \`data/brainrots.json\`
- Revisao de importacao: \`src/data/brainrots-review.json\`
- Mutacoes globais: \`src/data/mutations.json\`
- Valores de mercado: \`src/data/brainrot-market-values.json\`
- Valores ausentes: \`src/data/brainrots-missing-market-values.json\`
- Indice de imagens: \`src/data/brainrot-images.json\`
- Dados ausentes: \`src/data/brainrots-missing-data.json\`

## Pets obrigatorios

${requiredResults}

## Resultado do teste de Strawberry Elephant

- encontrado pela pesquisa/dados: ${strawberry ? 'sim' : 'nao'}
- slug: ${strawberry?.slug || 'ausente'}
- raridade: ${strawberry?.rarity || 'ausente'}
- registro de valor ligado ao pet: ${hasValue(strawberry) ? 'sim' : 'nao'}
- valor carregado: ${strawberry?.tradeValue ?? 'ausente'}
- mutacao Normal: ${TradeEquivalenceService.getMutation(strawberry, 'Normal') ? 'disponivel' : 'ausente'}
- total calculado: ${strawberryResult.referenceValue == null ? 'nao, falta valor de troca verificado' : strawberryResult.referenceValue}
- equivalencias: ${strawberryResult.results.length}
- estado: ${strawberryResult.diagnostics.join(' ') || 'ok'}

## Observacoes

Os valores de troca sao unidos por slug a partir de \`src/data/brainrot-market-values.json\`. Pets sem fonte comunitaria confiavel permanecem em \`src/data/brainrots-missing-market-values.json\`.
`;

const countReport = `# Brainrots Exist Count Report

- pets com quantidade existente: ${brainrots.filter((pet) => pet.existCount != null).length}
- pets sem contagem: ${brainrots.filter((pet) => pet.existCount == null).length}
- contagens contestadas: ${brainrots.filter((pet) => pet.existCountDisputed).length}
- contagens comunitarias: ${brainrots.filter((pet) => pet.existCountType === 'community').length}
- contagens estimadas: ${brainrots.filter((pet) => pet.existCountType === 'estimated').length}
- contagens oficiais: ${brainrots.filter((pet) => pet.existCountType === 'official').length}
- fontes registradas: ${[...new Set(brainrots.map((pet) => pet.existCountSource).filter(Boolean))].join(', ') || 'nenhuma'}
- datas registradas: ${[...new Set(brainrots.map((pet) => pet.existCountVerifiedAt).filter(Boolean))].join(', ') || 'nenhuma'}
- confianca alta: ${brainrots.filter((pet) => pet.existCountConfidence === 'high').length}
- confianca media: ${brainrots.filter((pet) => pet.existCountConfidence === 'medium').length}
- confianca baixa: ${brainrots.filter((pet) => pet.existCountConfidence === 'low').length}
- confianca desconhecida: ${brainrots.filter((pet) => pet.existCountConfidence === 'unknown').length}
- pets disponiveis apenas por troca: ${brainrots.filter((pet) => pet.availability === 'trade_only').length}
- pets indisponiveis: ${brainrots.filter((pet) => pet.availability === 'unavailable').length}

## Pets com menor quantidade existente

Nenhum pet possui contagem existente confiavel no arquivo atual.

## Pets sem contagem

${brainrots.map((pet) => `- ${pet.name}`).join('\n')}
`;

const mutationReport = `# Brainrots Mutations Report

- mutacoes cadastradas: ${mutations.length}
- mutacoes com renda confirmada/parcial: ${mutations.filter((mutation) => mutation.incomeMultiplier != null && mutation.confidence !== 'unknown').length}
- mutacoes com valor de troca confirmado: ${mutations.filter((mutation) => mutation.tradeValueMultiplier != null && mutation.confidence === 'high').length}
- mutacoes em revisao: ${mutations.filter((mutation) => mutation.confidence !== 'high' || mutation.tradeValueMultiplier == null).length}
- mutacoes sem fonte: ${mutations.filter((mutation) => !mutation.sources?.length).length}
- compatibilidades impossiveis cadastradas: ${mutations.filter((entry) => entry.compatibility?.incompatibleBrainrotSlugs?.length || entry.compatibility?.incompatibleRarities?.length).length}

## Fontes

- Steal a Brainrot Wiki: usada como fonte comunitaria de revisao para nomes e existencia de mutacoes.

## Pendencias

Impacto no valor de troca, compatibilidade por pet, disponibilidade historica e icones seguem em revisao.
`;

const imageReport = `# Brainrots Images Report

- total de pets: ${brainrots.length}
- registros no indice de imagens: ${images.length}
- imagens validadas como definitivas: ${images.filter((entry) => entry.usageStatus === 'allowed').length}
- imagens com atribuicao obrigatoria: ${images.filter((entry) => entry.usageStatus === 'attribution_required').length}
- imagens em revisao: ${images.filter((entry) => entry.usageStatus === 'review').length}
- imagens indisponiveis: ${images.filter((entry) => entry.usageStatus === 'unavailable').length}
- pets usando fallback: ${missingImages.length}
- imagens sem pet correspondente: ${images.filter((entry) => !brainrots.some((pet) => pet.slug === entry.brainrotSlug)).length}
- pets sem imagem confiavel: ${missingImages.length}

## Observacao

O app nao usa hotlink nem imagem de outro pet. Todos os pets usam fallback ate que arquivo, fonte, autor e licenca sejam validados.
`;

writeFileSync('docs/brainrots-market-data-report.md', marketReport);
writeFileSync('docs/brainrots-exist-count-report.md', countReport);
writeFileSync('docs/brainrots-mutations-report.md', mutationReport);
writeFileSync('docs/brainrots-images-report.md', imageReport);
