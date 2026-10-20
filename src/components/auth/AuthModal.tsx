import React, { useState } from 'react';
import { useAuth } from '../../auth';
import type { AuthProviderType } from '../../types';
import { Modal, Button, Input } from '../ui';
import {
  Globe,
  Mail,
  Smartphone,
  Key,
  AtSign,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { authService } from '../../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  initialProvider?: AuthProviderType;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
  initialProvider = 'google',
}) => {
  const {
    signInWithGoogleFirebase,
    loginWithGoogleRedirect,
    loginWithGoogle,
    registerIndividualAccount,
    loginWithGmail,
    loginWithApple,
    loginWithLiteraId,
    sendPhoneOTP,
    verifyPhoneOTP,
    loginWithSecretCode,
    googleClientId,
    setGoogleClientId,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [activeProvider, setActiveProvider] = useState<AuthProviderType>(initialProvider);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [literaHandle, setLiteraHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [secretCodeInput, setSecretCodeInput] = useState('');

  // Status & loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setOtpSent(false);
      setOtpCode('');
      setConfirmPassword('');
    }
  }, [isOpen, initialMode]);

  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googlePasswordInput, setGooglePasswordInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(googleClientId || '');
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  const redirectUri = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirectUri(true);
    setTimeout(() => setCopiedRedirectUri(false), 2000);
  };

  const handleFirebaseGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const user = await signInWithGoogleFirebase();
      setSuccessMsg(
        `✓ Authenticated via Google! Welcome ${user.displayName || user.email || 'Author'}. Cloud sync is active.`
      );
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (
        !message.includes('popup-closed-by-user') &&
        !message.includes('cancelled') &&
        !message.includes('canceled')
      ) {
        setErrorMsg(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRedirectAuth = () => {
    try {
      setErrorMsg(null);
      const activeId = (clientIdInput.trim() || googleClientId).trim();
      if (!activeId) {
        setShowClientIdConfig(true);
        setErrorMsg('Please configure your Google Cloud OAuth Client ID below to launch official Google OAuth.');
        return;
      }
      if (clientIdInput.trim() && clientIdInput.trim() !== googleClientId) {
        setGoogleClientId(clientIdInput.trim());
      }
      loginWithGoogleRedirect(activeId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to redirect to Google.');
    }
  };

  const handleGoogleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim()) {
      setErrorMsg('Please enter your Google / Gmail address.');
      return;
    }
    if (!googlePasswordInput || googlePasswordInput.length < 6) {
      setErrorMsg('Password must be at least 6 characters for authorized account security.');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithGoogle(
        googleEmailInput.trim(),
        googlePasswordInput,
        googleNameInput.trim() || undefined,
        mode
      );
      setSuccessMsg(
        mode === 'signup'
          ? '✓ Authorized Google Account created! Bearer session active & manuscripts synced to cloud vault.'
          : '✓ Authenticated & Authorized! Welcome back to your Google Studio.'
      );
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google authentication and authorization failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithApple();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Apple ID authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && confirmPassword && password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password.');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      if (mode === 'signup') {
        await registerIndividualAccount(email.trim(), password, displayName.trim() || undefined);
        setSuccessMsg('✓ Account registered successfully! Cloud vault is initialized.');
      } else {
        await loginWithGmail(email.trim(), password);
        setSuccessMsg('✓ Signed in successfully! Welcome back.');
      }
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLiteraIdAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!literaHandle.trim()) {
      setErrorMsg('Please enter a Litera ID handle (e.g. @author).');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithLiteraId(literaHandle.trim(), displayName.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Litera ID sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await sendPhoneOTP(phoneNumber.trim());
      setOtpSent(true);
      setSuccessMsg(`Verification code sent! (Demo OTP: ${res.simulatedOTP})`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMsg('Please enter the 6-digit OTP.');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await verifyPhoneOTP(phoneNumber.trim(), otpCode.trim());
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSecretCodeAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretCodeInput.trim()) {
      setErrorMsg('Please enter a secret vault passcode.');
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithSecretCode(secretCodeInput.trim());
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid secret code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateNewSecretCode = () => {
    const code = authService.generateSecretCode();
    setSecretCodeInput(code);
  };

  const PROVIDERS: Array<{
    id: AuthProviderType;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    { id: 'google', label: 'Google', icon: <Globe className="w-4 h-4 text-blue-500" /> },
    { id: 'gmail', label: 'G-Mail', icon: <Mail className="w-4 h-4 text-rose-500" /> },
    { id: 'apple', label: 'Apple ID', icon: <span className="text-sm font-bold"></span> },
    { id: 'litera_id', label: 'Litera ID', icon: <AtSign className="w-4 h-4 text-amber-500" />, badge: 'Official' },
    { id: 'phone', label: 'Mobile No', icon: <Smartphone className="w-4 h-4 text-emerald-500" /> },
    { id: 'secret_code', label: 'Secret Code', icon: <Key className="w-4 h-4 text-purple-500" />, badge: 'Vault' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="space-y-5">
        {/* Header Branding & Mode Toggle */}
        <div className="text-center space-y-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto ring-1 ring-amber-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100">
              {mode === 'signin' ? 'Sign In to Studio' : 'Create New Account'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {mode === 'signin'
                ? 'Welcome back! Sign in to access your AES-256 encrypted documents.'
                : 'Register a new author account to enable cross-device cloud synchronization.'}
            </p>
          </div>

          {/* Two-Sided Tab Switcher: Sign In vs Create Account */}
          <div className="inline-grid grid-cols-2 p-1 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-semibold w-full max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
              }}
              className={cn(
                'py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                mode === 'signin'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs font-bold ring-1 ring-stone-200 dark:ring-stone-700'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              )}
            >
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={cn(
                'py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                mode === 'signup'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              )}
            >
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* 6 Authentication Methods Selector */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-stone-100/70 dark:bg-stone-800/50 rounded-xl">
          {PROVIDERS.map((p) => {
            const isActive = activeProvider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveProvider(p.id);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-lg text-[11px] font-medium transition-all relative',
                  isActive
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs font-bold ring-1 ring-amber-500/40'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                )}
              >
                {p.icon}
                <span className="mt-1 truncate max-w-[55px]">{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Error / Success Feedback with Smart Mode Navigation */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
            {errorMsg.toLowerCase().includes('no account') && mode === 'signin' && (
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className="self-start text-[11px] font-bold underline text-amber-700 dark:text-amber-400 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <span>👉 Click here to switch to Create Account (Register)</span>
              </button>
            )}
            {errorMsg.toLowerCase().includes('already exists') && mode === 'signup' && (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className="self-start text-[11px] font-bold underline text-amber-700 dark:text-amber-400 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <span>👉 Click here to switch to Sign In</span>
              </button>
            )}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dynamic Form Area Based on Active Provider */}
        <div className="pt-1">
          {/* 1. GOOGLE */}
          {activeProvider === 'google' && (
            <div className="space-y-4 py-1">
              <div className="text-center">
                <p className="text-xs text-stone-600 dark:text-stone-300">
                  {mode === 'signin'
                    ? 'Authenticate and authorize your Google session for cloud vault synchronization.'
                    : 'Register and authorize your Google account with AES-256 cloud manuscript protection.'}
                </p>
              </div>

              {/* Security & Pre-login Guarantee Notice */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Cloud Sync & Authorized Bearer Token</span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                  Sign in with your Google account to enable secure cloud sync across all your devices with AES-256 client-side encryption.
                </p>
              </div>

              {/* Primary: Real Firebase Google Sign-in */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleFirebaseGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-stone-50 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-100 border border-stone-300 dark:border-stone-700 font-semibold shadow-xs transition-all text-sm active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12c0 2.03.45 3.84 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>
                    {isSubmitting
                      ? 'Authenticating with Google...'
                      : mode === 'signup'
                      ? 'Sign Up with Google (Create Account)'
                      : 'Continue with Google (Sign In)'}
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-stone-200 dark:border-stone-800 w-full" />
                <span className="bg-white dark:bg-stone-900 px-3 text-[10px] text-stone-400 uppercase tracking-wider font-medium shrink-0">
                  Or enter credentials manually
                </span>
              </div>

              {/* Authorized Google Credentials Form (Authentication & Authorization) */}
              <form onSubmit={handleGoogleAuth} className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center justify-between">
                    <span>Google / Gmail Address</span>
                    <span className="text-[10px] text-stone-400 font-normal">Primary Identity</span>
                  </label>
                  <Input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="author@gmail.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center justify-between">
                    <span>Account Password</span>
                    <button
                      type="button"
                      onClick={() => setShowGooglePassword(!showGooglePassword)}
                      className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                    >
                      {showGooglePassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showGooglePassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </label>
                  <Input
                    type={showGooglePassword ? 'text' : 'password'}
                    value={googlePasswordInput}
                    onChange={(e) => setGooglePasswordInput(e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                  <p className="text-[10px] text-stone-400">
                    {mode === 'signup'
                      ? 'Encrypted with SHA-256 salted hash to protect against unauthorized invasion.'
                      : 'Verifies identity to authorize Bearer session token & cloud vault access.'}
                  </p>
                </div>

                {mode === 'signup' && (
                  <div className="space-y-1 animate-in fade-in">
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                      Author / Pen Name (Optional)
                    </label>
                    <Input
                      type="text"
                      value={googleNameInput}
                      onChange={(e) => setGoogleNameInput(e.target.value)}
                      placeholder="e.g. Leo Tolstoy"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || !googleEmailInput.trim() || !googlePasswordInput.trim()}
                  className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {isSubmitting
                      ? 'Authenticating & Authorizing...'
                      : mode === 'signin'
                      ? 'Sign In & Authorize Google Session'
                      : 'Create Authorized Account & Sync Work'}
                  </span>
                </Button>
              </form>

              {/* Official Google OAuth 2.0 Section */}
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex items-center justify-between px-0.5 text-xs">
                  <span className="text-stone-500 font-medium text-[11px]">Or Official Google OAuth:</span>
                  <button
                    type="button"
                    onClick={() => setShowClientIdConfig((prev) => !prev)}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>{showClientIdConfig ? 'Close OAuth Setup' : '⚙️ OAuth 2.0 Config'}</span>
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleRedirectAuth}
                  disabled={isSubmitting}
                  className="w-full py-2 text-xs font-medium flex items-center justify-center gap-2 border-stone-300 dark:border-stone-700"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>Launch Official Google OAuth Redirect Flow</span>
                </Button>

                {showClientIdConfig && (
                  <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800/80 text-left space-y-2.5 text-xs border border-stone-200 dark:border-stone-700 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-800 dark:text-stone-200 text-xs">
                        Google Cloud OAuth 2.0 Setup
                      </span>
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>Console</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      To enable Google's direct popup/redirect on your domain, paste your Web Client ID from Google Cloud Console.
                    </p>

                    <div className="space-y-1">
                      <span className="text-[10px] text-stone-400 font-medium">Authorized Redirect URI to register:</span>
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] font-mono bg-white dark:bg-stone-900 px-2 py-1 rounded border border-stone-200 dark:border-stone-700 truncate flex-1">
                          {redirectUri}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyRedirectUri}
                          className="px-2 py-1 text-[10px] bg-stone-200 dark:bg-stone-700 rounded font-semibold hover:bg-stone-300 flex items-center gap-1 shrink-0"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>{copiedRedirectUri ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-medium text-stone-700 dark:text-stone-300">
                        OAuth 2.0 Web Client ID:
                      </label>
                      <Input
                        type="text"
                        value={clientIdInput}
                        onChange={(e) => setClientIdInput(e.target.value)}
                        placeholder="123456789-xxxx.apps.googleusercontent.com"
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (clientIdInput.trim()) {
                          setGoogleClientId(clientIdInput.trim());
                          setShowClientIdConfig(false);
                          setSuccessMsg('✓ Google OAuth Client ID saved! Click "Launch Official Google OAuth" to sign in.');
                          setTimeout(() => setSuccessMsg(null), 3500);
                        } else {
                          setErrorMsg('Please enter a valid Client ID.');
                        }
                      }}
                      className="w-full text-xs font-semibold"
                    >
                      Save Client ID &amp; Enable OAuth
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. G-MAIL / INDIVIDUAL ACCOUNT */}
          {activeProvider === 'gmail' && (
            <form onSubmit={handleGmailAuth} className="space-y-3">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 text-left">
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
                  {mode === 'signup' ? 'New Author Registration' : 'Author Sign In'}
                </span>
                <p className="text-[11px] text-stone-500 leading-relaxed mt-0.5">
                  {mode === 'signup'
                    ? 'Create an account with your email and password to sync manuscripts across your phone and computer.'
                    : 'Enter your registered email and password to unlock your cloud manuscripts.'}
                </p>
              </div>

              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Author / Pen Name
                  </label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. A. R. Vance"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="author@example.com"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !email.trim() || !password}
                className="w-full py-2.5 text-xs font-semibold"
              >
                {isSubmitting
                  ? (mode === 'signup' ? 'Creating Account & Vault...' : 'Signing In...')
                  : (mode === 'signup' ? 'Create Account & Sync Vault' : 'Sign In to Author Account')}
              </Button>
            </form>
          )}

          {/* 3. APPLE ID */}
          {activeProvider === 'apple' && (
            <div className="space-y-4 text-center py-2">
              <p className="text-xs text-stone-500">
                Sign in with Apple ID using Touch ID, Face ID, or your Apple password.
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={handleAppleAuth}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-black hover:bg-stone-900 text-white flex items-center justify-center gap-2"
              >
                <span className="text-base font-bold"></span>
                <span className="font-medium text-xs">
                  {isSubmitting ? 'Authenticating...' : 'Continue with Apple ID'}
                </span>
              </Button>
            </div>
          )}

          {/* 4. LITERA ID */}
          {activeProvider === 'litera_id' && (
            <form onSubmit={handleLiteraIdAuth} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Litera ID Handle (@username)
                </label>
                <Input
                  value={literaHandle}
                  onChange={(e) => setLiteraHandle(e.target.value)}
                  placeholder="@author_name"
                  required
                  autoFocus
                />
              </div>

              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Display Name / Pen Name
                  </label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Evelyn Vance"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Password / Passcode
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !literaHandle.trim()}
                className="w-full py-2.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSubmitting
                  ? 'Connecting...'
                  : mode === 'signin'
                  ? 'Sign In with Litera ID'
                  : 'Create Litera ID (@handle)'}
              </Button>
            </form>
          )}

          {/* 5. MOBILE NO (OTP) */}
          {activeProvider === 'phone' && (
            <div className="space-y-3">
              {!otpSent ? (
                <form onSubmit={handleSendPhoneOTP} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                      Mobile Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 019-2834"
                      required
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !phoneNumber.trim()}
                    className="w-full py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSubmitting ? 'Sending Code...' : 'Send Verification Code (OTP)'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhoneOTP} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                      Enter 6-Digit OTP Code
                    </label>
                    <Input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      className="font-mono text-center tracking-widest text-base"
                      required
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !otpCode.trim()}
                    className="w-full py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify OTP & Complete Sign In'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-[11px] text-stone-500 hover:underline w-full text-center"
                  >
                    ← Change Phone Number
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 6. SECRET CODE */}
          {activeProvider === 'secret_code' && (
            <form onSubmit={handleSecretCodeAuth} className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Portable Vault Secret Code
                  </label>
                  <button
                    type="button"
                    onClick={generateNewSecretCode}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate Code</span>
                  </button>
                </div>
                <Input
                  value={secretCodeInput}
                  onChange={(e) => setSecretCodeInput(e.target.value.toUpperCase())}
                  placeholder="LITERIA-XXXX-XXXX"
                  className="font-mono text-xs tracking-wider uppercase"
                  required
                  autoFocus
                />
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                Secret codes enable 100% anonymous, encrypted access across any device without requiring email or phone numbers.
              </p>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !secretCodeInput.trim()}
                className="w-full py-2.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isSubmitting ? 'Decrypting Vault...' : 'Unlock Vault with Secret Code'}
              </Button>
            </form>
          )}
        </div>

        {/* Switch Mode Footer Action */}
        <div className="pt-2 text-center text-xs text-stone-600 dark:text-stone-400 border-t border-stone-200/50 dark:border-stone-800/50">
          {mode === 'signin' ? (
            <p>
              Don&apos;t have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Create an Account (Register)</span>
                <span>→</span>
              </button>
            </p>
          ) : (
            <p>
              Already have an author account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Sign In to your Account</span>
                <span>→</span>
              </button>
            </p>
          )}
        </div>

        {/* Footer Security Note */}
        <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800 text-[11px] text-stone-400 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>End-to-End Encrypted Portable Author Vault</span>
        </div>
      </div>
    </Modal>
  );
};
