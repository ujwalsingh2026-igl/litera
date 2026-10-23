import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  BorderStyle,
} from 'docx';
import type { PrintManuscriptSection } from './printManuscript';

export interface GenerateDocxOptions {
  title: string;
  subtitle?: string;
  author: string;
  genre?: string;
  date?: string;
  sections: PrintManuscriptSection[];
  signature?: {
    enabled: boolean;
    typedName: string;
    date?: string;
  };
}

/**
 * Extracts plain paragraphs and structure from HTML
 */
function extractParagraphs(html: string): string[] {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const paragraphs: string[] = [];

  const blockNodes = doc.querySelectorAll('p, h1, h2, h3, h4, blockquote, li, tr');
  if (blockNodes.length > 0) {
    blockNodes.forEach((node) => {
      const text = node.textContent?.trim();
      if (text) paragraphs.push(text);
    });
  } else {
    const raw = html.replace(/<[^>]+>/g, '\n').split('\n');
    raw.forEach((r) => {
      const trimmed = r.trim();
      if (trimmed) paragraphs.push(trimmed);
    });
  }

  return paragraphs;
}

/**
 * Generates a real, standard Microsoft Word (.docx) binary document.
 */
export async function generateManuscriptDocxBlob(options: GenerateDocxOptions): Promise<Blob> {
  const {
    title,
    subtitle,
    author,
    genre,
    date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    sections,
    signature,
  } = options;

  const docChildren: Paragraph[] = [];

  // 1. Cover Page
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1800, after: 300 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 52, // 26pt
          font: 'Georgia',
        }),
      ],
    })
  );

  if (subtitle) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 400 },
        children: [
          new TextRun({
            text: subtitle,
            italics: true,
            size: 28, // 14pt
            font: 'Georgia',
            color: '555555',
          }),
        ],
      })
    );
  }

  // Divider Rule
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        bottom: {
          color: 'CCCCCC',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { before: 200, after: 400 },
    })
  );

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 150 },
      children: [
        new TextRun({
          text: `By ${author}`,
          bold: true,
          size: 26, // 13pt
          font: 'Georgia',
        }),
      ],
    })
  );

  if (genre) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 50, after: 100 },
        children: [
          new TextRun({
            text: `Genre: ${genre}`,
            size: 20, // 10pt
            color: '777777',
            font: 'Georgia',
          }),
        ],
      })
    );
  }

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 50, after: 600 },
      children: [
        new TextRun({
          text: date,
          size: 20,
          color: '777777',
          font: 'Georgia',
        }),
      ],
    })
  );

  // 2. Sections / Chapters
  sections.forEach((section, idx) => {
    // Start on a fresh page
    docChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    const showHeader = section.title && (sections.length > 1 || section.title !== title);
    if (showHeader) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 400 },
          children: [
            new TextRun({
              text: section.title!,
              bold: true,
              size: 34, // 17pt
              font: 'Georgia',
            }),
          ],
        })
      );
    }

    const paragraphs = extractParagraphs(section.contentHtml || '');
    paragraphs.forEach((pText) => {
      docChildren.push(
        new Paragraph({
          spacing: { before: 100, after: 160, line: 360 }, // 1.5 line spacing
          children: [
            new TextRun({
              text: pText,
              size: 23, // 11.5pt
              font: 'Georgia',
            }),
          ],
        })
      );
    });

    // Signature on final chapter
    if (idx === sections.length - 1 && signature?.enabled && signature.typedName) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 800, after: 100 },
          border: {
            top: {
              color: '999999',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 4,
            },
          },
          children: [
            new TextRun({
              text: signature.typedName,
              bold: true,
              size: 22,
              font: 'Georgia',
            }),
          ],
        })
      );

      docChildren.push(
        new Paragraph({
          spacing: { before: 50, after: 200 },
          children: [
            new TextRun({
              text: `Signed Author • ${signature.date || date}`,
              italics: true,
              size: 18,
              color: '888888',
              font: 'Georgia',
            }),
          ],
        })
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
