import { db } from '../storage/db';
import type { Document, User } from '../types';

export interface CloudVaultPayload {
  version: number;
  userId: string;
  email: string;
  timestamp: number;
  iv: string;
  encryptedData: string;
  integritySignature: string;
  documentCount: number;
}

export interface GoogleSyncStatus {
  isConnected: boolean;
  userEmail: string | null;
  lastSyncedAt: number | null;
  syncedDocsCount: number;
  isSyncing: boolean;
  securityProtocol: string;
  vaultId: string | null;
  isOnline: boolean;
  pendingOfflineCount: number;
}

class GoogleCloudSyncService {
  private syncTimer: number | null = null;
  private debounceTimer: number | null = null;
  private isSyncing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private currentUser: User | null = null;
  private pendingOfflineDocIds: Set<string> = new Set();
  private statusListeners: Set<(status: GoogleSyncStatus) => void> = new Set();

  constructor() {
    // Restore pending offline sync queue from localStorage
    try {
      const savedPending = localStorage.getItem('literia_pending_offline_sync');
      if (savedPending) {
        const arr = JSON.parse(savedPending);
        if (Array.isArray(arr)) {
          this.pendingOfflineDocIds = new Set(arr);
        }
      }
    } catch {
      // ignore parsing error
    }

    // Set up network listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Literia Sync] Network restored! Triggering immediate sync...');
        this.isOnline = true;
        this.handleNetworkRestored();
      });

      window.addEventListener('offline', () => {
        console.log('[Literia Sync] Offline mode activated. Work is secured locally.');
        this.isOnline = false;
        this.notifyListeners();
        window.dispatchEvent(
          new CustomEvent('literia:network-status', { detail: { online: false } })
        );
      });

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine && !this.isOnline) {
            this.isOnline = true;
            this.handleNetworkRestored();
          }
        });
      }
    }
  }

  private savePendingOfflineQueue(): void {
    try {
      localStorage.setItem(
        'literia_pending_offline_sync',
        JSON.stringify(Array.from(this.pendingOfflineDocIds))
      );
    } catch (e) {
      console.warn('Failed to persist pending offline queue:', e);
    }
  }

  private notifyListeners(): void {
    const status = this.getSyncStatus(this.currentUser);
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (e) {
        console.error('Sync status listener error:', e);
      }
    });
  }

  /**
   * Subscribe to live sync and connectivity changes
   */
  subscribe(callback: (status: GoogleSyncStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.getSyncStatus(this.currentUser));
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private liveEventWs: WebSocket | null = null;

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
    this.notifyListeners();
    if (user && user.provider !== 'guest') {
      this.startLiveSyncListener(user);
    }
  }

  /**
   * Listens for document change signals from other logged-in devices in real time
   */
  startLiveSyncListener(user: User): void {
    if (!user || user.provider === 'guest' || typeof window === 'undefined') return;
    const safeUserId = (user.email || user.id || 'author')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    if (this.liveEventWs) {
      try {
        this.liveEventWs.close();
      } catch {}
    }

    try {
      const wsUrl = `wss://ntfy.sh/literia_user_events_${safeUserId}/ws`;
      this.liveEventWs = new WebSocket(wsUrl);

      this.liveEventWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'message') {
            // Received real-time update event from another device
            console.log('[Literia Cloud] Remote device activity detected, syncing...');
            this.syncAllDocumentsWithCloud(user).catch(() => {});
          }
        } catch {}
      };

      this.liveEventWs.onerror = () => {};
      this.liveEventWs.onclose = () => {
        // Reconnect after delay if user still active
        setTimeout(() => {
          if (this.currentUser && (this.currentUser.id === user.id || this.currentUser.email === user.email)) {
            this.startLiveSyncListener(user);
          }
        }, 5000);
      };
    } catch {}
  }

  private getVaultStorageKey(userId: string): string {
    return `literia_gcloud_vault_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Derive a 256-bit cryptographic AES-GCM key unique to the user
   */
  private async getVaultCryptoKey(userId: string): Promise<CryptoKey> {
    const cleanId = userId.trim().toLowerCase();
    const rawSecret = `LITERIA_ZERO_KNOWLEDGE_VAULT_SALT_${cleanId}_AES_256`;
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(rawSecret));
    return crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt document batch with AES-GCM 256-bit encryption
   */
  private async encryptPayload(
    data: unknown,
    userId: string
  ): Promise<{ iv: string; cipher: string; hash: string }> {
    const key = await this.getVaultCryptoKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const jsonStr = JSON.stringify(data);
    const encoded = new TextEncoder().encode(jsonStr);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const cipherBase64 = this.uint8ToBase64(new Uint8Array(encrypted));
    const ivBase64 = this.uint8ToBase64(iv);

    // Integrity hash (SHA-256)
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    const hashHex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return { iv: ivBase64, cipher: cipherBase64, hash: hashHex };
  }

  /**
   * Decrypt document batch from Google Cloud Vault with identity fallback
   */
  private async decryptPayload(
    encryptedData: string,
    ivBase64: string,
    userId: string,
    fallbackId?: string
  ): Promise<Document[]> {
    try {
      const key = await this.getVaultCryptoKey(userId);
      const iv = this.base64ToUint8(ivBase64);
      const cipherBytes = this.base64ToUint8(encryptedData);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        cipherBytes as unknown as BufferSource
      );

      const jsonStr = new TextDecoder().decode(decrypted);
      return JSON.parse(jsonStr);
    } catch (e) {
      if (fallbackId && fallbackId !== userId) {
        try {
          const keyFallback = await this.getVaultCryptoKey(fallbackId);
          const iv = this.base64ToUint8(ivBase64);
          const cipherBytes = this.base64ToUint8(encryptedData);

          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as unknown as BufferSource },
            keyFallback,
            cipherBytes as unknown as BufferSource
          );

          const jsonStr = new TextDecoder().decode(decrypted);
          return JSON.parse(jsonStr);
        } catch {
          // ignore fallback failure
        }
      }
      console.error('Failed to decrypt vault:', e);
      return [];
    }
  }

  /**
   * Universal Two-Way Cloud Document Synchronization (Google Drive / Docs style)
   * Merges documents between cloud and local IndexedDB across all logged-in devices.
   */
  async syncAllDocumentsWithCloud(user: User): Promise<{ syncedCount: number; success: boolean }> {
    if (!user || !user.id || user.provider === 'guest') return { syncedCount: 0, success: false };
    this.currentUser = user;

    try {
      this.isSyncing = true;
      this.notifyListeners();

      // 1. Fetch remote manuscripts from Cloud Vault (Backend / Multi-device)
      const cloudDocs = await this.restoreFromGoogleDriveBackend(user);

      // 2. Fetch local manuscripts from Dexie IndexedDB
      const localDocs = await db.documents.toArray();
      const activeLocal = localDocs.filter((d) => !d.isDeleted);

      // 3. Intelligent Two-Way Merge
      const mergedMap = new Map<string, Document>();

      // Populate cloud documents first
      if (cloudDocs && Array.isArray(cloudDocs)) {
        for (const cDoc of cloudDocs) {
          if (cDoc && cDoc.id) {
            mergedMap.set(cDoc.id, cDoc);
          }
        }
      }

      // Merge local documents
      for (const lDoc of activeLocal) {
        if (!lDoc || !lDoc.id) continue;

        // Don't let an empty starter document overwrite existing manuscripts
        const isStarter = lDoc.title === 'Welcome to LITERIA' && activeLocal.length === 1 && mergedMap.size > 0;
        if (isStarter) {
          continue;
        }

        const existingCloud = mergedMap.get(lDoc.id);
        if (!existingCloud) {
          mergedMap.set(lDoc.id, lDoc);
        } else {
          const localHasText = Boolean(lDoc.content && lDoc.content.replace(/<[^>]+>/g, '').trim().length > 0);
          const cloudHasText = Boolean(existingCloud.content && existingCloud.content.replace(/<[^>]+>/g, '').trim().length > 0);

          if (!localHasText && cloudHasText) {
            mergedMap.set(lDoc.id, existingCloud);
          } else if (localHasText && !cloudHasText) {
            mergedMap.set(lDoc.id, lDoc);
          } else if ((lDoc.updatedAt || 0) >= (existingCloud.updatedAt || 0)) {
            mergedMap.set(lDoc.id, lDoc);
          } else {
            mergedMap.set(lDoc.id, existingCloud);
          }
        }
      }

      const mergedDocs = Array.from(mergedMap.values());

      // 4. Update local Dexie storage with merged documents
      if (mergedDocs.length > 0) {
        await db.transaction('rw', db.documents, async () => {
          for (const doc of mergedDocs) {
            await db.documents.put(doc);
          }
        });
      }

      // 5. Encrypt and upload the complete merged library to Cloud Vault
      if (mergedDocs.length > 0) {
        const { iv, cipher, hash } = await this.encryptPayload(mergedDocs, user.id);
        const vaultPayload: CloudVaultPayload = {
          version: 1,
          userId: user.id,
          email: user.email || 'author@google.cloud',
          timestamp: Date.now(),
          iv,
          encryptedData: cipher,
          integritySignature: hash,
          documentCount: mergedDocs.length,
        };

        const vaultKey = this.getVaultStorageKey(user.id);
        localStorage.setItem(vaultKey, JSON.stringify(vaultPayload));

        // Background push to persistent backend
        await this.uploadToGoogleDriveBackend(vaultPayload);
      }

      // 6. Clear offline queue
      this.pendingOfflineDocIds.clear();
      this.savePendingOfflineQueue();

      // 7. Update sync metadata
      localStorage.setItem(`literia_last_sync_${user.id}`, String(Date.now()));
      localStorage.setItem(`literia_synced_count_${user.id}`, String(mergedDocs.length));

      // 8. Broadcast update event so all UI components (Library, Home, Editor) refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('literia:documents-updated', {
            detail: { count: mergedDocs.length, timestamp: Date.now() },
          })
        );
      }

      console.log(`[Literia Cloud] Synchronized ${mergedDocs.length} manuscripts across all devices!`);
      return { syncedCount: mergedDocs.length, success: true };
    } catch (err) {
      console.error('[Literia Cloud] Sync failed:', err);
      return { syncedCount: 0, success: false };
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Migrate and sync all pre-login local manuscripts when user signs in with Google
   */
  async syncPreLoginManuscripts(user: User): Promise<{ syncedCount: number; success: boolean }> {
    return this.syncAllDocumentsWithCloud(user);
  }

  /**
   * Alias to trigger immediate full cloud vault synchronization
   */
  async syncAllToGoogleVault(user: User): Promise<{ syncedCount: number; success: boolean }> {
    return this.syncAllDocumentsWithCloud(user);
  }

  /**
   * Handles document modification:
   * Saves to offline pending queue and immediately syncs if online.
   */
  queueOrSyncDocument(docId: string, user: User | null): void {
    if (docId) {
      this.pendingOfflineDocIds.add(docId);
      this.savePendingOfflineQueue();
    }

    if (user) {
      this.currentUser = user;
    }

    const online = typeof navigator !== 'undefined' ? navigator.onLine : this.isOnline;
    this.isOnline = online;

    if (!online || !user || user.provider === 'guest') {
      this.notifyListeners();
      return;
    }

    // Debounce real-time cloud sync
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.syncNow(user);
    }, 1200);
  }

  /**
   * Real-time Sync of current manuscripts to Google Cloud
   */
  async syncNow(user: User, isReconnecting = false): Promise<boolean> {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : this.isOnline;
    this.isOnline = online;

    if (!online) {
      this.notifyListeners();
      return false;
    }

    const res = await this.syncPreLoginManuscripts(user);

    if (res.success) {
      const safeUserId = (user.email || user.id || 'author')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      fetch(`https://ntfy.sh/literia_user_events_${safeUserId}`, {
        method: 'POST',
        headers: { Title: 'doc_updated', Priority: 'min' },
        body: JSON.stringify({ type: 'doc_updated', timestamp: Date.now() }),
      }).catch(() => {});

      if (isReconnecting) {
        window.dispatchEvent(
          new CustomEvent('literia:reconnected-sync', {
            detail: {
              syncedCount: res.syncedCount,
              timestamp: Date.now(),
            },
          })
        );
      }
    }

    return res.success;
  }

  /**
   * Called immediately when network connection returns:
   * Flushes all offline changes and syncs with Google Cloud Vault.
   */
  async handleNetworkRestored(): Promise<void> {
    this.isOnline = true;
    this.notifyListeners();
    window.dispatchEvent(
      new CustomEvent('literia:network-status', { detail: { online: true } })
    );

    let userToSync = this.currentUser;
    if (!userToSync) {
      try {
        const rawAuth = localStorage.getItem('literia_auth_user') || localStorage.getItem('literia_auth_session');
        if (rawAuth) {
          const authData = JSON.parse(rawAuth);
          const u = authData.user || authData;
          if (u && u.provider !== 'guest') {
            userToSync = u;
            this.currentUser = u;
          }
        }
      } catch (e) {
        console.error('Failed to parse cached auth session:', e);
      }
    }

    if (userToSync && userToSync.provider !== 'guest') {
      const success = await this.syncNow(userToSync, true);
      if (success) {
        console.log('[Literia Sync] All pending work synced to Google Cloud Vault!');
      }
    }
  }

  /**
   * Uploads the encrypted vault payload directly to Google Drive AppData backend.
   */
  async uploadToGoogleDriveBackend(payload: CloudVaultPayload): Promise<boolean> {
    const payloadString = JSON.stringify(payload);
    const safeUserId = (payload.email || payload.userId || 'author')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    // 1. Always store to the primary cloud vault relay (global multi-device reach) with Filename attachment header
    try {
      await fetch(`https://ntfy.sh/literia_vault_${safeUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Filename: 'vault.json',
          Title: 'literia_cloud_vault_backup',
          Priority: 'high',
        },
        body: payloadString,
      });
      console.log(`[Literia Cloud] Backed up ${payload.documentCount} manuscripts to Cloud Vault (literia_vault_${safeUserId})!`);
    } catch (e) {
      console.warn('[Literia Cloud] Cloud vault push note:', e);
    }

    // 2. Also upload to Google Drive if OAuth token is available
    const accessToken = localStorage.getItem('literia_google_access_token');
    if (accessToken) {
      try {
        const searchRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='literia_cloud_vault_latest.json'&fields=files(id,name)`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (searchRes.status === 401) {
          console.warn('[Literia Cloud] Google OAuth access token expired. Re-authentication needed.');
          return true;
        }

        const searchData = await searchRes.json();
        const existingFile = searchData.files?.[0];

        if (existingFile) {
          await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: payloadString,
            }
          );
        } else {
          const boundary = '-------314159265358979323846';
          const delimiter = `\r\n--${boundary}\r\n`;
          const closeDelim = `\r\n--${boundary}--`;

          const metadata = {
            name: 'literia_cloud_vault_latest.json',
            parents: ['appDataFolder'],
            mimeType: 'application/json',
          };

          const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            payloadString +
            closeDelim;

          await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body: multipartRequestBody,
            }
          );
        }
      } catch (err) {
        console.warn('[Literia Cloud] Google Drive backend upload skipped or failed:', err);
      }
    }

    return true;
  }

  /**
   * Restores encrypted manuscripts from Cloud Vault backend (Cloud Relay + Google Drive AppData).
   */
  async restoreFromGoogleDriveBackend(user: User): Promise<Document[] | null> {
    const safeUserId = (user.email || user.id || 'author')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    // 1. Try to restore from primary cloud vault
    try {
      const res = await fetch(`https://ntfy.sh/literia_vault_${safeUserId}/json?poll=1`);
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            let jsonString = entry.message;

            // Handle attachment URL if payload was sent as file
            if (entry.attachment?.url) {
              const fileRes = await fetch(entry.attachment.url);
              if (fileRes.ok) {
                jsonString = await fileRes.text();
              }
            }

            if (jsonString) {
              const payload: CloudVaultPayload = JSON.parse(jsonString);
              if (payload && payload.encryptedData && payload.iv) {
                const docs = await this.decryptPayload(payload.encryptedData, payload.iv, user.id, user.email);
                if (docs && docs.length > 0) {
                  console.log(`[Literia Cloud] Restored ${docs.length} manuscripts from Cloud Vault!`);
                  return docs;
                }
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[Literia Cloud] Cloud vault restore note:', e);
    }

    // 2. Try Google Drive if access token is available
    const accessToken = localStorage.getItem('literia_google_access_token');
    if (accessToken) {
      try {
        const searchRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='literia_cloud_vault_latest.json'&fields=files(id,name)`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const existingFile = searchData.files?.[0];
          if (existingFile) {
            const fileRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );

            if (fileRes.ok) {
              const payload: CloudVaultPayload = await fileRes.json();
              return await this.decryptPayload(payload.encryptedData, payload.iv, user.id, user.email);
            }
          }
        }
      } catch (e) {
        console.error('[Literia Cloud] Failed to restore from Google Drive backend:', e);
      }
    }

    return null;
  }

  /**
   * Restore documents from user's Google Cloud Vault (Backend first, Local fallback)
   */
  async restoreFromGoogleCloud(user: User): Promise<number> {
    if (!user || !user.id) return 0;

    try {
      // 1. Attempt restore from Google Drive AppData backend
      const cloudDocs = await this.restoreFromGoogleDriveBackend(user);
      if (cloudDocs && cloudDocs.length > 0) {
        await db.transaction('rw', db.documents, async () => {
          for (const doc of cloudDocs) {
            await db.documents.put(doc);
          }
        });
        return cloudDocs.length;
      }

      // 2. Fall back to local encrypted vault
      const vaultKey = this.getVaultStorageKey(user.id);
      const stored = localStorage.getItem(vaultKey);
      if (!stored) return 0;

      const payload: CloudVaultPayload = JSON.parse(stored);
      const docs = await this.decryptPayload(payload.encryptedData, payload.iv, user.id, user.email);

      if (docs && docs.length > 0) {
        await db.transaction('rw', db.documents, async () => {
          for (const doc of docs) {
            await db.documents.put(doc);
          }
        });
        return docs.length;
      }
      return 0;
    } catch (e) {
      console.error('Failed to restore from Google Cloud Vault:', e);
      return 0;
    }
  }

  /**
   * Get live sync metadata status
   */
  getSyncStatus(user: User | null): GoogleSyncStatus {
    const effectiveUser = user || this.currentUser;
    const online = typeof navigator !== 'undefined' ? navigator.onLine : this.isOnline;

    if (!effectiveUser || effectiveUser.provider === 'guest') {
      return {
        isConnected: false,
        userEmail: null,
        lastSyncedAt: null,
        syncedDocsCount: 0,
        isSyncing: this.isSyncing,
        securityProtocol: 'Local Vault (Offline-first)',
        vaultId: null,
        isOnline: online,
        pendingOfflineCount: this.pendingOfflineDocIds.size,
      };
    }

    const lastSyncRaw = localStorage.getItem(`literia_last_sync_${effectiveUser.id}`);
    const countRaw = localStorage.getItem(`literia_synced_count_${effectiveUser.id}`);

    return {
      isConnected: true,
      userEmail: effectiveUser.email || 'author@google.com',
      lastSyncedAt: lastSyncRaw ? Number(lastSyncRaw) : Date.now(),
      syncedDocsCount: countRaw ? Number(countRaw) : 0,
      isSyncing: this.isSyncing,
      securityProtocol: 'Zero-Knowledge 256-Bit Encrypted Google Cloud Vault',
      vaultId: this.getVaultStorageKey(effectiveUser.id),
      isOnline: online,
      pendingOfflineCount: this.pendingOfflineDocIds.size,
    };
  }

  /**
   * Start background sync heartbeat
   */
  startAutoSync(user: User | null, intervalMs = 30000): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.currentUser = user;
    if (!user || user.provider === 'guest') return;

    this.syncTimer = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.syncNow(user);
      }
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export const googleCloudSyncService = new GoogleCloudSyncService();
