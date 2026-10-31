import { jsPDF } from 'jspdf';
import type { PrintManuscriptSection } from './printManuscript';

export interface GeneratePdfOptions {
  title: string;
  subtitle?: string;
  author: string;
  genre?: string;
  date?: string;
  sections: PrintManuscriptSection[];
  fontFamily?: string;
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

export interface ManuscriptBlock {
  text: string;
  type: 'p' | 'h1' | 'h2' | 'h3' | 'quote' | 'li' | 'hr';
  align?: 'left' | 'center' | 'right';
}

/**
 * Converts HTML content to exact plain text without changing a single whitespace.
 * Preserves every leading space, tab, consecutive spaces, blank lines, and line breaks.
 */
export function htmlToExactPlainText(html: string): string {
  if (!html) return '';

  if (typeof window === 'undefined') {
    return html
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  let result = '';

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // PRESERVE EXACT TEXT CONTENT - ZERO TRIMMING, ZERO MODIFICATION
      result += node.textContent || '';
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        result += '\n';
        return;
      }

      const isBlock = [
        'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'li', 'blockquote', 'tr', 'hr'
      ].includes(tag);

      for (let i = 0; i < el.childNodes.length; i++) {
        walk(el.childNodes[i]);
      }

      if (isBlock) {
        result += '\n';
      }
    }
  };

  for (let i = 0; i < doc.body.childNodes.length; i++) {
    walk(doc.body.childNodes[i]);
  }

  if (result.endsWith('\n')) {
    result = result.slice(0, -1);
  }

  return result;
}

/**
 * Parses HTML content into clean blocks of text with types (p, h1, h2, h3, quote, li).
 * Preserves all whitespaces, indentation, spaces, and line breaks without trimming.
 */
export function parseHtmlToBlocks(html: string): ManuscriptBlock[] {
  if (!html) return [];

  // Replace <br> variants with newline character so internal line breaks are preserved
  const normalizedHtml = html.replace(/<br\s*[\/]?>/gi, '\n');

  if (typeof window === 'undefined') {
    return normalizedHtml
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((text) => ({ text, type: 'p', align: 'left' }));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${normalizedHtml}</body>`, 'text/html');
  const blocks: ManuscriptBlock[] = [];

  const getAlign = (el: HTMLElement): 'left' | 'center' | 'right' => {
    const textAlign = el.style?.textAlign?.toLowerCase() || el.getAttribute('align')?.toLowerCase();
    if (textAlign === 'center') return 'center';
    if (textAlign === 'right') return 'right';
    return 'left';
  };

  const traverse = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const lines = text.split('\n');
      for (const line of lines) {
        blocks.push({ text: line, type: 'p', align: 'left' });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const align = getAlign(el);

      // Heading elements
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const text = el.textContent || '';
        const type = tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3';
        blocks.push({ text, type, align });
        return;
      }

      // Blockquotes
      if (tag === 'blockquote') {
        const text = el.textContent || '';
        const lines = text.split('\n');
        for (const line of lines) {
          blocks.push({ text: line, type: 'quote', align });
        }
        return;
      }

      // List items
      if (tag === 'li') {
        const text = el.textContent || '';
        blocks.push({ text: `•  ${text}`, type: 'li', align });
        return;
      }

      // Horizontal dividers / asterisms
      if (tag === 'hr') {
        blocks.push({ text: '*   *   *', type: 'hr', align: 'center' });
        return;
      }

      // Paragraph elements
      if (tag === 'p') {
        let pText = '';
        const walkP = (pChild: Node) => {
          if (pChild.nodeType === Node.TEXT_NODE) {
            pText += pChild.textContent || '';
          } else if (pChild.nodeType === Node.ELEMENT_NODE) {
            if ((pChild as HTMLElement).tagName.toLowerCase() === 'br') {
              pText += '\n';
            } else {
              for (let j = 0; j < pChild.childNodes.length; j++) {
                walkP(pChild.childNodes[j]);
              }
            }
          }
        };
        for (let j = 0; j < el.childNodes.length; j++) {
          walkP(el.childNodes[j]);
        }

        const lines = pText.split('\n');
        for (const line of lines) {
          blocks.push({ text: line, type: 'p', align });
        }
        return;
      }

      // Containers (div, section, article, main, table, etc.):
      // Check if it contains block-level child elements
      const hasBlockChildren =
        el.querySelector('p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, li, div, hr, table') !== null;

      if (hasBlockChildren) {
        for (let i = 0; i < el.childNodes.length; i++) {
          traverse(el.childNodes[i]);
        }
        return;
      }

      // Leaf container element without nested block children
      const text = el.textContent || '';
      const lines = text.split('\n');
      for (const line of lines) {
        blocks.push({ text: line, type: 'p', align });
      }
    }
  };

  for (let i = 0; i < doc.body.childNodes.length; i++) {
    traverse(doc.body.childNodes[i]);
  }

  return blocks;
}

/**
 * Generates a clean, authentic manuscript PDF matching Literia's editor writing sheet.
 * Preserves exact whitespace, paragraph spacing, dialogue formatting, and Literia's
 * distinctive title accent underline and styling without forced cover page push.
 */
export async function generateManuscriptPdfBlob(options: GeneratePdfOptions): Promise<Blob> {
  const {
    title,
    subtitle,
    author,
    genre,
    date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    sections,
    fontFamily = 'serif',
    includeCoverPage = false,
    watermark,
    signature,
  } = options;

  // Standard A4 portrait: 210mm x 297mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20; // 20mm margin (matches reading sheet margins)
  const contentWidth = pageWidth - margin * 2; // 170mm
  const bottomThreshold = pageHeight - margin - 12;

  // Resolve standard PDF font matching app appearance
  let pdfFont = 'times';
  if (fontFamily === 'mono') {
    pdfFont = 'courier';
  } else if (fontFamily === 'sans' || fontFamily === 'modern') {
    pdfFont = 'helvetica';
  } else {
    pdfFont = 'times'; // serif, classic, handwriting
  }

  let y = margin + 4;
  const shouldRenderCover = includeCoverPage && sections.length > 1;

  if (shouldRenderCover) {
    // Render Book Title Cover Page only for multi-chapter compilation when requested
    pdf.setFont(pdfFont, 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(28, 25, 23); // #1c1917

    const titleLines = pdf.splitTextToSize(title, contentWidth);
    let coverY = 85;
    pdf.text(titleLines, pageWidth / 2, coverY, { align: 'center' });
    coverY += titleLines.length * 10;

    // Literia Accent Bar on Cover
    pdf.setFillColor(217, 119, 6);
    pdf.roundedRect(pageWidth / 2 - 16, coverY + 4, 32, 1.4, 0.7, 0.7, 'F');
    coverY += 16;

    if (subtitle) {
      pdf.setFont(pdfFont, 'italic');
      pdf.setFontSize(14);
      pdf.setTextColor(87, 83, 78);
      const subLines = pdf.splitTextToSize(subtitle, contentWidth);
      pdf.text(subLines, pageWidth / 2, coverY, { align: 'center' });
      coverY += subLines.length * 8 + 6;
    }

    if (author) {
      pdf.setFont(pdfFont, 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(40, 35, 30);
      pdf.text(`By ${author}`, pageWidth / 2, coverY, { align: 'center' });
      coverY += 8;
    }

    pdf.setFont(pdfFont, 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(120, 113, 108);
    if (genre) {
      pdf.text(`Genre: ${genre}`, pageWidth / 2, coverY, { align: 'center' });
      coverY += 6;
    }
    pdf.text(date, pageWidth / 2, coverY, { align: 'center' });

    // Transition to Chapter 1
    pdf.addPage();
    y = margin + 5;
  } else {
    // START DIRECTLY ON PAGE 1: EXACT MATCH TO APP'S MANUSCRIPT SHEET
    // 1. Prominent Document Title
    pdf.setFont(pdfFont, 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(28, 25, 23); // #1c1917
    const titleLines = pdf.splitTextToSize(title, contentWidth);
    titleLines.forEach((tLine: string) => {
      pdf.text(tLine, margin, y);
      y += 8.5;
    });

    // 2. Literia Signature Amber Accent Pill Bar (matches editor UI: h-0.5 w-16 bg-amber-600)
    pdf.setFillColor(217, 119, 6); // #d97706
    pdf.roundedRect(margin, y, 22, 1.2, 0.6, 0.6, 'F');
    y += 5.5;

    // 3. Author Byline & Date
    if (author && author.trim()) {
      pdf.setFont(pdfFont, 'italic');
      pdf.setFontSize(9.5);
      pdf.setTextColor(120, 113, 108); // #78716c
      const byline = subtitle
        ? `${subtitle} • By ${author} • ${date}`
        : `By ${author} • ${date}`;
      pdf.text(byline, margin, y);
      y += 7;
    }

    // Natural vertical breathing space before prose begins
    y += 4;
  }

  // Render Manuscript Sections / Chapters
  sections.forEach((section, sIdx) => {
    // In multi-chapter manuscripts, start subsequent chapters on a new page
    if (sIdx > 0) {
      pdf.addPage();
      y = margin + 5;
    }

    // Chapter Header (if multi-chapter or distinct title)
    const showHeader = section.title && (sections.length > 1 || section.title !== title);
    if (showHeader) {
      pdf.setFont(pdfFont, 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(28, 25, 23);
      const chLines = pdf.splitTextToSize(section.title!, contentWidth);
      chLines.forEach((cLine: string) => {
        pdf.text(cLine, margin, y);
        y += 7;
      });
      // Chapter accent dot / mini-line
      pdf.setFillColor(217, 119, 6);
      pdf.roundedRect(margin, y, 14, 0.9, 0.45, 0.45, 'F');
      y += 6;
    }

    const blocks = parseHtmlToBlocks(section.contentHtml || '');

    blocks.forEach((block) => {
      // Horizontal Rule / Asterism Divider
      if (block.type === 'hr' || block.text === '*   *   *' || block.text === '* * *') {
        if (y + 12 > bottomThreshold) {
          pdf.addPage();
          y = margin + 5;
        }
        y += 3;
        pdf.setFont(pdfFont, 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(168, 162, 158); // #a8a29e
        pdf.text('*   *   *', pageWidth / 2, y, { align: 'center' });
        y += 7;
        return;
      }

      let fontSize = 11.5; // App standard comfortable font size
      let fontStyle: 'normal' | 'bold' | 'italic' = 'normal';
      let fontColor = [28, 25, 23]; // #1c1917
      let extraPadding = 4.5; // 4.5mm paragraph spacing matching editor.css
      let indent = 0;
      let effectiveWidth = contentWidth;

      if (block.type === 'h1') {
        fontSize = 18;
        fontStyle = 'bold';
        extraPadding = 5;
        if (y + 22 > bottomThreshold) {
          pdf.addPage();
          y = margin + 5;
        }
      } else if (block.type === 'h2') {
        fontSize = 15;
        fontStyle = 'bold';
        extraPadding = 4;
        if (y + 18 > bottomThreshold) {
          pdf.addPage();
          y = margin + 5;
        }
      } else if (block.type === 'h3') {
        fontSize = 13;
        fontStyle = 'bold';
        extraPadding = 3.5;
        if (y + 15 > bottomThreshold) {
          pdf.addPage();
          y = margin + 5;
        }
      } else if (block.type === 'quote') {
        fontSize = 11;
        fontStyle = 'italic';
        fontColor = [87, 83, 78]; // #57534e
        extraPadding = 4;
        indent = 6.5; // indent 6.5mm for the amber border
        effectiveWidth = contentWidth - indent;
      } else if (block.type === 'li') {
        fontSize = 11.5;
        fontStyle = 'normal';
        extraPadding = 2.5;
        indent = 4.5;
        effectiveWidth = contentWidth - indent;
      }

      pdf.setFont(pdfFont, fontStyle);
      pdf.setFontSize(fontSize);
      pdf.setTextColor(fontColor[0], fontColor[1], fontColor[2]);

      // 1.6x line height (comfortable, breathable literary line height matching editor)
      const lineSpacing = fontSize * 0.3528 * 1.6;

      // Handle empty string line (author intentional blank line)
      if (block.text === '') {
        y += lineSpacing;
        return;
      }

      const lines = pdf.splitTextToSize(block.text, effectiveWidth);
      const startQuoteY = y;

      lines.forEach((line: string) => {
        if (y + lineSpacing > bottomThreshold) {
          pdf.addPage();
          y = margin + 5;
        }

        const printX = margin + indent;
        if (block.align === 'center') {
          pdf.text(line, pageWidth / 2, y, { align: 'center' });
        } else if (block.align === 'right') {
          pdf.text(line, pageWidth - margin, y, { align: 'right' });
        } else {
          pdf.text(line, printX, y);
        }
        y += lineSpacing;
      });

      // If blockquote, draw the iconic Literia amber left border line
      if (block.type === 'quote' && lines.length > 0) {
        const endQuoteY = y - lineSpacing + 2;
        pdf.setDrawColor(217, 119, 6); // #d97706
        pdf.setLineWidth(0.75);
        pdf.line(margin + 1.5, startQuoteY - 2.5, margin + 1.5, endQuoteY);
      }

      // Spacing after paragraph / block
      y += extraPadding;
    });

    // Signature Block if enabled
    if (sIdx === sections.length - 1 && signature?.enabled && signature.typedName) {
      if (y + 35 > bottomThreshold) {
        pdf.addPage();
        y = margin + 5;
      } else {
        y += 8;
      }

      // Amber top border line
      pdf.setDrawColor(217, 119, 6);
      pdf.setLineWidth(0.6);
      pdf.line(margin, y, margin + 55, y);
      y += 6;

      // Typed signature name in bold
      pdf.setFont(pdfFont, 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(28, 25, 23);
      pdf.text(signature.typedName, margin, y);
      y += 5;

      // Metadata
      pdf.setFont(pdfFont, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120, 113, 108);
      pdf.text(`Signed Author • ${signature.date || date}`, margin, y);
    }
  });

  // Post-processing: Running Headers, Page Numbers, Watermarks
  const totalPages = pdf.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);

    // Diagonal Watermark if enabled
    if (watermark?.enabled && watermark.text?.trim()) {
      pdf.saveGraphicsState();
      pdf.setTextColor(225, 220, 215);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(36);
      pdf.text(watermark.text.trim(), pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
      });
      pdf.restoreGraphicsState();
    }

    // Running Header on Pages 2+ (Subtle title & hairline rule)
    if (p > 1 && (!shouldRenderCover || p > 2)) {
      pdf.setFont(pdfFont, 'italic');
      pdf.setFontSize(8.5);
      pdf.setTextColor(168, 162, 158); // #a8a29e
      pdf.text(title, margin, margin - 6);
      pdf.setDrawColor(231, 229, 228); // #e7e5e4
      pdf.setLineWidth(0.2);
      pdf.line(margin, margin - 4, pageWidth - margin, margin - 4);
    }

    // Bottom Centered Page Number (on all pages or after cover)
    if (!shouldRenderCover || p > 1) {
      const pageNumStr = shouldRenderCover ? `${p - 1}` : `${p}`;
      pdf.setFont(pdfFont, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(168, 162, 158);
      pdf.text(pageNumStr, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  }

  // Return standard compliant PDF binary Blob
  return pdf.output('blob');
}
