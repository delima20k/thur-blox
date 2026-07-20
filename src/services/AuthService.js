export const AUTH_USERS_STORAGE_KEY = 'thur_blox_auth_users_v1';
export const AUTH_SESSION_STORAGE_KEY = 'thur_blox_auth_session_v1';
export const ADMIN_EMAILS = Object.freeze([
  'delima20k@gmail.com'
]);

const SESSION_TTL_MS = 60 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getDefaultStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const hashPassword = (password) => {
  const value = String(password || '');
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `local-dev-${(hash >>> 0).toString(16)}`;
};

const LOCAL_ADMIN_PASSWORD_HASH = 'local-dev-9aaabbee';

export const isLocalAdminCredential = ({ email, password }) => (
  ADMIN_EMAILS.includes(normalizeEmail(email))
  && hashPassword(String(password || '').trim()) === LOCAL_ADMIN_PASSWORD_HASH
);

const createId = () => `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

export class AuthService {
  constructor({ storage = getDefaultStorage(), now = () => Date.now() } = {}) {
    this.storage = storage;
    this.now = now;
  }

  isAdminEmail(email) {
    return ADMIN_EMAILS.includes(normalizeEmail(email));
  }

  register({ name, email, password, confirmPassword, robloxUsername = '' }) {
    const safeName = String(name || '').trim();
    const safeEmail = normalizeEmail(email);
    const safePassword = String(password || '').trim();
    const safeConfirm = String(confirmPassword || '');
    if (!safeName) throw new Error('Informe seu nome.');
    if (!EMAIL_PATTERN.test(safeEmail)) throw new Error('Informe um e-mail válido.');
    if (safePassword.length < MIN_PASSWORD_LENGTH) throw new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    if (safePassword !== safeConfirm) throw new Error('As senhas não conferem.');
    const users = this.loadUsers();
    if (users.some((user) => user.email === safeEmail)) throw new Error('Já existe uma conta com este e-mail.');

    const user = {
      id: createId(),
      name: safeName,
      email: safeEmail,
      robloxUsername: String(robloxUsername || '').trim(),
      passwordHash: hashPassword(safePassword),
      createdAt: new Date(this.now()).toISOString()
    };
    users.push(user);
    this.saveUsers(users);
    const session = this.createSession(user, 'customer');
    this.saveSession(session);
    return { user: this.publicUser(user), session };
  }

  async login({ email, password }) {
    const safeEmail = normalizeEmail(email);
    const safePassword = String(password || '');
    if (!EMAIL_PATTERN.test(safeEmail)) throw new Error('Informe um e-mail válido.');
    if (!safePassword) throw new Error('Informe a senha.');

    if (this.isAdminEmail(safeEmail)) {
      const session = await this.loginAdmin({ email: safeEmail, password: safePassword });
      this.saveSession(session);
      return session;
    }

    const user = this.loadUsers().find((item) => item.email === safeEmail);
    if (!user || user.passwordHash !== hashPassword(safePassword)) throw new Error('E-mail ou senha inválidos.');
    const session = this.createSession(user, 'customer');
    this.saveSession(session);
    return session;
  }

  async loginAdmin({ email, password }) {
    const safeEmail = normalizeEmail(email);
    const safePassword = String(password || '').trim();
    try {
      return await this.loginAdminViaApi({ email: safeEmail, password: safePassword });
    } catch {
      if (!isLocalAdminCredential({ email: safeEmail, password: safePassword })) {
        throw new Error('E-mail ou senha invalidos.');
      }
    }

    let users = this.loadUsers();
    let user = users.find((item) => item.email === safeEmail);
    if (!user) {
      user = {
        id: createId(),
        name: 'Alan Lima',
        email: safeEmail,
        robloxUsername: '',
        passwordHash: 'admin-local-session',
        createdAt: new Date(this.now()).toISOString()
      };
      users = [...users, user];
      this.saveUsers(users);
    }
    return this.createSession(user, 'admin', ADMIN_SESSION_TTL_MS);
  }

  async loginAdminViaApi({ email, password }) {
    const response = await fetch('/api/admin/access', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.authorized !== true) {
      throw new Error('E-mail ou senha inválidos.');
    }
    let users = this.loadUsers();
    let user = users.find((item) => item.email === email);
    if (!user) {
      user = {
        id: createId(),
        name: email.split('@')[0],
        email,
        robloxUsername: '',
        passwordHash: 'admin-server-session',
        createdAt: new Date(this.now()).toISOString()
      };
      users = [...users, user];
      this.saveUsers(users);
    }
    return this.createSession(user, 'admin', Number(data.expiresInSeconds || 1800) * 1000);
  }

  getSession() {
    if (!this.storage) return null;
    try {
      const session = JSON.parse(this.storage.getItem(AUTH_SESSION_STORAGE_KEY) || 'null');
      if (!session?.email || !Number.isInteger(session.expiresAt)) return null;
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

  isAdminSession(session = this.getSession()) {
    return session?.role === 'admin' && this.isAdminEmail(session.email);
  }

  getCurrentUser() {
    const session = this.getSession();
    if (!session) return null;
    const user = this.loadUsers().find((item) => item.email === session.email);
    return user ? this.publicUser(user) : {
      id: session.userId,
      name: session.name,
      email: session.email,
      robloxUsername: session.robloxUsername || ''
    };
  }

  async logout() {
    const session = this.getSession();
    this.clearSession();
    if (session?.role === 'admin') {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      }).catch(() => {});
    }
  }

  createSession(user, role, ttl = SESSION_TTL_MS) {
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      robloxUsername: user.robloxUsername || '',
      role,
      expiresAt: this.now() + ttl
    };
  }

  publicUser(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      robloxUsername: user.robloxUsername || ''
    };
  }

  loadUsers() {
    if (!this.storage) return [];
    try {
      const users = JSON.parse(this.storage.getItem(AUTH_USERS_STORAGE_KEY) || '[]');
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
    }
  }

  saveUsers(users) {
    if (!this.storage) return;
    this.storage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(users));
  }

  saveSession(session) {
    if (!this.storage) return;
    this.storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clearSession() {
    if (!this.storage) return;
    this.storage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }
}
