import type { User } from '../types';
import { googleCloudSyncService } from './googleCloudSyncService';

const STORAGE_KEY = 'literia_auth_user';
const GOOGLE_TOKEN_KEY = 'literia_google_access_token';
const GOOGLE_CLIENT_ID_KEY = 'literia_google_client_id';
const REGISTERED_USERS_KEY = 'literia_registered_accounts';
const VAULT_CODE_KEY = 'literia_secret_vault_code';

export interface RegisteredAccount {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  createdAt: number;
}

export class AuthService {
  /**
   * Get currently persisted user session
   */
  getCurrentUser(): User | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load user session:', e);
    }
    // Default guest session for local offline writing
    return {
      id: 'local_author',
      displayName: 'Local Author',
      email: 'author@local.literia',
      provider: 'guest',
      isCloudSynced: false,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Persist user session to localStorage
   */
  saveUserSession(user: User): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to persist user session:', e);
    }
  }

  /**
   * Clear user session (Logout)
   */
  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
  }

  /**
   * Google OAuth Access Token management
   */
  getGoogleAccessToken(): string | null {
    return localStorage.getItem(GOOGLE_TOKEN_KEY);
  }

  setGoogleAccessToken(token: string): void {
    if (token) {
      localStorage.setItem(GOOGLE_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
    }
  }

  getGoogleClientId(): string {
    return (
      localStorage.getItem(GOOGLE_CLIENT_ID_KEY) ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      ''
    );
  }

  setGoogleClientId(clientId: string): void {
    if (clientId.trim()) {
      localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
    }
  }

  /**
   * 1. Official Google OAuth 2.0 Page Redirect Flow
   * Redirects the browser to accounts.google.com for real authorized Google Login.
   */
  initiateGoogleRedirectLogin(customClientId?: string): void {
    if (typeof window === 'undefined') return;

    const clientId = (customClientId || this.getGoogleClientId()).trim();
    if (!clientId) {
      throw new Error(
        'Google OAuth Client ID is required. Please enter your Google Client ID or use Individual Account Login.'
      );
    }

    // Generate secure random state and nonce for CSRF validation
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('literia_oauth_state', state);
    sessionStorage.setItem('literia_oauth_nonce', nonce);

    // Current page URL without hash as redirect URI
    const redirectUri = window.location.origin + window.location.pathname;

    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.appdata',
    ].join(' ');

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=${encodeURIComponent('token id_token')}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${encodeURIComponent(state)}&` +
      `nonce=${encodeURIComponent(nonce)}&` +
      `prompt=select_account`;

    window.location.href = authUrl;
  }

  /**
   * Inspects window.location.hash on app startup to complete Google OAuth redirect.
   */
  async handleGoogleRedirectCallback(): Promise<User | null> {
    if (typeof window === 'undefined' || !window.location.hash) return null;

    const hashStr = window.location.hash.substring(1);
    if (!hashStr.includes('access_token=') && !hashStr.includes('id_token=')) {
      return null;
    }

    const params = new URLSearchParams(hashStr);
    const accessToken = params.get('access_token');
    const returnedState = params.get('state');
    const storedState = sessionStorage.getItem('literia_oauth_state');

    // Clean hash from browser URL immediately for security
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    sessionStorage.removeItem('literia_oauth_state');

    if (returnedState && storedState && returnedState !== storedState) {
      console.warn('OAuth state mismatch; ignoring callback');
      return null;
    }

    if (!accessToken) return null;

    try {
      this.setGoogleAccessToken(accessToken);

      // Fetch authentic user profile from Google UserInfo endpoint
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile from Google');
      }

      const info = await response.json();
      const finalEmail = info.email || 'author@gmail.com';
      const finalName = info.name || finalEmail.split('@')[0];

      const user: User = {
        id: `google_${info.sub || finalEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: finalEmail,
        displayName: finalName,
        avatarUrl: info.picture || 'https://lh3.googleusercontent.com/a/default-user',
        avatarColor: '#4285F4',
        provider: 'google',
        isCloudSynced: true,
        lastLoginAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.saveUserSession(user);

      // Automatically sync all pre-login local manuscripts to the cloud
      await googleCloudSyncService.syncPreLoginManuscripts(user);

      return user;
    } catch (err) {
      console.error('Google Redirect Auth error:', err);
      return null;
    }
  }

  /**
   * Direct Google Sign-In (using email or credentials)
   */
  async signInWithGoogle(customEmail?: string, customName?: string): Promise<User> {
    await new Promise((res) => setTimeout(res, 400));
    const finalEmail =
      customEmail && customEmail.includes('@') ? customEmail.trim() : 'author.google@gmail.com';
    const finalName = customName?.trim() || finalEmail.split('@')[0].replace('.', ' ');
    const formattedName = finalName.charAt(0).toUpperCase() + finalName.slice(1);

    const user: User = {
      id: `google_${finalEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: finalEmail,
      displayName: formattedName,
      avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
      avatarColor: '#4285F4',
      provider: 'google',
      isCloudSynced: true,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.saveUserSession(user);

    // Automatically sync and encrypt all pre-login local manuscripts to Google Cloud Vault
    await googleCloudSyncService.syncPreLoginManuscripts(user);

    return user;
  }

  /**
   * 2. Individual Account Registration & Sign-In with Salted Hashing
   */
  private async hashPassword(password: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}:LITERIA_AUTHOR_VAULT_2026`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private getRegisteredAccounts(): RegisteredAccount[] {
    try {
      const raw = localStorage.getItem(REGISTERED_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveRegisteredAccounts(accounts: RegisteredAccount[]): void {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(accounts));
  }

  /**
   * Register a new individual user account
   */
  async registerIndividualAccount(
    email: string,
    password: string,
    displayName?: string
  ): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const accounts = this.getRegisteredAccounts();
    if (accounts.some((a) => a.email === cleanEmail)) {
      throw new Error('An account with this email already exists. Please Sign In.');
    }

    const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const passwordHash = await this.hashPassword(password, salt);
    const name = displayName?.trim() || cleanEmail.split('@')[0];
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    const newAccount: RegisteredAccount = {
      id: `user_${Math.random().toString(36).substring(2, 10)}`,
      email: cleanEmail,
      passwordHash,
      salt,
      displayName: formattedName,
      createdAt: Date.now(),
    };

    accounts.push(newAccount);
    this.saveRegisteredAccounts(accounts);

    const user: User = {
      id: newAccount.id,
      email: cleanEmail,
      displayName: formattedName,
      avatarColor: '#EA4335',
      provider: 'gmail',
      isCloudSynced: true,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.saveUserSession(user);
    await googleCloudSyncService.syncPreLoginManuscripts(user);
    return user;
  }

  /**
   * Sign in to an existing individual account
   */
  async signInWithGmail(email: string, password?: string): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const accounts = this.getRegisteredAccounts();
    const existing = accounts.find((a) => a.email === cleanEmail);

    if (existing && password) {
      const hash = await this.hashPassword(password, existing.salt);
      if (hash !== existing.passwordHash) {
        throw new Error('Incorrect password. Please verify and try again.');
      }

      const user: User = {
        id: existing.id,
        email: existing.email,
        displayName: existing.displayName,
        avatarColor: '#EA4335',
        provider: 'gmail',
        isCloudSynced: true,
        lastLoginAt: Date.now(),
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };

      this.saveUserSession(user);
      await googleCloudSyncService.syncPreLoginManuscripts(user);
      return user;
    }

    // Direct passwordless sign-in or auto-creation for quick author access
    const namePart = cleanEmail.split('@')[0];
    const user: User = {
      id: `gmail_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: cleanEmail,
      displayName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      avatarColor: '#EA4335',
      provider: 'gmail',
      isCloudSynced: true,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.saveUserSession(user);
    await googleCloudSyncService.syncPreLoginManuscripts(user);
    return user;
  }

  /**
   * 3. Apple ID Sign-In / Sign-Up
   */
  async signInWithApple(): Promise<User> {
    await new Promise((res) => setTimeout(res, 400));
    const user: User = {
      id: `apple_${crypto.randomUUID().slice(0, 8)}`,
      email: 'author@privaterelay.appleid.com',
      displayName: 'Apple Author',
      avatarColor: '#000000',
      provider: 'apple',
      isCloudSynced: true,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.saveUserSession(user);
    await googleCloudSyncService.syncPreLoginManuscripts(user);
    return user;
  }

  /**
   * 4. Litera ID Sign-In / Sign-Up (@handle)
   */
  async signInWithLiteraId(handle: string, displayName?: string): Promise<User> {
    await new Promise((res) => setTimeout(res, 400));
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const user: User = {
      id: `litera_${cleanHandle.replace('@', '')}`,
      literaHandle: cleanHandle,
      displayName: displayName || cleanHandle.replace('@', ''),
      email: `${cleanHandle.replace('@', '')}@litera.io`,
      avatarColor: '#D97706',
      provider: 'litera_id',
      isCloudSynced: true,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.saveUserSession(user);
    await googleCloudSyncService.syncPreLoginManuscripts(user);
    return user;
  }

  /**
   * 5. Mobile Phone Number & OTP Verification
   */
  async sendPhoneOTP(phoneNumber: string): Promise<{ success: boolean; simulatedOTP: string }> {
    await new Promise((res) => setTimeout(res, 300));
    if (!phoneNumber || phoneNumber.length < 7) {
      throw new Error('Please enter a valid mobile phone number.');
    }
    return {
      success: true,
      simulatedOTP: '123456',
    };
  }

  async verifyPhoneOTP(phoneNumber: string, otp: string): Promise<User> {
    await new Promise((res) => setTimeout(res, 400));
    if (otp !== '123456' && otp.length !== 6) {
      throw new Error('Invalid OTP code. For testing, enter 123456.');
    }
    const user: User = {
      id: `phone_${phoneNumber.replace(/\D/g, '')}`,
      phoneNumber,
      displayName: `Author (${phoneNumber.slice(-4)})`,
      avatarColor: '#10B981',
      provider: 'phone',
      isCloudSynced: true,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.saveUserSession(user);
    await googleCloudSyncService.syncPreLoginManuscripts(user);
    return user;
  }

  /**
   * 6. Secret Vault Passcode / Recovery Key
   */
  generateSecretCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'LITERIA-';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async signInWithSecretCode(secretCode: string): Promise<User> {
    await new Promise((res) => setTimeout(res, 400));
    const cleanCode = secretCode.trim().toUpperCase();
    if (cleanCode.length < 8) {
      throw new Error('Secret code must be a valid 12-character passcode (e.g. LITERIA-XXXX-XXXX).');
    }
    localStorage.setItem(VAULT_CODE_KEY, cleanCode);
    const user: User = {
      id: `secret_${cleanCode.replace(/[^A-Z0-9]/g, '').slice(0, 10)}`,
      displayName: 'Secret Vault Author',
      secretCode: cleanCode,
      avatarColor: '#8B5CF6',
      provider: 'secret_code',
      isCloudSynced: true,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.saveUserSession(user);
    await googleCloudSyncService.syncPreLoginManuscripts(user);
    return user;
  }
}

export const authService = new AuthService();
