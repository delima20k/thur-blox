import fs from 'fs';
import path from 'path';
import { BrainrotDataService } from '../src/services/BrainrotDataService.js';

const readJson = (rel) => JSON.parse(fs.readFileSync(path.resolve(rel), 'utf8'));

(async () => {
  const brainrots = readJson('src/data/brainrots.json');
  const gameStats = readJson('src/data/brainrot-game-stats.json');
  const marketValues = readJson('src/data/brainrot-market-values.json');
  const images = readJson('src/data/brainrot-images.json');

  const { brainrots: merged, diagnostics } = BrainrotDataService.merge({ brainrots, marketValues, gameStats, images });

  const report = [];
  const summary = {
    total: merged.length,
    complete: 0,
    withIncome: 0,
    withCommunityValue: 0,
    withSource: 0,
    withDate: 0
  };

  for (const pet of merged) {
    const originalCard = brainrots.find((b) => b.slug === pet.slug) || {};
    // card is considered to already contain core market/stats data if it has any of these fields
    const cardHasData = (originalCard.purchaseCost != null)
      || ((originalCard.baseIncomePerSecond ?? originalCard.incomePerSecond) != null)
      || (originalCard.communityTradeValue != null)
      || (originalCard.baseTradeValue != null)
      || (originalCard.existCount != null)
      || ((originalCard.valueSources || originalCard.sources || []).length > 0);
    const obj = {
      slug: pet.slug,
      name: pet.name,
      rarity: pet.rarity,
      purchaseCost: pet.purchaseCost ?? null,
      baseIncomePerSecond: pet.baseIncomePerSecond ?? pet.incomePerSecond ?? null,
      communityTradeValue: pet.communityTradeValue ?? pet.baseTradeValue ?? null,
      demand: pet.demand ?? null,
      existCount: pet.existCount ?? null,
      sources: (pet.valueSources || pet.valueSource || pet.sources || []).map((s) => (typeof s === 'string' ? { name: s } : s)),
      verifiedAt: pet.valueVerifiedAt || pet.marketVerifiedAt || pet.verifiedAt || null
    };
    // determine whether modal would receive only the card or should fetch merged
    obj.cardHasPartialData = !!cardHasData;
    obj.mergedHasData = !!(obj.purchaseCost != null || obj.baseIncomePerSecond != null || obj.communityTradeValue != null || obj.existCount != null || (obj.sources || []).length || obj.verifiedAt != null);
    obj.modalShouldFetchMerged = !!obj.mergedHasData && !obj.cardHasPartialData;
    obj.missing = Object.entries({ purchaseCost: obj.purchaseCost, baseIncomePerSecond: obj.baseIncomePerSecond, communityTradeValue: obj.communityTradeValue, demand: obj.demand, existCount: obj.existCount }).filter(([, v]) => v == null).map(([k]) => k);
    if (obj.missing.length === 0) summary.complete += 1;
    if (obj.baseIncomePerSecond != null) summary.withIncome += 1;
    if (obj.communityTradeValue != null) summary.withCommunityValue += 1;
    if ((obj.sources || []).length) summary.withSource += 1;
    if (obj.verifiedAt) summary.withDate += 1;
    report.push(obj);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    diagnostics,
    summary,
    pets: report
  };

  fs.writeFileSync('docs/pet-details-audit.md', `# Pet details audit\n\nGenerated: ${out.generatedAt}\n\n## Summary\n- total: ${summary.total}\n- complete: ${summary.complete}\n- withIncome: ${summary.withIncome}\n- withCommunityValue: ${summary.withCommunityValue}\n- withSource: ${summary.withSource}\n- withDate: ${summary.withDate}\n\n## Sample details\n\n` + report.slice(0, 200).map((p) => `- ${p.slug} (${p.name}): purchaseCost=${p.purchaseCost ?? 'null'}, baseIncomePerSecond=${p.baseIncomePerSecond ?? 'null'}, communityTradeValue=${p.communityTradeValue ?? 'null'}, demand=${p.demand ?? 'null'}, existCount=${p.existCount ?? 'null'}, sources=${(p.sources||[]).length}, verifiedAt=${p.verifiedAt ?? 'null'}, modalShouldFetchMerged=${p.modalShouldFetchMerged ? 'sim' : 'nao'}`).join('\n'));

  console.log('Audit written to docs/pet-details-audit.md');
  // print requested pets details for quick review
  const requested = ['noobini-santanini','noobini-pizzanini','fluriflura','pipi-avocado','signore-carapace','elefanto-frigo','garama','madundung','strawberry-elephant','meowl'];
  for (const slug of requested) {
    const pet = report.find((p) => p.slug === slug);
    if (pet) console.log(slug, pet);
  }
})();
