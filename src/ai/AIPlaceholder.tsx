import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Wand2,
  Copy,
  Check,
  BookOpen,
  User,
  Zap,
  RefreshCw,
  PlusCircle,
  Key,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useApp } from '../state';
import { useToast } from '../components/ui/Toast';
import { documentService } from '../services/documentService';
import { aiService } from '../services/aiService';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIPlaceholder: React.FC = () => {
  const { activeDocument, setActiveDocument, openDocument, setCurrentView } = useApp();
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(aiService.getStoredApiKey());
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ valid?: boolean; message?: string } | null>(null);

  useEffect(() => {
    setApiKey(aiService.getStoredApiKey());
  }, []);

  const handleTestAndSaveKey = async () => {
    if (!apiKey.trim()) {
      aiService.setStoredApiKey('');
      setTestResult({ valid: false, message: 'API key cleared. System is now using the offline creative engine.' });
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await aiService.validateApiKey(apiKey.trim());
      setTestResult(res);
      if (res.valid) {
        aiService.setStoredApiKey(apiKey.trim());
      }
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveApiKey = (keyVal: string) => {
    setApiKey(keyVal);
    aiService.setStoredApiKey(keyVal);
    setTestResult({ valid: true, message: 'API key saved!' });
    setTimeout(() => setShowKeyInput(false), 1500);
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Welcome to your LITERIA AI Writing Companion. ✍️\n\nI am your intelligent creative partner for prose enhancement, character development, dialogue polishing, and plot generation. Select a quick action below or type any custom writing request!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const generateAIResponse = async (userPrompt: string): Promise<string> => {
    return await aiService.queryGeminiOrLocal(userPrompt, activeDocument?.content || '', apiKey);
  };

  const handleSend = async (textToSend?: string) => {
    const finalPrompt = textToSend || prompt;
    if (!finalPrompt.trim() || isGenerating) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: finalPrompt.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setPrompt('');
    setIsGenerating(true);

    try {
      const responseText = await generateAIResponse(finalPrompt);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsertIntoManuscript = async (text: string) => {
    const cleanText = aiService.cleanProseForInsertion(text);
    const paragraphs = cleanText.split(/\n\s*\n/).filter(Boolean);
    const formattedHtml = paragraphs.map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('literia:insert-content', {
          detail: {
            html: formattedHtml,
            text: cleanText,
          },
        })
      );
    }

    if (activeDocument) {
      const updatedHtml = `${activeDocument.content || ''}${formattedHtml}`;
      await documentService.update(activeDocument.id, { content: updatedHtml });
      setActiveDocument({ ...activeDocument, content: updatedHtml });
      await openDocument(activeDocument.id);
      setCurrentView('document');
    } else {
      const newDoc = await documentService.create('AI Companion Story', 'story', formattedHtml);
      setActiveDocument(newDoc);
      await openDocument(newDoc.id);
      setCurrentView('document');
    }

    toast.success('✓ Prose successfully inserted into manuscript!');
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto space-y-3 py-2">
      {/* Header Banner */}
      <Card className="p-4 bg-stone-900 text-stone-100 border-none rounded-2xl shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
              <span>AI Writing Companion Studio</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                Active
              </span>
            </h2>
            <p className="text-xs text-stone-400">
              Prose expansion, character design, dialogue polishing, and plot twists.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowKeyInput((prev) => !prev)}
          className="px-3 py-1.5 rounded-lg border border-stone-700 bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 flex items-center gap-1.5 transition"
          title="Configure API Key"
        >
          <Key className="w-3.5 h-3.5 text-amber-400" />
          <span>{apiKey ? 'API Key Set' : 'Configure API Key'}</span>
        </button>
      </Card>

      {/* API Key Input Drawer */}
      {showKeyInput && (
        <div className="p-3.5 rounded-xl bg-stone-800/90 border border-stone-700 text-xs space-y-2.5 animate-in fade-in">
          <div className="flex justify-between items-center text-stone-300">
            <span className="font-semibold text-stone-100">Google Gemini API Key</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-amber-400 hover:underline"
            >
              Get Free Key from AI Studio ↗
            </a>
          </div>
          <p className="text-stone-400 text-[11px]">
            Supports Gemini 2.0 Flash, 1.5 Flash, and 1.5 Pro. Leave empty to use the built-in offline creative engine.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="AIzaSy..."
              className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-xs text-stone-100 outline-none font-mono"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleTestAndSaveKey}
              disabled={testingKey}
            >
              {testingKey ? 'Testing...' : 'Test & Save'}
            </Button>
            <Button size="sm" variant="primary" onClick={() => handleSaveApiKey(apiKey)}>
              Save
            </Button>
          </div>
          {testResult && (
            <div
              className={`p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                testResult.valid
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-800'
              }`}
            >
              {testResult.valid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Quick Literary Prompts Ribbon */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {[
          { label: 'Expand Scene', prompt: 'Expand the current scene with atmospheric sensory details.', icon: <BookOpen className="w-3.5 h-3.5 text-amber-500" /> },
          { label: 'Character Profile', prompt: 'Create a deep character profile with motives and flaws.', icon: <User className="w-3.5 h-3.5 text-blue-500" /> },
          { label: 'Suggest Plot Twist', prompt: 'Suggest 3 dramatic plot twists for this manuscript.', icon: <Zap className="w-3.5 h-3.5 text-purple-500" /> },
          { label: 'Polish Dialogue', prompt: 'Polish the dialogue to sound more natural and evocative.', icon: <Wand2 className="w-3.5 h-3.5 text-emerald-500" /> },
        ].map((q) => (
          <button
            key={q.label}
            onClick={() => handleSend(q.prompt)}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 shrink-0 transition"
          >
            {q.icon}
            <span>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Message Chat Stream */}
      <div className="flex-1 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 overflow-y-auto space-y-4 shadow-xs min-h-[360px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed space-y-2 shadow-xs ${
                m.sender === 'user'
                  ? 'bg-amber-600 text-white rounded-br-xs'
                  : 'bg-stone-100 dark:bg-stone-800/90 text-stone-900 dark:text-stone-100 rounded-bl-xs font-serif'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {m.sender === 'assistant' && m.id !== 'welcome' && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-700/60 text-[11px] text-stone-500 font-sans">
                  <span>{m.timestamp}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(m.id, m.text)}
                      className="hover:text-stone-900 dark:hover:text-stone-200 flex items-center gap-1"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    {activeDocument && (
                      <button
                        onClick={() => handleInsertIntoManuscript(m.text)}
                        className="hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 font-semibold"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Insert in Manuscript</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <div className="p-3.5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              <span>Generating literary response...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI to expand a scene, describe a character, or polish prose..."
          className="flex-1 px-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-none focus:border-amber-500 transition shadow-xs"
        />
        <Button type="submit" size="md" variant="primary" disabled={isGenerating || !prompt.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};
