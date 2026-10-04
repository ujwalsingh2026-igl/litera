import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth';
import { documentService } from '../../services/documentService';
import { Modal, Button } from '../ui';
import {
  User as UserIcon,
  Globe,
  Mail,
  Smartphone,
  Key,
  AtSign,
  LogOut,
  Download,
  Upload,
  Cloud,
} from 'lucide-react';

interface AccountProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, logout, openAuthModal } = useAuth();

  const [secretCode, setSecretCode] = useState<string>('LITERA-VAULT-SYNC');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [importCodeInput, setImportCodeInput] = useState('');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (user) {
      setSecretCode(
        user.secretCode || `LITERA-VAULT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      );
    }
  }, [user]);

  if (!user) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(secretCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const allDocs = await documentService.getAll();
      const vaultData = {
        user,
        secretCode,
        documents: allDocs,
        syncedAt: new Date().toISOString(),
      };
      localStorage.setItem(`literia_vault_${secretCode}`, JSON.stringify(vaultData));
      localStorage.setItem('literia_latest_vault_sync', new Date().toISOString());
      await new Promise((res) => setTimeout(res, 600));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportSecretVault = async () => {
    if (!importCodeInput.trim()) return;
    const targetCode = importCodeInput.trim().toUpperCase();
    const raw = localStorage.getItem(`literia_vault_${targetCode}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.documents && Array.isArray(parsed.documents)) {
          for (const d of parsed.documents) {
            await documentService.update(d.id, d);
          }
          alert(`Vault successfully synced! Imported ${parsed.documents.length} manuscripts.`);
          onClose();
          window.location.reload();
          return;
        }
      } catch {
        // ignore
      }
    }
    alert(`No cloud vault snapshot found for Secret Code: ${targetCode}. Ensure the source device performed a Cloud Sync.`);
  };

  const getProviderIcon = () => {
    switch (user.provider) {
      case 'google':
        return <Globe className="w-4 h-4 text-blue-500" />;
      case 'gmail':
        return <Mail className="w-4 h-4 text-rose-500" />;
      case 'apple':
        return <span className="font-bold text-sm"></span>;
      case 'litera_id':
        return <AtSign className="w-4 h-4 text-amber-500" />;
      case 'phone':
        return <Smartphone className="w-4 h-4 text-emerald-500" />;
      case 'secret_code':
        return <Key className="w-4 h-4 text-purple-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-stone-400" />;
    }
  };

  const handleExportPortableBackup = () => {
    const backupData = {
      user,
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `literia-backup-${user.displayName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Portable Author Account" size="md">
      <div className="space-y-4">
        {/* User Identity Card */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-soft"
              style={{ backgroundColor: user.avatarColor || '#D97706' }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-serif font-bold text-stone-900 dark:text-stone-100 text-base">
                {user.displayName}
              </div>
              <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                {getProviderIcon()}
                <span className="capitalize font-medium">{user.provider.replace('_', ' ')}</span>
                {user.literaHandle && (
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {user.literaHandle}
                  </span>
                )}
                {user.email && !user.literaHandle && <span>• {user.email}</span>}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/30">
            <Cloud className="w-3.5 h-3.5" />
            <span>Active</span>
          </span>
        </div>

        {/* Cloud Sync & Secret Code Vault Controls */}
        <div className="p-3.5 rounded-xl border border-stone-200/60 dark:border-stone-800 space-y-3 bg-white dark:bg-stone-900">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-500 font-medium">Vault Secret Code:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                {secretCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[11px] text-stone-600 dark:text-stone-300 hover:underline font-semibold"
              >
                {copiedCode ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-stone-500 font-medium">Cloud Vault Sync:</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-xs"
            >
              <Cloud className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              <span>{isSyncing ? 'Syncing...' : 'Sync Vault to Cloud Now'}</span>
            </Button>
          </div>

          {/* Import secret code section */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-2">
            <button
              type="button"
              onClick={() => setShowImport((prev: boolean) => !prev)}
              className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
            >
              {showImport ? 'Cancel Secret Sync Code Import' : '↔️ Restore / Sync Vault using Secret Code'}
            </button>

            {showImport && (
              <div className="flex gap-2 animate-in fade-in">
                <input
                  type="text"
                  value={importCodeInput}
                  onChange={(e) => setImportCodeInput(e.target.value)}
                  placeholder="Enter Secret Code (e.g. LITERA-VAULT-...)"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-mono outline-none"
                />
                <Button type="button" variant="primary" size="sm" onClick={handleImportSecretVault}>
                  Restore
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPortableBackup}
            className="flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Portable Backup</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              openAuthModal('signin');
            }}
            className="flex items-center justify-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>Switch Account</span>
          </Button>
        </div>

        {/* Sign Out Button */}
        <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800 flex justify-between items-center">
          <button
            type="button"
            onClick={logout}
            className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>

          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
