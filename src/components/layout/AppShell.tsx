import React, { type ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { MobileDrawer } from './MobileDrawer';
import { RightPanel } from './RightPanel';
import { SearchModal } from './SearchModal';
import { GlobalAiFab } from '../ai/GlobalAiFab';
import { GlobalAiModal } from '../ai/GlobalAiModal';
import { useApp } from '../../state';
import { useToast } from '../ui/Toast';
import { Eye } from 'lucide-react';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { isStorageReady, distractionFree, toggleDistractionFree, currentView } = useApp();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { success, info } = useToast();

  React.useEffect(() => {
    const handleReconnectedSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      const count = customEvent.detail?.syncedCount;
      if (typeof count === 'number' && count > 0) {
        success(`🌐 Reconnected! ${count} manuscript${count > 1 ? 's' : ''} synced immediately to Google Cloud Vault.`);
      } else {
        success('🌐 Reconnected! All changes are synchronized with Google Cloud Vault.');
      }
    };

    const handleNetworkStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.online === false) {
        info('📴 Offline Mode: All writing is saved locally and will auto-sync once reconnected.');
      }
    };

    window.addEventListener('literia:reconnected-sync', handleReconnectedSync);
    window.addEventListener('literia:network-status', handleNetworkStatus);
    return () => {
      window.removeEventListener('literia:reconnected-sync', handleReconnectedSync);
      window.removeEventListener('literia:network-status', handleNetworkStatus);
    };
  }, [success, info]);

  if (!isStorageReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950 text-stone-600 dark:text-stone-300">
        <div className="w-10 h-10 border-2 border-stone-300 border-t-stone-800 dark:border-t-stone-200 rounded-full animate-spin mb-4" />
        <div className="font-serif text-lg tracking-wide">Preparing LITERIA Local Studio...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-50/50 dark:bg-stone-950 font-sans text-stone-900 dark:text-stone-100 antialiased">
      {/* Search Modal (Ctrl/Cmd + K) */}
      <SearchModal />

      {/* Global Universal AI Modal */}
      <GlobalAiModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} />

      {/* Desktop / Tablet Sidebar */}
      <Sidebar />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <Header />

        {/* Workspace + Right Panel Container */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative pb-14 md:pb-0">
          <main
            className={`flex-1 ${
              currentView === 'document' ? 'overflow-hidden p-0' : 'overflow-y-auto p-3 sm:p-6 lg:p-8'
            }`}
          >
            <div
              className={`mx-auto h-full ${
                currentView === 'document'
                  ? 'max-w-none w-full'
                  : distractionFree
                  ? 'max-w-3xl'
                  : 'max-w-6xl'
              }`}
            >
              {children}
            </div>
          </main>

          {/* Optional Right Panel */}
          <RightPanel />
        </div>

        {/* Mobile / Foldable Bottom Navigation */}
        <MobileNav />

        {/* Global Floating AI Button - Available Everywhere */}
        {!distractionFree && (
          <GlobalAiFab onClick={() => setAiModalOpen(true)} />
        )}

        {/* Floating exit control for Distraction-Free Mode */}
        {distractionFree && (
          <button
            onClick={toggleDistractionFree}
            className="fixed bottom-6 right-6 z-sticky flex items-center gap-2 px-3.5 py-2 rounded-full bg-stone-900/80 dark:bg-stone-100/80 text-white dark:text-stone-900 backdrop-blur-md text-xs font-medium shadow-soft hover:opacity-100 opacity-60 transition-opacity"
            title="Exit distraction-free mode"
          >
            <Eye className="w-4 h-4" />
            <span>Exit Focus</span>
          </button>
        )}

        {/* Mobile Slide-Out Navigation Drawer */}
        <MobileDrawer />
      </div>
    </div>
  );
};

