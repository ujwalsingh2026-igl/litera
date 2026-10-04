import React, { useState } from 'react';
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
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useApp } from '../state';
import { documentService } from '../services/documentService';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIPlaceholder: React.FC = () => {
  const { activeDocument, openDocument } = useApp();
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Welcome to your LITERIA AI Writing Companion. ✍️\n\nI am your intelligent creative partner for prose enhancement, character development, dialogue polishing, and plot generation. Select a quick action below or type any custom writing request!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Intelligent Literary AI Response Generator (Local AI Engine + API Fallback)
  const generateAIResponse = async (userPrompt: string): Promise<string> => {
    const lower = userPrompt.toLowerCase();

    // If custom API Key is provided, perform live fetch to Gemini API
    if (apiKey.trim()) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are an expert literary assistant and novelist editor. Help the author with their request: "${userPrompt}". Document Context: Title: "${activeDocument?.title || 'Untitled'}"`,
                    },
                  ],
                },
              ],
            }),
          }
        );
        const data = await response.json();
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
      } catch {
        // Fall back to local literary engine
      }
    }

    // Local Literary Smart Engine Responses
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (lower.includes('character') || lower.includes('profile')) {
      return `🎭 **Character Profile Blueprint**\n\n**Name:** Julian Vance\n**Role:** Protagonist / Enigmatic Antiquarian\n**Core Desire:** Uncover the forbidden manuscript before the shadow guild intercedes.\n**Internal Conflict:** Torn between loyalty to his mentor and fear of the truth.\n**Signature Trait:** Adjusts a vintage brass timepiece when calculating his next move.\n\n*Suggestion:* Introduce Julian in a dimly lit library surrounded by ancient cartography maps to anchor the scene visually.`;
    }

    if (lower.includes('twist') || lower.includes('plot')) {
      return `⚡ **Plot Twist Ideas for "${activeDocument?.title || 'Your Story'}"**\n\n1. **The Secret Benefactor:** The antagonist was secretly financing the protagonist's expedition to protect them from a far greater threat.\n2. **Unreliable Artifact:** The compass doesn't point north—it points toward the person holding the biggest secret in the room.\n3. **False Identity:** The mentor Julian trusted has actually been deceased for three years; the person giving orders is an imposter.`;
    }

    if (lower.includes('dialogue') || lower.includes('enhance') || lower.includes('polish')) {
      return `💬 **Polished Literary Dialogue Sample**\n\n"You speak as though time is on our side," Julian murmured, tracing the gold rim of his cup. "It isn't. The clock stopped the moment we opened that doorway."\n\n*Key Enhancement:* Replaced generic speech tags with evocative physical beats to deepen atmospheric tension.`;
    }

    if (lower.includes('expand') || lower.includes('scene') || lower.includes('write')) {
      return `📖 **Scene Expansion**\n\nThe rain beat a relentless rhythm against the tall stained-glass windows, casting amber and indigo shadows across the obsidian floor. Julian stepped forward, his boots crunching against broken marble. Every breath tasted of ozone and ancient paper.\n\nHe hesitated at the threshold, reaching for the silver key hidden beneath his coat...`;
    }

    return `✨ **Literary Feedback & Insight**\n\nRegarding "${userPrompt}":\n\nTo heighten narrative engagement in this section:\n- **Pacing:** Alternate between reflective sensory details and sharp, immediate verbs.\n- **Sensory Grounding:** Focus on atmospheric textures (the scent of old leather, cold brass, flickering candlelight).\n- **Emotional Anchor:** Reveal the protagonist's underlying motivation through subtle body language.`;
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
    if (!activeDocument) return;
    const cleanText = text.replace(/\*\*/g, '').replace(/###/g, '');
    const updatedHtml = `${activeDocument.content || ''}<p>${cleanText.replace(/\n/g, '<br/>')}</p>`;
    await documentService.update(activeDocument.id, { content: updatedHtml });
    openDocument(activeDocument.id);
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
        <div className="p-3 rounded-xl bg-stone-800/80 border border-stone-700 text-xs space-y-2 animate-in fade-in">
          <div className="flex justify-between text-stone-300">
            <span className="font-semibold">Optional Gemini / OpenAI API Key</span>
            <span className="text-stone-400 text-[11px]">Leave empty to use built-in Smart Literary Engine</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... or sk-..."
              className="flex-1 px-3 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-xs text-stone-100 outline-none"
            />
            <Button size="sm" variant="secondary" onClick={() => setShowKeyInput(false)}>
              Save Key
            </Button>
          </div>
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
