import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  PlusCircle,
  Wand2,
  RefreshCw,
  Key,
  BookOpen,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { documentService } from '../../services/documentService';
import { useApp } from '../../state';

interface GlobalAiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalAiModal: React.FC<GlobalAiModalProps> = ({ isOpen, onClose }) => {
  const { activeDocument } = useApp();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(aiService.getStoredApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keySavedNotice, setKeySavedNotice] = useState(false);

  const handleSaveApiKey = () => {
    aiService.setStoredApiKey(apiKeyInput);
    setKeySavedNotice(true);
    setTimeout(() => setKeySavedNotice(false), 2000);
    setShowKeyConfig(false);
  };

  const handleRunPrompt = async (queryText?: string) => {
    const textToRun = queryText || prompt;
    if (!textToRun.trim() || loading) return;
    setLoading(true);
    try {
      const res = await aiService.queryGeminiOrLocal(
        textToRun,
        activeDocument?.content || ''
      );
      setResponse(res);
    } finally {
      setLoading(false);
    }
  };

  const handleInsertIntoManuscript = async () => {
    if (!activeDocument || !response) return;
    const cleanText = response.replace(/\*\*/g, '');
    const updatedHtml = `${activeDocument.content || ''}<p>${cleanText.replace(/\n/g, '<br/>')}</p>`;
    await documentService.update(activeDocument.id, { content: updatedHtml });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✨ LITERIA AI Writing Companion" size="lg">
      <div className="space-y-4">
        {/* Top Header & API Key Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-medium text-stone-800 dark:text-stone-200">
              Universal AI Assistant • Available Anywhere in LITERIA
            </span>
          </div>

          <button
            onClick={() => setShowKeyConfig((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{aiService.getStoredApiKey() ? 'API Key Set' : 'Configure Gemini API'}</span>
          </button>
        </div>

        {/* API Key Config Box */}
        {showKeyConfig && (
          <div className="p-3.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2 text-xs animate-in fade-in">
            <div className="font-semibold text-stone-800 dark:text-stone-200">
              Set Google Gemini API Key
            </div>
            <p className="text-stone-500 text-[11px]">
              Optional. Enter your free Gemini API key from AI Studio to enable cloud model generation.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg outline-none font-mono text-xs"
              />
              <Button variant="primary" size="sm" onClick={handleSaveApiKey}>
                Save Key
              </Button>
            </div>
            {keySavedNotice && (
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                ✓ API key updated successfully!
              </div>
            )}
          </div>
        )}

        {/* Preset AI Quick Action Chips */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
            Quick AI Enhancements
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleRunPrompt('Expand this scene with rich sensory atmosphere')}
              disabled={loading}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-left transition flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-stone-800 dark:text-stone-200">
                <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Expand Scene</span>
              </div>
              <span className="text-[10px] text-stone-400 line-clamp-1">Atmosphere & sensory details</span>
            </button>

            <button
              onClick={() => handleRunPrompt('Polish prose, improve pacing, and refine dialogue')}
              disabled={loading}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-left transition flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-stone-800 dark:text-stone-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>Polish Prose</span>
              </div>
              <span className="text-[10px] text-stone-400 line-clamp-1">Refine dialogue & grammar</span>
            </button>

            <button
              onClick={() => handleRunPrompt('Generate 3 unexpected plot twists for this narrative')}
              disabled={loading}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-left transition flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-stone-800 dark:text-stone-200">
                <Zap className="w-3.5 h-3.5 text-purple-500" />
                <span>Plot Twists</span>
              </div>
              <span className="text-[10px] text-stone-400 line-clamp-1">Brainstorm novel turns</span>
            </button>

            <button
              onClick={() => handleRunPrompt('Create a character profile blueprint with physical traits and flaw')}
              disabled={loading}
              className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-left transition flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-stone-800 dark:text-stone-200">
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span>Character Bio</span>
              </div>
              <span className="text-[10px] text-stone-400 line-clamp-1">Desire, flaw & role</span>
            </button>
          </div>
        </div>

        {/* Custom Prompt Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunPrompt();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask AI anything about your story, characters, plot, or grammar..."
            className="flex-1 px-3.5 py-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={loading || !prompt.trim()}
            className="shrink-0 px-4"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1" />
                <span>Ask AI</span>
              </>
            )}
          </Button>
        </form>

        {/* Active Document Context Indicator */}
        {activeDocument && (
          <div className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
            <BookOpen className="w-3 h-3 text-amber-500" />
            <span>Active Document Context: "{activeDocument.title}" ({activeDocument.stats.words} words)</span>
          </div>
        )}

        {/* Response Box */}
        {loading && (
          <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
            <span>AI Companion is crafting your literary response...</span>
          </div>
        )}

        {response && !loading && (
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3 animate-in fade-in">
            <div className="text-xs text-stone-800 dark:text-stone-200 font-serif leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
              {response}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(response);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
              </button>

              {activeDocument && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleInsertIntoManuscript}
                  className="text-amber-900 dark:text-amber-300 font-bold"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1" />
                  <span>Insert into Manuscript</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
