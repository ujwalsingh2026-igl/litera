import React, { useState } from 'react';
import { Modal } from '../ui';
import type { Chapter, BookRollupStats } from '../../types';
import { Copy, Download, Check, FileText, Share2 } from 'lucide-react';
import { exportManuscriptFile } from '../../utils/exportHelper';
import {
  generateManuscriptPdfBlob,
  htmlToExactPlainText,
} from '../../utils/pdfGenerator';
import { generateManuscriptDocxBlob } from '../../utils/docxGenerator';
import { useApp } from '../../state';

interface ManuscriptCompileModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookTitle: string;
  bookSubtitle?: string;
  author: string;
  genre?: string;
  chapters: Chapter[];
  stats: BookRollupStats;
}

export const ManuscriptCompileModal: React.FC<ManuscriptCompileModalProps> = ({
  isOpen,
  onClose,
  bookTitle,
  bookSubtitle,
  author,
  genre,
  chapters,
  stats,
}) => {
  const { settings } = useApp();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const getNoticeMessage = (res: { method?: string; success: boolean }, formatName: string, filename: string) => {
    if (res.method === 'capacitor-save') return `Saved to Documents: ${filename}`;
    if (res.method === 'download') return `Saved to system: ${filename}`;
    if (res.method === 'capacitor-share' || res.method === 'web-share') return `${formatName} shared!`;
    return `${formatName} exported!`;
  };

  const getPlainText = () => {
    let output = '';

    chapters.forEach((c, idx) => {
      if (chapters.length > 1 && c.title) {
        output += `${c.title}\n\n`;
      }
      output += htmlToExactPlainText(c.content || '');
      if (idx < chapters.length - 1) {
        output += `\n\n* * *\n\n`;
      }
    });

    return output;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (format: 'txt' | 'md', mode: 'save' | 'share' = 'save') => {
    setIsExporting(format);
    try {
      const text = getPlainText();
      const mimeType = format === 'txt' ? 'text/plain' : 'text/markdown';
      const filename = `${bookTitle.replace(/\s+/g, '_')}_Manuscript.${format}`;
      const res = await exportManuscriptFile({
        filename,
        mimeType,
        content: text,
        title: bookTitle,
        mode,
      });
      if (res.success) {
        showNotice(getNoticeMessage(res, format === 'txt' ? 'Plain Text (.txt)' : 'Markdown (.md)', filename));
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadDocx = async (mode: 'save' | 'share' = 'save') => {
    setIsExporting('docx');
    try {
      const docxBlob = await generateManuscriptDocxBlob({
        title: bookTitle,
        subtitle: bookSubtitle,
        author,
        genre,
        sections: chapters.map((c) => ({
          title: c.title,
          contentHtml: c.content,
        })),
        signature: settings.signature?.typedName
          ? {
              enabled: settings.signature.placement === 'bottom' || settings.signature.placement === 'both',
              typedName: settings.signature.typedName,
            }
          : undefined,
      });

      const filename = `${bookTitle.replace(/\s+/g, '_')}_Manuscript.docx`;
      const res = await exportManuscriptFile({
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: docxBlob,
        title: `${bookTitle} (Word Document)`,
        mode,
      });
      if (res.success) {
        showNotice(getNoticeMessage(res, 'Word document (.docx)', filename));
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handlePrint = async (mode: 'save' | 'share' = 'save') => {
    setIsExporting('pdf');
    try {
      const sig = settings.signature;
      const pdfBlob = await generateManuscriptPdfBlob({
        title: bookTitle,
        subtitle: bookSubtitle,
        author,
        genre,
        sections: chapters.map((c) => ({
          title: c.title,
          contentHtml: c.content,
        })),
        watermark: sig?.watermarkText
          ? {
              enabled: sig.placement === 'watermark' || sig.placement === 'both',
              text: sig.watermarkText,
              opacity: sig.watermarkOpacity || 0.1,
            }
          : undefined,
        signature: sig?.typedName
          ? {
              enabled: sig.placement === 'bottom' || sig.placement === 'both',
              typedName: sig.typedName,
            }
          : undefined,
      });

      const filename = `${bookTitle.replace(/\s+/g, '_')}_Manuscript.pdf`;
      const res = await exportManuscriptFile({
        filename,
        mimeType: 'application/pdf',
        content: pdfBlob,
        title: `${bookTitle} (PDF Manuscript)`,
        mode,
      });
      if (res.success) {
        showNotice(getNoticeMessage(res, 'PDF Manuscript', filename));
      }
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compiled Manuscript Preview" size="xl">
      <div className="space-y-4">
        {/* Actions ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800 text-xs">
          <div className="flex items-center gap-3 text-stone-500 font-mono">
            <span>{stats.chaptersCount} chapters</span>
            <span>•</span>
            <span>{stats.totalWords.toLocaleString()} words</span>
            <span>•</span>
            <span>~{stats.estimatedPages} pages</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              title="Copy all chapters to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={() => handleDownload('md', 'save')}
              disabled={isExporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition disabled:opacity-50"
              title="Save Markdown file to system"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.md</span>
            </button>

            <button
              onClick={() => handleDownloadDocx('save')}
              disabled={isExporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition disabled:opacity-50"
              title="Save Word (.docx) file to system"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.docx</span>
            </button>

            <button
              onClick={() => handlePrint('save')}
              disabled={isExporting !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-amber-600 dark:hover:bg-amber-500 hover:text-white transition font-medium disabled:opacity-50"
              title="Save PDF manuscript directly to system"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting === 'pdf' ? 'Saving...' : 'Save PDF'}</span>
            </button>

            <button
              onClick={() => handlePrint('share')}
              disabled={isExporting !== null}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition disabled:opacity-50"
              title="Share PDF manuscript to external apps"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>

        {/* Dynamic Export Notification */}
        {notice && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Manuscript Reader Sheet */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-8 bg-[#faf8f5] dark:bg-[#151312] border border-stone-200 dark:border-stone-800 rounded-xl custom-scrollbar font-serif">
          {/* Title Page */}
          <div className="text-center py-16 border-b border-stone-300 dark:border-stone-700 mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-2 text-stone-900 dark:text-stone-100">
              {bookTitle}
            </h1>
            {bookSubtitle && (
              <p className="text-xl italic text-stone-600 dark:text-stone-400 mb-6 font-serif">
                {bookSubtitle}
              </p>
            )}
            <p className="text-sm uppercase tracking-widest text-stone-500 font-sans">
              By {author}
            </p>
          </div>

          {/* Sequential Chapters */}
          <div className="space-y-16">
            {chapters.map((chapter) => (
              <article key={chapter.id} className="prose prose-stone dark:prose-invert max-w-none">
                <h2 className="text-2xl font-bold text-center font-serif mb-8 text-stone-900 dark:text-stone-100">
                  {chapter.title}
                </h2>
                <div
                  className="leading-relaxed text-base text-stone-800 dark:text-stone-200"
                  dangerouslySetInnerHTML={{ __html: chapter.content }}
                />
                <div className="text-center my-10 text-stone-400 select-none">* * *</div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
