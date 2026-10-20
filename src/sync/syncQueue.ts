import { db } from '../storage/db';
import type { SyncOutboxItem, OutboxOperation } from './sync.types';
import { generateSafeId } from '../utils/security';

export class SyncQueueManager {
  /**
   * Enqueue or coalesce a document mutation in the Dexie outbox.
   */
  async enqueue(
    documentId: string,
    operation: OutboxOperation,
    baseRev: number
  ): Promise<SyncOutboxItem> {
    const existing = await db.syncOutbox
      .where('documentId')
      .equals(documentId)
      .first();

    const now = Date.now();

    if (existing) {
      // Coalesce operations: if existing was upsert and new is delete -> change to delete.
      // If existing was delete and new is upsert -> update to upsert.
      const updatedItem: SyncOutboxItem = {
        ...existing,
        operation,
        status: 'pending',
        createdAt: now,
        lastAttemptAt: undefined,
        lastError: undefined,
        retryCount: 0,
      };
      await db.syncOutbox.put(updatedItem);
      return updatedItem;
    }

    const newItem: SyncOutboxItem = {
      id: generateSafeId(),
      documentId,
      operation,
      status: 'pending',
      createdAt: now,
      retryCount: 0,
      baseRev,
    };

    await db.syncOutbox.put(newItem);
    return newItem;
  }

  /**
   * Fetch all items that are ready to be dispatched.
   */
  async getPending(): Promise<SyncOutboxItem[]> {
    return db.syncOutbox
      .where('status')
      .equals('pending')
      .sortBy('createdAt');
  }

  /**
   * Mark an item as currently transmitting.
   */
  async markProcessing(id: string): Promise<void> {
    await db.syncOutbox.update(id, {
      status: 'processing',
      lastAttemptAt: Date.now(),
    });
  }

  /**
   * Mark an item as successfully synced to Cloud Firestore.
   */
  async markCompleted(id: string): Promise<void> {
    await db.syncOutbox.delete(id);
  }

  /**
   * Record a sync transmission failure with exponential backoff.
   */
  async markFailed(id: string, error: string): Promise<void> {
    const item = await db.syncOutbox.get(id);
    if (!item) return;

    const nextRetry = item.retryCount + 1;
    const isExhausted = nextRetry >= 5;

    await db.syncOutbox.update(id, {
      status: isExhausted ? 'failed' : 'pending',
      retryCount: nextRetry,
      lastAttemptAt: Date.now(),
      lastError: error,
    });
  }

  /**
   * Total count of pending changes.
   */
  async countPending(): Promise<number> {
    return db.syncOutbox
      .where('status')
      .anyOf(['pending', 'processing'])
      .count();
  }

  /**
   * Clear all pending items (e.g. upon account sign-out).
   */
  async clearAll(): Promise<void> {
    await db.syncOutbox.clear();
  }
}

export const syncQueue = new SyncQueueManager();
