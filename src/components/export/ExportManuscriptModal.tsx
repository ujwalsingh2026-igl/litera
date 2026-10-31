import React, { useState, useMemo } from 'react';
import { useApp } from '../../state';
import type { Document, Chapter, SignaturePlacement } from '../../types';
import { Modal, Button, Input } from '../ui';
import {
  generateManuscriptPrintHtml,
  type PrintManuscriptSection,
} from '../../utils/printManuscript';
import { exportManuscriptFile } from '../../utils/exportHelper';
import {
  generateManuscriptPdfBlob,
  htmlToExactPlainText,
} from '../../utils/pdfGenerator';
import { generateManuscriptDocxBlob } from '../../utils/docxGenerator';
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
  BookOpen,
  Share2,
} from 'lucide-react';

interface ExportManuscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: Document | null;
  bookTitle?: string;
  bookSubtitle?: string;
  author?: string;
  genre?: string;
  chapters?: Chapter[];
  liveContent?: string;
  livePlainText?: string;
}

export const ExportManuscriptModal: React.FC<ExportManuscriptModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  bookTitle,
  bookSubtitle,
  author = 'Author',
  genre,
  chapters,
  liveContent,
  livePlainText,
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

  const hasMultipleChapters = Boolean(chapters && chapters.length > 1);
  const [exportScope, setExportScope] = useState<'book' | 'chapter'>(
    hasMultipleChapters ? 'book' : 'chapter'
  );

  const effectiveTitle = exportScope === 'book' && bookTitle
    ? bookTitle
    : doc?.title || bookTitle || 'Manuscript';

  const [copied, setCopied] = useState(false);
  const [exportPlacement, setExportPlacement] = useState<SignaturePlacement>(sig.placement);
  const [watermarkText, setWatermarkText] = useState<string>(sig.watermarkText || 'CONFIDENTIAL DRAFT');
  const [typedName, setTypedName] = useState<string>(sig.typedName || 'Author Signature');

  // Compute sections to export. Uses liveContent (from TipTap) if available so recent typing is never missed!
  const sectionsToExport: PrintManuscriptSection[] = useMemo(() => {
    if (exportScope === 'chapter' || !chapters || chapters.length === 0) {
      return [
        {
          title: doc ? doc.title : bookTitle,
          contentHtml: liveContent !== undefined ? liveContent : doc?.content || '',
        },
      ];
    }

    return chapters.map((ch) => {
      const isCurrentActive = doc?.chapterId === ch.id;
      return {
        title: ch.title,
        contentHtml: isCurrentActive && liveContent !== undefined ? liveContent : ch.content,
      };
    });
  }, [exportScope, chapters, doc, bookTitle, liveContent]);

  const getExactPlainText = () => {
    // If live text directly from TipTap is available for the current document, return it byte-for-byte!
    if (livePlainText !== undefined && (exportScope === 'chapter' || !chapters || chapters.length <= 1)) {
      return livePlainText;
    }

    // Otherwise, extract exact text from each section preserving every single whitespace
    return sectionsToExport
      .map((sec) => htmlToExactPlainText(sec.contentHtml || ''))
      .join('\n');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getExactPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 3500);
  };

  const getNoticeMessage = (res: { method?: string; success: boolean }, formatName: string, filename: string) => {
    if (res.method === 'capacitor-save') return `Saved to Documents: ${filename}`;
    if (res.method === 'download') return `Saved to system: ${filename}`;
    if (res.method === 'capacitor-share' || res.method === 'web-share') return `${formatName} shared successfully!`;
    return `${formatName} exported!`;
  };

  const handleDownloadTxt = async (mode: 'save' | 'share' = 'save') => {
    const key = mode === 'share' ? 'txt-share' : 'txt';
    setIsExporting(key);
    try {
      const text = getExactPlainText();
      const filename = `${effectiveTitle.replace(/\s+/g, '_')}.txt`;
      const res = await exportManuscriptFile({
        filename,
        mimeType: 'text/plain',
        content: text,
        title: effectiveTitle,
        mode,
      });
      if (res.success) {
        showNotice(getNoticeMessage(res, 'Plain Text (.txt)', filename));
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadMd = async (mode: 'save' | 'share' = 'save') => {
    const key = mode === 'share' ? 'md-share' : 'md';
    setIsExporting(key);
    try {
      let md = '';
      if (sectionsToExport.length === 1) {
        md = getExactPlainText();
      } else {
        sectionsToExport.forEach((sec, idx) => {
          if (sec.title) {
            md += `## ${sec.title}\n\n`;
          }
          md += htmlToExactPlainText(sec.contentHtml || '');
          if (idx < sectionsToExport.length - 1) {
            md += '\n\n* * *\n\n';
          }
        });
      }

      const filename = `${effectiveTitle.replace(/\s+/g, '_')}.md`;
      const res = await exportManuscriptFile({
        filename,
        mimeType: 'text/markdown',
        content: md,
        title: effectiveTitle,
        mode,
      });
      if (res.success) {
        showNotice(getNoticeMessage(res, 'Markdown (.md)', filename));
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadDocx = async (mode: 'save' | 'share' = 'save') => {
    const key = mode === 'share' ? 'doc-share' : 'doc';
    setIsExporting(key);
    try {
      const docxBlob = await generateManuscriptDocxBlob({
        title: effectiveTitle,
        subtitle: bookSubtitle,
        author,
        genre,
        sections: sectionsToExport,
        signature: {
          enabled: exportPlacement === 'bottom' || exportPlacement === 'both',
          typedName,
          date: new Date().toLocaleDateString(),
        },
      });

      const filename = `${effectiveTitle.replace(/\s+/g, '_')}.docx`;
      const res = await exportManuscriptFile({
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: docxBlob,
        title: `${effectiveTitle} (Word Document)`,
        mode,
      });

      if (res.success) {
        showNotice(getNoticeMessage(res, 'Word document (.docx)', filename));
      }
    } catch (err) {
      console.error('Failed to generate Word document:', err);
      showNotice('Failed to generate Word document (.docx)');
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadHtml = async (mode: 'save' | 'share' = 'save') => {
    const key = mode === 'share' ? 'html-share' : 'html';
    setIsExporting(key);
    try {
      const fullHtml = generateManuscriptPrintHtml({
        title: effectiveTitle,
        subtitle: bookSubtitle,
        author,
        genre,
        sections: sectionsToExport,
        watermark: {
          enabled: exportPlacement === 'watermark' || exportPlacement === 'both',
          text: watermarkText,
          opacity: sig.watermarkOpacity || 0.12,
        },
        signature: {
          enabled: exportPlacement === 'bottom' || exportPlacement === 'both',
          typedName,
          date: new Date().toLocaleDateString(),
        },
      });

      const filename = `${effectiveTitle.replace(/\s+/g, '_')}.html`;
      const res = await exportManuscriptFile({
        filename,
        mimeType: 'text/html',
        content: fullHtml,
        title: effectiveTitle,
        mode,
      });
      if (res.success) {
        showNotice(getNoticeMessage(res, 'HTML Document', filename));
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handlePrintPdf = async (mode: 'save' | 'share' = 'save') => {
    const key = mode === 'share' ? 'pdf-share' : 'pdf';
    setIsExporting(key);
    try {
      // Save signature placement settings back to state
      updateSettings({
        signature: {
          ...sig,
          placement: exportPlacement,
          watermarkText,
          typedName,
        },
      });

      // Generate a REAL standard PDF binary Blob matching editor writing style
      const pdfBlob = await generateManuscriptPdfBlob({
        title: effectiveTitle,
        subtitle: bookSubtitle,
        author,
        genre,
        sections: sectionsToExport,
        fontFamily: settings.appearance.fontFamily,
        includeCoverPage: hasMultipleChapters && exportScope === 'book',
        watermark: {
          enabled: exportPlacement === 'watermark' || exportPlacement === 'both',
          text: watermarkText,
          opacity: sig.watermarkOpacity || 0.12,
        },
        signature: {
          enabled: exportPlacement === 'bottom' || exportPlacement === 'both',
          typedName,
          date: new Date().toLocaleDateString(),
        },
      });

      const filename = `${effectiveTitle.replace(/\s+/g, '_')}.pdf`;
      const res = await exportManuscriptFile({
        filename,
        mimeType: 'application/pdf',
        content: pdfBlob,
        title: `${effectiveTitle} (PDF Manuscript)`,
        mode,
      });

      if (res.success) {
        showNotice(getNoticeMessage(res, 'PDF Manuscript', filename));
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      showNotice('Failed to generate PDF document');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Manuscript & Printable Studio" size="lg">
      <div className="space-y-5">
        {/* Header Summary */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <span className="font-semibold">{effectiveTitle}</span>
              <span className="text-[11px] opacity-80 block">
                {sectionsToExport.length > 1
                  ? `Full manuscript compilation across ${sectionsToExport.length} chapters, formatted for unlimited pages.`
                  : 'Complete formatted document, ready for publication, printing, or digital submission.'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Export Notification */}
        {exportNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Scope selector if multiple chapters exist */}
        {hasMultipleChapters && (
          <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/80 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 font-mono flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Export Scope</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('book')}
                className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition flex items-center justify-between ${
                  exportScope === 'book'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>📚 Complete Book ({chapters?.length} Chapters)</span>
                {exportScope === 'book' && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setExportScope('chapter')}
                className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition flex items-center justify-between ${
                  exportScope === 'chapter'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>📄 Current Chapter Only ({doc?.title || 'Chapter'})</span>
                {exportScope === 'chapter' && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              </button>
            </div>
          </div>
        )}

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. REAL PDF DOCUMENT */}
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/30 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Printer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                    {isExporting?.startsWith('pdf') ? 'Exporting...' : 'Standard PDF'}
                  </span>
                </div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  PDF Document (.pdf)
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Authentic manuscript PDF matching editor writing style
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handlePrintPdf('save')}
                  disabled={isExporting !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition disabled:opacity-50"
                  title="Save directly to your device storage"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting === 'pdf' ? 'Saving...' : 'Save to System'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintPdf('share')}
                  disabled={isExporting !== null}
                  className="p-1.5 rounded-lg border border-amber-500/40 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 transition disabled:opacity-50"
                  title="Share to external app"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. REAL MICROSOFT WORD (.DOCX) */}
            <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="text-[10px] text-stone-400 font-mono">
                    {isExporting?.startsWith('doc') ? 'Exporting...' : '.docx'}
                  </span>
                </div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  Microsoft Word (.docx)
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Genuine Word document file with formatted chapters
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadDocx('save')}
                  disabled={isExporting !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white text-xs font-medium transition disabled:opacity-50"
                  title="Save directly to your device storage"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting === 'doc' ? 'Saving...' : 'Save to System'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadDocx('share')}
                  disabled={isExporting !== null}
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition disabled:opacity-50"
                  title="Share to external app"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. MARKDOWN */}
            <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FileCode className="w-5 h-5 text-emerald-500" />
                  <span className="text-[10px] text-stone-400 font-mono">
                    {isExporting?.startsWith('md') ? 'Exporting...' : '.md'}
                  </span>
                </div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  Markdown (.md)
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Plain markdown syntax with headers & dividers
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadMd('save')}
                  disabled={isExporting !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-emerald-600 dark:hover:bg-emerald-500 dark:hover:text-white text-xs font-medium transition disabled:opacity-50"
                  title="Save directly to your device storage"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting === 'md' ? 'Saving...' : 'Save to System'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadMd('share')}
                  disabled={isExporting !== null}
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition disabled:opacity-50"
                  title="Share to external app"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4. PLAIN TEXT */}
            <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Download className="w-5 h-5 text-purple-500" />
                  <span className="text-[10px] text-stone-400 font-mono">
                    {isExporting?.startsWith('txt') ? 'Exporting...' : '.txt'}
                  </span>
                </div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  Plain Text (.txt)
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Complete unformatted manuscript text
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadTxt('save')}
                  disabled={isExporting !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-purple-600 dark:hover:bg-purple-500 dark:hover:text-white text-xs font-medium transition disabled:opacity-50"
                  title="Save directly to your device storage"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting === 'txt' ? 'Saving...' : 'Save to System'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTxt('share')}
                  disabled={isExporting !== null}
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition disabled:opacity-50"
                  title="Share to external app"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 5. STANDALONE HTML */}
            <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Globe className="w-5 h-5 text-sky-500" />
                  <span className="text-[10px] text-stone-400 font-mono">
                    {isExporting?.startsWith('html') ? 'Exporting...' : '.html'}
                  </span>
                </div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  HTML Web Document
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Self-contained web page with cover & watermark
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadHtml('save')}
                  disabled={isExporting !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-sky-600 dark:hover:bg-sky-500 dark:hover:text-white text-xs font-medium transition disabled:opacity-50"
                  title="Save directly to your device storage"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting === 'html' ? 'Saving...' : 'Save to System'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadHtml('share')}
                  disabled={isExporting !== null}
                  className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition disabled:opacity-50"
                  title="Share to external app"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 6. COPY TO CLIPBOARD */}
            <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5 text-stone-500" />}
                  <span className="text-[10px] text-stone-400 font-mono">Clipboard</span>
                </div>
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                  {copied ? 'Copied to Clipboard!' : 'Copy Plain Text'}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Copy formatted manuscript text to clipboard
                </div>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition"
                  title="Copy text to clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>
              </div>
            </div>
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
