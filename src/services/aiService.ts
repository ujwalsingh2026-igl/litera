import type { AIActionType } from '../types';

export interface AIServiceResponse {
  suggestion: string;
  confidence?: number;
}

export const aiService = {
  async processWritingPrompt(
    action: AIActionType,
    text: string,
    context?: string
  ): Promise<AIServiceResponse> {
    const prompt = text || context || '';
    const lower = prompt.toLowerCase();

    // Generate responsive literary suggestions based on user action or text
    let suggestion = '';

    if (action === 'expand' || lower.includes('expand')) {
      suggestion = `The night deepened around the city as flickering gas lamps cast long, jagged shadows against the wet cobblestones. Every step echoed with a heavy, deliberate rhythm, carrying the weight of a secret long buried.`;
    } else if (action === 'rewrite' || action === 'summarize' || lower.includes('polish')) {
      suggestion = `With measured precision, he reached for the silver key. Rain hammered against the stained glass, but inside the archive, the silence was absolute—broken only by the dry rustle of ancient parchment.`;
    } else if (action === 'brainstorm' || lower.includes('twist')) {
      suggestion = `1. The ancient cartography map is drawn in invisible ink that only reveals itself under moonlight.\n2. The mentor Julian trusts is secretly working for the rival guild.\n3. The vault key isn't a physical key—it's a musical melody that must be played on the chapel organ.`;
    } else {
      suggestion = `To heighten narrative tension in this scene:\n• Use evocative sensory details (the scent of ozone and ancient leather).\n• Contrast Julian's hesitant body language with his resolute inner monologue.\n• End the paragraph on a sharp action beat to drive the reader forward.`;
    }

    return {
      suggestion,
      confidence: 0.95,
    };
  },

  async queryGeminiOrLocal(userPrompt: string, documentText?: string, apiKey?: string): Promise<string> {
    if (apiKey?.trim()) {
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
                      text: `You are an expert editor and novelist assistant. User prompt: "${userPrompt}". Manuscript Context: "${documentText || ''}"`,
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
      } catch (err) {
        console.error('Gemini API fetch failed, falling back to local engine:', err);
      }
    }

    const res = await this.processWritingPrompt('brainstorm', userPrompt, documentText);
    return res.suggestion;
  },
};
