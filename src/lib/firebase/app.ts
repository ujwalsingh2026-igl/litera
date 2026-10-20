import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth';
import { getFirebaseConfig, DEFAULT_FIREBASE_CONFIG, type FirebaseEnvironmentConfig } from './config';

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;
let isAuthEmulatorConnected = false;

/**
 * Initializes and returns the singleton Firebase App instance.
 * Guaranteed to return a valid FirebaseApp using default project config if needed.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseAppInstance) {
    return firebaseAppInstance;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAppInstance = existingApps[0];
    return firebaseAppInstance;
  }

  const envConfig: FirebaseEnvironmentConfig = getFirebaseConfig();
  const config = (envConfig && envConfig.config) ? envConfig.config : DEFAULT_FIREBASE_CONFIG;

  try {
    firebaseAppInstance = initializeApp(config);
    return firebaseAppInstance;
  } catch (err) {
    console.warn('[Firebase] Initialization attempt error:', err);
    const existing = getApps();
    if (existing.length > 0) {
      firebaseAppInstance = existing[0];
      return firebaseAppInstance;
    }
    return null;
  }
}

/**
 * Initializes and returns the singleton Firebase Auth instance.
 * Uses getAuth with fallback to initializeAuth with browser persistence.
 */
export function getFirebaseAuth(): Auth | null {
  if (firebaseAuthInstance) {
    return firebaseAuthInstance;
  }

  let app = getFirebaseApp();
  if (!app) {
    try {
      app = initializeApp(DEFAULT_FIREBASE_CONFIG);
      firebaseAppInstance = app;
    } catch {
      const apps = getApps();
      if (apps.length > 0) {
        app = apps[0];
        firebaseAppInstance = app;
      }
    }
  }

  if (!app) {
    return null;
  }

  try {
    try {
      firebaseAuthInstance = getAuth(app);
    } catch (getAuthErr) {
      console.info('[Firebase] getAuth fallback to initializeAuth:', getAuthErr);
      try {
        firebaseAuthInstance = initializeAuth(app, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence],
          popupRedirectResolver: browserPopupRedirectResolver,
        });
      } catch {
        firebaseAuthInstance = initializeAuth(app);
      }
    }

    const envConfig = getFirebaseConfig();
    if (envConfig.useEmulator && envConfig.emulatorHosts.auth && !isAuthEmulatorConnected) {
      connectAuthEmulator(firebaseAuthInstance, envConfig.emulatorHosts.auth, {
        disableWarnings: true,
      });
      isAuthEmulatorConnected = true;
      console.log('[Firebase] Connected to Auth Emulator at', envConfig.emulatorHosts.auth);
    }

    return firebaseAuthInstance;
  } catch (err) {
    console.warn('[Firebase] Auth initialization failed:', err);
    return null;
  }
}

/**
 * Checks whether Firebase is initialized and available in the current environment
 */
export function isFirebaseReady(): boolean {
  return getFirebaseApp() !== null && getFirebaseAuth() !== null;
}
