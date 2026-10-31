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
import { parseHtmlToBlocks } from './pdfGenerator';

export interface GenerateDocxOptions {
  title: string;
  subtitle?: string;
  author: string;
  genre?: string;
  date?: string;
  sections: PrintManuscriptSection[];
  fontFamily?: string;
  includeCoverPage?: boolean;
  signature?: {
    enabled: boolean;
    typedName: string;
    date?: string;
  };
}

/**
 * Extracts plain blocks and structure from HTML using the robust block parser.
 */
function extractBlocks(html: string) {
  return parseHtmlToBlocks(html);
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
    includeCoverPage = false,
    signature,
  } = options;

  const docChildren: Paragraph[] = [];
  const shouldRenderCover = includeCoverPage && sections.length > 1;

  if (shouldRenderCover) {
    // 1. Cover Page for multi-chapter book compilation
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
            color: 'D97706',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 12,
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
  } else {
    // START DIRECTLY ON PAGE 1: MATCHING MANUSCRIPT SHEET
    docChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 44, // 22pt
            font: 'Georgia',
            color: '1C1917',
          }),
        ],
      })
    );

    // Amber Accent Line
    docChildren.push(
      new Paragraph({
        border: {
          bottom: {
            color: 'D97706',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 16,
          },
        },
        spacing: { before: 60, after: 160 },
      })
    );

    if (author && author.trim()) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 40, after: 300 },
          children: [
            new TextRun({
              text: subtitle ? `${subtitle} • By ${author} • ${date}` : `By ${author} • ${date}`,
              italics: true,
              size: 20, // 10pt
              font: 'Georgia',
              color: '78716C',
            }),
          ],
        })
      );
    }
  }

  // 2. Sections / Chapters
  sections.forEach((section, idx) => {
    // Page break between chapters, or after cover page
    if (idx > 0 || shouldRenderCover) {
      docChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    const showHeader = section.title && (sections.length > 1 || section.title !== title);
    if (showHeader) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.LEFT,
          spacing: { before: 400, after: 200 },
          children: [
            new TextRun({
              text: section.title!,
              bold: true,
              size: 32, // 16pt
              font: 'Georgia',
              color: '1C1917',
            }),
          ],
        })
      );
    }

    const blocks = extractBlocks(section.contentHtml || '');
    blocks.forEach((block) => {
      if (block.type === 'hr' || block.text === '*   *   *' || block.text === '* * *') {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [
              new TextRun({
                text: '*   *   *',
                size: 22,
                color: 'A8A29E',
                font: 'Georgia',
              }),
            ],
          })
        );
        return;
      }

      const isQuote = block.type === 'quote';
      const isLi = block.type === 'li';

      docChildren.push(
        new Paragraph({
          alignment: block.align === 'center' ? AlignmentType.CENTER : block.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
          indent: isQuote ? { left: 720 } : isLi ? { left: 360 } : undefined,
          border: isQuote
            ? {
                left: {
                  color: 'D97706',
                  space: 8,
                  style: BorderStyle.SINGLE,
                  size: 16,
                },
              }
            : undefined,
          spacing: { before: 80, after: 140, line: 384 }, // 1.6x line spacing matching editor
          children: [
            new TextRun({
              text: block.text,
              italics: isQuote,
              bold: block.type === 'h1' || block.type === 'h2' || block.type === 'h3',
              size: block.type === 'h1' ? 36 : block.type === 'h2' ? 30 : block.type === 'h3' ? 26 : 23, // 11.5pt default
              font: 'Georgia',
              color: isQuote ? '57534E' : '1C1917',
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
