import type { Editor } from '@tiptap/react';

export type CaseType = 'uppercase' | 'lowercase' | 'sentence' | 'title' | 'toggle';

/**
 * Capitalizes the first letter of each sentence while lowercasing the rest.
 */
export function toSentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^\s*|[.!?\n]\s+)([a-z\u00C0-\u024F])/g, (_, prefix, char) => prefix + char.toUpperCase());
}

/**
 * Capitalizes the first letter of each major word.
 */
export function toTitleCase(text: string): string {
  const minorWords = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at',
    'to', 'from', 'by', 'in', 'of', 'with', 'as', 'into', 'upon'
  ]);
  return text.toLowerCase().replace(/\b\w+/g, (word, index) => {
    if (index > 0 && minorWords.has(word) && index + word.length < text.length) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/**
 * Inverts the casing of every character in the string.
 */
export function toToggleCase(text: string): string {
  return text
    .split('')
    .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
    .join('');
}

/**
 * Applies case transformation to the selected text in TipTap,
 * or the active sentence / paragraph block if nothing is selected.
 */
export function transformTipTapCase(editor: Editor, type: CaseType): void {
  const { from, to, empty } = editor.state.selection;
  let targetFrom = from;
  let targetTo = to;
  let text = '';

  if (!empty) {
    text = editor.state.doc.textBetween(from, to, ' ');
  } else {
    // If no text is explicitly selected, expand to current block/paragraph
    const $from = editor.state.selection.$from;
    const parent = $from.parent;
    if (parent.isTextblock) {
      targetFrom = $from.start();
      targetTo = $from.end();
      text = parent.textContent;
    }
  }

  if (!text) return;

  let transformed = '';
  switch (type) {
    case 'uppercase':
      transformed = text.toUpperCase();
      break;
    case 'lowercase':
      transformed = text.toLowerCase();
      break;
    case 'sentence':
      transformed = toSentenceCase(text);
      break;
    case 'title':
      transformed = toTitleCase(text);
      break;
    case 'toggle':
      transformed = toToggleCase(text);
      break;
  }

  editor
    .chain()
    .focus()
    .insertContentAt({ from: targetFrom, to: targetTo }, transformed)
    .setTextSelection({ from: targetFrom, to: targetFrom + transformed.length })
    .run();
}
