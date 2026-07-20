import { SupportService, SUPPORT_MESSAGE_MAX_LENGTH } from '../services/SupportService.js';
import { createElement } from './ui-utils.js';

const APP_LOGO = '/assets/brand/delima-blox-logo.webp';
const SECURITY_WARNING = 'Nunca envie sua senha, cookie ou código de autenticação do Roblox.';

export class SupportChatWidget {
  constructor({ service = new SupportService() } = {}) {
    this.service = service;
    this.open = false;
    this.error = '';
    this.element = null;
    this.handleStorageSync = () => {
      if (this.open) this.replace();
    };
    this.handleOpenRequest = () => this.openPanel();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageSync);
      window.addEventListener('thur-blox-support-updated', this.handleStorageSync);
      window.addEventListener('thur-blox-open-support', this.handleOpenRequest);
    }
  }

  render() {
    const unread = this.service.getCustomerUnreadCount();
    const widget = createElement('div', { class: `support-widget ${this.open ? 'is-open' : ''}` }, [
      this.open ? this.buildPanel() : null,
      createElement('button', {
        type: 'button',
        class: 'support-launcher',
        'data-action': this.open ? 'close-support' : 'open-support',
        'aria-label': this.open ? 'Fechar suporte' : 'Abrir suporte'
      }, [
        createElement('span', { class: 'support-launcher-icon', 'aria-hidden': 'true' }, this.open ? '×' : ''),
        unread > 0 ? createElement('span', { class: 'support-unread-badge' }, String(unread)) : null
      ])
    ]);
    widget.querySelector('.support-launcher').addEventListener('click', () => {
      this.open ? this.closePanel() : this.openPanel();
    });
    this.element = widget;
    return widget;
  }

  buildPanel() {
    const conversation = this.service.getActiveConversation();
    return createElement('section', { class: 'support-panel', 'aria-label': 'Chat de suporte Thur Blox' }, [
      createElement('div', { class: 'support-panel-header' }, [
        createElement('div', { class: 'support-header-top' }, [
          createElement('span', { class: 'support-home-icon', 'aria-hidden': 'true' }, ''),
          createElement('span', { class: 'support-channel-pill' }, [
            createElement('span', { class: 'support-channel-icon', 'aria-hidden': 'true' }, ''),
          createElement('span', {}, 'Conversação')
          ]),
          createElement('button', { type: 'button', class: 'support-header-close', 'data-action': 'close-support', 'aria-label': 'Fechar chat' }, '')
        ]),
        createElement('div', { class: 'support-brand-stack' }, [
          createElement('span', { class: 'support-brand-avatar' }, [
            createElement('img', { src: APP_LOGO, alt: '' })
          ]),
          createElement('span', { class: 'support-brand-avatar secondary' }, 'TB'),
          createElement('span', { class: 'support-brand-avatar' }, [
            createElement('img', { src: APP_LOGO, alt: '' })
          ])
        ]),
      createElement('strong', {}, 'Dúvidas? Fale conosco!'),
      createElement('small', {}, 'Última vez online uma hora atrás')
      ]),
      createElement('div', { class: 'support-panel-body' }, [
        this.error ? createElement('p', { class: 'support-error' }, this.error) : null,
        conversation ? this.buildConversation(conversation) : this.buildStarter()
      ])
    ]);
  }

  buildStarter() {
    const block = createElement('div', { class: 'support-starter' }, [
      this.buildSupportBubble('Olá! Como posso ajudar você? 😊'),
      createElement('p', { class: 'support-warning' }, SECURITY_WARNING),
      createElement('form', { class: 'support-start-form' }, [
        this.buildField('Seu nome', 'customerName', 'text', true),
        this.buildField('Email (opcional)', 'customerEmail', 'email', false),
        this.buildField('Nick Roblox (opcional)', 'robloxUsername', 'text', false),
        createElement('label', { class: 'support-field wide' }, [
          createElement('span', {}, 'Mensagem'),
          createElement('textarea', {
            name: 'message',
            maxlength: String(SUPPORT_MESSAGE_MAX_LENGTH),
            required: 'required',
            placeholder: 'Escreva sua mensagem...'
          })
        ]),
        createElement('button', { type: 'submit', class: 'support-send-wide' }, [
          createElement('span', {}, 'Iniciar atendimento'),
          createElement('span', { class: 'support-send-arrow', 'aria-hidden': 'true' }, '')
        ])
      ])
    ]);
    block.querySelector('form').addEventListener('submit', (event) => this.submitStarter(event));
    return block;
  }

  buildConversation(conversation) {
    const messages = this.service.getConversationMessages(conversation.id);
    const closed = conversation.status === 'closed';
    const area = createElement('div', { class: 'support-conversation' }, [
      createElement('div', { class: 'support-message-list' }, messages.map((message) => this.buildMessage(message))),
      createElement('p', { class: 'support-warning' }, SECURITY_WARNING),
      closed
        ? createElement('p', { class: 'support-closed-note' }, 'Esta conversa foi fechada pelo suporte.')
        : createElement('form', { class: 'support-compose' }, [
          createElement('textarea', {
            name: 'message',
            maxlength: String(SUPPORT_MESSAGE_MAX_LENGTH),
            required: 'required',
            placeholder: 'Escreva sua mensagem...'
          }),
          createElement('button', { type: 'submit', class: 'support-send-button', 'aria-label': 'Enviar mensagem' }, [
            createElement('span', { class: 'support-send-arrow', 'aria-hidden': 'true' }, '')
          ])
        ]),
      createElement('small', { class: 'support-powered' }, 'Suporte Thur Blox')
    ]);
    area.querySelector('form')?.addEventListener('submit', (event) => this.sendCustomerMessage(event, conversation.id, conversation.customerName));
    return area;
  }

  buildField(label, name, type, required) {
    return createElement('label', { class: 'support-field' }, [
      createElement('span', {}, label),
      createElement('input', {
        name,
        type,
        required: required ? 'required' : null,
        autocomplete: name === 'customerName' ? 'name' : name === 'customerEmail' ? 'email' : 'off'
      })
    ]);
  }

  buildSupportBubble(text) {
    return createElement('div', { class: 'support-message-row support' }, [
      createElement('span', { class: 'support-message-avatar' }, [
        createElement('img', { src: APP_LOGO, alt: '' })
      ]),
      createElement('p', { class: 'support-message-bubble' }, text)
    ]);
  }

  buildMessage(message) {
    if (message.senderType === 'system') return this.buildSupportBubble(message.body);
    const own = message.senderType === 'customer';
    return createElement('div', { class: `support-message-row ${own ? 'customer' : 'admin'}` }, [
      own ? null : createElement('span', { class: 'support-message-avatar' }, [
        createElement('img', { src: APP_LOGO, alt: '' })
      ]),
      createElement('div', { class: 'support-message-bubble' }, [
        createElement('span', { class: 'support-message-name' }, own ? 'Você' : (message.senderName || 'Suporte Thur Blox')),
        createElement('p', {}, message.body)
      ])
    ]);
  }

  openPanel() {
    this.open = true;
    const conversation = this.service.getActiveConversation();
    if (conversation) this.service.markAsRead(conversation.id, 'customer');
    this.replace();
  }

  closePanel() {
    this.open = false;
    this.error = '';
    this.replace();
  }

  submitStarter(event) {
    event.preventDefault();
    this.error = '';
    const data = new FormData(event.currentTarget);
    try {
      const conversation = this.service.createConversation({
        customerName: data.get('customerName'),
        customerEmail: data.get('customerEmail'),
        robloxUsername: data.get('robloxUsername')
      });
      this.service.sendMessage(conversation.id, {
        senderType: 'customer',
        senderName: conversation.customerName,
        body: data.get('message')
      });
      this.service.markAsRead(conversation.id, 'customer');
      this.replace();
    } catch (error) {
      this.error = error.message || 'Não foi possível iniciar o atendimento.';
      this.replace();
    }
  }

  sendCustomerMessage(event, conversationId, customerName) {
    event.preventDefault();
    this.error = '';
    const data = new FormData(event.currentTarget);
    try {
      this.service.sendMessage(conversationId, {
        senderType: 'customer',
        senderName: customerName,
        body: data.get('message')
      });
      this.replace();
    } catch (error) {
      this.error = error.message || 'Não foi possível enviar a mensagem.';
      this.replace();
    }
  }

  replace() {
    const oldElement = this.element;
    const nextElement = this.render();
    if (oldElement?.parentNode) oldElement.replaceWith(nextElement);
    if (this.open) {
      window.setTimeout(() => {
        nextElement.querySelector('.support-message-list')?.scrollTo({ top: 100000, behavior: 'smooth' });
      }, 0);
    }
  }
}
