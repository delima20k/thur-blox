import { formatTradeValue } from '../utils/formatTradeValue.js';

const VALUE_LABELS = {
  unknown: 'Desconhecido',
  high: 'Alta',
  medium: 'Media',
  low: 'Baixa',
  official: 'Oficial',
  community: 'Comunitaria',
  estimated: 'Estimada',
  event: 'Evento',
  ritual: 'Ritual',
  admin_abuse: 'Admin Abuse',
  normal: 'Normal',
  unavailable: 'Indisponivel',
  available: 'Disponivel',
  trade_only: 'Disponivel somente por troca'
  ,
  unverified: 'Nao verificado',
  verified: 'Verificado',
  manual: 'Manual'
};

export const FormatService = {
  label(value, fallback = 'Desconhecido') {
    if (value == null || value === '') return fallback;
    return VALUE_LABELS[value] || String(value);
  },

  source(value) {
    return value || 'Fonte em revisao';
  },

  date(value) {
    if (!value) return 'Data em revisao';
    return new Date(value).toLocaleDateString('pt-BR');
  },

  confidence(value) {
    if (!value || value === 'unknown') return 'Confianca ainda nao avaliada';
    return this.label(value);
  },

  availability(value) {
    if (!value || value === 'unknown') return 'Disponibilidade em revisao';
    return this.label(value);
  },

  value(value) {
    if (value == null) return 'Valor desconhecido';
    return `${formatTradeValue(value)} BRT`;
  },

  money(value) {
    if (value == null) return 'Custo desconhecido';
    return `$${Number(value).toLocaleString('pt-BR')}`;
  },

  income(value) {
    if (value == null) return 'Renda desconhecida';
    return `$${formatTradeValue(value)}/s`;
  },

  existCount(pet) {
    if (!pet || pet.existCount == null) return 'Quantidade existente em revisao';
    const prefix = pet.existCountType === 'estimated' ? 'aproximadamente ' : '';
    const disputed = pet.existCountDisputed ? ' (contagem contestada)' : '';
    return `${prefix}${Number(pet.existCount).toLocaleString('pt-BR')} existentes${disputed}`;
  }
};
