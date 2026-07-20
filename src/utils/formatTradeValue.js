export const formatTradeValue = (value) => {
  if (value == null || value === '' || !Number.isFinite(Number(value))) {
    return 'Valor desconhecido';
  }

  const number = Number(value);
  const formatCompact = (amount, suffix) => {
    const formatted = amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: amount < 10 ? 2 : 1
    });
    return `${formatted}${suffix}`;
  };

  if (Math.abs(number) >= 1_000_000) return formatCompact(number / 1_000_000, 'M');
  if (Math.abs(number) >= 1_000) return formatCompact(number / 1_000, 'K');
  return number.toLocaleString('pt-BR');
};
