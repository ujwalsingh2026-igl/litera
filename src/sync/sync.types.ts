/**
 * Synchronisation Types for Cloud Firestore and Dexie Outbox
 * Owner-scoped at users/{uid}/documents/{documentId}
 */

export interface CloudDocumentEnvelope {
  documentId: string;
  ownerUid: string;
  schemaVersion: number;
  rev: number;
  updatedAt: number;
  createdAt: number;
  isDeleted: boolean;
  deviceId: string;
  encryptedPayload: string; // Base64 AES-GCM-256 ciphertext
  iv: string;               // Base64 96-bit initialization vector
  integritySignature: string; // SHA-256 hex checksum of unencrypted serialized JSON
  type: string;             // Unencrypted metadata for document classification
  wordCount: number;        // Unencrypted stats counter
}

export type OutboxOperation = 'upsert' | 'delete';
export type OutboxStatus = 'pending' | 'processing' | 'failed';

export interface SyncOutboxItem {
  id: string;
  documentId: string;
  operation: OutboxOperation;
  status: OutboxStatus;
  createdAt: number;
  retryCount: number;
  lastAttemptAt?: number;
  lastError?: string;
  baseRev: number;
}

export interface SyncEngineStatus {
  isOnline: boolean;
  isAuthenticated: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  pendingCount: number;
  activeDeviceId: string;
  userEmail: string | null;
  lastError: string | null;
}

export interface ConflictRecord {
  documentId: string;
  localTitle: string;
  conflictCopyId: string;
  detectedAt: number;
}
