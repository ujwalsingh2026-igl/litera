import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type User as FirebaseUser,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getFirebaseAuth, getFirebaseApp } from './app';
import type { User } from '../../types';

/**
 * Transforms a Firebase User into the application's User domain model.
 * The Firebase Auth UID is the definitive, tamper-proof user account identifier.
 */
export function mapFirebaseUserToAppUser(fbUser: FirebaseUser): User {
  return {
    id: fbUser.uid,
    email: fbUser.email || undefined,
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Author',
    avatarUrl: fbUser.photoURL || undefined,
    avatarColor: '#4285F4',
    provider: 'google',
    isCloudSynced: true,
    isAuthorized: true,
    authScopes: ['manuscripts:read', 'manuscripts:write', 'firestore:owner'],
    lastLoginAt: Date.now(),
    createdAt: fbUser.metadata.creationTime ? new Date(fbUser.metadata.creationTime).getTime() : Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Initiates Google Sign-In across Web and Android platforms.
 * - On Native Android: Uses @capacitor-firebase/authentication to obtain native credentials,
 *   then signs in to JavaScript Firebase Auth with GoogleAuthProvider.credential(idToken)
 *   so the Cloud Firestore client is immediately authorized.
 * - On Web: Uses signInWithPopup, falling back to signInWithRedirect if popups are blocked.
 */
export async function signInWithGoogleService(): Promise<User> {
  let auth = getFirebaseAuth();
  if (!auth) {
    const app = getFirebaseApp();
    if (app) {
      try {
        auth = getAuth(app);
      } catch {
        try {
          auth = initializeAuth(app, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence],
            popupRedirectResolver: browserPopupRedirectResolver,
          });
        } catch {
          auth = initializeAuth(app);
        }
      }
    }
  }

  if (!auth) {
    throw new Error(
      'Firebase Auth service could not be initialized. Please check your network connection.'
    );
  }

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      // 1. Native Android Google Sign-In via Capacitor plugin
      const result = await FirebaseAuthentication.signInWithGoogle({
        scopes: ['profile', 'email'],
      });

      // 2. Bridge native ID token to JavaScript Firebase session for Firestore SDK
      if (result.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(result.credential.idToken);
        const userCred = await signInWithCredential(auth, credential);
        return mapFirebaseUserToAppUser(userCred.user);
      } else if (result.user) {
        // If plugin already authenticated native user
        return {
          id: result.user.uid,
          email: result.user.email || undefined,
          displayName: result.user.displayName || 'Author',
          avatarUrl: result.user.photoUrl || undefined,
          avatarColor: '#4285F4',
          provider: 'google',
          isCloudSynced: true,
          isAuthorized: true,
          authScopes: ['manuscripts:read', 'manuscripts:write', 'firestore:owner'],
          lastLoginAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      throw new Error('Native Google sign-in did not return valid credentials.');
    } catch (nativeErr: unknown) {
      console.warn('[Firebase Auth] Native sign-in error:', nativeErr);
      const msg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
      throw new Error(`Android Google Sign-In failed: ${msg}`);
    }
  }

  // 3. Web Google Sign-In
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const userCredential = await signInWithPopup(auth, provider);
    return mapFirebaseUserToAppUser(userCredential.user);
  } catch (popupErr: unknown) {
    const errorObj = popupErr as { code?: string; message?: string };
    
    // If popup was blocked or closed, attempt redirect flow
    if (
      errorObj.code === 'auth/popup-blocked' ||
      errorObj.code === 'auth/cancelled-popup-request' ||
      /popup/i.test(errorObj.message || '')
    ) {
      console.info('[Firebase Auth] Popup blocked or cancelled. Falling back to redirect flow...');
      await signInWithRedirect(auth, provider);
      // Flow continues after redirect via handleRedirectResult()
      throw new Error('Redirecting to Google for sign in...');
    }

    if (errorObj.code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in was cancelled.');
    }

    throw new Error(errorObj.message || 'Google sign-in failed.');
  }
}

/**
 * Creates a new user account with Email and Password using Firebase Auth.
 */
export async function createAccountWithEmailService(
  email: string,
  pass: string,
  displayName?: string
): Promise<User> {
  let auth = getFirebaseAuth();
  if (!auth) {
    const app = getFirebaseApp();
    if (app) auth = getAuth(app);
  }
  if (!auth) {
    throw new Error('Authentication service unavailable. Please check your network connection.');
  }

  const userCred = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName?.trim()) {
    try {
      await updateProfile(userCred.user, { displayName: displayName.trim() });
    } catch {
      // non-fatal
    }
  }
  return mapFirebaseUserToAppUser(userCred.user);
}

/**
 * Signs in an existing user with Email and Password using Firebase Auth.
 */
export async function signInWithEmailService(
  email: string,
  pass: string
): Promise<User> {
  let auth = getFirebaseAuth();
  if (!auth) {
    const app = getFirebaseApp();
    if (app) auth = getAuth(app);
  }
  if (!auth) {
    throw new Error('Authentication service unavailable. Please check your network connection.');
  }

  const userCred = await signInWithEmailAndPassword(auth, email, pass);
  return mapFirebaseUserToAppUser(userCred.user);
}

/**
 * Checks for a pending redirect result upon page load (Web fallback).
 */
export async function handleRedirectResult(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return mapFirebaseUserToAppUser(result.user);
    }
  } catch (err) {
    console.warn('[Firebase Auth] Redirect result error:', err);
  }
  return null;
}

/**
 * Signs out from Firebase Authentication on both Native and Web platforms.
 */
export async function signOutService(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.warn('[Firebase Auth] Native sign-out notice:', e);
    }
  }

  const auth = getFirebaseAuth();
  if (auth) {
    await firebaseSignOut(auth);
  }
}

/**
 * Subscribes to real-time Firebase Authentication state changes.
 */
export function onAuthStateChangedService(
  callback: (user: User | null) => void
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      callback(mapFirebaseUserToAppUser(fbUser));
    } else {
      callback(null);
    }
  });
}
