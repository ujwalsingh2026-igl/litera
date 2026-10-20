import { db } from '../storage/db';
import type { Document } from '../types';
import type { CloudDocumentEnvelope, SyncOutboxItem } from './sync.types';
import { generateSafeId } from '../utils/security';
import { activityService } from '../services/activityService';

export interface ConflictResolutionResult {
  hasConflict: boolean;
  conflictedCopyDoc?: Document;
  resolvedDoc?: Document;
}

/**
 * Evaluates whether an incoming remote CloudDocumentEnvelope conflicts with
 * local pending outbox changes.
 */
export async function detectAndResolveConflict(
  remoteDoc: Document,
  remoteEnvelope: CloudDocumentEnvelope,
  pendingOutboxItem?: SyncOutboxItem,
  currentDeviceId?: string
): Promise<ConflictResolutionResult> {
  const localDoc = await db.documents.get(remoteEnvelope.documentId);

  // If local document does not exist, there is no conflict; it's a pure new document download.
  if (!localDoc) {
    return { hasConflict: false, resolvedDoc: remoteDoc };
  }

  const localHasText = Boolean(localDoc.content && localDoc.content.replace(/<[^>]+>/g, '').trim().length > 0);
  const remoteHasText = Boolean(remoteDoc.content && remoteDoc.content.replace(/<[^>]+>/g, '').trim().length > 0);

  // Critical content preservation: If local copy is empty but remote manuscript has written content, accept remote!
  if (!localHasText && remoteHasText) {
    console.log(`[Conflict Policy] Restoring remote manuscript content for "${remoteDoc.title}" (${remoteDoc.id})`);
    return { hasConflict: false, resolvedDoc: remoteDoc };
  }

  // If this device originated the change, revisions match, and local content is intact, it's our own echo.
  if (remoteEnvelope.deviceId === currentDeviceId && localDoc.version === remoteEnvelope.rev && localHasText) {
    return { hasConflict: false, resolvedDoc: localDoc };
  }

  // If there are no pending outbox changes for this document locally,
  // remote is strictly newer or equal -> accept remote.
  if (!pendingOutboxItem || pendingOutboxItem.status === 'processing') {
    if (remoteEnvelope.rev >= (localDoc.version || 1)) {
      return { hasConflict: false, resolvedDoc: remoteDoc };
    }
    return { hasConflict: false, resolvedDoc: localDoc };
  }

  // Conflict Scenario:
  // Both local and remote have changes on top of the same baseRev, or remote revision
  // is higher than what local started modifying.
  const isConcurrentDivergence =
    remoteEnvelope.rev >= pendingOutboxItem.baseRev &&
    remoteEnvelope.deviceId !== currentDeviceId &&
    localDoc.content !== remoteDoc.content;

  if (isConcurrentDivergence) {
    console.warn(
      `[Conflict Policy] Detected concurrent divergence for document "${localDoc.title}" (${localDoc.id}). Generating safe preservation copy.`
    );

    const now = Date.now();
    const dateStamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Create a preserved conflicted branch document containing local changes
    const conflictedCopy: Document = {
      ...localDoc,
      id: generateSafeId(),
      title: `${localDoc.title} (Conflicted Copy ${dateStamp})`,
      version: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    // Save copy locally to IndexedDB
    await db.documents.add(conflictedCopy);

    // Enqueue outbox item to sync the conflicted copy to the cloud
    await db.syncOutbox.put({
      id: generateSafeId(),
      documentId: conflictedCopy.id,
      operation: 'upsert',
      status: 'pending',
      createdAt: now,
      retryCount: 0,
      baseRev: 0,
    });

    await activityService.log(
      'created',
      conflictedCopy.id,
      conflictedCopy.title,
      'document',
      { conflictWith: localDoc.id }
    );

    // Cancel pending outbox item for the original document so remote version can prevail cleanly
    await db.syncOutbox.delete(pendingOutboxItem.id);

    return {
      hasConflict: true,
      conflictedCopyDoc: conflictedCopy,
      resolvedDoc: remoteDoc,
    };
  }

  return { hasConflict: false, resolvedDoc: remoteDoc };
}
