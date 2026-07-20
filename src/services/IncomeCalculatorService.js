export const IncomeCalculatorService = {
  calculate({ brainrot, mutation = null }) {
    const baseIncome = brainrot?.baseIncomePerSecond ?? brainrot?.incomePerSecond;
    if (baseIncome == null) return null;

    let income = Number(baseIncome);
    const applied = [];

    const multiplier = Number(mutation?.incomeMultiplier);
    if (Number.isFinite(multiplier) && multiplier > 0) {
      income *= multiplier;
      applied.push({
        type: 'mutation',
        name: mutation.name,
        multiplier,
        confidence: mutation.confidence || 'unknown'
      });
    }

    return {
      income,
      applied,
      confidence: applied.length ? 'medium' : brainrot.incomeConfidence || 'unknown'
    };
  }
};
