# LITERIA — Project Architecture, Decisions & Feature Registry

> **LIVING SPECIFICATION & AUDIT LOG**  
> *Notice: This document (`antigravity.md`) serves as the single source of truth for Literia's architecture, technology stack, established design decisions, and live feature registry. It is to be maintained and updated after each and every feature or architectural change.*

---

## 1. Project Overview

- **Project Name:** Literia (formerly Literia Studio / Litera)
- **Domain:** Distraction-Free Creative Writing Suite & Comprehensive Manuscript Studio
- **Target Audience:** Novelists, screenwriters, playwrights, poets, essayists, and long-form prose authors
- **Core Vision:** An elegant, privacy-first, offline-first digital atelier where authors own 100% of their words. It blends the typographic beauty of classic typewriter studios with cutting-edge cloud synchronization, end-to-end encryption (E2EE), AI-assisted creative ideation, and publishing-grade manuscript compilation.

---

## 2. Technology Stack

### Frontend & Application Shell
- **UI Library & Framework:** React 19 (`react: ^19.2.8`, `react-dom: ^19.2.8`)
- **Language:** TypeScript 6 (`typescript: ~6.0.2`)
- **Build Tooling & Bundler:** Vite 8 (`vite: ^8.3.0`, `@vitejs/plugin-react: ^6.1.1`)
- **Styling Engine:** Tailwind CSS v4 (`@tailwindcss/vite: ^4.3.3`, `tailwindcss: ^4.3.3`)
- **Iconography:** Lucide React (`lucide-react: ^1.51.0`)
- **Utility Libraries:** `clsx: ^2.1.1`, `tailwind-merge: ^3.7.0`
- **Linter & Code Quality:** Oxlint (`oxlint: ^1.81.0`)

### Rich Text & Typography Engine
- **Core Framework:** TipTap v3 / ProseMirror (`@tiptap/react: ^3.31.4`, `@tiptap/pm: ^3.31.4`)
- **Extensions:**
  - `@tiptap/starter-kit`: Core schema, bold, italic, strike, code, blockquote, lists, headings (H1–H4).
  - `@tiptap/extension-underline`
  - `@tiptap/extension-highlight`: Multicolor text highlighting.
  - `@tiptap/extension-color` & `@tiptap/extension-text-style`
  - `@tiptap/extension-link`: Safe link insertion.
  - `@tiptap/extension-image`: Base64 and remote inline imagery.
  - `@tiptap/extension-table`, `TableRow`, `TableCell`, `TableHeader`: Rich tabular content.
  - `@tiptap/extension-text-align`: Alignment (left, center, right, justify) across blocks.
  - `@tiptap/extension-subscript` & `@tiptap/extension-superscript`
  - `@tiptap/extension-placeholder`: Dynamic dynamic inspiration prompts.
  - `CustomHorizontalRule`: Themed ornamental dividers (asterisms, filigrees, dashed lines).

### Local Storage & Offline-First Persistence
- **Client Database:** Dexie.js v4 (`dexie: ^4.4.6`) on browser IndexedDB with relational tables:
  - `documents`: Individual manuscripts, chapters, and standalone notes.
  - `books`: Multi-chapter book projects with volume metadata and cover artwork.
  - `folders`: Hierarchical file categorization.
  - `tags`: Color-coded taxonomy tagging.
  - `characters`, `locations`, `scenes`, `timelineEvents`: Story Bible / World-building entities.
  - `activities`: Word count telemetry, writing streak metrics, and session logs.
  - `trash`: Safe-recovery deletion bin with 30-day soft retention.
- **Emergency Crash Safeguards:** Synchronous fallback snapshots in `localStorage` (`literia_snapshot_{id}` & timestamps) updated on every keystroke to survive battery loss or abrupt tab closure.

### Native Mobile Platform
- **Cross-Platform Bridge:** Capacitor 8 (`@capacitor/core: ^8.5.2`, `@capacitor/cli: ^8.5.2`, `@capacitor/android: ^8.5.2`)
- **Native Native Plugins:**
  - `@capacitor/filesystem: ^8.1.5`: Direct document saving to Android Documents / Downloads directory.
  - `@capacitor/share: ^8.0.3`: Android native intent share sheet for compiled manuscripts (.pdf, .docx, .epub, .txt).
  - `@capacitor/app: ^8.1.2`: Hardware back-button routing and app lifecycle state handling.
  - `@capacitor-firebase/authentication: ^8.5.2`: Native Android Google credential sign-in.

### Cloud Architecture, Sync & Security
- **Backend-as-a-Service:** Firebase 12 (`firebase: ^12.19.0`)
  - **Firebase Authentication:** Google OAuth 2.0 & Email/Password with dynamic signup modal fallback.
  - **Cloud Firestore:** Remote document vault for multi-device sync.
  - **Firebase Hosting:** Automated production web deployment (`literia-studio-app.web.app`).
- **Cryptographic Security (E2EE):** Client-side AES-GCM-256 encryption.
  - Master keys derived via PBKDF2 (100,000 iterations) with SHA-256 integrity signatures.
  - Ciphertext is created before transmission; Firestore stores zero plaintext.
- **Access Control:** Production-grade `firestore.rules` enforcing strict owner-scoped paths (`/users/{uid}/documents/{documentId}`), revision validation, and size guards.

### AI Writing Companion
- **Engine:** Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-pro`)
- **Capabilities:** Non-intrusive brainstorming, dialogue refinement, prose expansion, character voice generation, sensory description enhancer, and 1-click insertion into the active editor caret.

### Export & Document Compilation
- **PDF Generation:** `jspdf: ^4.2.1` with custom styling, headers, footers, pagination, cover artwork, and author signature embeds.
- **Word Processing:** `docx: ^9.14.0` producing clean native `.docx` files formatted to industry standard submission guidelines (12pt serif, 1-inch margins, double-spacing, running heads).
- **Additional Formats:** EPUB packaging, CommonMark Markdown (`.md`), HTML5 (`.html`), and Plain Text (`.txt`).

### Audio & Sensory Atmosphere
- **Web Audio Engine:** `ambientEngine.ts` generating real-time algorithmic audio loops (Gentle Rain, Library Fireplace, Coastal Waves, Coffee Shop, Forest Birds, Brown/Pink Noise) directly synthesized without external network bandwidth.

---

## 3. Core Architectural Decisions & Invariants

| Decision | Rationale | Invariant |
|---|---|---|
| **Local-First Authority** | Authors often write in cabins, planes, or areas with spotty connectivity. | The local IndexedDB is the authoritative single source of truth. Remote synchronization runs asynchronously in the background. |
| **Zero Data Loss Invariant** | Losing an author's prose is unacceptable under any circumstance. | Keystrokes are buffered in an in-memory ref, debounced to Dexie in 400ms, immediately snapshotted to `localStorage`, and flushed on `beforeunload`, `pagehide`, and `visibilitychange`. |
| **Focused Editor Immutability** | Background sync or collaboration events must never jump the cursor or erase work. | If `editor.isFocused` is true, remote sync events (`literia:document-updated`) are rejected from calling `setContent()`. |
| **Client-Side Cryptography** | Author privacy is absolute; creative manuscripts contain unreleased intellectual property. | Documents are encrypted with AES-GCM-256 on device before leaving the browser. |
| **Mobile Keyboard Adaptation** | Mobile viewports lose 40–50% vertical height when the soft keyboard is opened. | Bottom toolbars use horizontal smooth scrolling; modals use flex-column scrollable bodies with sticky action footers; popovers flip dynamically above the keyboard. |
| **Deterministic APK Distribution** | Android users require a reliable standalone APK without relying on external app stores during beta testing. | Fast local Gradle builds (`cmd /c "cd android && gradlew.bat assembleDebug"`) copy directly to root `literia-app.apk`. |
| **Decoupled Title State Invariant** | Editing document title must never be wiped by editor debounces, background sync echoes, or component re-renders. | Title uses dedicated `titleSaveTimeoutRef`, synchronous `titleRef`, and `titleInputRef` focus protection. `useEffect([activeDocument])` guards against overwriting the same loaded document ID. Title commits immediately on `onBlur` or Enter, keeping React state, AppContext, Dexie, and Cloud Vault in perfect lockstep. |

---

## 4. Live Feature Registry (Developed & Operational)

### ✍️ Core Rich Text Writing Suite
- [x] **Distraction-Free Workspace:** Minimalist canvas with adjustable margins, page-view simulation, and customizable max-width.
- [x] **Typographic Styling:** Bold, italic, underline, strike, inline code, blockquotes, callout panels, headings 1–4, text colors, and background highlights.
- [x] **Text Alignment & Spacing:** Left, center, right, and full justify alignment options.
- [x] **Lists & Tables:** Bulleted lists, numbered lists, nested lists, and full table creation with row/column insertion and deletion.
- [x] **Ornamental Dividers:** Custom horizontal rules featuring asterisms (`* * *`), flourishes, and minimalist rules.
- [x] **Typewriter Mode:** Centers the active line of writing in the vertical middle of the screen as you type.
- [x] **Zen / Focus HUD Mode:** Strips away sidebars, headers, and UI distractions, leaving only the author and their words.
- [x] **Find & Replace:** Full-text in-document search with regex support, case-matching, and sequential or bulk replacement.
- [x] **Word Count & Telemetry:** Real-time character counts, word counts, sentence counts, paragraph counts, estimated reading time, and speaking time.

### 📚 Manuscript & Book Hierarchy
- [x] **Book Projects:** Group multiple chapters into cohesive books with metadata (Genre, Logline, Target Word Count, Publication Status).
- [x] **Chapter Navigation & Reordering:** Intuitive chapter drawer enabling drag-and-drop or sequential reordering of scenes.
- [x] **Custom Book Covers:** Dynamic SVG and CSS book cover designer with customizable palettes, typography, and badges.
- [x] **Manuscript Compilation:** Compile all or selected chapters into a single master document for export or review.

### 🎭 Story Bible & World-Building Studio
- [x] **Character Roster:** Track character archetypes, physical descriptions, psychological traits, secrets, arcs, and relationship webs.
- [x] **World Locations:** Document fictional or real settings, sensory details, historical notes, and connected scenes.
- [x] **Scene Outliner:** Scene-by-scene plotting cards with POV, objective, conflict, outcome, and pacing meters.
- [x] **Timeline Events:** Chronological timeline tracking story beats, historical events, and flashbacks.

### 🔠 Text Transformation & Polish
- [x] **Case Handling Dialog:**
  - UPPERCASE
  - lowercase
  - Title Case (Smart Chicago Manual of Style capitalization)
  - Sentence case
  - Capitalize Each Word
  - Invert / Toggle Case
- [x] **Z-Index Layering:** Case dialog and dropdown toolbars render with proper overlay depth (`z-50`) preventing text underlap.

### 🖼️ Media & Online Image Seeker
- [x] **Unsplash Image Integration:** In-app modal querying the Unsplash high-resolution photography API.
- [x] **1-Click Image Insertion:** Embed found imagery directly into manuscripts with captions and attribution or assign directly as book cover artwork.
- [x] **Local Image Upload:** Support for base64 inline image embedding.

### 🤖 AI Writing Companion
- [x] **Non-Intrusive Drawer & Floating Action Button (FAB):** Expandable AI workspace that never covers the text.
- [x] **Creative Prompt Presets:**
  - "Continue the Scene" (predictive prose matching the author's tone)
  - "Deepen the Atmosphere & Sensory Details"
  - "Sharpen Dialogue & Subtext"
  - "Plot Doctor / Brainstorm Next Complications"
  - "Critique Prose & Highlight Clichés"
- [x] **Direct Manuscript Insertion:** 1-click button to insert generated prose directly at the active cursor position.

### 📦 Export & Publishing Engine
- [x] **PDF Export:** Standard or manuscript formatted PDF with running headers, chapter page breaks, and cover artwork.
- [x] **Word (.docx) Export:** Professional standard manuscript submission format with 1-inch margins, double line-spacing, and Times New Roman / Georgia styling.
- [x] **EPUB Export:** Standard electronic publication format compatible with Apple Books, Kindle Previewer, and Kobo.
- [x] **Markdown & Plain Text:** Clean `.md` and `.txt` files for archiving or external processing.
- [x] **Mobile Sharing:** Built-in Android intent integration sharing binary documents directly to WhatsApp, Drive, Gmail, or local Files without corruption.

### 🎵 Ambience & Focus Audio Engine
- [x] **Synthesized Soundscapes:** Rain on Window, Roaring Hearth, Forest Breeze, Distant Thunder, Coffee Shop Murmur, Ocean Tides.
- [x] **Individual Volume Sliders:** Mix and blend soundscapes to craft custom writing atmospheres.

### 🔐 Security, Cloud Sync & Identity
- [x] **Dynamic Auth & Registration Modal:** Seamless tab switching between "Sign In" and "Create Account" with automated account setup.
- [x] **Google One-Click Sign-In:** Fast sign-in via Google OAuth on both Web and Native Android.
- [x] **End-to-End Client Encryption:** Encrypts document content using AES-GCM-256 before transmission to Cloud Firestore.
- [x] **Cloud Vault Backup:** Automatic syncing of encrypted payloads with revision tracking.

### 📱 Mobile Usability & Ergonomics
- [x] **Slidable Bottom Navigation Bar:** Horizontally scrolling mobile action bar housing all formatting tools, AI tools, case conversions, and export options.
- [x] **Keyboard-Resistant Layouts:** Dynamic safe-area padding ensuring active controls remain visible when the on-screen keyboard expands.

---

## 5. Living Maintenance Protocol

To ensure this document remains accurate:
1. **Whenever a new feature is added:** Add the feature to Section 4 under the appropriate category.
2. **Whenever a dependency or architectural pattern changes:** Update Section 2 and Section 3.
3. **Whenever a bug or edge-case is permanently resolved:** Note any permanent architectural invariant in Section 3.
4. **Verification Step:** Run `npm run build` to confirm compilation before updating the registry.
