import React from 'react';
import { Sparkles } from 'lucide-react';

interface GlobalAiFabProps {
  onClick: () => void;
}

export const GlobalAiFab: React.FC<GlobalAiFabProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-[85] p-3 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold shadow-lg shadow-amber-900/20 hover:shadow-xl transition-all duration-200 flex items-center gap-2 group cursor-pointer border border-amber-400/30 active:scale-95"
      title="Open Universal AI Writing Companion"
      aria-label="Open AI Assistant"
    >
      <Sparkles className="w-5 h-5 animate-pulse text-amber-100" />
      <span className="hidden sm:inline text-xs font-semibold tracking-wide">
        AI Assistant
      </span>
    </button>
  );
};
