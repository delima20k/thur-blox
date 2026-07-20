import fs from 'fs';
import path from 'path';
import { BrainrotDataService } from '../src/services/BrainrotDataService.js';
import { RealTradeEquivalenceService } from '../src/services/RealTradeEquivalenceService.js';

const rawBrainrots = JSON.parse(fs.readFileSync(path.resolve('src/data/brainrots.json'), 'utf8'));
const marketValues = JSON.parse(fs.readFileSync(path.resolve('src/data/brainrot-real-trade-values.json'), 'utf8'));
const gameStats = JSON.parse(fs.readFileSync(path.resolve('src/data/brainrot-game-stats.json'), 'utf8'));
const images = JSON.parse(fs.readFileSync(path.resolve('src/data/brainrot-images.json'), 'utf8'));
const { brainrots } = BrainrotDataService.merge({ brainrots: rawBrainrots, marketValues, gameStats, images });
const selected = brainrots.find((pet) => pet.slug === 'headless-horseman');
console.log('selected', selected?.slug, selected?.name, 'market', selected?.communityTradeValue ?? selected?.baseTradeValue ?? selected?.tradeValue);
const candidates = RealTradeEquivalenceService.getComparablePets(brainrots, selected);
console.log('candidate count', candidates.length);
console.log('top candidates', candidates.slice(0,20).map((pet) => ({slug: pet.slug, value: RealTradeEquivalenceService.getMarketValue(pet), rarity: pet.rarity, existCount: pet.existCount})));
const result = RealTradeEquivalenceService.findEquivalents({ selectedPet: selected, mutation: { slug: 'normal', name: 'Normal' }, quantity: 1, allPets: brainrots });
console.log('result len', result.results.length, 'rejected', result.rejected.length, 'diagnostics', result.diagnostics);
console.log('rejected sample', result.rejected.slice(0,20));
console.log('results', result.results.map((item)=>({slug:item.pets[0].pet.slug, name:item.pets[0].pet.name, qty:item.pets[0].quantity, value:item.value, diff:item.differencePercent })));
