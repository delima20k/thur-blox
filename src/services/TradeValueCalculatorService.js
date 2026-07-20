const hasNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

export const TradeValueCalculatorService = {
  getBaseTradeValue(brainrot) {
    if (!brainrot) return null;
    if (hasNumber(brainrot.baseTradeValue)) return Number(brainrot.baseTradeValue);
    if (hasNumber(brainrot.tradeValue)) return Number(brainrot.tradeValue);
    if (hasNumber(brainrot.tradeValueMin) && hasNumber(brainrot.tradeValueMax)) {
      return (Number(brainrot.tradeValueMin) + Number(brainrot.tradeValueMax)) / 2;
    }
    if (hasNumber(brainrot.tradeValueMin)) return Number(brainrot.tradeValueMin);
    if (hasNumber(brainrot.tradeValueMax)) return Number(brainrot.tradeValueMax);
    return null;
  },

  getMutationMultiplier(mutation) {
    if (!mutation) return 1;
    if (hasNumber(mutation.tradeValueMultiplier)) return Number(mutation.tradeValueMultiplier);
    if (hasNumber(mutation.marketMultiplier)) return Number(mutation.marketMultiplier);
    if (mutation.slug && mutation.slug !== 'normal') return 1;
    return 1;
  },

  calculate({ brainrot, quantity = 1, mutation = null }) {
    const safeQuantity = Number(quantity);
    if (!brainrot || !Number.isInteger(safeQuantity) || safeQuantity < 1) return null;

    const baseValue = this.getBaseTradeValue(brainrot);
    if (baseValue == null) return null;

    return baseValue * this.getMutationMultiplier(mutation) * safeQuantity;
  }
};
