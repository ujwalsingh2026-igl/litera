import React, { useEffect, useState } from 'react';
import type { DocumentStats } from '../types';
import { CheckCircle, Clock, BookOpen, Eye, Cloud, WifiOff, RefreshCw } from 'lucide-react';
import { useApp } from '../state';
import { useAuth } from '../auth';
import { googleCloudSyncService, type GoogleSyncStatus } from '../services/googleCloudSyncService';

interface EditorStatusBarProps {
  stats: DocumentStats;
  isSaving: boolean;
  hasUnsaved: boolean;
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({
  stats,
  isSaving,
  hasUnsaved,
}) => {
  const { toggleDistractionFree } = useApp();
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<GoogleSyncStatus>(() =>
    googleCloudSyncService.getSyncStatus(user)
  );

  useEffect(() => {
    googleCloudSyncService.setCurrentUser(user);
    const unsubscribe = googleCloudSyncService.subscribe((newStatus) => {
      setSyncStatus(newStatus);
    });
    return unsubscribe;
  }, [user]);

  return (
    <footer className="h-9 px-4 border-t border-stone-200/70 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 select-none shrink-0 font-mono">
      {/* Metrics */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        <span>
          <strong className="text-stone-800 dark:text-stone-200">{stats.words}</strong> words
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">
          <strong className="text-stone-800 dark:text-stone-200">{stats.characters}</strong> chars
        </span>
        <span className="hidden md:inline">•</span>
        <span className="hidden md:inline">
          <strong className="text-stone-800 dark:text-stone-200">{stats.sentences}</strong> sentences
        </span>
        <span className="hidden md:inline">•</span>
        <span className="hidden md:inline">
          <strong className="text-stone-800 dark:text-stone-200">{stats.paragraphs}</strong> paras
        </span>
        <span className="hidden lg:inline">•</span>
        <span className="hidden lg:inline flex items-center gap-1">
          <Clock className="w-3 h-3 text-stone-400" />
          <span>{stats.readingTimeMinutes} min read</span>
        </span>
        <span className="hidden xl:inline">•</span>
        <span className="hidden xl:inline flex items-center gap-1">
          <BookOpen className="w-3 h-3 text-stone-400" />
          <span>~{stats.estimatedPages} pages</span>
        </span>
      </div>

      {/* Save & Connectivity Status & Focus Mode */}
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <div className="flex items-center gap-1.5 text-[10px]">
          {isSaving ? (
            <span className="text-amber-600 dark:text-amber-400 font-sans italic">Saving...</span>
          ) : hasUnsaved ? (
            <span className="text-stone-400 font-sans italic">Unsaved</span>
          ) : !syncStatus.isOnline ? (
            <span
              className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-sans font-medium bg-amber-500/10 px-2 py-0.5 rounded-full"
              title="Working offline. All work is saved locally and will sync immediately when internet reconnects."
            >
              <WifiOff className="w-3 h-3 text-amber-500" />
              <span>Offline ({syncStatus.pendingOfflineCount > 0 ? `${syncStatus.pendingOfflineCount} queued` : 'Saved locally'})</span>
            </span>
          ) : syncStatus.isSyncing ? (
            <span
              className="flex items-center gap-1 text-sky-700 dark:text-sky-400 font-sans font-medium bg-sky-500/10 px-2 py-0.5 rounded-full animate-pulse"
              title="Syncing changes with Google Cloud Vault..."
            >
              <RefreshCw className="w-3 h-3 text-sky-500 animate-spin" />
              <span>Syncing...</span>
            </span>
          ) : syncStatus.isConnected ? (
            <span
              className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-sans font-medium"
              title="All work is synced and encrypted in your Google Cloud Vault"
            >
              <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Cloud Synced</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-stone-600 dark:text-stone-400 font-sans font-medium">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span className="hidden sm:inline">Saved locally</span>
            </span>
          )}
        </div>

        <button
          onClick={toggleDistractionFree}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 font-sans transition"
          title="Distraction-Free Focus Mode"
        >
          <Eye className="w-3 h-3 text-stone-400" />
          <span className="hidden sm:inline">Focus</span>
        </button>
      </div>
    </footer>
  );
};
