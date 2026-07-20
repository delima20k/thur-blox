import { EquivalenceApp } from './EquivalenceApp.js';
import { createElement } from './ui-utils.js';

export class BrainrotModule {
  constructor({ root, brainrots, mutations, realMoneyValues, brainrotImages, onNavigate }) {
    this.root = root;
    this.brainrots = brainrots;
    this.mutations = mutations;
    this.realMoneyValues = realMoneyValues;
    this.brainrotImages = brainrotImages;
    this.onNavigate = onNavigate;
    this.render();
  }

  render() {
    this.root.innerHTML = '';
    const wrapper = createElement('div', { class: 'brainrot-module' });
    const header = createElement('header', { class: 'portal-topbar' }, [
      createElement('div', { class: 'portal-brand' }, [
        createElement('div', { class: 'portal-icon' }, 'B'),
        createElement('div', {}, [
          createElement('strong', {}, 'Roube um Brainrot'),
          createElement('small', {}, 'Módulo de Brainrot aberto no THUR BLOX')
        ])
      ]),
      createElement('button', { type: 'button', class: 'button-secondary' }, 'Voltar ao portal')
    ]);
    header.querySelector('button').addEventListener('click', () => this.onNavigate('home'));
    wrapper.append(header);
    const appContainer = createElement('div', { class: 'brainrot-app-container' });
    wrapper.append(appContainer);
    this.root.append(wrapper);
    new EquivalenceApp({ root: appContainer, brainrots: this.brainrots, mutations: this.mutations, realMoneyValues: this.realMoneyValues, brainrotImages: this.brainrotImages });
  }
}
