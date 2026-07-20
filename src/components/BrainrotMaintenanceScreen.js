import { BRAINROT_MAINTENANCE_CONFIG } from '../config/brainrot-maintenance-config.js';
import { createElement } from './ui-utils.js';

export class BrainrotMaintenanceScreen {
  constructor({ root, onNavigate, config = BRAINROT_MAINTENANCE_CONFIG }) {
    this.root = root;
    this.onNavigate = onNavigate;
    this.config = config;
    this.render();
  }

  render() {
    this.root.innerHTML = '';
    const screen = createElement('main', { class: 'brainrot-maintenance', 'aria-labelledby': 'brainrot-maintenance-title' }, [
      createElement('section', { class: 'maintenance-panel' }, [
        createElement('span', { class: 'maintenance-badge' }, this.config.badgeLabel || 'Manutencao temporaria'),
        createElement('div', { class: 'maintenance-icon', 'aria-hidden': 'true' }, [
          createElement('span', { class: 'maintenance-icon-tool' }, '!')
        ]),
        createElement('div', { class: 'maintenance-copy' }, [
          createElement('h1', { id: 'brainrot-maintenance-title' }, this.config.title),
          createElement('p', {}, this.config.message),
          createElement('p', { class: 'maintenance-return-note' }, this.config.returnMessage)
        ]),
        createElement('div', { class: 'maintenance-actions' }, [
          createElement('button', { type: 'button', class: 'button-secondary', 'data-action': 'back-home' }, 'Voltar ao portal'),
          createElement('button', { type: 'button', class: 'button-primary', 'data-action': 'open-garden' }, 'Acessar Grow a Garden 2')
        ])
      ])
    ]);

    screen.querySelector('[data-action="back-home"]').addEventListener('click', () => this.onNavigate('home'));
    screen.querySelector('[data-action="open-garden"]').addEventListener('click', () => this.onNavigate('grow-garden'));
    this.root.append(screen);
    screen.querySelector('[data-action="back-home"]').focus();
  }
}
