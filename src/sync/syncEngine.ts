import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '../lib/firebase/firestore';
import { db } from '../storage/db';
import type { User } from '../types';
import type {
  CloudDocumentEnvelope,
  SyncEngineStatus,
} from './sync.types';
import { syncQueue } from './syncQueue';
import {
  encryptDocument,
  decryptEnvelope,
  clearKeyCache,
} from '../crypto/documentEncryption';
import { detectAndResolveConflict } from './conflictPolicy';
import { generateSafeId } from '../utils/security';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  let deviceId = localStorage.getItem('literia_sync_device_id');
  if (!deviceId) {
    deviceId = `dev_${generateSafeId()}`;
    localStorage.setItem('literia_sync_device_id', deviceId);
  }
  return deviceId;
}

export class SyncEngine {
  private currentUser: User | null = null;
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private isSyncing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private deviceId = getOrCreateDeviceId();
  private debounceTimer: number | null = null;
  private listeners: Set<(status: SyncEngineStatus) => void> = new Set();
  private lastSyncedAt: number | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyStatus();
        this.processOutbox();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyStatus();
      });

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) {
            this.isOnline = true;
            this.processOutbox();
          }
        });
      }
    }
  }

  public subscribe(callback: (status: SyncEngineStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getStatus(): SyncEngineStatus {
    return {
      isOnline: this.isOnline,
      isAuthenticated: !!this.currentUser && this.currentUser.provider !== 'guest',
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingCount: 0, // updated asynchronously
      activeDeviceId: this.deviceId,
      userEmail: this.currentUser?.email || null,
      lastError: this.lastError,
    };
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    syncQueue.countPending().then((count) => {
      status.pendingCount = count;
      this.listeners.forEach((cb) => {
        try {
          cb(status);
        } catch (e) {
          console.error('Status listener error:', e);
        }
      });
    });
  }

  /**
   * Start two-way sync for an authenticated user.
   */
  public start(user: User): void {
    if (!user || !user.id || user.provider === 'guest') {
      this.stop();
      return;
    }

    if (this.currentUser?.id === user.id && this.unsubscribeSnapshot) {
      return; // Already actively syncing for this user
    }

    this.stop();
    this.currentUser = user;
    this.lastError = null;

    // 1. Initialise Firestore listener for incoming remote changes
    this.initRemoteListener(user.id);

    // 2. Dispatch pending local outbox items
    this.processOutbox();
  }

  /**
   * Stop two-way sync and clean up listeners.
   */
  public stop(): void {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.currentUser = null;
    this.isSyncing = false;
    clearKeyCache();
    this.notifyStatus();
  }

  /**
   * Inform the sync engine of a local document modification.
   * Debounces outbox processing to batch rapid edits cleanly.
   */
  public notifyChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.processOutbox();
    }, 1200);
  }

  /**
   * Force an immediate sync cycle (e.g. user clicks "Sync Now").
   */
  public async forceSync(): Promise<void> {
    if (!this.currentUser) return;
    await this.processOutbox();
  }

  /**
   * Processes all pending changes in the Dexie outbox and uploads them to Firestore.
   */
  public async processOutbox(): Promise<void> {
    if (!this.currentUser || !this.currentUser.id || this.currentUser.provider === 'guest') {
      return;
    }
    if (!this.isOnline || this.isSyncing) {
      return;
    }

    const firestore = getFirebaseFirestore();
    if (!firestore) return;

    try {
      this.isSyncing = true;
      this.notifyStatus();

      const pendingItems = await syncQueue.getPending();
      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notifyStatus();
        return;
      }

      for (const item of pendingItems) {
        await syncQueue.markProcessing(item.id);

        try {
          const docRef = doc(
            firestore,
            `users/${this.currentUser.id}/documents/${item.documentId}`
          );

          if (item.operation === 'delete') {
            // Tombstone envelope
            const envelope: CloudDocumentEnvelope = {
              documentId: item.documentId,
              ownerUid: this.currentUser.id,
              schemaVersion: 1,
              rev: item.baseRev + 1,
              updatedAt: Date.now(),
              createdAt: Date.now(),
              isDeleted: true,
              deviceId: this.deviceId,
              encryptedPayload: '',
              iv: '',
              integritySignature: '0000000000000000000000000000000000000000000000000000000000000000',
              type: 'blank',
              wordCount: 0,
            };
            await setDoc(docRef, envelope);
          } else {
            // Upsert: fetch latest local record
            const localDoc = await db.documents.get(item.documentId);
            if (!localDoc) {
              await syncQueue.markCompleted(item.id);
              continue;
            }

            const targetRev = Math.max(localDoc.version || 1, item.baseRev + 1);
            localDoc.version = targetRev;
            await db.documents.update(localDoc.id, { version: targetRev });

            const envelope = await encryptDocument(
              localDoc,
              this.currentUser.id,
              this.deviceId,
              targetRev
            );

            await setDoc(docRef, envelope);
          }

          await syncQueue.markCompleted(item.id);
        } catch (itemErr: unknown) {
          const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
          console.error(`Sync error uploading document ${item.documentId}:`, msg);
          await syncQueue.markFailed(item.id, msg);
          this.lastError = msg;
        }
      }

      this.lastSyncedAt = Date.now();
    } catch (globalErr: unknown) {
      const msg = globalErr instanceof Error ? globalErr.message : String(globalErr);
      console.error('Fatal outbox processing error:', msg);
      this.lastError = msg;
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }
  }

  /**
   * Listen for remote updates in Firestore: users/{uid}/documents
   */
  private initRemoteListener(userId: string): void {
    const firestore = getFirebaseFirestore();
    if (!firestore) return;

    const colRef = collection(firestore, `users/${userId}/documents`);

    this.unsubscribeSnapshot = onSnapshot(
      colRef,
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const envelope = change.doc.data() as CloudDocumentEnvelope;
          if (!envelope || !envelope.documentId) continue;

          // Check if local document already has intact content before skipping
          const existingLocal = await db.documents.get(envelope.documentId);
          const localHasContent = Boolean(
            existingLocal?.content &&
            existingLocal.content.replace(/<[^>]+>/g, '').trim().length > 0
          );

          // Only ignore echo if local copy exists, has content, and revisions align
          if (
            envelope.deviceId === this.deviceId &&
            existingLocal &&
            localHasContent &&
            existingLocal.version === envelope.rev
          ) {
            continue;
          }

          try {
            if (envelope.isDeleted) {
              // Remote soft-delete tombstone
              const local = await db.documents.get(envelope.documentId);
              if (local && !local.isDeleted) {
                await db.documents.update(envelope.documentId, {
                  isDeleted: true,
                  updatedAt: envelope.updatedAt,
                  version: envelope.rev,
                });
                window.dispatchEvent(
                  new CustomEvent('literia:document-updated', {
                    detail: { documentId: envelope.documentId, deleted: true },
                  })
                );
              }
              continue;
            }

            // Remote active document: decrypt & verify
            const decryptedDoc = await decryptEnvelope(envelope, userId);

            // Check for pending local changes & resolve potential concurrency conflicts
            const pendingOutbox = await db.syncOutbox
              .where('documentId')
              .equals(envelope.documentId)
              .first();

            const conflictResult = await detectAndResolveConflict(
              decryptedDoc,
              envelope,
              pendingOutbox,
              this.deviceId
            );

            if (conflictResult.resolvedDoc) {
              await db.documents.put(conflictResult.resolvedDoc);
              window.dispatchEvent(
                new CustomEvent('literia:document-updated', {
                  detail: {
                    documentId: conflictResult.resolvedDoc.id,
                    doc: conflictResult.resolvedDoc,
                  },
                })
              );
              window.dispatchEvent(
                new CustomEvent('literia:documents-updated', {
                  detail: {
                    documentId: conflictResult.resolvedDoc.id,
                    doc: conflictResult.resolvedDoc,
                  },
                })
              );
            }

            this.lastSyncedAt = Date.now();
            this.notifyStatus();
          } catch (err) {
            console.error(
              `Failed to process remote document ${envelope.documentId}:`,
              err
            );
          }
        }
      },
      (error) => {
        console.error('Firestore snapshot listener error:', error);
        this.lastError = error.message;
        this.notifyStatus();
      }
    );
  }
}

export const syncEngine = new SyncEngine();
