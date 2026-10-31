import { jsPDF } from 'jspdf';
import type { PrintManuscriptSection } from './printManuscript';

export interface GeneratePdfOptions {
  title: string;
  subtitle?: string;
  author: string;
  genre?: string;
  date?: string;
  sections: PrintManuscriptSection[];
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
  type: 'p' | 'h1' | 'h2' | 'h3' | 'quote' | 'li';
}

/**
 * Parses HTML content into clean blocks of text with types (p, h1, h2, h3, quote, li).
 * Robustly traverses wrapper divs and extracts every paragraph and dialogue line distinctly.
 */
export function parseHtmlToBlocks(html: string): ManuscriptBlock[] {
  if (!html || !html.trim()) return [];

  // Replace <br> variants with newline character so internal line breaks are preserved
  const normalizedHtml = html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ');

  if (typeof window === 'undefined') {
    return normalizedHtml
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((text) => ({ text, type: 'p' }));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${normalizedHtml}</body>`, 'text/html');
  const blocks: ManuscriptBlock[] = [];

  const traverse = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        blocks.push({ text: line, type: 'p' });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Heading elements
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const text = el.textContent?.trim();
        if (text) {
          const type = tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3';
          blocks.push({ text, type });
        }
        return;
      }

      // Blockquotes
      if (tag === 'blockquote') {
        const text = el.textContent || '';
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          blocks.push({ text: line, type: 'quote' });
        }
        return;
      }

      // List items
      if (tag === 'li') {
        const text = el.textContent?.trim();
        if (text) {
          blocks.push({ text: `• ${text}`, type: 'li' });
        }
        return;
      }

      // Horizontal dividers / asterisms
      if (tag === 'hr') {
        blocks.push({ text: '* * *', type: 'p' });
        return;
      }

      // Paragraph elements
      if (tag === 'p') {
        const text = el.textContent || '';
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          blocks.push({ text: line, type: 'p' });
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
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        blocks.push({ text: line, type: 'p' });
      }
    }
  };

  for (let i = 0; i < doc.body.childNodes.length; i++) {
    traverse(doc.body.childNodes[i]);
  }

  // Fallback if no block elements were detected (e.g. pure raw unformatted text)
  if (blocks.length === 0) {
    const rawLines = normalizedHtml
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of rawLines) {
      blocks.push({ text: line, type: 'p' });
    }
  }

  return blocks;
}

/**
 * Generates a real, standard, multi-page PDF binary file for printing and reading.
 */
export async function generateManuscriptPdfBlob(options: GeneratePdfOptions): Promise<Blob> {
  const {
    title,
    subtitle,
    author,
    genre,
    date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    sections,
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
  const margin = 22; // 22mm margin
  const contentWidth = pageWidth - margin * 2; // 166mm
  const bottomThreshold = pageHeight - margin - 15;

  let currentPage = 1;

  // 1. Render Elegant Cover Page
  pdf.setFont('times', 'bold');
  pdf.setFontSize(26);
  pdf.setTextColor(30, 25, 20);

  const titleLines = pdf.splitTextToSize(title, contentWidth);
  let coverY = 85;
  pdf.text(titleLines, pageWidth / 2, coverY, { align: 'center' });
  coverY += titleLines.length * 10;

  if (subtitle) {
    pdf.setFont('times', 'italic');
    pdf.setFontSize(14);
    pdf.setTextColor(80, 75, 70);
    const subLines = pdf.splitTextToSize(subtitle, contentWidth);
    pdf.text(subLines, pageWidth / 2, coverY + 4, { align: 'center' });
    coverY += subLines.length * 8;
  }

  // Cover Rule
  pdf.setDrawColor(180, 160, 140);
  pdf.setLineWidth(0.4);
  pdf.line(pageWidth / 2 - 30, coverY + 8, pageWidth / 2 + 30, coverY + 8);
  coverY += 20;

  // Author & Metadata
  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(40, 35, 30);
  pdf.text(`By ${author}`, pageWidth / 2, coverY, { align: 'center' });
  coverY += 8;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(110, 105, 100);
  if (genre) {
    pdf.text(`Genre: ${genre}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 6;
  }
  pdf.text(date, pageWidth / 2, coverY, { align: 'center' });

  // 2. Render Chapters & Content
  sections.forEach((section, sIdx) => {
    // Start each section/chapter on a fresh page
    pdf.addPage();
    currentPage++;

    let y = margin + 5;

    // Chapter Header (if multi-chapter or custom title)
    const showHeader = section.title && (sections.length > 1 || section.title !== title);
    if (showHeader) {
      pdf.setFont('times', 'bold');
      pdf.setFontSize(17);
      pdf.setTextColor(35, 30, 25);
      const chLines = pdf.splitTextToSize(section.title!, contentWidth);
      pdf.text(chLines, pageWidth / 2, y, { align: 'center' });
      y += chLines.length * 8 + 8;
    }

    const blocks = parseHtmlToBlocks(section.contentHtml || '');

    blocks.forEach((block) => {
      let fontSize = 11;
      let fontStyle: 'normal' | 'bold' | 'italic' = 'normal';
      let fontColor = [35, 30, 25];
      let extraPadding = 3.5;

      if (block.type === 'h1') {
        fontSize = 15;
        fontStyle = 'bold';
        extraPadding = 5;
      } else if (block.type === 'h2') {
        fontSize = 13;
        fontStyle = 'bold';
        extraPadding = 4;
      } else if (block.type === 'h3') {
        fontSize = 12;
        fontStyle = 'bold';
        extraPadding = 3;
      } else if (block.type === 'quote') {
        fontSize = 10.5;
        fontStyle = 'italic';
        fontColor = [85, 75, 65];
        extraPadding = 3.5;
      }

      pdf.setFont('times', fontStyle);
      pdf.setFontSize(fontSize);
      pdf.setTextColor(fontColor[0], fontColor[1], fontColor[2]);

      const lineSpacing = fontSize * 0.3528 * 1.35; // Standard 1.35x line height in mm (~5.24mm for 11pt)
      const lines = pdf.splitTextToSize(block.text, contentWidth);

      // Print each line with safe page boundary overflow handling
      lines.forEach((line: string) => {
        if (y + lineSpacing > bottomThreshold) {
          pdf.addPage();
          currentPage++;
          y = margin + 5;
        }
        pdf.text(line, margin, y);
        y += lineSpacing;
      });

      // Extra space between paragraphs / dialogue blocks
      y += extraPadding;
    });

    // If last section, render signature block
    if (sIdx === sections.length - 1 && signature?.enabled && signature.typedName) {
      if (y + 35 > bottomThreshold) {
        pdf.addPage();
        currentPage++;
        y = margin + 5;
      } else {
        y += 10;
      }

      pdf.setDrawColor(180, 170, 160);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, margin + 60, y);
      y += 6;

      pdf.setFont('times', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(40, 35, 30);
      pdf.text(signature.typedName, margin, y);
      y += 5;

      pdf.setFont('times', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120, 115, 110);
      pdf.text(`Signed Author • ${signature.date || date}`, margin, y);
    }
  });

  // 3. Post-process all pages: Add Watermarks & Page Numbers
  const totalPages = pdf.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);

    // Apply diagonal watermark across background if enabled
    if (watermark?.enabled && watermark.text?.trim()) {
      pdf.saveGraphicsState();
      pdf.setTextColor(215, 210, 205);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(36);
      pdf.text(watermark.text.trim(), pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
      });
      pdf.restoreGraphicsState();
    }

    // Add page number (Skip on Cover Page #1)
    if (p > 1) {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(140, 135, 130);
      pdf.text(`${p - 1}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
    }
  }

  // Return standard compliant PDF binary Blob
  return pdf.output('blob');
}
