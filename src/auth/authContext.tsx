import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, AuthProviderType } from '../types';
import { authService } from '../services/authService';
import {
  signInWithGoogleService,
  signOutService,
  onAuthStateChangedService,
  handleRedirectResult,
  createAccountWithEmailService,
  signInWithEmailService,
} from '../lib/firebase/auth';
import { syncEngine } from '../sync/syncEngine';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authModalOpen: boolean;
  profileModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  setProfileModalOpen: (open: boolean) => void;
  openAuthModal: (defaultMode?: 'signin' | 'signup', defaultProvider?: AuthProviderType) => void;

  // Real Firebase Google & Individual Auth Actions
  signInWithGoogleFirebase: () => Promise<User>;
  loginWithGoogleRedirect: (customClientId?: string) => void;
  loginWithGoogle: (
    email: string,
    password?: string,
    displayName?: string,
    mode?: 'signin' | 'signup'
  ) => Promise<User>;
  loginWithGoogleJwtCredential: (credential: string) => Promise<User>;
  registerIndividualAccount: (email: string, password: string, displayName?: string) => Promise<User>;
  loginWithGmail: (email: string, password?: string) => Promise<User>;
  loginWithApple: () => Promise<User>;
  loginWithLiteraId: (handle: string, displayName?: string) => Promise<User>;
  sendPhoneOTP: (phoneNumber: string) => Promise<{ success: boolean; simulatedOTP: string }>;
  verifyPhoneOTP: (phoneNumber: string, otp: string) => Promise<User>;
  loginWithSecretCode: (secretCode: string) => Promise<User>;
  logout: () => Promise<void>;

  // Google OAuth Client ID management
  googleClientId: string;
  setGoogleClientId: (clientId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [googleClientId, setGoogleClientIdState] = useState<string>(authService.getGoogleClientId());

  useEffect(() => {
    let isMounted = true;

    // 1. Subscribe to Firebase Auth state (covers session restore & native Google sign-in)
    const unsubscribeFirebase = onAuthStateChangedService((fbUser) => {
      if (!isMounted) return;
      if (fbUser) {
        setUser(fbUser);
        authService.saveUserSession(fbUser);
        setIsLoading(false);
      } else {
        // If not authenticated in Firebase, check local cached session
        const current = authService.getCurrentUser();
        if (current && current.provider !== 'guest') {
          setUser(current);
        } else {
          setUser(current);
        }
        setIsLoading(false);
      }
    });

    // 2. Check for web redirect result
    handleRedirectResult()
      .then((redirectUser) => {
        if (isMounted && redirectUser) {
          setUser(redirectUser);
          authService.saveUserSession(redirectUser);
          setIsLoading(false);
        }
      })
      .catch((e) => {
        console.warn('[AuthContext] Redirect result check:', e);
      });

    return () => {
      isMounted = false;
      unsubscribeFirebase();
    };
  }, []);

  // Hook sync engine to user authentication state
  useEffect(() => {
    if (user && user.provider !== 'guest') {
      syncEngine.start(user);
    } else {
      syncEngine.stop();
    }
  }, [user]);

  const setGoogleClientId = (clientId: string) => {
    authService.setGoogleClientId(clientId);
    setGoogleClientIdState(clientId);
  };

  const openAuthModal = (_mode: 'signin' | 'signup' = 'signin', _provider?: AuthProviderType) => {
    setAuthModalOpen(true);
  };

  /**
   * Primary Firebase Google Sign-In (Cross-platform Web & Android)
   */
  const signInWithGoogleFirebase = async (): Promise<User> => {
    setIsLoading(true);
    try {
      const authenticatedUser = await signInWithGoogleService();
      setUser(authenticatedUser);
      authService.saveUserSession(authenticatedUser);
      return authenticatedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogleRedirect = (customClientId?: string) => {
    authService.initiateGoogleRedirectLogin(customClientId || googleClientId);
  };

  const loginWithGoogle = async (
    email: string,
    password?: string,
    displayName?: string,
    mode: 'signin' | 'signup' = 'signin'
  ): Promise<User> => {
    const newUser = await authService.signInWithGoogle(email, password, displayName, mode);
    setUser(newUser);
    return newUser;
  };

  const loginWithGoogleJwtCredential = async (credential: string): Promise<User> => {
    const newUser = await authService.handleGoogleJwtCredential(credential);
    setUser(newUser);
    return newUser;
  };

  const registerIndividualAccount = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<User> => {
    try {
      const fbUser = await createAccountWithEmailService(email, password, displayName);
      setUser(fbUser);
      authService.saveUserSession(fbUser);
      return fbUser;
    } catch (fbErr: unknown) {
      const errCode = (fbErr as { code?: string })?.code || '';
      if (errCode === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please switch to Sign In.');
      }
      console.warn('[Auth] Firebase email registration fallback:', fbErr);
      const newUser = await authService.registerIndividualAccount(email, password, displayName);
      setUser(newUser);
      return newUser;
    }
  };

  const loginWithGmail = async (email: string, password?: string): Promise<User> => {
    if (password) {
      try {
        const fbUser = await signInWithEmailService(email, password);
        setUser(fbUser);
        authService.saveUserSession(fbUser);
        return fbUser;
      } catch (fbErr: unknown) {
        const errCode = (fbErr as { code?: string })?.code || '';
        if (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential') {
          const localAccounts = authService.getRegisteredAccounts();
          const found = localAccounts.find((a) => a.email === email.trim().toLowerCase());
          if (!found) {
            throw new Error('No account found for this email address. Please switch to Create Account to register.');
          }
        }
        console.warn('[Auth] Firebase email sign-in fallback:', fbErr);
      }
    }
    const newUser = await authService.signInWithGmail(email, password);
    setUser(newUser);
    return newUser;
  };

  const loginWithApple = async (): Promise<User> => {
    const newUser = await authService.signInWithApple();
    setUser(newUser);
    return newUser;
  };

  const loginWithLiteraId = async (handle: string, displayName?: string): Promise<User> => {
    const newUser = await authService.signInWithLiteraId(handle, displayName);
    setUser(newUser);
    return newUser;
  };

  const sendPhoneOTP = async (phoneNumber: string) => {
    return authService.sendPhoneOTP(phoneNumber);
  };

  const verifyPhoneOTP = async (phoneNumber: string, otp: string): Promise<User> => {
    const newUser = await authService.verifyPhoneOTP(phoneNumber, otp);
    setUser(newUser);
    return newUser;
  };

  const loginWithSecretCode = async (secretCode: string): Promise<User> => {
    const newUser = await authService.signInWithSecretCode(secretCode);
    setUser(newUser);
    return newUser;
  };

  const logout = async (): Promise<void> => {
    syncEngine.stop();
    await signOutService();
    authService.clearSession();
    setUser({
      id: 'local_author',
      displayName: 'Local Author',
      email: 'author@local.literia',
      provider: 'guest',
      isCloudSynced: false,
      isAuthorized: false,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setProfileModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && user.provider !== 'guest',
        isLoading,
        authModalOpen,
        profileModalOpen,
        setAuthModalOpen,
        setProfileModalOpen,
        openAuthModal,

        signInWithGoogleFirebase,
        loginWithGoogleRedirect,
        loginWithGoogle,
        loginWithGoogleJwtCredential,
        registerIndividualAccount,
        loginWithGmail,
        loginWithApple,
        loginWithLiteraId,
        sendPhoneOTP,
        verifyPhoneOTP,
        loginWithSecretCode,
        logout,

        googleClientId,
        setGoogleClientId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
