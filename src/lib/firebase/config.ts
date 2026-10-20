export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

export interface FirebaseEnvironmentConfig {
  config: FirebaseClientConfig;
  isConfigured: boolean;
  missingKeys: string[];
  useEmulator: boolean;
  emulatorHosts: {
    auth?: string;
    firestore?: {
      host: string;
      port: number;
    };
  };
}

const REQUIRED_CONFIG_KEYS: (keyof FirebaseClientConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

/**
 * Default production Firebase configuration for Literia Studio.
 * Ensures the application is always configured even without .env bundling.
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseClientConfig = {
  apiKey: 'AIzaSyDjZuN4Jv1-1jNb43oB95sKIJhIzRZjifg',
  authDomain: 'literia-studio-app.firebaseapp.com',
  projectId: 'literia-studio-app',
  storageBucket: 'literia-studio-app.firebasestorage.app',
  messagingSenderId: '754852471988',
  appId: '1:754852471988:web:51e94d4722ab8a468823e1',
};

/**
 * Reads public client Firebase configuration safely.
 * Never throws; guarantees a valid Firebase client configuration.
 */
export function getFirebaseConfig(): FirebaseEnvironmentConfig {
  let runtimeOverride: Partial<FirebaseClientConfig> | null = null;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('literia_firebase_config');
      if (stored) {
        runtimeOverride = JSON.parse(stored);
        if (runtimeOverride && (!runtimeOverride.apiKey || !runtimeOverride.apiKey.startsWith('AIza'))) {
          localStorage.removeItem('literia_firebase_config');
          runtimeOverride = null;
        }
      }
    } catch {
      // ignore parsing error
    }
  }

  let envApiKey = '';
  let envAuthDomain = '';
  let envProjectId = '';
  let envStorageBucket = '';
  let envMessagingSenderId = '';
  let envAppId = '';
  let envMeasurementId = '';
  let envUseEmulator = false;

  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
    if (metaEnv) {
      envApiKey = metaEnv.VITE_FIREBASE_API_KEY || '';
      envAuthDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '';
      envProjectId = metaEnv.VITE_FIREBASE_PROJECT_ID || '';
      envStorageBucket = metaEnv.VITE_FIREBASE_STORAGE_BUCKET || '';
      envMessagingSenderId = metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
      envAppId = metaEnv.VITE_FIREBASE_APP_ID || '';
      envMeasurementId = metaEnv.VITE_FIREBASE_MEASUREMENT_ID || '';
      envUseEmulator = metaEnv.VITE_USE_FIREBASE_EMULATOR === 'true';
    }
  } catch {
    // ignore
  }

  const apiKey = (runtimeOverride?.apiKey?.trim() || envApiKey.trim() || DEFAULT_FIREBASE_CONFIG.apiKey).trim();
  const authDomain = (runtimeOverride?.authDomain?.trim() || envAuthDomain.trim() || DEFAULT_FIREBASE_CONFIG.authDomain).trim();
  const projectId = (runtimeOverride?.projectId?.trim() || envProjectId.trim() || DEFAULT_FIREBASE_CONFIG.projectId).trim();
  const appId = (runtimeOverride?.appId?.trim() || envAppId.trim() || DEFAULT_FIREBASE_CONFIG.appId).trim();

  const clientConfig: FirebaseClientConfig = {
    apiKey: apiKey.startsWith('AIza') ? apiKey : DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: authDomain || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: projectId || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: (runtimeOverride?.storageBucket?.trim() || envStorageBucket.trim() || DEFAULT_FIREBASE_CONFIG.storageBucket || '').trim(),
    messagingSenderId: (runtimeOverride?.messagingSenderId?.trim() || envMessagingSenderId.trim() || DEFAULT_FIREBASE_CONFIG.messagingSenderId || '').trim(),
    appId: appId || DEFAULT_FIREBASE_CONFIG.appId,
    measurementId: (runtimeOverride?.measurementId?.trim() || envMeasurementId.trim() || '').trim(),
  };

  const missingKeys = REQUIRED_CONFIG_KEYS.filter((key) => !clientConfig[key]);
  const isConfigured = true;

  return {
    config: clientConfig,
    isConfigured,
    missingKeys,
    useEmulator: envUseEmulator,
    emulatorHosts: {},
  };
}

/**
 * Saves or clears custom Firebase client configuration in localStorage
 */
export function setRuntimeFirebaseConfig(config: Partial<FirebaseClientConfig> | null): void {
  if (typeof window === 'undefined') return;
  if (!config) {
    localStorage.removeItem('literia_firebase_config');
  } else {
    localStorage.setItem('literia_firebase_config', JSON.stringify(config));
  }
}
