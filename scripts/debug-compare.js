import fs from 'fs';
import path from 'path';
import { BrainrotDataService } from '../src/services/BrainrotDataService.js';
import { TradeEquivalenceService } from '../src/services/TradeEquivalenceService.js';
import { RealTradeEquivalenceService } from '../src/services/RealTradeEquivalenceService.js';
import { BrainrotValueResolverService } from '../src/services/BrainrotValueResolverService.js';

const read = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
const rawBrainrots = read('src/data/brainrots.json');
const marketValues = read('src/data/brainrot-real-trade-values.json');
const gameStats = read('src/data/brainrot-game-stats.json');
const images = read('src/data/brainrot-images.json');
const { brainrots } = BrainrotDataService.merge({ brainrots: rawBrainrots, marketValues, gameStats, images });
const slugs = ['holy-arepa','noobini-santanini','noobini-pizzanini','fluriflura','pipi-avocado','signore-carapace','elefanto-frigo','garama-and-madundung','strawberry-elephant','meowl','skibidi-toilet','antonio','headless-horseman'];
for (const slug of slugs) {
  const pet = brainrots.find((p) => p.slug === slug);
  console.log('===', slug, pet?.name || 'MISSING', '===');
  if (!pet) {
    console.log('not found');
    continue;
  }
  const income = pet.baseIncomePerSecond ?? pet.incomePerSecond ?? null;
  const market = pet.communityTradeValue ?? pet.baseTradeValue ?? pet.tradeValue ?? null;
  const marketRange = [pet.tradeValueMin, pet.tradeValueMax];
  console.log({ income, market, marketRange, demand: pet.demand, existCount: pet.existCount, confidence: pet.valueConfidence, availability: pet.availability, sources: pet.valueSources?.length ?? pet.sources?.length });
  const normal = TradeEquivalenceService.getMutation(pet, 'Normal');
  const resolver = BrainrotValueResolverService.configure(brainrots);
  const incomeRes = TradeEquivalenceService.findEquivalences({ selectedPet: pet, quantity: 1, mutation: normal, comparisonMode: 'income' }, brainrots, { valueResolver: resolver, mutations: [normal] });
  const marketRes = TradeEquivalenceService.findEquivalences({ selectedPet: pet, quantity: 1, mutation: normal, comparisonMode: 'market' }, brainrots, { valueResolver: resolver, mutations: [normal] });
  console.log('income ref', incomeRes.selectedTotal, 'count', incomeRes.results.length, 'diag', incomeRes.diagnostics.slice(0,3));
  console.log('market ref', marketRes.selectedTotal, 'count', marketRes.results.length, 'diag', marketRes.diagnostics.slice(0,3));
  if (marketRes.rejected?.length) console.log('rejected', marketRes.rejected.slice(0,3));
}
