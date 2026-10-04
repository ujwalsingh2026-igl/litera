import React, { useState } from 'react';
import { useApp } from '../../state';
import type { Document, Chapter, SignaturePlacement } from '../../types';
import { Modal, Button, Input } from '../ui';
import {
  Printer,
  FileText,
  FileCode,
  Download,
  Copy,
  Check,
  PenTool,
  Globe,
  Sparkles,
} from 'lucide-react';

interface ExportManuscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: Document | null;
  bookTitle?: string;
  bookSubtitle?: string;
  author?: string;
  chapters?: Chapter[];
}

export const ExportManuscriptModal: React.FC<ExportManuscriptModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  bookTitle,
  bookSubtitle,
  author = 'Author',
  chapters,
}) => {
  const { settings, updateSettings } = useApp();
  const sig = settings.signature || {
    enabled: true,
    type: 'typed',
    typedName: 'Author Signature',
    fontFamily: 'handwriting',
    placement: 'bottom',
    watermarkOpacity: 0.12,
    watermarkText: 'LITERIA MANUSCRIPT DRAFT',
  };

  const title = doc ? doc.title : bookTitle || 'Manuscript';
  const contentHtml = doc ? doc.content : chapters ? chapters.map((c) => `<h2>${c.title}</h2>${c.content}`).join('<hr/>') : '';

  const [copied, setCopied] = useState(false);
  const [exportPlacement, setExportPlacement] = useState<SignaturePlacement>(sig.placement);
  const [watermarkText, setWatermarkText] = useState<string>(sig.watermarkText || 'CONFIDENTIAL DRAFT');
  const [typedName, setTypedName] = useState<string>(sig.typedName || 'Author Signature');

  const getPlainText = () => {
    let text = `${title.toUpperCase()}\n`;
    if (bookSubtitle) text += `${bookSubtitle}\n`;
    text += `By ${author}\n\n`;
    text += `========================================\n\n`;
    text += contentHtml.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
    if (exportPlacement === 'bottom' || exportPlacement === 'both') {
      text += `\n\n========================================\n`;
      text += `Signed: ${typedName}\n`;
      text += `Date: ${new Date().toLocaleDateString()}\n`;
    }
    return text;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const text = getPlainText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${title.replace(/\s+/g, '_')}.txt`);
  };

  const handleDownloadMd = () => {
    let md = `# ${title}\n\n`;
    if (bookSubtitle) md += `*${bookSubtitle}*\n\n`;
    md += `**Author:** ${author}  \n`;
    md += `**Date:** ${new Date().toLocaleDateString()}  \n\n`;
    md += `---\n\n`;
    md += contentHtml.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n').replace(/<[^>]+>/g, '');
    if (exportPlacement === 'bottom' || exportPlacement === 'both') {
      md += `\n\n---\n\n*Signed by ${typedName}*\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${title.replace(/\s+/g, '_')}.md`);
  };

  const handleDownloadDocx = () => {
    let docHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Georgia', serif; font-size: 12pt; line-height: 1.6; margin: 1in; }
          h1 { text-align: center; font-size: 24pt; margin-bottom: 0.5in; }
          .subtitle { text-align: center; font-style: italic; font-size: 14pt; margin-bottom: 0.25in; }
          .author { text-align: center; font-weight: bold; font-size: 12pt; margin-bottom: 0.5in; }
          .signature-box { margin-top: 1in; border-top: 1px solid #000; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${bookSubtitle ? `<div className="subtitle">${bookSubtitle}</div>` : ''}
        <div className="author">By ${author}</div>
        <hr/>
        <div>${contentHtml}</div>
        ${
          exportPlacement === 'bottom' || exportPlacement === 'both'
            ? `<div className="signature-box">
                <p><strong>Signed by Author:</strong> ${typedName}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
               </div>`
            : ''
        }
      </body>
      </html>
    `;
    const blob = new Blob([docHtml], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `${title.replace(/\s+/g, '_')}.doc`);
  };

  const handleDownloadHtml = () => {
    let fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { font-family: 'EB Garamond', Georgia, serif; max-width: 800px; margin: 2rem auto; padding: 2rem; color: #1c1917; background: #fafaf9; }
          h1 { font-size: 2.5rem; text-align: center; }
          .watermark { position: fixed; top: 40%; left: 10%; transform: rotate(-30deg); font-size: 3.5rem; color: rgba(0,0,0,${sig.watermarkOpacity}); font-weight: bold; pointer-events: none; }
          .signature { margin-top: 3rem; pt: 1rem; border-top: 2px solid #d97706; }
        </style>
      </head>
      <body>
        ${(exportPlacement === 'watermark' || exportPlacement === 'both') ? `<div className="watermark">${watermarkText}</div>` : ''}
        <h1>${title}</h1>
        <p style="text-align:center; font-style:italic;">By ${author}</p>
        <hr/>
        <div>${contentHtml}</div>
        ${(exportPlacement === 'bottom' || exportPlacement === 'both') ? `<div className="signature">✍️ <strong>Signed:</strong> ${typedName} (${new Date().toLocaleDateString()})</div>` : ''}
      </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${title.replace(/\s+/g, '_')}.html`);
  };

  const handlePrintPdf = () => {
    // Save signature placement settings back to state
    updateSettings({
      signature: {
        ...sig,
        placement: exportPlacement,
        watermarkText,
        typedName,
      },
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Printable Manuscript</title>
        <style>
          @page { size: A4; margin: 25mm 20mm; }
          body { font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; color: #1c1917; background: #fff; line-height: 1.7; margin: 0; padding: 0; }
          .watermark { position: fixed; top: 45%; left: 5%; right: 5%; transform: rotate(-35deg); font-size: 3rem; font-weight: 800; text-align: center; color: rgba(0,0,0,${sig.watermarkOpacity}); text-transform: uppercase; letter-spacing: 4px; pointer-events: none; z-index: -1; }
          .cover-page { text-align: center; padding-top: 35vh; page-break-after: always; }
          .cover-title { font-size: 36pt; font-weight: bold; margin-bottom: 15px; }
          .cover-subtitle { font-size: 18pt; font-style: italic; color: #57534e; margin-bottom: 40px; }
          .cover-author { font-size: 14pt; text-transform: uppercase; letter-spacing: 2px; }
          .manuscript-body { font-size: 12pt; }
          .manuscript-body p { margin-bottom: 1rem; text-indent: 1.5rem; }
          .signature-footer { margin-top: 4rem; padding-top: 1rem; border-top: 1.5px solid #d97706; page-break-inside: avoid; }
          .sig-font { font-family: 'Caveat', 'Dancing Script', cursive, serif; font-size: 22pt; color: #1c1917; }
        </style>
      </head>
      <body>
        ${(exportPlacement === 'watermark' || exportPlacement === 'both') ? `<div className="watermark">${watermarkText}</div>` : ''}
        
        <div className="cover-page">
          <div className="cover-title">${title}</div>
          ${bookSubtitle ? `<div className="cover-subtitle">${bookSubtitle}</div>` : ''}
          <div className="cover-author">By ${author}</div>
        </div>

        <div className="manuscript-body">
          ${contentHtml}

          ${(exportPlacement === 'bottom' || exportPlacement === 'both') ? `
            <div className="signature-footer">
              <div className="sig-font">${typedName}</div>
              <div style="font-size: 9pt; color: #78716c; margin-top: 4px;">Verified Author Signature • ${new Date().toLocaleDateString()}</div>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Manuscript & Printable Studio" size="lg">
      <div className="space-y-5">
        {/* Header Summary */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <span className="font-semibold">{title}</span>
              <span className="text-[11px] opacity-80 block">Ready for publication, printing, or digital submission.</span>
            </div>
          </div>
        </div>

        {/* Signature & Watermark Quick Controls */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 font-mono flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Signature & Watermark Export Options</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Signature & Watermark Placement
              </label>
              <select
                value={exportPlacement}
                onChange={(e) => setExportPlacement(e.target.value as SignaturePlacement)}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none"
              >
                <option value="bottom">Bottom Footer Signature Line</option>
                <option value="watermark">Diagonal Background Watermark</option>
                <option value="both">Both (Bottom Line + Watermark)</option>
                <option value="none">None (Clean Export)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Signer Name / Title
              </label>
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Author Signature"
              />
            </div>

            {(exportPlacement === 'watermark' || exportPlacement === 'both') && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Diagonal Watermark Text
                </label>
                <Input
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="CONFIDENTIAL DRAFT"
                />
              </div>
            )}
          </div>
        </div>

        {/* Export Formats Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 font-mono">
            Select Export Format
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {/* 1. PDF / PRINT */}
            <button
              type="button"
              onClick={handlePrintPdf}
              className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 text-left transition flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-2">
                <Printer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                  Recommended
                </span>
              </div>
              <div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  Print / Save as PDF
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Formatted cover, page numbers & signature
                </div>
              </div>
            </button>

            {/* 2. WORD DOCX */}
            <button
              type="button"
              onClick={handleDownloadDocx}
              className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-blue-500/40 bg-white dark:bg-stone-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 text-left transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] text-stone-400 font-mono">.doc / .docx</span>
              </div>
              <div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  Microsoft Word
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Editable Word document file
                </div>
              </div>
            </button>

            {/* 3. MARKDOWN */}
            <button
              type="button"
              onClick={handleDownloadMd}
              className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-emerald-500/40 bg-white dark:bg-stone-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <FileCode className="w-5 h-5 text-emerald-500" />
                <span className="text-[10px] text-stone-400 font-mono">.md</span>
              </div>
              <div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  Markdown (.md)
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Plain markdown syntax with headers
                </div>
              </div>
            </button>

            {/* 4. PLAIN TEXT */}
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-purple-500/40 bg-white dark:bg-stone-900 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 text-left transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <Download className="w-5 h-5 text-purple-500" />
                <span className="text-[10px] text-stone-400 font-mono">.txt</span>
              </div>
              <div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  Plain Text (.txt)
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Unformatted plain text document
                </div>
              </div>
            </button>

            {/* 5. STANDALONE HTML */}
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-sky-500/40 bg-white dark:bg-stone-900 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 text-left transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <Globe className="w-5 h-5 text-sky-500" />
                <span className="text-[10px] text-stone-400 font-mono">.html</span>
              </div>
              <div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  HTML Web Document
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Self-contained web page with watermark
                </div>
              </div>
            </button>

            {/* 6. COPY TO CLIPBOARD */}
            <button
              type="button"
              onClick={handleCopyText}
              className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-stone-400 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5 text-stone-500" />}
                <span className="text-[10px] text-stone-400 font-mono">Clipboard</span>
              </div>
              <div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  {copied ? 'Copied to Clipboard!' : 'Copy Plain Text'}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  Copy formatted manuscript text
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-stone-200 dark:border-stone-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close Studio
          </Button>
        </div>
      </div>
    </Modal>
  );
};
