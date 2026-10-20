import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import {
  realtimeCollabService,
  type CollaboratorInfo,
} from '../../services/realtimeCollabService';
import { googleCloudSyncService } from '../../services/googleCloudSyncService';
import { useAuth } from '../../auth';
import { useToast } from '../ui/Toast';
import type { Document } from '../../types';
import {
  Users,
  Copy,
  Check,
  Share2,
  Cloud,
  Radio,
  LogIn,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface LiveCollabModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

export const LiveCollabModal: React.FC<LiveCollabModalProps> = ({
  isOpen,
  onClose,
  document: doc,
}) => {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const activeRoom = realtimeCollabService.getActiveRoomId();

  // Generate deterministic room ID from document ID or existing room
  const currentRoomId =
    activeRoom ||
    (doc?.id ? `LIT-${doc.id.slice(0, 6).toUpperCase()}` : 'LIT-STUDIO');

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#collab=${currentRoomId}`
      : `https://literia.app/#collab=${currentRoomId}`;

  // Listen for collaborator presence updates
  useEffect(() => {
    if (!isOpen) return;

    const unsubCollab = realtimeCollabService.onCollaborators((list) => {
      setCollaborators(list);
    });

    const unsubStatus = realtimeCollabService.onStatus((connected) => {
      setIsConnected(connected);
    });

    return () => {
      unsubCollab();
      unsubStatus();
    };
  }, [isOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    success('📋 Sharable project link copied to clipboard!');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentRoomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    success(`🔑 Room Code ${currentRoomId} copied!`);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Collaborate on "${doc?.title || 'Manuscript'}" in LITERIA`,
          text: `Join me to write and edit "${doc?.title || 'Manuscript'}" in real time on LITERIA:`,
          url: shareUrl,
        });
      } catch {
        // ignore share cancellation
      }
    } else {
      handleCopyLink();
    }
  };

  const handleToggleCollab = async () => {
    if (!user) return;

    if (activeRoom) {
      realtimeCollabService.leaveRoom();
      info('Disconnected from live collaboration room.');
    } else {
      await realtimeCollabService.joinRoom(
        currentRoomId,
        user,
        doc?.content || '',
        doc?.title || ''
      );
      success(`🟢 Live room ${currentRoomId} activated! Others can join with your link.`);
    }
  };

  const handleJoinOtherRoom = async () => {
    const raw = joinCodeInput.trim().toUpperCase();
    if (!raw) return;

    // Support full URLs or raw room codes
    let code = raw;
    if (code.includes('#collab=')) {
      code = code.split('#collab=')[1];
    } else if (code.includes('collab=')) {
      code = code.split('collab=')[1].split('&')[0];
    }
    code = code.replace(/[^A-Z0-9_-]/g, '');

    if (!code) {
      error('Please enter a valid collaboration room code.');
      return;
    }

    setIsJoining(true);
    try {
      if (user) {
        await realtimeCollabService.joinRoom(code, user);
        success(`Successfully joined collaborative room ${code}!`);
        setJoinCodeInput('');
        onClose();
      }
    } catch (err) {
      error('Could not connect to room. Check code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleTriggerCloudBackup = async () => {
    if (!user) return;
    setIsBackingUp(true);
    try {
      const res = await googleCloudSyncService.syncAllToGoogleVault(user);
      if (res.success) {
        success(`☁️ Cloud Backup Successful! ${res.syncedCount} manuscripts secured in cloud vault.`);
      } else {
        error('Cloud backup could not reach server. Saved to encrypted offline vault.');
      }
    } catch (err) {
      error('Cloud backup failed: ' + String(err));
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>Real-Time Cloud Share & Collaboration Studio</span>
        </div>
      }
      size="lg"
    >
      <div className="space-y-6">
        {/* Banner summary */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-xs text-stone-700 dark:text-stone-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>{doc?.title || 'Current Project'}</span>
                {activeRoom && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    {isConnected ? 'LIVE SESSION' : 'CONNECTING...'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Share this manuscript with other writers to co-edit in real time with continuous cloud sync.
              </p>
            </div>
          </div>
        </div>

        {/* Share Link & Room Code Box */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-stone-500">
                Sharable Room Code
              </span>
              <div className="text-xl font-bold font-mono tracking-widest text-amber-600 dark:text-amber-400 mt-0.5">
                {currentRoomId}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-white dark:hover:bg-stone-800 text-xs font-medium transition flex items-center gap-1.5 text-stone-700 dark:text-stone-300"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>

              <button
                type="button"
                onClick={handleNativeShare}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Link</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-200 dark:border-stone-700/60 space-y-1.5">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
              Direct Collaboration Web Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 h-9 px-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-mono text-stone-600 dark:text-stone-400 select-all outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="h-9 px-3 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-white dark:hover:bg-stone-800 text-xs font-medium transition flex items-center gap-1.5"
                title="Copy link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Session Toggle & Active Writers */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 font-mono">
                Live Real-Time Co-Editing
              </span>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {activeRoom
                  ? 'All keystrokes and changes are broadcasting live to connected co-authors.'
                  : 'Start live session so co-authors can join and edit this document in real time.'}
              </p>
            </div>

            <Button
              type="button"
              variant={activeRoom ? 'destructive' : 'primary'}
              size="sm"
              onClick={handleToggleCollab}
            >
              {activeRoom ? 'Stop Live Session' : 'Start Live Session'}
            </Button>
          </div>

          {/* Active Collaborators List */}
          {activeRoom && (
            <div className="pt-3 border-t border-stone-200 dark:border-stone-700/60">
              <div className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-2 flex items-center justify-between">
                <span>Active Writers ({collaborators.length})</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Synced via WebSockets
                </span>
              </div>

              <div className="space-y-1.5">
                {collaborators.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-stone-800 dark:text-stone-200">
                        {c.displayName} {c.id === user?.id ? '(You)' : ''}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      Online
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Join Another Project Section */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 font-mono flex items-center gap-1.5">
            <LogIn className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Join Another Author's Project</span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="Paste Room Code (e.g. LIT-4912) or Share Link"
              className="text-xs font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleJoinOtherRoom}
              disabled={!joinCodeInput.trim() || isJoining}
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </Button>
          </div>
        </div>

        {/* Cloud Vault Consecutive Backup Card */}
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span>Cloud Vault Storage & Backup</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                AES-GCM-256 encrypted auto-backup runs consecutively with all changes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerCloudBackup}
            disabled={isBackingUp}
            className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-white dark:bg-stone-900 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs font-medium transition flex items-center justify-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
            <span>{isBackingUp ? 'Backing up...' : 'Backup Cloud Now'}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-stone-200 dark:border-stone-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
