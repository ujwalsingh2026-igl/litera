export interface PrintManuscriptSection {
  title?: string;
  contentHtml: string;
}

export interface PrintManuscriptOptions {
  title: string;
  subtitle?: string;
  author: string;
  date?: string;
  genre?: string;
  sections: PrintManuscriptSection[];
  includeCoverPage?: boolean;
  watermark?: {
    enabled: boolean;
    text: string;
    opacity?: number;
  };
  signature?: {
    enabled: boolean;
    typedName: string;
    date?: string;
  };
}

/**
 * Generates clean, printer-friendly, multi-page HTML matching the app's manuscript sheet.
 * Preserves exact whitespace, paragraph spacing, dialogue formatting, and Literia's
 * distinctive title accent underline and styling.
 */
export function generateManuscriptPrintHtml(options: PrintManuscriptOptions): string {
  const {
    title,
    subtitle,
    author,
    date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    genre,
    sections,
    includeCoverPage = false,
    watermark,
    signature,
  } = options;

  const watermarkOpacity = watermark?.opacity ?? 0.1;
  const showWatermark = watermark?.enabled && watermark.text?.trim().length > 0;
  const shouldRenderCover = includeCoverPage && sections.length > 1;

  // Format sections:
  const sectionsHtml = sections
    .map((section, idx) => {
      const showSectionHeader = section.title && (sections.length > 1 || section.title !== title);
      const isSubsequent = idx > 0;
      return `
        <article class="chapter-container ${isSubsequent ? 'chapter-break' : ''}">
          ${showSectionHeader ? `<h2 class="chapter-title">${escapeHtml(section.title!)}</h2>` : ''}
          <div class="chapter-content">
            ${section.contentHtml || '<p class="empty-notice"><em>(No content in this chapter)</em></p>'}
          </div>
          ${idx < sections.length - 1 ? '<div class="scene-divider" aria-hidden="true">*   *   *</div>' : ''}
        </article>
      `;
    })
    .join('\n');

  const signatureHtml = signature?.enabled && signature.typedName?.trim().length > 0
    ? `
      <div class="signature-footer">
        <div class="sig-name">${escapeHtml(signature.typedName)}</div>
        <div class="sig-meta">
          <span>Author Signature</span>
          <span>•</span>
          <span>${signature.date || date}</span>
        </div>
      </div>
    `
    : '';

  const headerHtml = shouldRenderCover
    ? `
      <header class="cover-page">
        <h1 class="cover-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="cover-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        <hr class="cover-rule" />
        <div class="cover-author">By ${escapeHtml(author)}</div>
        ${genre ? `<div class="cover-meta">Genre: ${escapeHtml(genre)}</div>` : ''}
        <div class="cover-meta">${escapeHtml(date)}</div>
      </header>
    `
    : `
      <header class="manuscript-header">
        <h1 class="manuscript-title">${escapeHtml(title)}</h1>
        <div class="manuscript-rule"></div>
        ${author && author.trim() ? `<div class="manuscript-byline">${subtitle ? `${escapeHtml(subtitle)} • ` : ''}By ${escapeHtml(author)} • ${escapeHtml(date)}</div>` : ''}
      </header>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} — Printable Manuscript</title>
  <style>
    /* CSS Paged Media Standard for Multi-Page Printing */
    @page {
      size: A4 portrait;
      margin: 20mm 20mm 20mm 20mm;
      @bottom-center {
        content: counter(page);
        font-family: 'EB Garamond', Georgia, serif;
        font-size: 9pt;
        color: #a8a29e;
      }
    }

    ${shouldRenderCover ? `
    @page :first {
      @bottom-center {
        content: none;
      }
    }
    ` : ''}

    *, *::before, *::after {
      box-sizing: border-box;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 100% !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #1c1917 !important;
      font-family: 'EB Garamond', Georgia, 'Times New Roman', serif;
      font-size: 11.5pt;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }

    /* Fixed watermark automatically repeats on every printed page in standard CSS Paged Media */
    .watermark-container {
      position: fixed;
      top: 45%;
      left: 5%;
      right: 5%;
      transform: translateY(-50%) rotate(-30deg);
      text-align: center;
      font-size: 3.25rem;
      font-weight: 800;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: rgba(0, 0, 0, ${watermarkOpacity});
      pointer-events: none;
      z-index: 1000;
      user-select: none;
    }

    /* Clean Manuscript Opening Header (Matches Literia Writing Sheet) */
    .manuscript-header {
      margin-bottom: 2rem;
      page-break-after: avoid;
      break-after: avoid;
    }

    .manuscript-title {
      font-size: 24pt;
      font-weight: 700;
      line-height: 1.25;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.5px;
      color: #1c1917;
    }

    .manuscript-rule {
      width: 55px;
      height: 3px;
      background: #d97706;
      border-radius: 9999px;
      margin: 0.65rem 0 1rem 0;
    }

    .manuscript-byline {
      font-size: 10pt;
      font-style: italic;
      color: #78716c;
      margin-bottom: 1.5rem;
    }

    /* Cover Page (When multi-chapter book compilation is enabled) */
    .cover-page {
      min-height: 85vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 15vh 1rem 5vh 1rem;
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
    }

    .cover-title {
      font-size: 32pt;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 0.75rem;
      letter-spacing: -0.5px;
      color: #1c1917;
    }

    .cover-subtitle {
      font-size: 16pt;
      font-style: italic;
      color: #57534e;
      margin-bottom: 2rem;
      max-width: 80%;
    }

    .cover-rule {
      width: 80px;
      height: 2px;
      background: #d97706;
      margin: 1.5rem auto;
      border: none;
    }

    .cover-author {
      font-size: 13pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: #292524;
      margin-top: 1rem;
    }

    .cover-meta {
      font-size: 9.5pt;
      color: #78716c;
      margin-top: 2rem;
      letter-spacing: 0.05em;
    }

    /* Manuscript Body Flow */
    .manuscript-flow {
      height: auto !important;
      overflow: visible !important;
      position: static !important;
    }

    .chapter-container {
      height: auto !important;
      overflow: visible !important;
    }

    /* Clean break between chapters */
    .chapter-break {
      page-break-before: always;
      break-before: page;
      padding-top: 2rem;
    }

    .chapter-title {
      font-size: 18pt;
      font-weight: 700;
      text-align: left;
      margin-top: 1rem;
      margin-bottom: 1.5rem;
      letter-spacing: -0.2px;
      color: #1c1917;
      page-break-after: avoid;
      break-after: avoid;
    }

    .chapter-content {
      font-size: 11.5pt;
      line-height: 1.65;
      color: #1c1917;
    }

    /* Standard Manuscript Paragraph Formatting (Matches Literia editor.css) */
    p {
      margin-top: 0;
      margin-bottom: 0.65rem;
      line-height: 1.65;
      text-indent: 0;
      orphans: 2;
      widows: 2;
    }

    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
      break-after: avoid;
      color: #1c1917;
      font-family: inherit;
    }

    h1 { font-size: 20pt; font-weight: 700; margin: 1.5rem 0 0.75rem 0; }
    h2 { font-size: 16pt; font-weight: 600; margin: 1.25rem 0 0.5rem 0; }
    h3 { font-size: 13.5pt; font-weight: 600; margin: 1rem 0 0.5rem 0; }

    /* Blockquote with signature Literia amber border */
    blockquote {
      margin: 1rem 0;
      padding-left: 1rem;
      border-left: 3px solid #d97706;
      font-style: italic;
      color: #57534e;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    blockquote p {
      margin-bottom: 0.35rem;
      line-height: 1.6;
    }

    .scene-divider {
      text-align: center;
      margin: 2rem 0;
      color: #a8a29e;
      font-size: 12pt;
      letter-spacing: 0.4em;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    ul, ol {
      padding-left: 1.5rem;
      margin: 0.75rem 0;
    }

    li {
      margin-bottom: 0.25rem;
    }

    /* Signature Block */
    .signature-footer {
      margin-top: 3.5rem;
      padding-top: 1.25rem;
      border-top: 1.5px solid #d97706;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .sig-name {
      font-family: 'Caveat', 'Dancing Script', 'Brush Script MT', cursive, serif;
      font-size: 22pt;
      color: #1c1917;
      line-height: 1.2;
    }

    .sig-meta {
      font-size: 9pt;
      color: #78716c;
      margin-top: 6px;
      display: flex;
      gap: 6px;
      align-items: center;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @media screen {
      body {
        max-width: 800px;
        margin: 2rem auto !important;
        padding: 2.5rem !important;
        background: #ffffff !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        border-radius: 8px;
      }
    }
  </style>
</head>
<body>
  ${showWatermark ? `<div class="watermark-container">${escapeHtml(watermark!.text)}</div>` : ''}

  ${headerHtml}

  <!-- Complete Multi-Page Manuscript Content -->
  <main class="manuscript-flow">
    ${sectionsHtml}
    ${signatureHtml}
  </main>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Triggers a multi-page print operation via an isolated hidden iframe.
 * Avoids popup blockers, works seamlessly across Chromium/Safari/Firefox
 * and mobile WebView / Capacitor, without altering current UI state.
 */
export function printManuscriptHtml(htmlContent: string): void {
  // 1. Create invisible sandbox iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '10px';
  iframe.style.height = '10px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Manuscript Print Frame');

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Fallback: window.open if iframe is blocked
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(htmlContent);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    }
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Allow iframe layout and fonts to settle before invoking print
  setTimeout(() => {
    try {
      const win = iframe.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }
    } catch (err) {
      console.warn('Iframe print failed, falling back to direct window.print:', err);
      window.print();
    } finally {
      // Clean up iframe after print dialog completes or is dismissed
      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch {
          // ignore cleanup errors
        }
      }, 4000);
    }
  }, 400);
}
