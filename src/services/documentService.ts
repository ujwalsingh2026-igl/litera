import { db } from '../storage/db';
import type { Document, DocumentType } from '../types';
import { generateSafeId } from '../utils/security';
import { activityService } from './activityService';
import { googleCloudSyncService } from './googleCloudSyncService';
import { syncQueue } from '../sync/syncQueue';
import { syncEngine } from '../sync/syncEngine';
import {
  getDocumentTypeTemplate,
  getDefaultMetadataForType,
  calculateEnhancedStats,
} from '../editor/documentTemplates';

async function enqueueDocSync(
  docId: string,
  operation: 'upsert' | 'delete',
  baseRev: number
): Promise<void> {
  try {
    await syncQueue.enqueue(docId, operation, baseRev);
    syncEngine.notifyChange();
  } catch (e) {
    console.warn('[Sync] Failed to enqueue outbox change:', e);
  }
}

function notifyCloudSync(docId: string, operation: 'upsert' | 'delete' = 'upsert', baseRev = 1) {
  enqueueDocSync(docId, operation, baseRev);
  try {
    const raw = localStorage.getItem('literia_auth_user') || localStorage.getItem('literia_auth_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      const user = parsed.user || parsed;
      if (user && user.provider !== 'guest') {
        googleCloudSyncService.queueOrSyncDocument(docId, user);
      }
    }
  } catch {}
}

export const documentService = {
  async getAll(): Promise<Document[]> {
    const docs = await db.documents.toArray();
    // Auto-resurrect drafts whose content was blanked out if an emergency snapshot exists
    for (const doc of docs) {
      if (!doc.isDeleted) {
        const docText = (doc.content || '').replace(/<[^>]+>/g, '').trim();
        if (docText.length === 0) {
          try {
            const snapshot = localStorage.getItem(`literia_snapshot_${doc.id}`);
            const snapshotText = snapshot ? snapshot.replace(/<[^>]+>/g, '').trim() : '';
            if (snapshotText.length > 0) {
              doc.content = snapshot!;
              doc.plainTextPreview = snapshotText.slice(0, 160);
              db.documents.update(doc.id, {
                content: doc.content,
                plainTextPreview: doc.plainTextPreview,
                updatedAt: Date.now(),
              }).catch(() => {});
            }
          } catch {}
        }
      }
    }
    return docs.filter((d) => !d.isDeleted);
  },

  async getById(id: string): Promise<Document | undefined> {
    const doc = await db.documents.get(id);
    if (doc && !doc.isDeleted) {
      // Auto-resurrect blank manuscript content from emergency snapshot if available
      const docText = (doc.content || '').replace(/<[^>]+>/g, '').trim();
      if (docText.length === 0) {
        try {
          const snapshot = localStorage.getItem(`literia_snapshot_${id}`);
          const snapshotText = snapshot ? snapshot.replace(/<[^>]+>/g, '').trim() : '';
          if (snapshotText.length > 0) {
            console.log(`[documentService] Rescued blank document ${id} from emergency snapshot!`);
            doc.content = snapshot!;
            doc.plainTextPreview = snapshotText.slice(0, 160);
            await db.documents.update(id, {
              content: doc.content,
              plainTextPreview: doc.plainTextPreview,
              updatedAt: Date.now(),
            });
          }
        } catch {}
      }

      await db.documents.update(id, { lastOpenedAt: Date.now() });
      return { ...doc, lastOpenedAt: Date.now() };
    }
    return undefined;
  },

  async getLatest(): Promise<Document | null> {
    const docs = await this.getAll();
    if (docs.length === 0) return null;
    return docs.sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt))[0];
  },

  async create(title = 'Untitled', type: DocumentType = 'blank', content = ''): Promise<Document> {
    const now = Date.now();
    const finalContent = content || getDocumentTypeTemplate(type, title);
    const plainText = finalContent.replace(/<[^>]+>/g, ' ');
    const stats = calculateEnhancedStats(type, plainText, finalContent);
    const metadata = getDefaultMetadataForType(type);

    const newDoc: Document = {
      id: generateSafeId(),
      title,
      type,
      content: finalContent,
      plainTextPreview: plainText.slice(0, 160),
      tags: [],
      isFavorite: false,
      isArchived: false,
      isDraft: true,
      isDeleted: false,
      version: 1,
      stats,
      metadata,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    await db.documents.add(newDoc);
    await activityService.log('created', newDoc.id, newDoc.title, 'document');
    notifyCloudSync(newDoc.id, 'upsert', 0);
    return newDoc;
  },

  async update(id: string, updates: Partial<Document>): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing) return;

    let content = updates.content !== undefined ? updates.content : existing.content;
    const existingText = (existing.content || '').replace(/<[^>]+>/g, '').trim();
    const incomingText = (content || '').replace(/<[^>]+>/g, '').trim();

    // Anti-Destruction Guard:
    // If existing document has substantive text (> 5 characters), and incoming update is blank / empty (<p></p>),
    // DO NOT allow the empty content to destroy the existing manuscript!
    if (existingText.length > 5 && incomingText.length === 0 && updates.content !== undefined) {
      console.warn(`[documentService] Anti-destruction guard triggered for document ${id}. Preserving ${existingText.length} characters.`);
      content = existing.content;
      delete updates.content;
      delete updates.plainTextPreview;
    }

    const plainText = content.replace(/<[^>]+>/g, ' ');
    const docType = updates.type || existing.type;
    const stats = updates.content !== undefined ? calculateEnhancedStats(docType, plainText, content) : existing.stats;
    const metadata = updates.metadata ? { ...existing.metadata, ...updates.metadata } : existing.metadata;
    const nextVersion = (existing.version || 1) + 1;

    await db.documents.update(id, {
      ...updates,
      content,
      plainTextPreview: plainText.slice(0, 160),
      stats,
      metadata,
      version: nextVersion,
      updatedAt: Date.now(),
    });

    notifyCloudSync(id, 'upsert', existing.version || 1);

    if (updates.title && updates.title !== existing.title) {
      await activityService.log('renamed', id, updates.title, 'document');
    } else if (updates.content !== undefined) {
      await activityService.log('edited', id, existing.title, 'document');
    }
  },

  async rename(id: string, newTitle: string): Promise<void> {
    await this.update(id, { title: newTitle.trim() || 'Untitled' });
  },

  async duplicate(id: string): Promise<Document | null> {
    const existing = await db.documents.get(id);
    if (!existing) return null;

    const now = Date.now();
    const copy: Document = {
      ...existing,
      id: generateSafeId(),
      title: `${existing.title} (Copy)`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    await db.documents.add(copy);
    await activityService.log('created', copy.id, copy.title, 'document', { duplicateOf: id });
    notifyCloudSync(copy.id, 'upsert', 0);
    return copy;
  },

  async moveToFolder(id: string, folderId: string | null): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing) return;
    await db.documents.update(id, { folderId, updatedAt: Date.now() });
    await activityService.log('moved', id, existing.title, 'document', { folderId });
    notifyCloudSync(id, 'upsert', existing.version || 1);
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const existing = await db.documents.get(id);
    if (!existing) return false;
    const nextFav = !existing.isFavorite;
    await db.documents.update(id, { isFavorite: nextFav, updatedAt: Date.now() });
    notifyCloudSync(id, 'upsert', existing.version || 1);
    return nextFav;
  },

  async toggleArchive(id: string): Promise<boolean> {
    const existing = await db.documents.get(id);
    if (!existing) return false;
    const nextArchived = !existing.isArchived;
    await db.documents.update(id, { isArchived: nextArchived, updatedAt: Date.now() });
    notifyCloudSync(id, 'upsert', existing.version || 1);
    return nextArchived;
  },

  async addTag(id: string, tag: string): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing) return;
    const normalized = tag.toLowerCase().trim();
    if (!existing.tags.includes(normalized)) {
      const nextTags = [...existing.tags, normalized];
      await db.documents.update(id, { tags: nextTags, updatedAt: Date.now() });
      notifyCloudSync(id, 'upsert', existing.version || 1);
    }
  },

  async removeTag(id: string, tag: string): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing) return;
    const nextTags = existing.tags.filter((t) => t !== tag);
    await db.documents.update(id, { tags: nextTags, updatedAt: Date.now() });
    notifyCloudSync(id, 'upsert', existing.version || 1);
  },

  async softDelete(id: string): Promise<void> {
    const existing = await db.documents.get(id);
    if (!existing) return;
    await db.documents.update(id, {
      isDeleted: true,
      updatedAt: Date.now(),
    });
    await activityService.log('deleted', id, existing.title, 'document');
    notifyCloudSync(id, 'delete', existing.version || 1);
  },

  /* Bulk operations */
  async bulkDelete(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.softDelete(id);
    }
  },

  async bulkMove(ids: string[], folderId: string | null): Promise<void> {
    for (const id of ids) {
      await this.moveToFolder(id, folderId);
    }
  },

  async bulkArchive(ids: string[], isArchived: boolean): Promise<void> {
    for (const id of ids) {
      await db.documents.update(id, { isArchived, updatedAt: Date.now() });
    }
  },

  async bulkFavorite(ids: string[], isFavorite: boolean): Promise<void> {
    for (const id of ids) {
      await db.documents.update(id, { isFavorite, updatedAt: Date.now() });
    }
  },
};
