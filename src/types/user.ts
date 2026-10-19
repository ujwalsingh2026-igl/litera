export type AuthProviderType =
  | 'google'
  | 'gmail'
  | 'apple'
  | 'litera_id'
  | 'phone'
  | 'secret_code'
  | 'guest';

export interface User {
  id: string;
  email?: string;
  displayName: string;
  literaHandle?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  avatarColor?: string;
  provider: AuthProviderType;
  secretCode?: string;
  isCloudSynced: boolean;
  authToken?: string;
  authScopes?: string[];
  isAuthorized?: boolean;
  tokenExpiresAt?: number;
  lastLoginAt: number;
  createdAt: number;
  updatedAt: number;
  preferences?: Record<string, unknown>;
}

export interface AuthSession {
  user: User | null;
  token?: string;
  scopes?: string[];
  isAuthorized: boolean;
  isOfflineMode: boolean;
}

