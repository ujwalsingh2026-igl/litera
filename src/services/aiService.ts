export interface AIServiceResponse {
  suggestion: string;
  confidence?: number;
}

export const aiService = {
  getStoredApiKey(): string {
    return localStorage.getItem('literia_gemini_api_key') || '';
  },

  setStoredApiKey(key: string): void {
    if (key.trim()) {
      localStorage.setItem('literia_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('literia_gemini_api_key');
    }
  },

  async queryGeminiOrLocal(userPrompt: string, documentText?: string, explicitKey?: string): Promise<string> {
    const key = (explicitKey || this.getStoredApiKey()).trim();

    if (key) {
      const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro'];
      let lastErrorMessage = '';

      for (const model of models) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `You are an expert literary assistant and novelist editor. Respond directly and helpfully to the author's request.\n\nAuthor Prompt: "${userPrompt}"\n\nManuscript Context:\n"${(documentText || '').slice(0, 1500)}"`,
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

          if (data?.error) {
            lastErrorMessage = data.error.message || JSON.stringify(data.error);
          }
        } catch (err) {
          lastErrorMessage = err instanceof Error ? err.message : 'Network error connecting to Gemini API.';
        }
      }

      if (lastErrorMessage) {
        return `⚠️ **Gemini API Key Error:**\n${lastErrorMessage}\n\n*Please verify your API key at Google AI Studio (aistudio.google.com).*`;
      }
    }

    // Local Conversational Smart Engine Fallback
    const lower = userPrompt.toLowerCase().trim();

    if (['hii', 'hi', 'hello', 'hey', 'greetings', 'who are you'].includes(lower)) {
      return `Hello! 👋 I am your LITERIA AI Writing Companion.\n\nHow can I assist your writing today? You can ask me to:\n- Expand a scene or description\n- Polish dialogue or fix grammar\n- Generate character bios or plot twists\n- Give feedback on your manuscript`;
    }

    if (lower.includes('character') || lower.includes('profile')) {
      return `🎭 **Character Profile Blueprint**\n\n**Name:** Julian Vance\n**Role:** Protagonist / Enigmatic Cartographer\n**Core Desire:** Uncover the forbidden manuscript before midnight.\n**Internal Conflict:** Reluctant to trust allies after a tragic betrayal.\n**Signature Trait:** Adjusts a vintage brass pocket watch when deep in thought.`;
    }

    if (lower.includes('twist') || lower.includes('plot')) {
      return `⚡ **Plot Twist Ideas**\n\n1. **The Secret Map:** The map doesn't show physical terrain—it maps the shifting corridors of the ancient library.\n2. **Double Agent:** The mentor Julian trusts is secretly acting on behalf of the rival guild.\n3. **Lost Time:** The watch Julian carries isn't measuring hours; it counts down to an astronomical alignment.`;
    }

    if (lower.includes('expand') || lower.includes('write')) {
      return `📖 **Scene Expansion**\n\nThe rain beat a relentless cadence against the stained-glass windows, casting indigo shadows across the obsidian floor. Julian stepped across the threshold, his boots crunching on fragments of ancient marble. Every breath tasted of ozone and dry parchment.`;
    }

    return `✨ **Literary Guidance**\n\nRegarding "${userPrompt}":\n\n- **Sensory Texture:** Ground the scene with atmospheric details (scent of rain, cold brass, flickering candlelight).\n- **Pacing:** Alternate between reflective sensory beats and immediate action.\n- **Subtext:** Let character motives show through subtle physical actions rather than raw exposition.`;
  },
};
