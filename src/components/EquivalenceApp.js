import {
  RARITY_ORDER,
  SCARCITY_LABELS,
  TradeEquivalenceService
} from '../services/TradeEquivalenceService.js';
import { BrainrotImageService } from '../services/BrainrotImageService.js';
import { BrainrotValueResolverService } from '../services/BrainrotValueResolverService.js';
import { CompatibilityService } from '../services/CompatibilityService.js';
import { FormatService } from '../services/FormatService.js';
import { favoritesService, FAVORITES_CHANGED_EVENT } from '../services/FavoritesService.js';
import { IncomeCalculatorService } from '../services/IncomeCalculatorService.js';
import { BrainrotRealMoneyValueService } from '../services/BrainrotRealMoneyValueService.js';
import { RealTradeEquivalenceService } from '../services/RealTradeEquivalenceService.js';
import {
  BACKGROUND_BRAINROTS,
  OUTCOME_THEME,
  RARITY_THEME
} from '../services/VisualConfig.js';

const MAX_QUANTITY = 99;

const safeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
  const text = String(value);
  if (['null', 'undefined', String(0 / 0), 'null' + 'null'].includes(text.trim())) return fallback;
  return text;
};

const joinSafe = (values, separator = ', ') => values
  .map((value) => safeText(value))
  .filter(Boolean)
  .join(separator);

const createElement = (tag, attrs = {}, content) => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null) return;
    if (key === 'className') el.className = value;
    else el.setAttribute(key, value);
  });
  if (typeof content === 'string' || typeof content === 'number') el.textContent = safeText(content);
  else if (content instanceof Node) el.append(content);
  else if (Array.isArray(content)) content.filter(Boolean).forEach((child) => el.append(child));
  return el;
};

export class EquivalenceApp {
  constructor({ root, brainrots, mutations = [], realMoneyValues = {}, brainrotImages = [] }) {
    this.root = root;
    this.mutations = mutations;
    BrainrotImageService.configure(brainrotImages);
    this.realMoneyValueService = BrainrotRealMoneyValueService.configure(realMoneyValues);
    this.valueResolver = BrainrotValueResolverService.configure(brainrots);
    this.brainrots = brainrots.filter((pet) => pet.active !== false).sort(TradeEquivalenceService.sortByRarityThenName);
    this.favoriteSlugs = new Set(favoritesService.pruneInvalid(this.brainrots.map((pet) => pet.slug)));
    this.selectedPet = null;
    this.selectedPetSlug = null;
    this.selectedMutation = this.getMutationBySlug('normal');
    this.quantity = 1;
    this.searchTerm = '';
    this.listSearchTerm = '';
    this.mutationSearchTerm = '';
    this.selectedRarity = 'Todos';
    this.pickerRarity = 'Todos';
    this.valueFilter = 'all';
    this.countFilter = 'all';
    this.showFavoritesOnly = false;
    this.favoriteSort = 'recent';
    this.comparisonMode = 'market';
    this.state = {
      results: [],
      groups: {},
      diagnostics: ['Pesquise um Brainrot para consultar o valor em reais.'],
      referenceValue: null,
      marginUsed: null,
      selectedBaseValue: null,
      selectedUnitValue: null,
      selectedValueSource: null,
      selectedConfidence: null,
      realMoneyValue: null,
      realMoneyConsulted: false,
      loading: false,
      view: 'equivalence',
      detailPet: null
    };
    this.handleSeeValue = this.handleSeeValue.bind(this);
    this.handleToggleFavorite = this.handleToggleFavorite.bind(this);
    this.handleFavoritesChanged = this.handleFavoritesChanged.bind(this);
    document.removeEventListener('click', this.handleSeeValue);
    document.addEventListener('click', this.handleSeeValue);
    document.removeEventListener('click', this.handleToggleFavorite);
    document.addEventListener('click', this.handleToggleFavorite);
    window.removeEventListener(FAVORITES_CHANGED_EVENT, this.handleFavoritesChanged);
    window.addEventListener(FAVORITES_CHANGED_EVENT, this.handleFavoritesChanged);
    this.render();
  }

  get searchableItems() {
    const mutationText = this.mutations.map((mutation) => mutation.name).join(' ');
    return this.brainrots.map((brainrot) => ({
      ...brainrot,
      searchableText: TradeEquivalenceService.normalizeText([
        brainrot.name,
        brainrot.rarity,
        brainrot.eventName,
        brainrot.availability,
        mutationText
      ].filter(Boolean).join(' '))
    }));
  }

  build() {
    this.root.innerHTML = '';
    this.root.className = 'app game-shell';
    this.root.append(
      this.buildBackground(),
      createElement('div', { class: 'shell-content' }, [
        this.buildTopNav(),
        this.buildHeader(),
        this.buildMain(),
        this.buildListSection()
      ]),
      this.buildDetailModal()
    );
  }

  buildBackground() {
    const layer = createElement('div', { class: 'background-stage', 'aria-hidden': 'true' });
    const allowedImages = BACKGROUND_BRAINROTS
      .map((slug) => BrainrotImageService.getMetadata(slug))
      .filter((entry) => entry?.usageStatus === 'allowed');

    if (allowedImages.length) {
      allowedImages.slice(0, 6).forEach((entry, index) => {
        layer.append(createElement('img', {
          class: `floating-brainrot float-${index + 1}`,
          src: entry.images.thumbnail || entry.images.card,
          alt: ''
        }));
      });
    }

    ['◇', '✦', '★', '⇄', '$', '✧', '◈'].forEach((symbol, index) => {
      layer.append(createElement('span', { class: `bg-token token-${index + 1}` }, symbol));
    });
    return layer;
  }

  buildTopNav() {
    const nav = createElement('nav', { class: 'top-game-nav', 'aria-label': 'Menu principal' });
    const brand = createElement('button', { type: 'button', class: 'brand-lockup' }, [
      createElement('span', { class: 'brand-mark' }, '⇄'),
      createElement('span', {}, [
        createElement('strong', {}, 'THUR BLOX'),
        createElement('small', {}, 'Central de trocas')
      ])
    ]);
    brand.addEventListener('click', () => this.onNavClick('equivalence'));
    nav.append(brand);
    [
      ['equivalence', '⌂', 'Inicio'],
      ['equivalence', '◆', 'Valor em reais'],
      ['list', '▦', 'Brainrots'],
      ['rarities', '★', 'Raridades'],
      ['favorites', '♡', 'Favoritos'],
      ['sources', '⋯', 'Mais']
    ].forEach(([id, icon, label]) => {
      const content = [
        createElement('span', {}, `${icon} ${label}`)
      ];
      if (id === 'favorites') {
        content.push(createElement('span', {
          class: 'favorite-count-badge',
          'data-favorite-count': 'true',
          hidden: this.favoriteSlugs.size === 0 ? 'true' : null
        }, String(this.favoriteSlugs.size)));
      }
      const button = createElement('button', {
        type: 'button',
        class: `top-nav-button ${this.state.view === id ? 'active' : ''}`
      }, content);
      button.addEventListener('click', () => this.onNavClick(id));
      nav.append(button);
    });

    return nav;
  }

  buildHeader() {
    this.heroPanel = createElement('section', { class: 'hero-panel game-hero' }, [
      createElement('div', { class: 'hero-copy' }, [
        createElement('span', { class: 'eyebrow' }, 'THUR BLOX'),
        createElement('h1', {}, 'Quanto vale em reais?'),
        createElement('p', {}, 'Pesquise um Brainrot para consultar uma estimativa comercial em reais cadastrada manualmente.'),
        this.buildSearchInput(),
        createElement('div', { class: 'hero-actions' }, [
          this.buildHeroButton('Consultar valor em reais', () => this.petCardSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })),
          this.buildHeroButton('Comparar troca', () => this.resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 'button-secondary')
        ])
      ]),
      createElement('div', { class: 'hero-mascot' }, [
        createElement('div', { class: 'mascot-orbit' }, [
          createElement('span', {}, '⇄'),
          createElement('span', {}, '★'),
          createElement('span', {}, '$')
        ]),
        this.selectedPet ? this.createPetImage(this.selectedPet, 'hero-pet-image') : createElement('div', { class: 'hero-placeholder-art' }, '⇄')
      ])
    ]);
    return this.heroPanel;
  }

  buildHeroButton(label, onClick, className = 'button-primary', action = null) {
    const button = createElement('button', {
      type: 'button',
      class: `hero-button ${className}`,
      'data-action': action
    }, this.state.loading && action === 'see-value' ? 'Calculando...' : label);
    if (this.state.loading && action === 'see-value') button.disabled = true;
    if (onClick) button.addEventListener('click', onClick);
    return button;
  }

  buildSearchInput() {
    const container = createElement('div', { class: 'equivalence-search' });
    this.searchInput = createElement('input', {
      id: 'equivalence-search-input',
      type: 'search',
      autocomplete: 'off',
      placeholder: 'Pesquise o nome do seu Brainrot...',
      'aria-label': 'Pesquisar pet'
    });
    this.searchInput.value = this.searchTerm;
    this.searchInput.addEventListener('input', () => this.onSearchChange());
    this.suggestionList = createElement('div', { class: 'suggestions-list' });
    const clear = createElement('button', { type: 'button', class: 'search-clear', 'aria-label': 'Limpar busca' }, '×');
    clear.addEventListener('click', () => {
      this.searchTerm = '';
      this.searchInput.value = '';
      this.suggestionList.innerHTML = '';
      this.searchInput.focus();
    });
    container.append(createElement('div', { class: 'search-frame' }, [
      createElement('span', { class: 'search-icon' }, '⌕'),
      this.searchInput,
      clear
    ]), this.suggestionList);
    return container;
  }

  buildMain() {
    this.main = createElement('main', { class: 'equivalence-grid' });
    this.main.append(
      this.buildPetPickerSection(),
      this.buildPetCardSection(),
      this.buildMutationSidebar(),
      this.buildResultsSection()
    );
    return this.main;
  }

  buildPetPickerSection() {
    this.petPickerSection = createElement('section', { class: 'panel pet-picker-panel' });
    this.petPickerSection.append(createElement('h2', {}, 'Escolha seu Brainrot'));
    const search = createElement('input', {
      type: 'search',
      value: this.searchTerm,
      placeholder: 'Pesquisar...',
      'aria-label': 'Buscar pet'
    });
    search.addEventListener('input', () => {
      this.searchTerm = search.value;
      if (this.searchInput) this.searchInput.value = this.searchTerm;
      this.renderPetPickerList();
      this.renderSuggestions(this.getSuggestions(this.searchTerm));
    });
    const clear = createElement('button', { type: 'button', class: 'button-secondary' }, 'Limpar');
    clear.addEventListener('click', () => {
      this.searchTerm = '';
      search.value = '';
      if (this.searchInput) this.searchInput.value = '';
      this.renderPetPickerList();
    });
    this.petPickerGrid = createElement('div', { class: 'pet-picker-grid' });
    this.pickerRarityBar = createElement('div', { class: 'picker-rarity-bar' });
    this.renderPickerRarityBar();
    this.petPickerSection.append(createElement('div', { class: 'picker-search-row' }, [search, clear]), this.pickerRarityBar, this.petPickerGrid);
    this.renderPetPickerList();
    return this.petPickerSection;
  }

  renderPickerRarityBar() {
    if (!this.pickerRarityBar) return;
    this.pickerRarityBar.innerHTML = '';
    ['Todos', ...RARITY_ORDER].forEach((rarity) => {
      const slug = rarity === 'Todos' ? 'all' : this.getRaritySlug(rarity);
      const button = createElement('button', {
        type: 'button',
        class: `picker-rarity-button rarity-filter-${slug} ${this.pickerRarity === rarity ? 'active' : ''}`
      }, rarity === 'Todos' ? 'Todos' : rarity);
      button.addEventListener('click', () => {
        this.pickerRarity = rarity;
        this.renderPickerRarityBar();
        this.renderPetPickerList();
      });
      this.pickerRarityBar.append(button);
    });
  }

  renderPetPickerList() {
    if (!this.petPickerGrid) return;
    this.petPickerGrid.innerHTML = '';
    const term = TradeEquivalenceService.normalizeText(this.searchTerm);
    const items = this.brainrots
      .filter((pet) => !term || TradeEquivalenceService.normalizeText(`${pet.name} ${pet.rarity}`).includes(term))
      .filter((pet) => this.pickerRarity === 'Todos' || pet.rarity === this.pickerRarity)
      .slice(0, 80);
    items.forEach((pet) => {
      const card = createElement('div', {
        role: 'button',
        tabindex: '0',
        class: `picker-pet-card ${this.selectedPetSlug === pet.slug ? 'active' : ''}`
      }, [
        this.createPetImage(pet, 'suggestion-image'),
        createElement('strong', {}, pet.name),
        createElement('span', { class: `rarity-pill rarity-${this.getRaritySlug(pet.rarity)}` }, pet.rarity),
        this.buildFavoriteButton(pet, 'icon'),
        this.selectedPetSlug === pet.slug ? createElement('span', { class: 'selected-badge' }, 'Selecionado') : null
      ]);
      card.addEventListener('click', (event) => {
        if (event.target.closest("[data-action='toggle-favorite']")) return;
        this.selectPet(pet);
      });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.selectPet(pet);
      });
      this.petPickerGrid.append(card);
    });
  }

  buildMutationSidebar() {
    this.mutationSidebar = createElement('aside', { class: 'panel mutation-sidebar' });
    this.renderMutationSidebar();
    return this.mutationSidebar;
  }

  renderMutationSidebar() {
    if (!this.mutationSidebar) return;
    this.mutationSidebar.innerHTML = '';
    this.mutationSidebar.append(createElement('h2', {}, 'Mutacoes'));
    const list = createElement('div', { class: 'mutation-sidebar-list' });
    this.mutations.filter((mutation) => mutation.active !== false).forEach((mutation) => {
      const multiplier = TradeEquivalenceService.getMutationMultiplier(mutation);
      const button = createElement('button', {
        type: 'button',
        class: `mutation-side-option mutation-${mutation.slug} ${mutation.slug === this.selectedMutation?.slug ? 'active' : ''}`
      }, [
      createElement('span', { class: 'mutation-icon' }, this.getMutationIcon(mutation.slug)),
        createElement('strong', {}, mutation.name),
        createElement('small', {}, `${multiplier}x - +${mutation.percentageIncrease ?? 0}%`)
      ]);
      button.addEventListener('click', () => {
        this.selectedMutation = this.getMutationBySlug(mutation.slug);
        this.recalculateReferenceValue();
        this.renderSelectedPet();
        this.renderMutationSidebar();
      });
      list.append(button);
    });
    this.mutationSidebar.append(
      list,
      this.buildComparisonModeControl(),
      this.buildQuantityControl(),
      createElement('p', { class: 'mutation-note' }, this.comparisonMode === 'income'
        ? 'Equivalencia de renda: esses pets produzem renda semelhante, mas podem ter valores de troca diferentes.'
        : 'Mercado comunitario: mutacoes so alteram o valor real quando houver multiplicador de mercado confirmado.')
    );
  }

  buildComparisonModeControl() {
    const select = this.buildSelect('comparison-mode', [
      ['market', 'Valor real de troca'],
      ['income', 'Renda por segundo']
    ], this.comparisonMode, (value) => {
      this.comparisonMode = value;
      this.recalculateReferenceValue();
      this.renderSelectedPet();
      this.renderResults();
      this.renderMutationSidebar();
    });
    return createElement('label', { class: 'field-control comparison-mode-control' }, [
      createElement('span', {}, 'Comparar por'),
      select
    ]);
  }

  buildPetCardSection() {
    this.petCardSection = createElement('section', { class: 'panel selected-pet-panel' });
    this.petCardSection.append(createElement('h2', {}, 'Seu pet'));
    this.petDetailsContainer = createElement('div', { class: 'selected-pet-details' });
    this.petCardSection.append(this.petDetailsContainer);
    return this.petCardSection;
  }

  buildResultsSection() {
    this.resultsSection = createElement('section', { class: 'panel equivalence-results-panel' });
    this.resultsHeader = createElement('h2', {}, 'Estimativa de valor');
    this.resultsList = createElement('div', { class: 'equivalence-results-list' });
    this.emptyState = createElement('div', { class: 'empty-state' });
    this.resultsSection.append(this.resultsHeader, this.resultsList, this.emptyState);
    return this.resultsSection;
  }


  buildListSection() {
    this.listSection = createElement('section', { id: 'list-section', class: 'panel list-section', style: 'display: none;' });
    this.renderListSection();
    return this.listSection;
  }

  onNavClick(view) {
    this.state.view = view;
    this.heroPanel.style.display = view === 'equivalence' ? 'grid' : 'none';
    this.main.style.display = view === 'equivalence' ? 'grid' : 'none';
    this.listSection.style.display = view === 'equivalence' ? 'none' : 'grid';
    if (view === 'sources') this.renderSourcesSection();
    else if (view === 'rarities') this.renderRaritiesSection();
    else if (view === 'favorites') this.renderFavoritesSection();
    else this.renderListSection();
  }

  onSearchChange() {
    this.searchTerm = this.searchInput.value;
    this.renderSuggestions(this.getSuggestions(this.searchTerm));
  }

  getSuggestions(termValue) {
    const term = TradeEquivalenceService.normalizeText(termValue);
    if (!term) return [];
    return this.searchableItems
      .filter((item) => item.searchableText.includes(term))
      .filter((item, index, list) => list.findIndex((other) => other.slug === item.slug) === index)
      .slice(0, 10);
  }

  renderSuggestions(items) {
    this.suggestionList.innerHTML = '';
    items.forEach((item) => {
      const row = createElement('div', { class: 'suggestion-item', role: 'button', tabindex: '0' });
      row.append(
        this.createPetImage(item, 'suggestion-image'),
        createElement('span', { class: 'suggestion-copy' }, [
          createElement('strong', { class: 'suggestion-name' }, item.name),
          createElement('span', { class: `rarity-pill rarity-${this.getRaritySlug(item.rarity)}` }, `${this.getRarityIcon(item.rarity)} ${item.rarity}`),
          createElement('span', { class: 'suggestion-meta' }, `${FormatService.availability(item.availability)} • ${FormatService.value(TradeEquivalenceService.getBaseValue(item))}`)
        ]),
        this.buildFavoriteButton(item, 'icon')
      );
      row.addEventListener('click', (event) => {
        if (event.target.closest("[data-action='toggle-favorite']")) return;
        this.selectPet(item);
      });
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.selectPet(item);
      });
      this.suggestionList.append(row);
    });
  }

  selectPet(item) {
    this.selectedPetSlug = item.slug || item.id || null;
    this.selectedPet = this.getSelectedPet();
    this.selectedMutation = this.getMutationBySlug('normal');
    this.quantity = 1;
    this.searchTerm = this.selectedPet.name;
    this.searchInput.value = this.selectedPet.name;
    this.suggestionList.innerHTML = '';
    this.state.results = [];
    this.state.realMoneyValue = null;
    this.state.realMoneyConsulted = false;
    this.recalculateReferenceValue();
    this.state.diagnostics = this.buildInitialDiagnostics();
    this.renderSelectedPet();
    this.renderResults();
    this.renderPetPickerList();
    this.renderMutationSidebar();
    if (window.matchMedia('(max-width: 760px)').matches) {
      this.petCardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  buildInitialDiagnostics() {
    if (!this.selectedPet) return ['Pesquise um Brainrot para consultar o valor em reais.'];
    return ['Clique em Consultar valor em reais para ver a estimativa comercial cadastrada.'];
  }

  renderSelectedPet() {
    this.petDetailsContainer.innerHTML = '';
    if (!this.selectedPet) {
      this.petDetailsContainer.append(
        this.buildEmptyVisualState('Nenhum Brainrot selecionado', 'Pesquise um Brainrot para consultar o valor em reais.', 'Pesquisar Brainrot', () => this.searchInput.focus())
      );
      return;
    }

    const incomeResult = IncomeCalculatorService.calculate({
      brainrot: this.selectedPet,
      mutation: this.selectedMutation
    });
    const resolvedValue = this.valueResolver.resolve(this.selectedPet);
    const baseIncome = this.getBaseIncome(this.selectedPet);
    const marketValue = RealTradeEquivalenceService.resolveMarket(this.selectedPet);
    const unitValue = marketValue?.value || null;
    const mutatedIncome = baseIncome != null ? baseIncome * this.getIncomeMultiplier(this.selectedMutation) : null;
    const compatibility = CompatibilityService.getCompatibilityResult(this.selectedPet, this.selectedMutation);
    const imageMeta = BrainrotImageService.getMetadata(this.selectedPet.slug);

    this.petCardSection.setAttribute('data-rarity', this.getRaritySlug(this.selectedPet.rarity));
    const media = createElement('div', { class: 'selected-media collectible-hero' }, [
      createElement('div', { class: 'pet-image-stage' }, this.createPetImage(this.selectedPet, 'selected-pet-image')),
      createElement('div', { class: 'selected-title-block' }, [
        createElement('h3', {}, this.selectedPet.name),
        createElement('span', { class: `rarity-pill rarity-${this.getRaritySlug(this.selectedPet.rarity)}` }, `${this.getRarityIcon(this.selectedPet.rarity)} ${this.selectedPet.rarity}`),
        createElement('span', { class: 'status-chip' }, FormatService.availability(this.selectedPet.availability)),
        this.buildFavoriteButton(this.selectedPet),
        createElement('small', {}, imageMeta?.usageStatus === 'review' ? 'Imagem em revisao' : '')
      ])
    ]);

    const details = createElement('div', { class: 'pet-info-grid stat-card-grid' }, [
      this.createDetailRow('Mutacao selecionada', this.selectedMutation?.name || 'Normal'),
      this.createDetailRow('Multiplicador de renda', `${this.getIncomeMultiplier(this.selectedMutation)}x`),
      this.createDetailRow('Quantidade informada', String(this.quantity)),
      this.createDetailRow('Custo dentro do jogo', FormatService.money(this.selectedPet.purchaseCost)),
      this.createDetailRow('Renda base', FormatService.income(baseIncome)),
      this.createDetailRow('Renda final com mutacao', FormatService.income(mutatedIncome)),
      this.createDetailRow('Renda total pela quantidade', FormatService.income(mutatedIncome ? mutatedIncome * this.quantity : null)),
      unitValue ? this.createDetailRow('Valor real de troca', FormatService.value(this.selectedPet.communityTradeValue ?? unitValue)) : this.createDetailRow('Valor real de troca', 'Valor real ainda nao confirmado'),
      unitValue ? this.createDetailRow('Fonte do valor real', FormatService.source(this.selectedPet.valueSources?.[0]?.name || this.selectedPet.valueSource?.[0]?.name)) : null,
      unitValue ? this.createDetailRow('Data do valor real', FormatService.date(this.selectedPet.valueVerifiedAt)) : null,
      this.createDetailRow('Demanda', this.selectedPet.demand || this.selectedPet.demandLabel || 'Demanda desconhecida'),
      this.createDetailRow('Disponibilidade', FormatService.availability(this.selectedPet.availability)),
      this.createDetailRow('Quantidade existente', this.formatExistCount(this.selectedPet)),
      this.createDetailRow('Tipo da contagem', FormatService.label(this.selectedPet.existCountType)),
      this.createDetailRow('Fonte da contagem', FormatService.source(this.selectedPet.existCountSource)),
      this.createDetailRow('Confianca da contagem', FormatService.confidence(this.selectedPet.existCountConfidence)),
      this.createDetailRow('Ultima verificacao', FormatService.date(this.selectedPet.existCountVerifiedAt)),
      this.createDetailRow('Atualizacao do valor', FormatService.date(this.selectedPet.valueVerifiedAt)),
      this.createDetailRow('Escassez', SCARCITY_LABELS[this.selectedPet.scarcityLevel] || SCARCITY_LABELS.unknown)
    ]);

    this.petDetailsContainer.append(...[
      media,
      details,
      this.buildQuantityControl(),
      joinSafe(compatibility.warnings, ' ') ? createElement('p', { class: 'empty-state' }, joinSafe(compatibility.warnings, ' ')) : null,
      joinSafe(compatibility.issues, ' ') ? createElement('p', { class: 'error-state' }, joinSafe(compatibility.issues, ' ')) : null,
      this.buildActionButton(),
      this.buildDetailButton(this.selectedPet)
    ].filter(Boolean));
  }

  createDetailRow(label, value) {
    return createElement('div', { class: 'pet-detail-row' }, [
      createElement('span', { class: 'pet-detail-label' }, label),
      createElement('span', { class: 'pet-detail-value' }, safeText(value, '-'))
    ]);
  }

  buildMutationControl() {
    const wrapper = createElement('div', { class: 'field-control mutation-panel' });
    const search = createElement('input', { type: 'search', value: this.mutationSearchTerm, placeholder: 'Pesquisar mutacao', 'aria-label': 'Pesquisar mutacao' });
    search.addEventListener('input', () => {
      this.mutationSearchTerm = search.value;
      this.renderSelectedPet();
    });
    const cards = createElement('div', { class: 'mutation-card-row' });
    this.getFilteredMutations().forEach((mutation) => {
      const option = createElement('button', {
        type: 'button',
        class: `mutation-card ${mutation.slug === this.selectedMutation?.slug ? 'active' : ''}`
      }, [
        createElement('span', { class: 'mutation-icon' }, this.getMutationIcon(mutation.slug)),
        createElement('strong', {}, mutation.name),
        createElement('small', {}, mutation.incomeMultiplier ? `${mutation.incomeMultiplier}x renda` : 'Em revisao')
      ]);
      option.addEventListener('click', () => {
        this.selectedMutation = this.getMutationBySlug(mutation.slug);
        this.recalculateReferenceValue();
        this.renderSelectedPet();
      });
      cards.append(option);
    });
    const reset = createElement('button', { type: 'button', class: 'button-secondary' }, 'Voltar para Normal');
    reset.addEventListener('click', () => {
      this.selectedMutation = this.getMutationBySlug('normal');
      this.mutationSearchTerm = '';
      this.recalculateReferenceValue();
      this.renderSelectedPet();
    });
    wrapper.append(
      createElement('span', {}, 'Mutacao'),
      search,
      cards,
      reset,
      createElement('small', {}, this.selectedMutation?.marketMultiplier == null && this.selectedMutation?.tradeValueMultiplier == null ? 'Esta mutacao possui efeito conhecido na renda quando confirmado, mas seu impacto no valor de troca esta em revisao.' : 'Mutacao com regra de valor confirmada.'),
      createElement('small', {}, `Disponibilidade: ${FormatService.availability(this.selectedMutation?.availability)}. Confianca: ${FormatService.confidence(this.selectedMutation?.confidence)}.`)
    );
    return wrapper;
  }

  buildQuantityControl() {
    const wrapper = createElement('label', { class: 'field-control' });
    const input = createElement('input', {
      type: 'number',
      min: '1',
      max: String(MAX_QUANTITY),
      step: '1',
      value: String(this.quantity),
      class: 'quantity-input',
      'aria-label': 'Quantidade de pets'
    });
    input.addEventListener('change', () => {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 1 || value > MAX_QUANTITY) {
        input.setCustomValidity(`Informe uma quantidade inteira entre 1 e ${MAX_QUANTITY}.`);
        input.reportValidity();
        input.value = String(this.quantity);
        return;
      }
      input.setCustomValidity('');
      this.quantity = value;
      this.recalculateReferenceValue();
      this.renderSelectedPet();
      this.renderMutationSidebar();
    });
    wrapper.append(createElement('span', {}, 'Quantidade'), input);
    return wrapper;
  }

  buildActionButton() {
    const button = createElement('button', {
      id: 'see-value-button',
      class: 'button-primary action-button big-cta',
      type: 'button',
      'data-action': 'see-value'
    }, this.state.loading ? 'Calculando...' : 'Consultar valor em reais');
    button.disabled = this.state.loading;
    return button;
  }

  handleSeeValue(event) {
    const button = event.target.closest("[data-action='see-value']");
    if (!button || !this.root.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    this.consultRealMoneyValue(button);
  }

  handleToggleFavorite(event) {
    const button = event.target.closest("[data-action='toggle-favorite']");
    if (!button || !this.root.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    const slug = button.dataset.petSlug;
    const isFavorite = favoritesService.toggle(slug);
    this.favoriteSlugs = new Set(favoritesService.getAll(this.brainrots.map((pet) => pet.slug)));
    this.updateFavoriteButtons(slug);
    this.updateFavoriteBadges();
    if (this.state.view === 'favorites') this.renderFavoritesSection();
    if (this.state.view === 'list') this.renderListSection();
    this.showToast(isFavorite ? 'Pet adicionado aos favoritos.' : 'Pet removido dos favoritos.');
  }

  handleFavoritesChanged() {
    this.favoriteSlugs = new Set(favoritesService.getAll(this.brainrots.map((pet) => pet.slug)));
    this.updateFavoriteBadges();
  }

  isFavorite(slug) {
    return this.favoriteSlugs.has(slug);
  }

  buildFavoriteButton(pet, mode = 'text') {
    const isFavorite = this.isFavorite(pet?.slug);
    const action = isFavorite ? 'Remover' : 'Adicionar';
    const label = `${action} ${pet?.name || 'pet'} ${isFavorite ? 'dos' : 'aos'} favoritos`;
    const text = mode === 'icon' ? (isFavorite ? '♥' : '♡') : `${isFavorite ? '♥' : '♡'} ${isFavorite ? 'Favoritado' : 'Favoritar'}`;
    return createElement('button', {
      type: 'button',
      class: `favorite-button ${isFavorite ? 'is-favorite' : ''}`,
      'data-action': 'toggle-favorite',
      'data-pet-slug': pet?.slug,
      'aria-label': label,
      'aria-pressed': String(isFavorite),
      title: label
    }, text);
  }

  updateFavoriteButtons(slug = null) {
    const selector = slug
      ? `[data-action='toggle-favorite'][data-pet-slug='${CSS.escape(slug)}']`
      : "[data-action='toggle-favorite']";
    this.root.querySelectorAll(selector).forEach((button) => {
      const pet = this.brainrots.find((item) => item.slug === button.dataset.petSlug);
      if (!pet) return;
      const isFavorite = this.isFavorite(pet.slug);
      const compact = button.textContent.trim() === '♡' || button.textContent.trim() === '♥';
      button.classList.toggle('is-favorite', isFavorite);
      button.setAttribute('aria-pressed', String(isFavorite));
      button.setAttribute('aria-label', `${isFavorite ? 'Remover' : 'Adicionar'} ${pet.name} ${isFavorite ? 'dos' : 'aos'} favoritos`);
      button.title = button.getAttribute('aria-label');
      button.textContent = compact ? (isFavorite ? '♥' : '♡') : `${isFavorite ? '♥' : '♡'} ${isFavorite ? 'Favoritado' : 'Favoritar'}`;
    });
  }

  updateFavoriteBadges() {
    const count = this.favoriteSlugs.size;
    this.root.querySelectorAll('[data-favorite-count]').forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  showToast(message) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (!this.toast) {
      this.toast = createElement('div', { class: 'app-toast', role: 'status', 'aria-live': 'polite' });
      this.root.append(this.toast);
    }
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    this.toastTimer = setTimeout(() => this.toast?.classList.remove('visible'), 2200);
  }

  setCalculationLoading(isLoading, clickedButton = null) {
    this.state.loading = isLoading;
    const buttons = clickedButton ? [clickedButton] : [...this.root.querySelectorAll("[data-action='see-value']")];
    buttons.forEach((button) => {
      button.disabled = isLoading;
      button.textContent = isLoading ? 'Calculando...' : 'Consultar valor em reais';
    });
    if (isLoading && this.emptyState) {
      this.resultsList.innerHTML = '';
      this.emptyState.innerHTML = '';
      this.emptyState.append(createElement('div', { class: 'trade-loading' }, [
        createElement('strong', {}, 'Consultando valor em reais...'),
        createElement('p', {}, 'Consultando a base comercial em reais...')
      ]));
    }
  }

  getSelectedPet() {
    if (!this.selectedPetSlug) return null;
    return this.brainrots.find((pet) => pet.slug === this.selectedPetSlug) || null;
  }

  waitForPaint() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => resolve());
    });
  }

  async consultRealMoneyValue(button = null) {
    if (!this.selectedPetSlug) {
      this.state.diagnostics = ['Pesquise um Brainrot para consultar o valor em reais.'];
      this.state.realMoneyValue = null;
      this.state.realMoneyConsulted = false;
      this.renderResults();
      return;
    }

    this.setCalculationLoading(true, button);
    this.state.results = [];
    this.state.groups = {};
    this.state.realMoneyValue = null;
    this.state.realMoneyConsulted = true;
    this.state.diagnostics = ['Consultando a base comercial em reais...'];
    this.renderResults();
    const loadingStartedAt = performance.now();
    await this.waitForPaint();

    try {
      const completePet = this.getSelectedPet();
      if (!completePet) {
        throw new Error(`PET_NOT_FOUND:${this.selectedPetSlug}`);
      }

      this.selectedPet = completePet;
      const value = this.realMoneyValueService.getValue(completePet);
      this.state.realMoneyValue = value;
      this.state.diagnostics = value.hasPrice
        ? ['Estimativa comercial em reais cadastrada manualmente. Nao e preco oficial.']
        : ['Ainda nao existe valor comercial em reais cadastrado para este Brainrot.'];
    } catch (error) {
      console.error('[VALOR_EM_REAIS] erro', error);
      this.state.realMoneyValue = null;
      this.state.diagnostics = ['A consulta de valor em reais falhou por um erro tecnico. Consulte o console.'];
    } finally {
      const elapsed = performance.now() - loadingStartedAt;
      if (elapsed < 250) {
        await new Promise((resolve) => setTimeout(resolve, 250 - elapsed));
      }
      this.setCalculationLoading(false, button);
      this.renderSelectedPet();
      this.renderMutationSidebar();
      this.renderResults();
    }
  }

  async calculateEquivalences(button = null) {
    console.log('[VER_O_QUE_VALE] clique detectado');
    console.table({
      selectedPetSlug: this.selectedPetSlug,
      selectedMutationSlug: this.selectedMutation?.slug,
      quantity: this.quantity
    });

    if (!this.selectedPetSlug) {
      this.state.diagnostics = ['Pesquise um Brainrot para consultar o valor em reais.'];
      this.renderResults();
      return;
    }

    this.setCalculationLoading(true, button);
    this.state.results = [];
    this.state.diagnostics = ['Consultando a base comercial em reais...'];
    this.renderResults();
    const loadingStartedAt = performance.now();
    await this.waitForPaint();

    try {
      const completePet = this.getSelectedPet();
      console.log('[VER_O_QUE_VALE] pet completo', completePet);
      if (!completePet) {
        throw new Error(`PET_NOT_FOUND:${this.selectedPetSlug}`);
      }
      const quantity = Number.parseInt(this.quantity, 10);
      if (!Number.isInteger(quantity) || quantity < 1) {
        this.state.results = [];
        this.state.groups = {};
        this.state.referenceValue = null;
        this.state.marginUsed = null;
        this.state.diagnostics = ['Informe uma quantidade valida.'];
        return;
      }
      this.selectedPet = completePet;
      let resolvedValue = null;

      if (this.comparisonMode === 'income') {
        const baseIncome = this.getBaseIncome(completePet);
        if (baseIncome == null) {
          this.state.results = [];
          this.state.groups = {};
          this.state.referenceValue = null;
          this.state.marginUsed = null;
          this.state.diagnostics = ['Este pet ainda nao possui renda-base cadastrada.'];
          return;
        }
        resolvedValue = {
          value: baseIncome,
          sourceType: 'income',
          confidence: completePet?.gameStatsConfidence || 'unknown',
          warning: ''
        };
      } else {
        resolvedValue = RealTradeEquivalenceService.resolveMarket(completePet);
        console.log('[VER_O_QUE_VALE] valor resolvido', resolvedValue);
        if (!resolvedValue || !Number.isFinite(resolvedValue.value) || resolvedValue.value <= 0) {
          this.state.results = [];
          this.state.groups = {};
          this.state.referenceValue = null;
          this.state.marginUsed = null;
          this.state.diagnostics = [resolvedValue?.warning || 'Nao foi possivel estimar este pet com os dados atuais.'];
          return;
        }
      }
      console.log('[VER_O_QUE_VALE] chamando servico', { totalPets: this.brainrots.length });
      const result = TradeEquivalenceService.findEquivalents({
        selectedPet: completePet,
        selectedResolvedValue: resolvedValue,
        quantity,
        mutation: this.selectedMutation,
        allPets: this.brainrots,
        mutations: this.mutations,
        valueResolver: this.valueResolver,
        comparisonMode: this.comparisonMode
      });
      console.log('[VER_O_QUE_VALE] resultado', result);
      this.state.results = result.results;
      this.state.groups = result.groups;
      this.state.referenceValue = result.referenceValue;
      this.state.marginUsed = result.marginUsed;
      this.state.diagnostics = result.diagnostics;
      this.state.selectedBaseValue = result.selectedBaseValue;
      this.state.selectedUnitValue = result.selectedUnitValue;
      this.state.selectedValueSource = result.selectedValueSource;
      this.state.selectedConfidence = result.selectedConfidence;
      this.state.comparisonMode = result.comparisonMode;
      console.log('[VER_O_QUE_VALE] renderizando resultado');
      // history has been removed from UI and storage; no action needed here.
    } catch (error) {
      console.error('[VER_O_QUE_VALE] erro', error);
      this.state.results = [];
      this.state.groups = {};
      this.state.diagnostics = ['O calculo falhou por um erro tecnico. Consulte o console.'];
    } finally {
      const elapsed = performance.now() - loadingStartedAt;
      if (elapsed < 350) {
        await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
      }
      this.setCalculationLoading(false, button);
      this.renderSelectedPet();
      this.renderMutationSidebar();
      this.renderResults();
    }
  }

  renderResults() {
    this.resultsSection.style.display = '';
    this.resultsList.innerHTML = '';
    this.emptyState.innerHTML = '';
    if (this.state.loading) {
      this.emptyState.append(createElement('p', {}, 'Consultando valor em reais...'));
      return;
    }
    if (!this.selectedPet) {
      this.resultsSection.style.display = 'none';
      return;
    }

    if (!this.state.realMoneyConsulted) {
      (this.state.diagnostics.length ? this.state.diagnostics : ['Clique em Consultar valor em reais para ver a estimativa comercial cadastrada.'])
        .forEach((message) => this.emptyState.append(createElement('p', {}, message)));
      this.emptyState.append(this.buildEmptyVisualState(
        'Quanto este Brainrot vale?',
        'A estimativa usa somente a base comercial em reais cadastrada manualmente.',
        'Pesquisar Brainrot',
        () => this.searchInput.focus()
      ));
      return;
    }

    this.resultsList.append(this.buildRealMoneySummary());
  }

  buildRealMoneySummary() {
    const value = this.state.realMoneyValue || this.realMoneyValueService.getValue(this.selectedPet);
    const summary = createElement('section', { class: 'equivalence-summary' });
    summary.append(
      createElement('h3', {}, 'Estimativa de valor'),
      createElement('div', { class: 'stat-card-grid' }, [
        this.createDetailRow('Brainrot', this.selectedPet?.name || '-'),
        this.createDetailRow(value.displayMode === 'range' ? 'Faixa de preco em reais' : 'Valor em reais', this.realMoneyValueService.formatValue(value)),
        this.createDetailRow('Moeda', value.currency || 'BRL'),
        this.createDetailRow('Status de mercado', FormatService.label(value.marketStatus)),
        this.createDetailRow('Origem', value.sourceType === 'manual' ? 'Base comercial manual' : FormatService.source(value.sourceType)),
        this.createDetailRow('Verificado em', value.verifiedAt ? FormatService.date(value.verifiedAt) : 'Ainda nao verificado'),
        value.notes ? this.createDetailRow('Observacoes', value.notes) : null
      ].filter(Boolean)),
      createElement('p', { class: 'result-meta' }, value.hasPrice
        ? 'Estimativa comercial cadastrada manualmente. Nao e preco oficial.'
        : 'Valor em reais ainda nao cadastrado. Nao foi feita conversao por renda, raridade, Sheckles ou itens de outro jogo.')
    );
    return summary;
  }

  buildResultSummary() {
    const sourceText = this.getValueSourceLabel(this.state.selectedValueSource);
    const confidenceText = this.getConfidenceLabel(this.state.selectedConfidence);
    const isIncomeMode = this.comparisonMode === 'income';
    const summary = createElement('section', { class: 'equivalence-summary' });
    summary.append(
      createElement('h3', {}, isIncomeMode ? 'Equivalencia de renda' : 'Mercado comunitario'),
      createElement('div', { class: 'stat-card-grid' }, [
        this.createDetailRow('Pet selecionado', this.selectedPet?.name || '-'),
        this.createDetailRow(isIncomeMode ? 'Renda base' : 'Valor real de troca', isIncomeMode ? FormatService.income(this.state.selectedBaseValue) : FormatService.value(this.state.selectedBaseValue)),
        this.createDetailRow('Origem', sourceText),
        this.createDetailRow('Confianca', confidenceText),
        this.createDetailRow('Mutacao', this.selectedMutation?.name || 'Normal'),
        this.createDetailRow(isIncomeMode ? 'Multiplicador de renda' : 'Multiplicador de mercado', `${isIncomeMode ? this.getIncomeMultiplier(this.selectedMutation) : TradeEquivalenceService.getMutationMultiplier(this.selectedMutation)}x`),
        this.createDetailRow('Quantidade', String(this.quantity)),
        this.createDetailRow(isIncomeMode ? 'Renda total' : 'Valor real total', isIncomeMode ? FormatService.income(this.state.referenceValue) : FormatService.value(this.state.referenceValue)),
        this.createDetailRow('Margem utilizada', this.state.marginUsed ? `${this.state.marginUsed}%` : 'Opcoes mais proximas')
      ]),
      createElement('p', { class: 'result-meta' }, isIncomeMode ? 'Comparacao de producao: esses pets produzem renda semelhante, mas podem ter valores de troca diferentes.' : 'Valor real de troca: renda por segundo e custo dentro do jogo ficam separados.')
    );
    return summary;
  }

  buildResultCard(result) {
    const outcomeClass = OUTCOME_THEME[result.outcome.key] || OUTCOME_THEME.review;
    const isIncomeMode = this.comparisonMode === 'income';
    const card = createElement('article', { class: `equivalence-result-card trade-card ${outcomeClass}` });
    const petLine = createElement('div', { class: 'result-pets' });
    result.pets.forEach((item) => {
      petLine.append(createElement('div', { class: `result-pet-mini rarity-frame rarity-${this.getRaritySlug(item.pet.rarity)}` }, [
        createElement('div', { class: 'result-image-stage' }, this.createPetImage(item.pet, 'result-image')),
        createElement('div', {}, [
          createElement('strong', {}, item.pet.name),
          createElement('span', {}, `${this.getRarityIcon(item.pet.rarity)} ${item.pet.rarity} • x${item.quantity}`),
          createElement('span', { class: 'mini-chip' }, item.mutation?.name || 'Normal')
        ])
      ]));
    });
    card.append(
      createElement('div', { class: 'trade-visual' }, [
        this.selectedPet ? this.createPetImage(this.selectedPet, 'trade-source-image') : null,
        createElement('span', { class: 'trade-arrow' }, '⇄'),
        createElement('div', { class: 'trade-target-stack' }, petLine)
      ]),
      createElement('p', { class: 'result-value' }, `${isIncomeMode ? 'Renda total' : 'Valor real total'}: ${isIncomeMode ? FormatService.income(result.value) : FormatService.value(result.value)}`),
      createElement('p', { class: 'result-diff' }, `Diferenca: ${isIncomeMode ? FormatService.income(result.difference) : FormatService.value(result.difference)} (${result.differencePercent.toFixed(1)}%)`),
      createElement('p', { class: `result-outcome badge ${outcomeClass}` }, result.outcome.label),
      createElement('p', { class: 'result-meta' }, `${isIncomeMode ? 'Renda-base' : 'Valor real de troca'}: ${joinSafe(result.pets.map((item) => isIncomeMode ? FormatService.income(item.baseValue) : FormatService.value(item.baseValue)))}`),
      createElement('p', { class: 'result-meta' }, `Origem do valor: ${joinSafe(result.pets.map((item) => this.getValueSourceLabel(item.valueSource)))}`),
      createElement('p', { class: 'result-meta' }, `Confianca do valor: ${joinSafe(result.pets.map((item) => this.getConfidenceLabel(item.valueConfidence)))}`),
      createElement('p', { class: 'result-meta' }, `Multiplicador: ${joinSafe(result.pets.map((item) => `${item.multiplier || 1}x`))}`),
      createElement('p', { class: 'result-meta' }, `${isIncomeMode ? 'Renda final unitaria' : 'Valor real unitario'}: ${joinSafe(result.pets.map((item) => isIncomeMode ? FormatService.income(item.unitValue) : FormatService.value(item.unitValue)))}`),
      createElement('p', { class: 'result-meta' }, `Demanda: ${joinSafe(result.pets.map((item) => item.pet.demand || 'desconhecida'))}`),
      createElement('p', { class: 'result-meta' }, `Disponibilidade: ${joinSafe(result.pets.map((item) => FormatService.availability(item.pet.availability)))}`),
      createElement('p', { class: 'result-meta' }, `Quantidade: ${joinSafe(result.pets.map((item) => this.formatExistCount(item.pet)))}`),
      createElement('p', { class: 'result-meta' }, `Escassez: ${joinSafe(result.pets.map((item) => SCARCITY_LABELS[item.pet.scarcityLevel] || SCARCITY_LABELS.unknown))}`),
      createElement('p', { class: 'result-meta' }, `Confianca: ${joinSafe(result.pets.map((item) => FormatService.confidence(item.pet.valueConfidence)))}`),
      createElement('p', { class: 'result-meta' }, `Atualizado em: ${joinSafe(result.pets.map((item) => FormatService.date(item.pet.valueVerifiedAt)))}`),
      createElement('p', { class: 'result-meta' }, `Fonte: ${joinSafe(result.pets.map((item) => FormatService.source(item.pet.valueSources?.[0]?.name || item.pet.valueSource?.[0]?.name)))}`),
      createElement('p', { class: 'result-reason' }, result.reason),
      createElement('div', { class: 'card-actions' }, [
        this.buildFavoriteButton(result.pets[0].pet),
        this.buildSmallAction('Ver detalhes', () => this.openDetail(result.pets[0].pet)),
        this.buildSmallAction('Comparar', () => this.selectPet(result.pets[0].pet), 'button-primary')
      ])
    );
    return card;
  }

  renderListSection() {
    this.listSection.innerHTML = '';
    const filters = createElement('div', { class: 'list-filters' });
    const search = createElement('input', { type: 'search', placeholder: 'Buscar na lista', value: this.listSearchTerm, 'aria-label': 'Buscar na lista' });
    search.addEventListener('input', () => {
      this.listSearchTerm = search.value;
      this.renderListSection();
    });
    const rarityBar = createElement('div', { class: 'rarity-filter-bar' });
    ['Todos', ...RARITY_ORDER].forEach((rarity) => {
      const slug = rarity === 'Todos' ? 'all' : this.getRaritySlug(rarity);
      const button = createElement('button', { type: 'button', class: `rarity-filter rarity-filter-${slug} ${this.selectedRarity === rarity ? 'active' : ''}` }, rarity === 'Todos' ? '✦ Todos' : `${this.getRarityIcon(rarity)} ${rarity}`);
      button.addEventListener('click', () => {
        this.selectedRarity = rarity;
        this.renderListSection();
      });
      rarityBar.append(button);
    });
    const valueSelect = this.buildSelect('value-filter', [['all', 'Todos os valores'], ['with-value', 'Pets com valor'], ['without-value', 'Pets sem valor']], this.valueFilter, (value) => {
      this.valueFilter = value;
      this.renderListSection();
    });
    const countSelect = this.buildSelect('count-filter', [['all', 'Todas as contagens'], ['lt100', 'Menos de 100'], ['100-500', '100 a 500'], ['500-1000', '500 a 1.000'], ['1000-10000', '1.000 a 10.000'], ['gt10000', 'Mais de 10.000'], ['unknown', 'Desconhecida']], this.countFilter, (value) => {
      this.countFilter = value;
      this.renderListSection();
    });
    const favoritesOnly = createElement('label', { class: 'favorite-filter-toggle' }, [
      createElement('input', { type: 'checkbox', checked: this.showFavoritesOnly ? 'true' : null }),
      createElement('span', {}, 'Somente favoritos')
    ]);
    favoritesOnly.querySelector('input').addEventListener('change', (event) => {
      this.showFavoritesOnly = event.target.checked;
      this.renderListSection();
    });
    filters.append(search, valueSelect, countSelect, favoritesOnly, rarityBar);
    const list = createElement('div', { class: 'cards-container' });
    const filtered = this.getFilteredList();
    filtered.forEach((pet) => list.append(this.buildListCard(pet)));
    this.listSection.append(createElement('h2', {}, 'Todos os Brainrots'), filters, createElement('p', { class: 'list-count' }, `${filtered.length} pets encontrados`), list);
  }

  renderSourcesSection() {
    this.listSection.innerHTML = '';
    const imageEntries = this.brainrots
      .map((pet) => ({ pet, image: BrainrotImageService.getMetadata(pet.slug) }))
      .sort((a, b) => a.pet.name.localeCompare(b.pet.name, 'pt-BR'));
    const downloaded = imageEntries.filter((entry) => entry.image?.status === 'downloaded').length;
    const fallback = imageEntries.filter((entry) => BrainrotImageService.isFallback(entry.image?.images?.card)).length;
    const sourcesList = createElement('div', { class: 'image-sources-list' });
    imageEntries.forEach(({ pet, image }) => {
      sourcesList.append(createElement('article', { class: 'image-source-row' }, [
        this.createPetImage(pet, 'suggestion-image'),
        createElement('div', {}, [
          createElement('strong', {}, pet.name),
          createElement('span', {}, `Pagina: ${image?.wikiPageUrl || image?.sourcePage || 'em revisao'}`),
          createElement('span', {}, `Arquivo: ${image?.originalImageUrl || 'em revisao'}`),
          createElement('span', {}, `Autor: ${image?.imageAuthor || image?.author || 'em revisao'}`),
          createElement('span', {}, `Licenca: ${image?.license || 'review'}`),
          createElement('span', {}, `Data: ${FormatService.date(image?.verifiedAt)}`)
        ])
      ]));
    });
    this.listSection.append(
      createElement('h2', {}, 'Fontes das imagens'),
      createElement('p', {}, `${downloaded} imagens locais baixadas. ${fallback} Brainrots usam fallback enquanto fonte, autor, licenca e permissao permanecem em revisao.`),
      createElement('p', {}, 'Fonte de revisao para nomes e mutacoes: Steal a Brainrot Wiki. Dados comunitarios nao foram tratados como oficiais.'),
      createElement('p', {}, 'Nenhum hotlink externo e usado como solucao final.'),
      sourcesList
    );
  }

  renderRaritiesSection() {
    this.listSection.innerHTML = '';
    const grid = createElement('div', { class: 'rarity-showcase-grid' });
    RARITY_ORDER.forEach((rarity) => {
      const pets = this.brainrots.filter((pet) => pet.rarity === rarity);
      const samplePets = pets.slice(0, 3);
      const slug = this.getRaritySlug(rarity);
      grid.append(createElement('article', { class: `rarity-showcase rarity-${slug}` }, [
        createElement('span', { class: 'rarity-big-icon' }, this.getRarityIcon(rarity)),
        createElement('h3', {}, rarity),
        createElement('p', {}, `${pets.length} Brainrots cadastrados`),
        samplePets.length
          ? createElement('div', { class: 'rarity-favorite-samples' }, samplePets.map((pet) => createElement('div', { class: 'rarity-sample-row' }, [
            createElement('span', {}, pet.name),
            this.buildFavoriteButton(pet, 'icon')
          ])))
          : createElement('small', {}, 'Sem exemplos')
      ]));
    });
    this.listSection.append(createElement('h2', {}, 'Raridades'), grid);
  }

  renderFavoritesSection() {
    this.listSection.innerHTML = '';
    const entries = favoritesService.getEntries(this.brainrots.map((pet) => pet.slug));
    const favoritePets = entries
      .map((entry) => ({
        entry,
        pet: this.brainrots.find((pet) => pet.slug === entry.slug)
      }))
      .filter((item) => item.pet);

    const sortSelect = this.buildSelect('favorite-sort', [
      ['recent', 'Mais recente'],
      ['added', 'Ordem adicionada'],
      ['name', 'Nome'],
      ['rarity', 'Raridade'],
      ['value', 'Valor comunitario']
    ], this.favoriteSort, (value) => {
      this.favoriteSort = value;
      this.renderFavoritesSection();
    });

    const sorted = this.sortFavoritePets(favoritePets);
    const grid = createElement('div', { class: 'cards-container favorites-grid' });
    sorted.forEach(({ pet }) => grid.append(this.buildListCard(pet)));

    this.listSection.append(createElement('h2', {}, 'Favoritos'));
    if (!sorted.length) {
      this.listSection.append(this.buildEmptyVisualState(
        'Nenhum pet favoritado',
        'Adicione seus Brainrots preferidos para encontra-los rapidamente.',
        'Explorar Brainrots',
        () => this.onNavClick('list')
      ));
      return;
    }

    this.listSection.append(
      createElement('div', { class: 'list-filters' }, [
        createElement('label', { class: 'field-control' }, [
          createElement('span', {}, 'Ordenar favoritos'),
          sortSelect
        ]),
        createElement('button', { type: 'button', class: 'button-secondary', 'data-action': 'clear-favorites' }, 'Limpar favoritos')
      ]),
      createElement('p', { class: 'list-count' }, `${sorted.length} pets favoritos`),
      grid
    );
    this.listSection.querySelector("[data-action='clear-favorites']").addEventListener('click', (event) => {
      event.preventDefault();
      favoritesService.clear();
      this.favoriteSlugs = new Set();
      this.updateFavoriteBadges();
      this.renderFavoritesSection();
      this.showToast('Favoritos removidos.');
    });
  }

  sortFavoritePets(items) {
    const rarityRank = (pet) => RARITY_ORDER.indexOf(pet.rarity);
    return items.slice().sort((a, b) => {
      if (this.favoriteSort === 'added') return new Date(a.entry.addedAt) - new Date(b.entry.addedAt);
      if (this.favoriteSort === 'name') return a.pet.name.localeCompare(b.pet.name, 'pt-BR');
      if (this.favoriteSort === 'rarity') return rarityRank(a.pet) - rarityRank(b.pet) || a.pet.name.localeCompare(b.pet.name, 'pt-BR');
      if (this.favoriteSort === 'value') return (TradeEquivalenceService.getBaseValue(b.pet) || 0) - (TradeEquivalenceService.getBaseValue(a.pet) || 0);
      return new Date(b.entry.addedAt) - new Date(a.entry.addedAt);
    });
  }

  buildSelect(id, options, value, onChange) {
    const select = createElement('select', { id, 'aria-label': id });
    options.forEach(([optionValue, label]) => {
      const option = createElement('option', { value: optionValue }, label);
      if (optionValue === value) option.selected = true;
      select.append(option);
    });
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  getFilteredList() {
    const term = TradeEquivalenceService.normalizeText(this.listSearchTerm);
    return this.brainrots.filter((pet) => {
      if (this.selectedRarity !== 'Todos' && pet.rarity !== this.selectedRarity) return false;
      if (this.showFavoritesOnly && !this.isFavorite(pet.slug)) return false;
      if (term && !TradeEquivalenceService.normalizeText(`${pet.name} ${pet.rarity} ${pet.availability}`).includes(term)) return false;
      const hasTradeValue = TradeEquivalenceService.getBaseValue(pet) != null;
      if (this.valueFilter === 'with-value' && !hasTradeValue) return false;
      if (this.valueFilter === 'without-value' && hasTradeValue) return false;
      return this.matchesCountFilter(pet);
    });
  }

  matchesCountFilter(pet) {
    const count = pet.existCount == null ? null : Number(pet.existCount);
    if (this.countFilter === 'unknown') return count == null;
    if (this.countFilter === 'lt100') return count != null && count < 100;
    if (this.countFilter === '100-500') return count >= 100 && count <= 500;
    if (this.countFilter === '500-1000') return count > 500 && count <= 1000;
    if (this.countFilter === '1000-10000') return count > 1000 && count <= 10000;
    if (this.countFilter === 'gt10000') return count > 10000;
    return true;
  }

  buildListCard(pet) {
    return createElement('article', { class: `brainrot-card collectible-card rarity-${this.getRaritySlug(pet.rarity)}` }, [
      this.createPetImage(pet, 'brainrot-image'),
      createElement('div', { class: 'card-content' }, [
        createElement('div', { class: 'card-top' }, [
          createElement('h3', { class: 'brainrot-name' }, pet.name),
          createElement('span', { class: `rarity-pill rarity-${this.getRaritySlug(pet.rarity)}` }, `${this.getRarityIcon(pet.rarity)} ${pet.rarity}`)
        ]),
        createElement('dl', { class: 'card-stats' }, [
          createElement('div', {}, [createElement('dt', {}, 'Valor comunitario'), createElement('dd', {}, FormatService.value(pet.communityTradeValue ?? TradeEquivalenceService.getBaseValue(pet)))]),
          createElement('div', {}, [createElement('dt', {}, 'Custo'), createElement('dd', {}, FormatService.money(pet.purchaseCost))]),
          createElement('div', {}, [createElement('dt', {}, 'Renda base'), createElement('dd', {}, FormatService.income(pet.baseIncomePerSecond ?? pet.incomePerSecond))]),
          createElement('div', {}, [createElement('dt', {}, 'Existentes'), createElement('dd', {}, this.formatExistCount(pet))])
        ]),
        createElement('p', { class: 'card-meta' }, `${FormatService.availability(pet.availability)} - ${SCARCITY_LABELS[pet.scarcityLevel] || SCARCITY_LABELS.unknown}`),
        createElement('div', { class: 'card-actions' }, [
          this.buildFavoriteButton(pet),
          this.buildSmallAction('Ver detalhes', () => this.openDetail(pet)),
          this.buildSmallAction('Comparar', () => this.selectPet(pet), 'button-primary')
        ])
      ])
    ]);
  }


  saveHistory() {
    // History is removed from the interface and storage.
  }

  loadHistory() {
    return [];
  }

  persistHistory() {
    // No history storage required.
  }

  createPetImage(pet, className) {
    const size = className.includes('suggestion') ? 'thumbnail' : className.includes('selected') ? 'detail' : 'card';
    const image = createElement('img', {
      class: className,
      src: BrainrotImageService.getImage(pet.slug, size),
      alt: pet.name,
      loading: className.includes('selected') || className.includes('hero') ? 'eager' : 'lazy',
      decoding: 'async'
    });
    image.addEventListener('error', () => {
      if (image.src.endsWith(BrainrotImageService.fallback())) return;
      image.src = BrainrotImageService.fallback();
    });
    return image;
  }

  buildSmallAction(label, onClick, className = 'button-secondary') {
    const button = createElement('button', { type: 'button', class: `small-action ${className}` }, label);
    button.addEventListener('click', onClick);
    return button;
  }

  buildDetailButton(pet) {
    return this.buildSmallAction('Ver detalhes do pet', () => this.openDetail(pet));
  }

  buildDetailModal() {
    this.detailModal = createElement('div', { class: 'detail-modal hidden', role: 'dialog', 'aria-modal': 'true' });
    return this.detailModal;
  }

  _normalizePetFields(pet) {
    const p = { ...pet };
    const toNumber = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };

    // slug and name
    p.slug = p.slug || (p.name ? slugify(p.name) : p.slug);

    // purchaseCost aliases
    p.purchaseCost = toNumber(p.purchaseCost ?? p.cost ?? p.buyPrice ?? p.purchase_price ?? p.price) ?? null;

    // base income aliases
    p.baseIncomePerSecond = toNumber(p.baseIncomePerSecond ?? p.incomePerSecond ?? p.baseIncome ?? p.income) ?? null;
    // keep old incomePerSecond too if present
    p.incomePerSecond = p.incomePerSecond ?? p.baseIncomePerSecond;

    // community trade value aliases
    p.communityTradeValue = toNumber(p.communityTradeValue ?? p.tradeValue ?? p.baseTradeValue ?? p.marketValue ?? p.value) ?? null;

    // exist count aliases
    p.existCount = toNumber(p.existCount ?? p.existingCount ?? p.quantityExisting ?? p.count) ?? null;

    // demand normalization (keep null when unknown/missing)
    p.demand = (p.demand ?? p.demandLabel ?? p.demand_score ?? p.demandScore) || null;

    // sources normalization
    p.valueSources = p.valueSources || p.valueSource || p.marketSources || p.sources || p.gameStatsSources || [];
    p.sources = p.sources || p.valueSources || [];

    // verifiedAt normalization
    p.valueVerifiedAt = p.valueVerifiedAt || p.marketVerifiedAt || p.verifiedAt || p.gameStatsVerifiedAt || null;

    // confidence (keep null when missing)
    p.confidence = p.confidence || p.valueConfidence || p.marketConfidence || p.gameStatsConfidence || null;

    return p;
  }

  openDetail(pet) {
    const slug = typeof pet === 'string' ? pet : pet?.slug;
    let complete = null;
    if (slug) {
      // prefer authoritative merged dataset
      try {
        complete = BrainrotDataService.getBySlug(slug) || this.brainrots.find((p) => p.slug === slug) || pet;
      } catch (e) {
        complete = pet;
      }
    } else {
      complete = pet;
    }
    // normalize fields to canonical names expected by the UI
    this.state.detailPet = this._normalizePetFields(complete || {});
    this.renderDetailModal();
  }

  closeDetail() {
    this.state.detailPet = null;
    this.renderDetailModal();
  }

  renderDetailModal() {
    if (!this.detailModal) return;
    this.detailModal.innerHTML = '';
    if (!this.state.detailPet) {
      this.detailModal.className = 'detail-modal hidden';
      return;
    }
    const pet = this.state.detailPet;
    this.detailModal.className = 'detail-modal';
    this.detailModal.append(createElement('div', { class: `detail-dialog rarity-${this.getRaritySlug(pet.rarity)}` }, [
      createElement('button', { type: 'button', class: 'modal-close', 'aria-label': 'Fechar detalhes' }, '×'),
      createElement('div', { class: 'detail-hero' }, [
        this.createPetImage(pet, 'detail-image'),
        createElement('div', {}, [
          createElement('h2', {}, pet.name),
          createElement('span', { class: `rarity-pill rarity-${this.getRaritySlug(pet.rarity)}` }, `${this.getRarityIcon(pet.rarity)} ${pet.rarity}`),
          createElement('p', {}, FormatService.availability(pet.availability)),
          this.buildFavoriteButton(pet)
        ])
      ]),
      createElement('div', { class: 'detail-tabs' }, [
        createElement('span', {}, 'Informacoes'),
        createElement('span', {}, 'Valores'),
        createElement('span', {}, 'Mutacoes'),
        createElement('span', {}, 'Trocas'),
        createElement('span', {}, 'Fontes')
      ]),
      createElement('div', { class: 'stat-card-grid' }, (() => {
        const communityValue = pet.communityTradeValue ?? TradeEquivalenceService.getBaseValue(pet);
        const communityLabel = communityValue != null ? FormatService.value(communityValue) : 'Valor comunitario em revisao';
        const baseIncome = this.getBaseIncome(pet);
        const baseIncomeLabel = baseIncome != null ? FormatService.income(baseIncome) : 'Renda-base em revisao';
        const income = pet.incomePerSecond ?? pet.baseIncomePerSecond;
        const incomeLabel = income != null ? FormatService.income(income) : 'Renda em revisao';
        const demandLabel = pet.demand ? FormatService.label(pet.demand) : 'Demanda em revisao';
        const existLabel = (pet && pet.existCount != null) ? FormatService.existCount(pet) : 'Quantidade existente em revisao';
        const sourceName = pet.valueSources?.[0]?.name || pet.valueSource?.[0]?.name || null;
        const sourceLabel = sourceName ? FormatService.source(sourceName) : 'Fonte em revisao';
        const verifiedLabel = pet.valueVerifiedAt ? FormatService.date(pet.valueVerifiedAt) : 'Data em revisao';

        return [
          this.createDetailRow('Valor comunitario', communityLabel),
          this.createDetailRow('Renda base', baseIncomeLabel),
          this.createDetailRow('Renda', incomeLabel),
          this.createDetailRow('Demanda', demandLabel),
          this.createDetailRow('Existentes', existLabel),
          this.createDetailRow('Fonte', sourceLabel),
          this.createDetailRow('Atualizacao', verifiedLabel)
        ];
      })())
    ]));
    this.detailModal.querySelector('.modal-close').addEventListener('click', () => this.closeDetail());
  }

  buildEmptyVisualState(title, text, buttonLabel, onClick) {
    const button = createElement('button', { type: 'button', class: 'button-primary empty-action' }, buttonLabel);
    button.addEventListener('click', onClick);
    return createElement('div', { class: 'empty-visual-state' }, [
      createElement('div', { class: 'empty-art' }, '⇄'),
      createElement('h3', {}, title),
      createElement('p', {}, text),
      button
    ]);
  }

  formatExistCount(pet) {
    return FormatService.existCount(pet);
  }

  getMutationBySlug(slug) {
    return this.mutations.find((mutation) => mutation.slug === slug)
      || this.mutations.find((mutation) => mutation.slug === 'normal')
      || TradeEquivalenceService.getMutation(this.selectedPet, 'Normal');
  }

  getFilteredMutations() {
    const term = TradeEquivalenceService.normalizeText(this.mutationSearchTerm);
    const active = this.mutations.filter((mutation) => mutation.active !== false);
    if (!term) return active;
    return active.filter((mutation) => TradeEquivalenceService.normalizeText(`${mutation.name} ${mutation.displayNamePtBr} ${mutation.availability}`).includes(term));
  }

  getRaritySlug(rarity) {
    return RARITY_THEME[rarity]?.slug || TradeEquivalenceService.normalizeSlug(rarity);
  }

  getRarityIcon(rarity) {
    return RARITY_THEME[rarity]?.icon || '◇';
  }

  getMutationIcon(slug) {
    const icons = {
      normal: '◇',
      gold: '★',
      diamond: '◆',
      rainbow: '✺',
      galaxy: '✦',
      lava: '✹',
      bloodrot: '✚',
      candy: '●',
      'yin-yang': '◐',
      radioactive: '☢',
      cursed: '☾',
      cyber: '▣'
    };
    return icons[slug] || '✧';
  }

  getValueSourceLabel(sourceType) {
    const labels = {
      income: 'Renda base por segundo',
      market: 'Valor real de troca',
      community: 'Valor comunitario',
      range: 'Media de faixa',
      cost_income_estimate: 'Estimativa experimental por custo e renda',
      income_estimate: 'Estimativa experimental por renda',
      cost_estimate: 'Estimativa experimental por custo',
      rarity_estimate: 'Estimativa experimental por raridade',
      unavailable: 'Indisponivel'
    };
    return labels[sourceType] || 'Estimativa experimental';
  }

  getConfidenceLabel(confidence) {
    const labels = {
      high: 'Alta',
      medium: 'Media',
      low: 'Baixa',
      experimental: 'Experimental',
      unknown: 'Desconhecida'
    };
    return labels[confidence] || FormatService.confidence(confidence);
  }

  recalculateReferenceValue() {
    const resolvedMarket = RealTradeEquivalenceService.resolveMarket(this.selectedPet);
    const multiplier = this.comparisonMode === 'income'
      ? this.getIncomeMultiplier(this.selectedMutation)
      : TradeEquivalenceService.getMutationMultiplier(this.selectedMutation);
    const baseValue = this.comparisonMode === 'income'
      ? this.getBaseIncome(this.selectedPet)
      : resolvedMarket?.value ?? null;
    this.state.referenceValue = baseValue ? baseValue * multiplier * this.quantity : null;
    this.state.selectedBaseValue = baseValue ?? null;
    this.state.selectedUnitValue = baseValue ? baseValue * multiplier : null;
    this.state.selectedValueSource = this.comparisonMode === 'income' ? 'income' : resolvedMarket?.sourceType || 'unavailable';
    this.state.selectedConfidence = this.comparisonMode === 'income' ? this.selectedPet?.gameStatsConfidence || 'unknown' : resolvedMarket?.confidence || 'unknown';
  }

  getBaseIncome(pet) {
    const value = pet?.baseIncomePerSecond ?? pet?.incomePerSecond;
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
    return Number(value);
  }

  getIncomeMultiplier(mutation) {
    if (mutation?.incomeMultiplier !== null && mutation?.incomeMultiplier !== undefined && Number.isFinite(Number(mutation.incomeMultiplier))) {
      return Number(mutation.incomeMultiplier);
    }
    return TradeEquivalenceService.getMutationMultiplier(mutation);
  }

  render() {
    this.build();
    this.renderSelectedPet();
    this.renderResults();
  }
}
