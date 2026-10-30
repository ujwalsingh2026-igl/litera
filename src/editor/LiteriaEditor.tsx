import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { getEditorExtensions } from './extensions';
import { EditorToolbar } from './EditorToolbar';
import { MobileEditorToolbar } from './MobileEditorToolbar';
import { EditorStatusBar } from './EditorStatusBar';
import { FindAndReplace } from './FindAndReplace';
import { TypeSpecificToolbar } from './TypeSpecificToolbar';
import { useApp } from '../state';
import { documentService } from '../services/documentService';
import { bookService } from '../services/bookService';
import { calculateEnhancedStats, getDefaultMetadataForType } from './documentTemplates';
import { FocusModeHUD, type FocusDepth } from '../components/focus/FocusModeHUD';
import { ExportManuscriptModal } from '../components/export/ExportManuscriptModal';
import { AuthorSignatureModal } from '../components/signature/AuthorSignatureModal';
import { DrawingStudioModal } from '../components/drawing/DrawingStudioModal';
import { TemplateDesignerModal } from '../components/templates/TemplateDesignerModal';
import { GlobalAiModal } from '../components/ai/GlobalAiModal';
import { OnlineImageSeekerModal } from '../components/media/OnlineImageSeekerModal';
import { LiveCollabModal } from '../components/collab/LiveCollabModal';
import { realtimeCollabService } from '../services/realtimeCollabService';
import { useAuth } from '../auth';
import { googleCloudSyncService } from '../services/googleCloudSyncService';
import type { Document, DocumentStats, DocumentType, DocumentTypeMetadata, Chapter, Book } from '../types';
import './editor.css';

const DOC_TYPE_LABELS: Record<DocumentType, { label: string; icon: string }> = {
  blank: { label: 'Blank Document', icon: '📄' },
  note: { label: 'Note', icon: '📝' },
  story: { label: 'Story', icon: '✨' },
  novel: { label: 'Novel', icon: '📖' },
  book: { label: 'Book', icon: '📚' },
  poem: { label: 'Poem', icon: '🪶' },
  script: { label: 'Script', icon: '🎬' },
  comic: { label: 'Comic', icon: '💬' },
  journal: { label: 'Journal', icon: '📔' },
  draft: { label: 'Draft', icon: '⏳' },
};

export const LiteriaEditor: React.FC = () => {
  const { activeDocument, setActiveDocument, distractionFree, setDistractionFree, settings } = useApp();
  const [doc, setDoc] = useState<Document | null>(activeDocument);
  const { user } = useAuth();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [title, setTitle] = useState<string>(activeDocument?.title || 'Untitled');
  const [stats, setStats] = useState<DocumentStats>(
    activeDocument?.stats || calculateEnhancedStats('blank', '', '')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [isCollabActive, setIsCollabActive] = useState(false);
  const [collabCount, setCollabCount] = useState(1);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [drawingModalOpen, setDrawingModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [imageSeekerOpen, setImageSeekerOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [bookChapters, setBookChapters] = useState<Chapter[]>([]);
  const [parentBook, setParentBook] = useState<Book | null>(null);
  const [focusDepth, setFocusDepth] = useState<FocusDepth>('off');
  const [typewriterMode, setTypewriterMode] = useState<boolean>(
    settings.editor.typewriterMode || false
  );

  const saveTimeoutRef = useRef<number | null>(null);
  const titleSaveTimeoutRef = useRef<number | null>(null);
  const titleRef = useRef<string>(activeDocument?.title || 'Untitled');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const currentDocIdRef = useRef<string | null>(activeDocument?.id || null);
  const loadedDocIdRef = useRef<string | null>(null);
  const latestDraftRef = useRef<{ id: string; html: string; text: string } | null>(null);

  // Sync chapters and book details when editing a book document
  useEffect(() => {
    if (doc?.bookId) {
      bookService.getChapters(doc.bookId).then(setBookChapters);
      bookService.getById(doc.bookId).then((b) => setParentBook(b || null));
    } else {
      setBookChapters([]);
      setParentBook(null);
    }
  }, [doc?.bookId]);

  // Sync when activeDocument changes from outside
  useEffect(() => {
    if (activeDocument) {
      // Guard: Only switch document if the document ID actually changed!
      // If we are already on this document, do NOT wipe the in-memory title or state!
      if (currentDocIdRef.current !== activeDocument.id) {
        currentDocIdRef.current = activeDocument.id;
        setDoc(activeDocument);
        setTitle(activeDocument.title);
        titleRef.current = activeDocument.title;
        setStats(
          activeDocument.stats ||
            calculateEnhancedStats(
              activeDocument.type,
              (activeDocument.content || '').replace(/<[^>]+>/g, ' '),
              activeDocument.content || ''
            )
        );
      }
    } else {
      // Auto-load latest document or create initial one if none active
      (async () => {
        const latest = await documentService.getLatest();
        if (latest) {
          setActiveDocument(latest);
        } else {
          const fresh = await documentService.create('Welcome to LITERIA', 'blank');
          setActiveDocument(fresh);
        }
      })();
    }
  }, [activeDocument, setActiveDocument]);

  // Setup TipTap Editor
  const editor = useEditor({
    extensions: getEditorExtensions(),
    content: doc?.content || '',
    editorProps: {
      attributes: {
        class:
          'focus:outline-none min-h-[500px] max-w-none font-serif text-[var(--color-text-primary)] text-lg selection:bg-amber-100 dark:selection:bg-amber-900/40',
        spellcheck: settings.editor.spellCheck ? 'true' : 'false',
        autocorrect: 'on',
        autocapitalize: 'sentences',
        autocomplete: 'on',
      },
      handleDOMEvents: {
        // Prevent virtual keyboard from disappearing when user interacts with spelling correction tabs/bubbles
        beforeinput: (view, event: Event) => {
          const inputEvent = event as InputEvent;
          if (
            inputEvent.inputType === 'insertReplacementText' ||
            inputEvent.inputType === 'insertFromSpellChecker' ||
            inputEvent.inputType === 'insertText'
          ) {
            if (!view.hasFocus()) {
              view.focus();
            }
          }
          return false;
        },
        touchend: (view, event: TouchEvent) => {
          if (event.target instanceof HTMLElement && event.target.closest('.tiptap')) {
            requestAnimationFrame(() => {
              if (!view.hasFocus()) {
                view.focus();
              }
            });
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setHasUnsaved(true);
      const text = currentEditor.getText();
      const html = currentEditor.getHTML();
      const newStats = calculateEnhancedStats(doc?.type || 'blank', text, html);
      setStats(newStats);

      // Smooth dynamic scrolling only for typewriter mode; in normal mode let browser natively keep typing caret in view without forcing container scroll
      if (typewriterMode) {
        window.requestAnimationFrame(() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect && rect.top > 0) {
              const targetY = window.innerHeight / 2;
              const delta = rect.top - targetY;
              if (Math.abs(delta) > 30) {
                window.scrollBy({ top: delta, behavior: 'smooth' });
              }
            }
          }
        });
      }

      // Emergency snapshot in localStorage (crash-proofing) & update latest draft ref
      if (currentDocIdRef.current) {
        latestDraftRef.current = {
          id: currentDocIdRef.current,
          html,
          text,
        };
        try {
          localStorage.setItem(`literia_snapshot_${currentDocIdRef.current}`, html);
          localStorage.setItem(`literia_snapshot_time_${currentDocIdRef.current}`, String(Date.now()));
        } catch {
          // ignore quota exceeded
        }
        // Broadcast real-time edit only if explicitly connected to a collaboration room
        if (realtimeCollabService.getRoomId()) {
          realtimeCollabService.broadcastEdit(currentDocIdRef.current, html, titleRef.current);
        }
      }

      // Fast debounced save to IndexedDB & Google Cloud Vault (400ms)
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(async () => {
        if (!currentDocIdRef.current) return;
        setIsSaving(true);
        try {
          await documentService.update(currentDocIdRef.current, {
            title: titleRef.current,
            content: html,
            plainTextPreview: text.slice(0, 160),
          });
          setHasUnsaved(false);

          // Queue or immediately sync to Google Cloud Vault
          if (currentDocIdRef.current) {
            googleCloudSyncService.queueOrSyncDocument(currentDocIdRef.current, user);
          }
        } catch (err) {
          console.error('Failed to save document:', err);
        } finally {
          setIsSaving(false);
        }
      }, 400);
    },
  });

  // Flush unsaved draft changes immediately (Exit-flush & Unmount protection)
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (titleSaveTimeoutRef.current) {
      window.clearTimeout(titleSaveTimeoutRef.current);
      titleSaveTimeoutRef.current = null;
    }

    const currentDraft = latestDraftRef.current;
    const docId = currentDraft?.id || currentDocIdRef.current;
    if (!docId) return;

    const html = currentDraft?.html || (editor ? editor.getHTML() : '');
    const text = currentDraft?.text || (editor ? editor.getText() : '');

    // Skip if completely empty without draft
    if (!html && !text && !titleRef.current) return;

    // Synchronously write to emergency crash snapshot
    try {
      localStorage.setItem(`literia_snapshot_${docId}`, html);
      localStorage.setItem(`literia_snapshot_time_${docId}`, String(Date.now()));
    } catch {}

    // Flush directly to Dexie IndexedDB
    documentService.update(docId, {
      title: titleRef.current,
      content: html,
      plainTextPreview: text.slice(0, 160),
    }).catch(console.error);

    // Queue sync to Google Cloud Vault
    try {
      googleCloudSyncService.queueOrSyncDocument(docId, user);
    } catch {}
  }, [editor, user]);

  // Attach immediate flush listeners to window unload, pagehide, and visibilitychange
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSave();
    };
    const handlePageHide = () => {
      flushSave();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Flush immediately when leaving editor / unmounting
      flushSave();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushSave]);

  // Update editor content whenever active document changes or editor is ready
  useEffect(() => {
    if (!editor || !doc) return;

    if (loadedDocIdRef.current !== doc.id) {
      loadedDocIdRef.current = doc.id;
      currentDocIdRef.current = doc.id;

      // Check emergency snapshot
      const snapshot = localStorage.getItem(`literia_snapshot_${doc.id}`);
      const snapshotTime = Number(localStorage.getItem(`literia_snapshot_time_${doc.id}`) || 0);
      const snapshotText = snapshot ? snapshot.replace(/<[^>]+>/g, '').trim() : '';
      const docText = (doc.content || '').replace(/<[^>]+>/g, '').trim();

      // Determine best content:
      // If snapshot exists and has text:
      // - If doc has no text, use snapshot!
      // - If snapshot is newer than doc.updatedAt, use snapshot!
      // - If snapshot has more text than doc, use snapshot!
      let contentToLoad = doc.content || '';
      if (snapshotText.length > 0) {
        if (docText.length === 0 || snapshotTime > (doc.updatedAt || 0) || snapshotText.length > docText.length) {
          console.log(`[LiteriaEditor] Recovering latest draft from emergency snapshot for doc ${doc.id}`);
          contentToLoad = snapshot!;
          // Immediately update Dexie with the recovered content
          documentService.update(doc.id, {
            content: contentToLoad,
            plainTextPreview: snapshotText.slice(0, 160),
          }).catch(console.error);
        }
      }

      editor.commands.setContent(contentToLoad, { emitUpdate: false });
      latestDraftRef.current = {
        id: doc.id,
        html: contentToLoad,
        text: contentToLoad.replace(/<[^>]+>/g, ' '),
      };
      setHasUnsaved(false);
    }
  }, [doc, editor]);

  // Listen for remote document updates from Cloud Sync
  useEffect(() => {
    const handleDocumentSync = async (event: Event) => {
      const customEvent = event as CustomEvent<{ documentId?: string; doc?: Document }>;
      const updatedId = customEvent.detail?.documentId;
      if (updatedId && doc && updatedId === doc.id) {
        // CRITICAL: If the user is currently focused/typing in the editor OR in the title input, NEVER overwrite!
        // The in-memory editor and title state are authoritative.
        const isTitleFocused = document.activeElement === titleInputRef.current;
        if (editor?.isFocused || isTitleFocused) {
          return;
        }

        const fresh = customEvent.detail?.doc || (await documentService.getById(updatedId));
        if (fresh && fresh.content) {
          const currentHtml = editor?.getHTML() || '';
          if (editor && !hasUnsaved && currentHtml !== fresh.content) {
            const { from, to } = editor.state.selection;
            editor.commands.setContent(fresh.content, { emitUpdate: false });
            const maxPos = editor.state.doc.content.size;
            try {
              editor.commands.setTextSelection({
                from: Math.min(from, maxPos),
                to: Math.min(to, maxPos),
              });
            } catch {
              // Ignore if selection couldn't be restored
            }
            setDoc(fresh);
            if (!isTitleFocused) {
              setTitle(fresh.title);
              titleRef.current = fresh.title;
            }
            setStats(fresh.stats);
            setHasUnsaved(false);
          }
        }
      }
    };

    window.addEventListener('literia:document-updated', handleDocumentSync as EventListener);
    window.addEventListener('literia:documents-updated', handleDocumentSync as EventListener);
    return () => {
      window.removeEventListener('literia:document-updated', handleDocumentSync as EventListener);
      window.removeEventListener('literia:documents-updated', handleDocumentSync as EventListener);
    };
  }, [editor, doc, hasUnsaved]);

  // Direct insertion listener for AI Companion prose or external text
  useEffect(() => {
    const handleInsertContent = (event: Event) => {
      const customEvent = event as CustomEvent<{ html?: string; text?: string }>;
      const htmlToInsert = customEvent.detail?.html;
      const textToInsert = customEvent.detail?.text;
      if (!editor || (!htmlToInsert && !textToInsert)) return;

      const payload = htmlToInsert || `<p>${textToInsert}</p>`;
      editor.chain().focus().insertContent(payload).run();

      // Immediately synchronize and persist
      const updatedHtml = editor.getHTML();
      const updatedText = editor.getText();
      const docId = currentDocIdRef.current;
      if (docId) {
        latestDraftRef.current = {
          id: docId,
          html: updatedHtml,
          text: updatedText,
        };
        try {
          localStorage.setItem(`literia_snapshot_${docId}`, updatedHtml);
          localStorage.setItem(`literia_snapshot_time_${docId}`, String(Date.now()));
        } catch {}

        documentService.update(docId, {
          content: updatedHtml,
          plainTextPreview: updatedText.slice(0, 160),
        }).catch(console.error);

        // Notify collab room
        realtimeCollabService.broadcastEdit(docId, updatedHtml, title);
      }
    };

    window.addEventListener('literia:insert-content', handleInsertContent as EventListener);
    return () => {
      window.removeEventListener('literia:insert-content', handleInsertContent as EventListener);
    };
  }, [editor, title]);

  // Real-time peer editing listener and presence sync
  useEffect(() => {
    const unsubContent = realtimeCollabService.onContent((remoteHtml, _senderName, remoteTitle) => {
      const isTitleFocused = document.activeElement === titleInputRef.current;
      if (editor) {
        // If author is actively typing, do not disrupt their in-progress typing session
        if (editor.isFocused || isTitleFocused) {
          return;
        }
        const currentHtml = editor.getHTML();
        if (currentHtml !== remoteHtml) {
          const { from, to } = editor.state.selection;
          editor.commands.setContent(remoteHtml, { emitUpdate: false });
          const maxPos = editor.state.doc.content.size;
          try {
            editor.commands.setTextSelection({
              from: Math.min(from, maxPos),
              to: Math.min(to, maxPos),
            });
          } catch {
            // Ignore
          }
        }
      }
      if (remoteTitle && remoteTitle !== titleRef.current && !isTitleFocused) {
        setTitle(remoteTitle);
        titleRef.current = remoteTitle;
      }
    });

    const unsubCollab = realtimeCollabService.onCollaborators((list) => {
      setCollabCount(list.length);
    });

    const unsubStatus = realtimeCollabService.onStatus((_connected, roomId) => {
      setIsCollabActive(Boolean(roomId));
    });

    // Only join real-time collaboration room if explicitly in collaboration mode (via invite link / hash)
    if (typeof window !== 'undefined' && user && doc) {
      const hash = window.location.hash;
      if (hash.includes('collab=')) {
        const targetRoom = hash.split('collab=')[1].split('&')[0].replace(/[^A-Z0-9_-]/g, '');
        if (targetRoom) {
          realtimeCollabService.joinRoom(targetRoom, user, doc.content || '', doc.title || '');
        }
      }
    }

    return () => {
      unsubContent();
      unsubCollab();
      unsubStatus();
      realtimeCollabService.leaveRoom();
    };
  }, [editor, user, doc?.id]);

  // Handle immediate manual save (Ctrl+S)
  const handleImmediateSave = useCallback(async () => {
    if (!currentDocIdRef.current || !editor) return;
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    if (titleSaveTimeoutRef.current) {
      window.clearTimeout(titleSaveTimeoutRef.current);
    }
    setIsSaving(true);
    const currentTitle = titleRef.current;
    const html = editor.getHTML();
    const text = editor.getText();
    try {
      await documentService.update(currentDocIdRef.current, {
        title: currentTitle,
        content: html,
        plainTextPreview: text.slice(0, 160),
      });
      setHasUnsaved(false);
      setActiveDocument((prev: Document | null) => (prev && prev.id === currentDocIdRef.current ? { ...prev, title: currentTitle } : prev));
      googleCloudSyncService.queueOrSyncDocument(currentDocIdRef.current, user);
    } finally {
      setIsSaving(false);
    }
  }, [editor, user]);

  // Title change handler with dedicated debounce timer & instant state sync
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    titleRef.current = newTitle;
    setHasUnsaved(true);

    // Keep doc in sync immediately in local memory so UI stays consistent
    setDoc((prev) => (prev ? { ...prev, title: newTitle } : prev));

    if (titleSaveTimeoutRef.current) {
      window.clearTimeout(titleSaveTimeoutRef.current);
    }

    titleSaveTimeoutRef.current = window.setTimeout(async () => {
      const docId = currentDocIdRef.current;
      if (!docId) return;
      setIsSaving(true);
      try {
        await documentService.rename(docId, newTitle);
        setHasUnsaved(false);
        setActiveDocument((prev: Document | null) => (prev && prev.id === docId ? { ...prev, title: newTitle } : prev));
        googleCloudSyncService.queueOrSyncDocument(docId, user);
      } finally {
        setIsSaving(false);
      }
    }, 500);
  };

  // Immediate title commit on blur or Enter
  const handleTitleBlur = async () => {
    if (titleSaveTimeoutRef.current) {
      window.clearTimeout(titleSaveTimeoutRef.current);
      titleSaveTimeoutRef.current = null;
    }
    const docId = currentDocIdRef.current;
    if (!docId) return;
    const finalTitle = titleRef.current.trim() || 'Untitled Document';
    setTitle(finalTitle);
    titleRef.current = finalTitle;
    setDoc((prev) => (prev ? { ...prev, title: finalTitle } : prev));
    setActiveDocument((prev: Document | null) => (prev && prev.id === docId ? { ...prev, title: finalTitle } : prev));
    try {
      await documentService.rename(docId, finalTitle);
      setHasUnsaved(false);
      googleCloudSyncService.queueOrSyncDocument(docId, user);
    } catch (e) {
      console.warn('Failed to save title on blur:', e);
    }
  };

  // Document Type Change Handler
  const handleDocumentTypeChange = async (newType: DocumentType) => {
    if (!doc || !currentDocIdRef.current) return;
    const defaultMeta = getDefaultMetadataForType(newType);
    const updatedDoc: Document = {
      ...doc,
      type: newType,
      metadata: defaultMeta,
    };
    setDoc(updatedDoc);
    setTypeDropdownOpen(false);
    await documentService.update(doc.id, {
      type: newType,
      metadata: defaultMeta,
    });
  };

  // Metadata Update Handler
  const handleUpdateMetadata = async (newMetadata: DocumentTypeMetadata) => {
    if (!doc || !currentDocIdRef.current) return;
    const updated = { ...doc, metadata: newMetadata };
    setDoc(updated);
    await documentService.update(doc.id, { metadata: newMetadata });
  };

  // Chapter switch handler inside multi-chapter book
  const handleSwitchChapter = async (targetChapter: Chapter) => {
    if (!editor || !doc) return;
    if (doc.chapterId) {
      await bookService.updateChapter(doc.chapterId, { content: editor.getHTML() });
    }
    editor.commands.setContent(targetChapter.content);
    setTitle(targetChapter.title);
    titleRef.current = targetChapter.title;
    const updatedDoc: Document = {
      ...doc,
      title: targetChapter.title,
      chapterId: targetChapter.id,
      content: targetChapter.content,
    };
    setDoc(updatedDoc);
    setActiveDocument(updatedDoc);
    await documentService.update(doc.id, {
      title: targetChapter.title,
      chapterId: targetChapter.id,
      content: targetChapter.content,
    });
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleImmediateSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindReplaceOpen((prev) => !prev);
      }
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setTypewriterMode((prev) => !prev);
      }
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setDistractionFree(!distractionFree);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleImmediateSave, distractionFree, setDistractionFree]);

  const widthClassMap: Record<string, string> = {
    narrow: 'max-w-xl',
    medium: 'max-w-3xl',
    wide: 'max-w-5xl',
    full: 'max-w-none px-4',
  };

  const fontClassMap: Record<string, string> = {
    serif: 'font-serif-literary',
    sans: 'font-sans-literary',
    mono: 'font-mono-literary',
    classic: 'font-classic-literary',
    modern: 'font-sans-literary',
    handwriting: 'font-handwriting-literary',
  };

  const currentFontClass = fontClassMap[settings.appearance.fontFamily] || 'font-serif-literary';
  const currentWidthClass = widthClassMap[settings.appearance.writingWidth] || 'max-w-3xl';

  return (
    <div
      className={`flex flex-col h-full bg-[var(--color-bg)] text-[var(--color-text-primary)] relative overflow-hidden transition-colors duration-200 ${currentFontClass} ${
        distractionFree ? 'pt-[env(safe-area-inset-top,0px)]' : ''
      }`}
    >
      {/* Desktop Toolbar (Hidden on mobile screens and in Distraction-Free mode) */}
      {!distractionFree && (
        <div className="hidden md:block">
          <EditorToolbar
            editor={editor}
            onToggleFindReplace={() => setFindReplaceOpen((prev) => !prev)}
            onOpenExport={() => setExportModalOpen(true)}
            onOpenSignature={() => setSignatureModalOpen(true)}
            onOpenDrawing={() => setDrawingModalOpen(true)}
            onOpenTemplate={() => setTemplateModalOpen(true)}
            onOpenAi={() => setAiModalOpen(true)}
            onOpenCollab={() => setCollabModalOpen(true)}
            onOpenImageSeeker={() => setImageSeekerOpen(true)}
            isCollabActive={isCollabActive}
            collabCount={collabCount}
          />

          {/* Type-Specific Specialized Toolbar */}
          {doc && (
            <TypeSpecificToolbar
              editor={editor}
              document={doc}
              onUpdateMetadata={handleUpdateMetadata}
            />
          )}

          {/* Book Chapter Navigator Ribbon */}
          {doc?.bookId && bookChapters.length > 0 && (
            <div className="px-4 py-1.5 border-b border-amber-600/20 bg-amber-500/5 dark:bg-amber-500/10 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-amber-900 dark:text-amber-400">
                  📖 Chapter Navigation:
                </span>
                <select
                  value={doc.chapterId || ''}
                  onChange={(e) => {
                    const target = bookChapters.find((c) => c.id === e.target.value);
                    if (target) handleSwitchChapter(target);
                  }}
                  aria-label="Select book chapter"
                  className="text-xs px-2 py-0.5 rounded border border-amber-600/30 bg-white dark:bg-stone-800 font-serif outline-none"
                >
                  {bookChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.number}: {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const idx = bookChapters.findIndex((c) => c.id === doc.chapterId);
                    if (idx > 0) handleSwitchChapter(bookChapters[idx - 1]);
                  }}
                  disabled={bookChapters.findIndex((c) => c.id === doc.chapterId) <= 0}
                  className="px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-30 text-[11px]"
                >
                  ← Prev Chapter
                </button>
                <button
                  onClick={() => {
                    const idx = bookChapters.findIndex((c) => c.id === doc.chapterId);
                    if (idx >= 0 && idx < bookChapters.length - 1) handleSwitchChapter(bookChapters[idx + 1]);
                  }}
                  disabled={bookChapters.findIndex((c) => c.id === doc.chapterId) >= bookChapters.length - 1}
                  className="px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 disabled:opacity-30 text-[11px]"
                >
                  Next Chapter →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Find & Replace */}
      <FindAndReplace
        editor={editor}
        isOpen={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
      />

      {/* Floating Focus Mode & Ambient Atmosphere HUD */}
      <FocusModeHUD
        focusDepth={focusDepth}
        onChangeFocusDepth={setFocusDepth}
        typewriterMode={typewriterMode}
        onToggleTypewriter={() => setTypewriterMode((prev) => !prev)}
        wordCount={stats.words}
      />

      {/* Writing Canvas - Pure block container for natural dynamic vertical expansion */}
      <div
        data-focus-depth={focusDepth}
        data-writing-mode={settings.appearance.writingMode || 'paper'}
        className={`flex-1 overflow-y-auto px-3 sm:px-8 md:px-12 py-4 sm:py-8 custom-scrollbar block ${
          typewriterMode ? 'typewriter-canvas' : ''
        }`}
      >
        <main
          className={`w-full ${currentWidthClass} mx-auto block min-h-[calc(100vh-8rem)] h-auto writing-sheet transition-colors duration-200`}
          style={{
            fontSize: `${settings.appearance.largerText ? settings.appearance.fontSize + 2 : settings.appearance.fontSize}px`,
            lineHeight: settings.appearance.increasedLineHeight ? settings.appearance.lineHeight + 0.2 : settings.appearance.lineHeight,
            letterSpacing: `${settings.appearance.letterSpacing}px`,
          }}
        >
          {/* Header Row: Document Type Badge & Title */}
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between">
              {/* Type Switcher Pill */}
              <div className="relative">
                <button
                  onClick={() => setTypeDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-stone-200 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-800/60 hover:bg-stone-200/60 dark:hover:bg-stone-700/60 transition"
                  title="Switch Document Format"
                >
                  <span>{DOC_TYPE_LABELS[doc?.type || 'blank'].icon}</span>
                  <span className="capitalize">{DOC_TYPE_LABELS[doc?.type || 'blank'].label}</span>
                  <span className="text-[10px] text-stone-400">▾</span>
                </button>

                {typeDropdownOpen && (
                  <div className="absolute left-0 top-8 z-50 p-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-lg flex flex-col gap-0.5 min-w-[160px] animate-in fade-in duration-100">
                    {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => handleDocumentTypeChange(t)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                          doc?.type === t
                            ? 'bg-amber-100/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-medium'
                            : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        <span>{DOC_TYPE_LABELS[t].icon}</span>
                        <span>{DOC_TYPE_LABELS[t].label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Form / Genre Tag indicator */}
              {doc?.type === 'poem' && doc.metadata?.poem?.form && (
                <span className="text-[11px] font-mono text-stone-400 capitalize">
                  Form: {doc.metadata.poem.form}
                </span>
              )}
              {doc?.type === 'script' && doc.metadata?.script?.format && (
                <span className="text-[11px] font-mono text-stone-400 capitalize">
                  {doc.metadata.script.format} Screenplay
                </span>
              )}
            </div>

            {/* Document Title Input */}
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                  editor?.commands.focus('start');
                }
              }}
              placeholder="Untitled Document"
              className="w-full text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] bg-transparent border-none outline-none focus:ring-0 tracking-tight transition-colors"
            />
            <div className="h-0.5 w-16 bg-[var(--color-accent)]/40 mt-3 rounded-full" />
          </div>

          {/* TipTap Rich Text Area */}
          <div className="cursor-text pb-40 writing-sheet-content">
            <EditorContent editor={editor} />
          </div>
        </main>
      </div>

      {/* Mobile Toolbar (Visible on touch/small viewports) */}
      <MobileEditorToolbar
        editor={editor}
        onOpenAi={() => setAiModalOpen(true)}
        stats={stats}
        onOpenExport={() => setExportModalOpen(true)}
        onOpenSignature={() => setSignatureModalOpen(true)}
        onOpenDrawing={() => setDrawingModalOpen(true)}
        onOpenTemplate={() => setTemplateModalOpen(true)}
        onToggleFindReplace={() => setFindReplaceOpen((prev) => !prev)}
        onOpenCollab={() => setCollabModalOpen(true)}
        onOpenImageSeeker={() => setImageSeekerOpen(true)}
        isCollabActive={isCollabActive}
        collabCount={collabCount}
      />

      {/* Status Bar */}
      <EditorStatusBar
        stats={stats}
        isSaving={isSaving}
        hasUnsaved={hasUnsaved}
      />

      {/* Real-time Cloud Share & Live Collaboration Studio */}
      <LiveCollabModal
        isOpen={collabModalOpen}
        onClose={() => setCollabModalOpen(false)}
        document={doc}
      />

      {/* Export, Signature, Drawing, Template & AI Modals */}
      <ExportManuscriptModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        document={doc}
        bookTitle={parentBook?.title}
        bookSubtitle={parentBook?.subtitle}
        author={parentBook?.author || settings.signature?.typedName || user?.displayName || 'Author'}
        genre={parentBook?.genre}
        chapters={bookChapters.length > 0 ? bookChapters : undefined}
        liveContent={editor ? editor.getHTML() : undefined}
      />

      <AuthorSignatureModal
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
      />

      <DrawingStudioModal
        isOpen={drawingModalOpen}
        onClose={() => setDrawingModalOpen(false)}
      />

      <TemplateDesignerModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
      />

      <GlobalAiModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
      />

      <OnlineImageSeekerModal
        isOpen={imageSeekerOpen}
        onClose={() => setImageSeekerOpen(false)}
        onInsertImage={(url, caption) => {
          if (editor) {
            editor.chain().focus().setImage({ src: url, alt: caption || 'Manuscript illustration' }).run();
          }
        }}
      />
    </div>
  );
};
