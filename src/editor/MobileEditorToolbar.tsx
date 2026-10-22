import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  SlidersHorizontal,
  Table,
  Link,
  ImagePlus,
  Image,
  Sparkles,
  Printer,
  PenTool,
  Palette,
  LayoutTemplate,
  Search,
  Users,
  CaseSensitive,
  RemoveFormatting,
  Rows,
  Columns,
  Trash2,
} from 'lucide-react';
import { BottomSheet } from '../components/ui';
import { transformTipTapCase, type CaseType } from './caseTransform';

interface MobileEditorToolbarProps {
  editor: Editor | null;
  onOpenAi?: () => void;
  stats?: { words: number; characters: number };
  onOpenExport?: () => void;
  onOpenSignature?: () => void;
  onOpenDrawing?: () => void;
  onOpenTemplate?: () => void;
  onToggleFindReplace?: () => void;
  onOpenCollab?: () => void;
  onOpenImageSeeker?: () => void;
  isCollabActive?: boolean;
  collabCount?: number;
}

const safeChain = (editor: Editor) => editor.chain().focus();

export const MobileEditorToolbar: React.FC<MobileEditorToolbarProps> = ({
  editor,
  onOpenAi,
  stats,
  onOpenExport,
  onOpenSignature,
  onOpenDrawing,
  onOpenTemplate,
  onToggleFindReplace,
  onOpenCollab,
  onOpenImageSeeker,
  isCollabActive = false,
  collabCount = 1,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);

  // Avoid virtual keyboard overlap on mobile phones
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      // In mobile Chrome/WebView/Safari, vv.height shrinks when the virtual keyboard opens
      const offset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setKeyboardOffset(offset);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  if (!editor) return null;

  const handleApplyCase = (type: CaseType) => {
    transformTipTapCase(editor, type);
    setCaseMenuOpen(false);
    setSheetOpen(false);
  };

  const handleInsertLink = () => {
    const url = window.prompt('Enter link URL (e.g. https://...):');
    if (url) {
      safeChain(editor).setLink({ href: url }).run();
    }
  };

  const handleInsertImageUrl = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      safeChain(editor).setImage({ src: url }).run();
    }
  };

  const isTableActive = editor.isActive('table');

  return (
    <>
      {/* Dynamic Keyboard-Avoiding Slidable Bottom Navigation Ribbon */}
      <div
        style={{
          bottom: `${keyboardOffset}px`,
          transition: 'bottom 0.12s cubic-bezier(0, 0, 0.2, 1)',
        }}
        className="md:hidden fixed left-0 right-0 z-[80] bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-stone-200/90 dark:border-stone-800 shadow-xl pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1 px-2.5 py-1.5 whitespace-nowrap select-none">
          {/* 1. History (Undo / Redo) */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => safeChain(editor).undo().run()}
              disabled={!editor.can().undo()}
              className="p-2 rounded-lg text-stone-700 dark:text-stone-300 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              aria-label="Undo"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).redo().run()}
              disabled={!editor.can().redo()}
              className="p-2 rounded-lg text-stone-700 dark:text-stone-300 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              aria-label="Redo"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 2. Primary Typography Formats */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => safeChain(editor).toggleBold().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('bold')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Bold"
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleItalic().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('italic')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Italic"
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleUnderline().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('underline')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Underline"
              title="Underline"
            >
              <Underline className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleStrike().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('strike')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Strikethrough"
              title="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleHighlight().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('highlight')
                  ? 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900/60 dark:text-yellow-200 font-bold'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Highlight"
              title="Highlight"
            >
              <Highlighter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleCode().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('code')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Inline Code"
              title="Inline Code"
            >
              <Code className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 3. Text Case Handling Quick Trigger */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setCaseMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition"
              title="Text Case Transformations (Aa)"
            >
              <CaseSensitive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Aa</span>
            </button>

            {caseMenuOpen && (
              <div className="absolute left-0 bottom-10 z-[90] p-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl flex flex-col gap-1 min-w-[170px] animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 font-semibold border-b border-stone-100 dark:border-stone-800">
                  Case Transformations
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyCase('sentence')}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 flex flex-col"
                >
                  <span className="font-semibold">Sentence case</span>
                  <span className="text-[10px] text-stone-400">Capitalize sentences</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCase('title')}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 flex flex-col"
                >
                  <span className="font-semibold">Title Case</span>
                  <span className="text-[10px] text-stone-400">Capitalize Each Word</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCase('uppercase')}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 flex flex-col"
                >
                  <span className="font-bold">UPPERCASE</span>
                  <span className="text-[10px] text-stone-400 font-mono">ALL CAPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCase('lowercase')}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 flex flex-col"
                >
                  <span className="font-semibold">lowercase</span>
                  <span className="text-[10px] text-stone-400 font-mono">all lower</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyCase('toggle')}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 flex flex-col"
                >
                  <span className="font-semibold">tOGGLE cASE</span>
                  <span className="text-[10px] text-stone-400">Invert case</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 4. Headings & Paragraph Hierarchy */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => safeChain(editor).setParagraph().run()}
              className={`p-2 rounded-lg text-xs font-serif font-bold transition ${
                editor.isActive('paragraph') && !editor.isActive('heading')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Normal Text"
              title="Normal Paragraph"
            >
              <Pilcrow className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleHeading({ level: 1 }).run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('heading', { level: 1 })
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Heading 1"
              title="H1 Title"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('heading', { level: 2 })
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Heading 2"
              title="H2 Chapter"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleHeading({ level: 3 }).run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('heading', { level: 3 })
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Heading 3"
              title="H3 Section"
            >
              <Heading3 className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 5. Lists & Quotes */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => safeChain(editor).toggleBulletList().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('bulletList')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Bullet list"
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleOrderedList().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('orderedList')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Numbered list"
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).toggleBlockquote().run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive('blockquote')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Quote"
              title="Blockquote"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).setHorizontalRule().run()}
              className="p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              aria-label="Divider Line"
              title="Scene Divider Line"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 6. Alignment Cluster */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => safeChain(editor).setTextAlign('left').run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive({ textAlign: 'left' })
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Align Left"
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).setTextAlign('center').run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive({ textAlign: 'center' })
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Align Center"
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).setTextAlign('right').run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive({ textAlign: 'right' })
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Align Right"
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).setTextAlign('justify').run()}
              className={`p-2 rounded-lg transition ${
                editor.isActive({ textAlign: 'justify' })
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Justify"
              title="Justify"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 7. Inserts & Media */}
          <div className="flex items-center gap-0.5 shrink-0">
            {onOpenImageSeeker && (
              <button
                type="button"
                onClick={onOpenImageSeeker}
                className="p-2 rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition flex items-center gap-1"
                aria-label="Seek Online Images"
                title="Online Image Seeker (Wikimedia Commons)"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleInsertLink}
              className={`p-2 rounded-lg transition ${
                editor.isActive('link')
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Insert Link"
              title="Insert Link"
            >
              <Link className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => safeChain(editor).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className={`p-2 rounded-lg transition ${
                isTableActive
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              aria-label="Insert Table"
              title="Insert 3x3 Table"
            >
              <Table className="w-4 h-4" />
            </button>
            {onOpenDrawing && (
              <button
                type="button"
                onClick={onOpenDrawing}
                className="p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                aria-label="Drawing Studio"
                title="Drawing Studio"
              >
                <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </button>
            )}
            {onOpenSignature && (
              <button
                type="button"
                onClick={onOpenSignature}
                className="p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                aria-label="Author Signature"
                title="Author Signature & Watermarking"
              >
                <PenTool className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </button>
            )}
            {onOpenTemplate && (
              <button
                type="button"
                onClick={onOpenTemplate}
                className="p-2 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                aria-label="Template Designer"
                title="Template Designer"
              >
                <LayoutTemplate className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </button>
            )}
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 8. Studio, Utilities & AI */}
          <div className="flex items-center gap-1 shrink-0">
            {onOpenAi && (
              <button
                type="button"
                onClick={onOpenAi}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition font-semibold text-xs"
                aria-label="Literia AI Companion"
                title="Open Literia AI Companion"
              >
                <Sparkles className="w-4 h-4" />
                <span>AI</span>
              </button>
            )}

            {onOpenExport && (
              <button
                type="button"
                onClick={onOpenExport}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 transition font-semibold text-xs"
                aria-label="Export Manuscript"
                title="Export / Print Manuscript"
              >
                <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Export</span>
              </button>
            )}

            {onToggleFindReplace && (
              <button
                type="button"
                onClick={onToggleFindReplace}
                className="p-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                aria-label="Find & Replace"
                title="Find & Replace"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {onOpenCollab && (
              <button
                type="button"
                onClick={onOpenCollab}
                className={`p-2 rounded-lg transition ${
                  isCollabActive
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
                aria-label="Live Collaboration"
                title={isCollabActive ? `Live Collab (${collabCount})` : 'Live Collaboration'}
              >
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-800 shrink-0 mx-0.5" />

          {/* 9. Word Count & All Tools Menu Sheet Trigger */}
          <div className="flex items-center gap-1.5 shrink-0 pl-1">
            {stats !== undefined && (
              <span className="text-[11px] font-mono font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">
                {stats.words}w
              </span>
            )}

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition"
              aria-label="All Elements & Features"
              title="Open Complete Elements & Features Menu"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>All Tools</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comprehensive Features & Elements Bottom Sheet */}
      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Features, Elements & Formatting"
      >
        <div className="space-y-5 pb-8 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {/* Section: Literia AI Companion */}
          {onOpenAi && (
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-900 dark:text-purple-200 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Literia AI Companion</span>
                </span>
                <span className="text-[10px] font-mono text-purple-600 dark:text-purple-300 font-medium uppercase">
                  Writing Assistant
                </span>
              </div>
              <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80">
                Brainstorm scenes, expand narratives, polish prose, generate dialogue, and insert directly into your manuscript.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenAi();
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Open AI Companion Studio</span>
              </button>
            </div>
          )}

          {/* Section: Text Case Transformations */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-500 dark:text-stone-400 uppercase text-[10px] tracking-wider font-mono flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CaseSensitive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Text Case Handling</span>
              </span>
              <span className="text-[10px] font-mono">Aa</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleApplyCase('sentence')}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 text-left flex flex-col gap-0.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition"
              >
                <span className="font-semibold text-xs text-stone-800 dark:text-stone-200">Sentence case</span>
                <span className="text-[10px] text-stone-400">Capitalize sentences</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyCase('title')}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 text-left flex flex-col gap-0.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition"
              >
                <span className="font-semibold text-xs text-stone-800 dark:text-stone-200">Title Case</span>
                <span className="text-[10px] text-stone-400">Capitalize Each Word</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyCase('uppercase')}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 text-left flex flex-col gap-0.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition"
              >
                <span className="font-bold text-xs text-stone-800 dark:text-stone-200">UPPERCASE</span>
                <span className="text-[10px] text-stone-400 font-mono">ALL CAPITAL LETTERS</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyCase('lowercase')}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 text-left flex flex-col gap-0.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition"
              >
                <span className="font-semibold text-xs text-stone-800 dark:text-stone-200">lowercase</span>
                <span className="text-[10px] text-stone-400 font-mono">all lower</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyCase('toggle')}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 text-left flex flex-col gap-0.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition col-span-2"
              >
                <span className="font-semibold text-xs text-stone-800 dark:text-stone-200">tOGGLE cASE</span>
                <span className="text-[10px] text-stone-400 font-mono">iNVERT cASING oF eACH lETTER</span>
              </button>
            </div>
          </div>

          {/* Section: Typography & Styling */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-500 dark:text-stone-400 uppercase text-[10px] tracking-wider font-mono">
              Text Formatting & Typography
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleBold().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive('bold')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
                <span>Bold</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleItalic().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive('italic')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
                <span>Italic</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleUnderline().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive('underline')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Underline className="w-3.5 h-3.5" />
                <span>Underline</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleStrike().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive('strike')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Strikethrough className="w-3.5 h-3.5" />
                <span>Strike</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleHighlight().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive('highlight')
                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-900 dark:text-yellow-200 font-bold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>Highlight</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleCode().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive('code')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).unsetAllMarks().clearNodes().run();
                  setSheetOpen(false);
                }}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center gap-1.5 col-span-3 text-stone-500 transition"
              >
                <RemoveFormatting className="w-3.5 h-3.5" />
                <span>Clear All Formatting</span>
              </button>
            </div>
          </div>

          {/* Section: Headings & Hierarchy */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-500 dark:text-stone-400 uppercase text-[10px] tracking-wider font-mono">
              Headings & Document Hierarchy
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).setParagraph().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center transition ${
                  editor.isActive('paragraph') && !editor.isActive('heading')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleHeading({ level: 1 }).run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center flex items-center justify-center gap-1 transition ${
                  editor.isActive('heading', { level: 1 })
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Heading1 className="w-3.5 h-3.5" />
                <span>H1</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleHeading({ level: 2 }).run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center flex items-center justify-center gap-1 transition ${
                  editor.isActive('heading', { level: 2 })
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Heading2 className="w-3.5 h-3.5" />
                <span>H2</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleHeading({ level: 3 }).run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border text-center flex items-center justify-center gap-1 transition ${
                  editor.isActive('heading', { level: 3 })
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Heading3 className="w-3.5 h-3.5" />
                <span>H3</span>
              </button>
            </div>
          </div>

          {/* Section: Text Alignment */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-500 dark:text-stone-400 uppercase text-[10px] tracking-wider font-mono">
              Text Alignment
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).setTextAlign('left').run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive({ textAlign: 'left' })
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Left</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).setTextAlign('center').run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive({ textAlign: 'center' })
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
                <span>Center</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).setTextAlign('right').run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive({ textAlign: 'right' })
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <AlignRight className="w-3.5 h-3.5" />
                <span>Right</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).setTextAlign('justify').run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition ${
                  editor.isActive({ textAlign: 'justify' })
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <AlignJustify className="w-3.5 h-3.5" />
                <span>Justify</span>
              </button>
            </div>
          </div>

          {/* Section: Lists, Quotes & Dividers */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-500 dark:text-stone-400 uppercase text-[10px] tracking-wider font-mono">
              Lists, Quotes & Breaks
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleBulletList().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 transition ${
                  editor.isActive('bulletList')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <List className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Bullet List</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleOrderedList().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 transition ${
                  editor.isActive('orderedList')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <ListOrdered className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Numbered List</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).toggleBlockquote().run();
                  setSheetOpen(false);
                }}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 transition ${
                  editor.isActive('blockquote')
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Quote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Blockquote</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).setHorizontalRule().run();
                  setSheetOpen(false);
                }}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center gap-2 transition"
              >
                <Minus className="w-4 h-4 text-stone-500" />
                <span>Scene Divider</span>
              </button>
            </div>
          </div>

          {/* Section: Insert Elements & Media */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-500 dark:text-stone-400 uppercase text-[10px] tracking-wider font-mono">
              Insert Elements & Media
            </div>
            <div className="grid grid-cols-2 gap-2">
              {onOpenImageSeeker && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenImageSeeker();
                  }}
                  className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 flex items-center justify-center gap-2 transition col-span-2"
                >
                  <ImagePlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold">Online Image Seeker (Wikimedia & Art)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  handleInsertImageUrl();
                }}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center gap-2 transition"
              >
                <Image className="w-4 h-4 text-blue-500" />
                <span>Image via URL</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  handleInsertLink();
                }}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center gap-2 transition"
              >
                <Link className="w-4 h-4 text-purple-500" />
                <span>Hyperlink</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  safeChain(editor).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  setSheetOpen(false);
                }}
                className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center gap-2 transition col-span-2"
              >
                <Table className="w-4 h-4 text-amber-500" />
                <span>Insert 3x3 Table</span>
              </button>
            </div>

            {/* Contextual Table Controls when cursor is inside a table */}
            {isTableActive && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 mt-2">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-amber-600" />
                  <span>Table Controls</span>
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => safeChain(editor).addColumnAfter().run()}
                    className="p-1.5 rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-[11px] flex items-center justify-center gap-1"
                  >
                    <Columns className="w-3 h-3" />
                    <span>Add Column</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChain(editor).addRowAfter().run()}
                    className="p-1.5 rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-[11px] flex items-center justify-center gap-1"
                  >
                    <Rows className="w-3 h-3" />
                    <span>Add Row</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChain(editor).deleteColumn().run()}
                    className="p-1.5 rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-rose-600 dark:text-rose-400 text-[11px] flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Column</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => safeChain(editor).deleteRow().run()}
                    className="p-1.5 rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-rose-600 dark:text-rose-400 text-[11px] flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Row</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      safeChain(editor).deleteTable().run();
                      setSheetOpen(false);
                    }}
                    className="p-1.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center justify-center gap-1 col-span-2"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Entire Table</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Creative Studios & Utilities */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-500 dark:text-stone-400 uppercase text-[10px] tracking-wider font-mono">
              Creative Studios & Utilities
            </div>
            <div className="grid grid-cols-2 gap-2">
              {onOpenExport && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenExport();
                  }}
                  className="p-3 rounded-lg border border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-center gap-2 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition col-span-2"
                >
                  <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-amber-950 dark:text-amber-200">Export Manuscript & Printable Studio</span>
                </button>
              )}
              {onToggleFindReplace && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onToggleFindReplace();
                  }}
                  className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
                >
                  <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Find & Replace</span>
                </button>
              )}
              {onOpenCollab && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenCollab();
                  }}
                  className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 transition ${
                    isCollabActive
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{isCollabActive ? `Live Collab (${collabCount})` : 'Live Collab'}</span>
                </button>
              )}
              {onOpenDrawing && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenDrawing();
                  }}
                  className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
                >
                  <Palette className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Drawing Studio</span>
                </button>
              )}
              {onOpenSignature && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenSignature();
                  }}
                  className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
                >
                  <PenTool className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Author Signature</span>
                </button>
              )}
              {onOpenTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onOpenTemplate();
                  }}
                  className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-800 transition col-span-2"
                >
                  <LayoutTemplate className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Template Designer</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
};
