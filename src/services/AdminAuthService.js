import { isLocalAdminCredential } from './AuthService.js';

export const ADMIN_SESSION_STORAGE_KEY = 'thur_blox_admin_session_v1';
export const ADMIN_AUTHORIZED_EMAILS = Object.freeze([
  'delima20k@gmail.com'
]);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const defaultNow = () => Date.now();

const getDefaultStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
};

export class AdminAuthService {
  constructor({ storage = getDefaultStorage(), now = defaultNow } = {}) {
    this.storage = storage;
    this.now = now;
  }

  isAuthorizedEmail(email) {
    return ADMIN_AUTHORIZED_EMAILS.includes(normalizeEmail(email));
  }

  getSession() {
    if (!this.storage) return null;
    try {
      const session = JSON.parse(this.storage.getItem(ADMIN_SESSION_STORAGE_KEY) || 'null');
      if (!session?.authorized || !session.email || !Number.isInteger(session.expiresAt)) return null;
      if (session.expiresAt <= this.now()) {
        this.clearSession();
        return null;
      }
      return session;
    } catch {
      this.clearSession();
      return null;
    }
  }

  isAuthorized() {
    return Boolean(this.getSession()?.authorized);
  }

  async login({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const safePassword = String(password || '').trim();
    if (!normalizedEmail) throw new Error('Informe o e-mail.');
    if (!safePassword) throw new Error('Informe a senha.');
    if (!this.isAuthorizedEmail(normalizedEmail)) {
      throw new Error('E-mail ou senha invalidos.');
    }
    let session = null;
    try {
      session = await this.loginViaApi({ email: normalizedEmail, password: safePassword });
    } catch {
      session = null;
    }
    if (!session) {
      if (!isLocalAdminCredential({ email: normalizedEmail, password: safePassword })) {
        throw new Error('E-mail ou senha invalidos.');
      }
      session = {
        authorized: true,
        email: normalizedEmail,
        expiresAt: this.now() + (30 * 60 * 1000)
      };
    }
    this.saveSession(session);
    return session;
  }

  async loginViaApi({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error('Informe o e-mail.');
    if (!String(password || '').trim()) throw new Error('Informe a senha.');
    if (!this.isAuthorizedEmail(normalizedEmail)) {
      throw new Error('E-mail ou senha inválidos.');
    }

    const response = await fetch('/api/admin/access', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.authorized !== true) {
      throw new Error(data.error || 'Não foi possível validar o acesso.');
    }
    const session = {
      authorized: true,
      email: data.email || normalizedEmail,
      expiresAt: this.now() + (Number(data.expiresInSeconds || 1800) * 1000)
    };
    this.saveSession(session);
    return session;
  }

  saveSession(session) {
    if (!this.storage) return;
    this.storage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clearSession() {
    if (!this.storage) return;
    this.storage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  }

  async logout() {
    this.clearSession();
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {});
  }
}
