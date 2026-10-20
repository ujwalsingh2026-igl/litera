import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseApp } from './app';
import { getFirebaseConfig } from './config';

let firestoreInstance: Firestore | null = null;
let isFirestoreEmulatorConnected = false;

/**
 * Initializes and returns the singleton Cloud Firestore instance.
 * Automatically hooks up to Firestore emulator if configured in environment.
 */
export function getFirebaseFirestore(): Firestore | null {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    firestoreInstance = getFirestore(app);

    const envConfig = getFirebaseConfig();
    if (
      envConfig.useEmulator &&
      envConfig.emulatorHosts.firestore &&
      !isFirestoreEmulatorConnected
    ) {
      const { host, port } = envConfig.emulatorHosts.firestore;
      connectFirestoreEmulator(firestoreInstance, host, port);
      isFirestoreEmulatorConnected = true;
      console.log(`[Firebase] Connected to Firestore Emulator at ${host}:${port}`);
    }

    return firestoreInstance;
  } catch (err) {
    console.warn('[Firebase] Firestore initialization failed:', err);
    return null;
  }
}
