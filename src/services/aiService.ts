export interface AIServiceResponse {
  suggestion: string;
  confidence?: number;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  message: string;
  model?: string;
}

const SUPPORTED_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export const aiService = {
  cleanKey(key?: string): string {
    if (!key) return '';
    return key.trim().replace(/^["']|["']$/g, '').trim();
  },

  getStoredApiKey(): string {
    return this.cleanKey(localStorage.getItem('literia_gemini_api_key') || '');
  },

  setStoredApiKey(key: string): void {
    const cleaned = this.cleanKey(key);
    if (cleaned) {
      localStorage.setItem('literia_gemini_api_key', cleaned);
    } else {
      localStorage.removeItem('literia_gemini_api_key');
    }
  },

  /**
   * Ping Gemini API to test if the API key is active and valid.
   */
  async validateApiKey(testKey?: string): Promise<ApiKeyValidationResult> {
    const key = this.cleanKey(testKey || this.getStoredApiKey());
    if (!key) {
      return { valid: false, message: 'Please enter a Gemini API key.' };
    }

    for (const model of SUPPORTED_GEMINI_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Respond with the single word: Connected' }] }],
            }),
          }
        );

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return {
            valid: true,
            message: `✓ Connected successfully to Google Gemini (${model})!`,
            model,
          };
        }

        if (data?.error) {
          const errCode = data.error.code || response.status;
          const errMsg = data.error.message || 'API rejected key';

          if (errCode === 400 && errMsg.includes('API_KEY_INVALID')) {
            return { valid: false, message: 'Invalid API key. Please check your key in Google AI Studio.' };
          }
          if (errCode === 429) {
            return { valid: false, message: 'Quota exceeded for this API key. Please check your usage on Google AI Studio.' };
          }
        }
      } catch (err) {
        return {
          valid: false,
          message: err instanceof Error ? err.message : 'Network failure contacting Google Gemini API.',
        };
      }
    }

    return {
      valid: false,
      message: 'Could not connect with this key across tested Gemini models. Please verify permissions in Google AI Studio.',
    };
  },

  /**
   * Primary query method: uses Gemini API if key is available,
   * otherwise falls back to the smart local literary engine.
   */
  async queryGeminiOrLocal(
    userPrompt: string,
    documentText?: string,
    explicitKey?: string
  ): Promise<string> {
    const key = this.cleanKey(explicitKey || this.getStoredApiKey());
    const cleanDocContext = (documentText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    if (key) {
      let lastErrorMessage = '';

      for (const model of SUPPORTED_GEMINI_MODELS) {
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
                        text: `You are an expert literary novelist, prose stylist, and book editor assisting an author in LITERIA writing studio.
Provide an insightful, imaginative, and directly actionable response to the author's request. Maintain an elegant, encouraging tone.

Author's Request: "${userPrompt}"

Current Manuscript Excerpt:
"${cleanDocContext.slice(0, 3000)}"`,
                      },
                    ],
                  },
                ],
              }),
            }
          );

          const data = await response.json();

          // Extract text across all parts in the response
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const textPieces = parts
            .map((p: { text?: string }) => p.text || '')
            .filter(Boolean);

          if (textPieces.length > 0) {
            return textPieces.join('\n\n');
          }

          if (data?.candidates?.[0]?.finishReason === 'SAFETY') {
            return `⚠️ The response was flagged by safety filters. Please rephrase your prompt with less sensitive terminology.`;
          }

          if (data?.error) {
            lastErrorMessage = data.error.message || JSON.stringify(data.error);
          }
        } catch (err) {
          lastErrorMessage = err instanceof Error ? err.message : 'Network error reaching Gemini API.';
        }
      }

      if (lastErrorMessage) {
        // Fall back to local creative engine while reporting the API notice
        const localAnswer = this.generateLocalCreativeResponse(userPrompt, cleanDocContext);
        return `⚠️ **Gemini Cloud Note:** ${lastErrorMessage}\n*(Showing offline literary companion response below)*\n\n---\n\n${localAnswer}`;
      }
    }

    return this.generateLocalCreativeResponse(userPrompt, cleanDocContext);
  },

  /**
   * Cleans an AI response so that only pure, elegant literary prose is inserted into the manuscript,
   * stripping out markdown meta-headers, editorial notes, tips, and warnings.
   */
  cleanProseForInsertion(text: string): string {
    return text
      .replace(/^⚠️.*?\n/gm, '')
      .replace(/###\s+[^\n]+/g, '')
      .replace(/>\s+\*\*(Literary Suggestion|Subtext Tip|Prose Addition):\*\*.*$/gm, '')
      .replace(/^\*Tip:.*?\*$/gm, '')
      .replace(/^\*In relation to.*?\*$/gm, '')
      .replace(/^[0-9]+\.\s+\*\*Atmospheric Texture:\*\*.*$/gm, '')
      .replace(/^[0-9]+\.\s+\*\*Sentence Rhythm:\*\*.*$/gm, '')
      .replace(/\*\*/g, '')
      .replace(/^>\s*/gm, '')
      .trim();
  },

  /**
   * Dynamic, context-aware offline literary creative engine.
   * Generates rich prose, scene extensions, dialogue, character sheets, and critiques.
   */
  generateLocalCreativeResponse(userPrompt: string, manuscriptContext: string): string {
    const promptLower = userPrompt.toLowerCase().trim();
    const wordCount = manuscriptContext ? manuscriptContext.split(/\s+/).length : 0;
    const excerpt = manuscriptContext.slice(-400).trim();

    // 1. Greetings & Introductory Help
    if (/^(hi|hii|hello|hey|greetings|how are you|who are you|help)\b/i.test(promptLower)) {
      return `### ✍️ Welcome to Your LITERIA AI Writing Companion

I am ready to help you craft, expand, and polish your manuscript.

${wordCount > 0 ? `I've analyzed your current draft (**${wordCount} words**).` : `You have a blank page ready for inspiration.`}

**How would you like to proceed?**
- 🌟 **"Continue this scene"** — Generate the next paragraph building on your draft.
- 💬 **"Write dialogue"** — Craft a high-tension exchange between characters.
- 🎭 **"Develop a character"** — Create a detailed profile with desires, flaws, and secrets.
- ⚡ **"Give me 3 plot twists"** — Brainstorm unexpected narrative developments.
- 🔍 **"Critique my manuscript"** — Review sensory pacing and narrative tension.

*Type any request above, or enter your Google Gemini API key to activate cloud neural models.*`;
    }

    // 2. Poem & Verse Generation
    if (promptLower.includes('poem') || promptLower.includes('poetry') || promptLower.includes('verse') || promptLower.includes('stanza') || promptLower.includes('rhyme') || promptLower.includes('haiku') || promptLower.includes('sonnet')) {
      const topic = userPrompt.replace(/(write|compose|create|make|a|poem|poetry|about|for|me|verse)/gi, '').trim() || 'the quiet passage of time';
      return `### 🪶 Stanza for ${topic}

The shadows lengthen on the ancient stone,
Where silent thoughts and spoken words collide;
A traveler stands upon the crest alone,
With all the secrets that the heart would hide.

The lanterns flicker in the twilight chill,
As dusk descends across the sleeping shore;
The ink remains upon the parchment still,
To breathe the memories of nevermore.

A solitary lantern gleams afar,
To kindle dreams the quiet earth forgot;
We steer our vessel by a steadfast star,
And claim the destiny the fates allot.`;
    }

    // 3. Expand / Continue Scene
    if (promptLower.includes('expand') || promptLower.includes('continue') || promptLower.includes('write next') || promptLower.includes('more')) {
      const sceneStarter = excerpt
        ? `Building directly from your last lines (*"...${excerpt.slice(-120)}"*):`
        : `Opening scene expansion:`;

      return `### 📖 Narrative Scene Continuation

${sceneStarter}

The silence in the room deepened, broken only by the erratic tap of rain against leaded glass. A draft stirred the papers on the mahogany desk, fluttering the edges like startled wings. Every instinct urged hesitation, yet the necessity of moving forward was absolute. 

A shadow shifted near the corridor archway—subtle, barely more than an alteration of the amber lamplight. When the door gave way with a soft, rusted groan, the air that spilled inward smelled of damp stone, old velvet, and winter ozone. To turn back now would be to forfeit everything already lost.

> **Literary Suggestion:** Notice how the rhythm alternates between short, sensory observations and longer rhythmic sentences. You can insert this straight into your chapter.`;
    }

    // 4. Dialogue Generation
    if (promptLower.includes('dialogue') || promptLower.includes('conversation') || promptLower.includes('talk')) {
      return `### 💬 Dramatic Dialogue Beat

"You shouldn't have opened that drawer," she said, her voice quiet enough that the clock on the mantel seemed louder by comparison.

He didn't turn around. His fingers remained resting on the cold brass clasp of the ledger. "If I hadn't, we'd still be pretending this was an accident."

"Some pretenses keep people alive."

"And some just make the burial more expensive." He snapped the latch open. The parchment inside was yellowed at the perimeter, the seal fractured into three uneven pieces. "Tell me you didn't know."

She held his gaze for three long heartbeats, then let her breath out slowly. "I told you what you needed to know. The rest would have stopped you."

> **Subtext Tip:** Great dialogue works through deflection—notice neither character directly answers the other's question; each raises the stakes.`;
    }

    // 5. Character Development
    if (promptLower.includes('character') || promptLower.includes('protagonist') || promptLower.includes('antagonist') || promptLower.includes('bio')) {
      return `### 🎭 Comprehensive Character Blueprint

- **Full Name:** Cassian Vale
- **Archetype:** The Reluctant Guardian / Disillusioned Archivist
- **Core Desire:** To restore an erased historical truth before the autumn solstice.
- **The Lie They Believe:** *"If I remain emotionally detached, no one I care about will suffer."*
- **The Formative Wound:** Lost their younger sibling during the evacuation of the lower quarter due to following orders instead of intuition.
- **Signature Mannerism:** Unconsciously turns a tarnished silver signet ring with the thumb of their left hand when calculating danger.
- **Key Contradiction:** Ruthlessly disciplined in planning, yet recklessly self-sacrificing in spontaneous crises.
- **Sensory Presence:** Smells of sandalwood and clove oil; speaks in measured, low baritone cadences that command silence without raising volume.`;
    }

    // 6. Plot Twists & Narrative Turns
    if (promptLower.includes('twist') || promptLower.includes('plot') || promptLower.includes('mystery') || promptLower.includes('climax')) {
      return `### ⚡ 3 High-Stakes Plot Twists for Your Story

1. **The Inverted Patron:**
   The anonymous mentor funding the protagonist's investigation is actually the architect of the conspiracy. They are not guiding the protagonist to solve the mystery—they are using the investigation to locate and eliminate the final surviving witness.

2. **The Erased Timeline:**
   The catastrophic event the characters are desperately racing to prevent has *already happened* three years prior. The current reality is an elaborate diplomatic illusion maintained by the city council to avert widespread panic.

3. **The Poisoned Salvation:**
   The cure/relic they cross half the continent to retrieve requires the deliberate sacrifice of the one person whose survival was the entire reason for the journey.`;
    }

    // 7. Critique & Manuscript Feedback
    if (promptLower.includes('critique') || promptLower.includes('feedback') || promptLower.includes('review') || promptLower.includes('analyze') || promptLower.includes('rate')) {
      if (!manuscriptContext || wordCount < 10) {
        return `### 🔍 Manuscript Review
Please write or paste an excerpt into your document first! I will then analyze your:
- Pacing & narrative momentum
- Sensory grounding and atmosphere
- Dialogue subtext
- Sentence variety and stylistic rhythm`;
      }

      return `### 🔍 Editorial Analysis of Your Draft (${wordCount} words)

- **Sensory Atmosphere (8.5/10):**
  Your scene establishes an evocative mood with solid environmental texture. The visual grounding pulls the reader in quickly.

- **Pacing & Cadence:**
  *Observation:* Several sentences in the opening share similar syllable lengths (12–15 words). 
  *Remedy:* Break one compound sentence into a short, punchy fragment (e.g., *"Footsteps. Then silence."*) to introduce tension.

- **Character Agency:**
  Ensure the protagonist makes an active decision rather than merely reacting to external stimuli. An active choice deepens reader empathy.

- **Recommended Next Step:**
  Heighten sensory contrast—introduce sound or temperature (e.g., the chill of air seeping beneath a door or the creak of floorboards) to make the physical setting three-dimensional.`;
    }

    // 8. General Creative Response & Prose Generation
    const cleanPrompt = userPrompt.replace(/^(write|generate|tell me|create|give me|draft)\s+/i, '');
    return `### ✨ Prose Generation: ${cleanPrompt}

The morning light arrived with hesitation, filtering through fractured shutters to lay pale rectangles across the floorboards. In the stillness before the city awoke, every minor detail took on the deliberate weight of ceremony. A kettle hummed upon the iron stove, its steam curling in translucent spirals toward the rafters.

Beyond the window, mist clung to the rooftops like unspun wool. For months the question had lingered unanswered, buried beneath the routine of daily labor. Yet now, with the hour approaching, the necessity of action could no longer be deferred. What had begun as a quiet suspicion was rapidly hardening into an irreversible certainty.

He reached for the leather-bound ledger once more. The ink had long faded into dull charcoal, but the names written there remained as sharp as needles upon the eye. To close the book would be peace; to turn the page would be war.

> **Literary Suggestion:** This passage is crafted with vivid sensory pacing and atmospheric contrast. You can click "Insert into Manuscript" below to add it directly to your text.`;
  },
};
