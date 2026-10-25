import type { User } from '../types';

export interface CollaboratorInfo {
  id: string;
  displayName: string;
  color: string;
  lastActive: number;
  isHost?: boolean;
}

export interface CollabMessage {
  type: 'edit' | 'presence' | 'request-sync' | 'sync-snapshot' | 'leave';
  roomId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  contentHtml?: string;
  title?: string;
  timestamp: number;
}

type ContentListener = (contentHtml: string, senderName: string, title?: string) => void;
type CollaboratorsListener = (collaborators: CollaboratorInfo[]) => void;
type StatusListener = (connected: boolean, roomId: string | null) => void;

class RealtimeCollabService {
  private activeRoomId: string | null = null;
  private currentUser: User | null = null;
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private heartbeatInterval: number | null = null;
  private activeCollaborators: Map<string, CollaboratorInfo> = new Map();
  private lastSentContent = '';
  private lastReceivedTimestamp = 0;
  private broadcastDebounceTimer: number | null = null;

  private contentListeners: Set<ContentListener> = new Set();
  private collabListeners: Set<CollaboratorsListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  /**
   * Connect to a real-time collaborative editing room.
   */
  async joinRoom(roomId: string, user: User, initialContent = '', docTitle = ''): Promise<void> {
    const cleanRoomId = roomId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanRoomId) return;

    // Leave any existing room first
    if (this.activeRoomId && this.activeRoomId !== cleanRoomId) {
      this.leaveRoom();
    }

    this.activeRoomId = cleanRoomId;
    this.currentUser = user;
    this.lastSentContent = initialContent;
    this.activeCollaborators.clear();

    // Register self in collaborators
    const myInfo: CollaboratorInfo = {
      id: user.id,
      displayName: user.displayName || 'Author',
      color: user.avatarColor || '#d97706',
      lastActive: Date.now(),
      isHost: true,
    };
    this.activeCollaborators.set(user.id, myInfo);
    this.notifyCollaborators();
    this.notifyStatus(true);

    // Setup Cross-Tab Broadcast Channel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel(`literia_collab_${cleanRoomId}`);
        this.broadcastChannel.onmessage = (e) => this.handleMessage(e.data);
      }
    } catch (e) {
      console.warn('[Collab] BroadcastChannel error:', e);
    }

    // Connect to Real-time WebSocket Relay (hosted via ntfy.sh public pub/sub network)
    this.connectWebSocket(cleanRoomId);

    // Fetch latest cloud snapshot of the room if someone has already been working in it
    this.fetchLatestRoomSnapshot(cleanRoomId);

    // Announce presence
    this.broadcastMessage({
      type: 'presence',
      roomId: cleanRoomId,
      senderId: user.id,
      senderName: user.displayName || 'Author',
      senderColor: user.avatarColor || '#d97706',
      title: docTitle,
      timestamp: Date.now(),
    });

    // Start presence heartbeat (every 10 seconds)
    if (this.heartbeatInterval) window.clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = window.setInterval(() => {
      if (!this.activeRoomId || !this.currentUser) return;
      this.cleanStaleCollaborators();
      this.broadcastMessage({
        type: 'presence',
        roomId: this.activeRoomId,
        senderId: this.currentUser.id,
        senderName: this.currentUser.displayName || 'Author',
        senderColor: this.currentUser.avatarColor || '#d97706',
        timestamp: Date.now(),
      });
    }, 10000);
  }

  /**
   * Establish persistent WebSocket connection with automatic reconnect
   */
  private connectWebSocket(roomId: string): void {
    if (typeof window === 'undefined') return;

    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      const wsUrl = `wss://ntfy.sh/literia_collab_${roomId}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[Collab] Connected to live collaboration room: ${roomId}`);
        this.notifyStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'message' && payload.message) {
            const data: CollabMessage = JSON.parse(payload.message);
            this.handleMessage(data);
          }
        } catch {
          // ignore non-json notifications
        }
      };

      this.ws.onerror = (e) => {
        console.warn('[Collab] WebSocket error, fallback active:', e);
      };

      this.ws.onclose = () => {
        this.notifyStatus(false);
        // Auto-reconnect if still in active room
        if (this.activeRoomId === roomId) {
          setTimeout(() => {
            if (this.activeRoomId === roomId) {
              this.connectWebSocket(roomId);
            }
          }, 3500);
        }
      };
    } catch (err) {
      console.warn('[Collab] WebSocket connection failed:', err);
    }
  }

  /**
   * Broadcast an edit made in the editor to all peers in the room (debounced to avoid network storms)
   */
  broadcastEdit(_docId: string, contentHtml: string, title?: string): void {
    if (!this.activeRoomId || !this.currentUser) return;
    if (contentHtml === this.lastSentContent) return;

    if (this.broadcastDebounceTimer) {
      window.clearTimeout(this.broadcastDebounceTimer);
    }

    this.broadcastDebounceTimer = window.setTimeout(() => {
      if (!this.activeRoomId || !this.currentUser) return;
      this.lastSentContent = contentHtml;
      const now = Date.now();

      const msg: CollabMessage = {
        type: 'edit',
        roomId: this.activeRoomId,
        senderId: this.currentUser.id,
        senderName: this.currentUser.displayName || 'Author',
        senderColor: this.currentUser.avatarColor || '#d97706',
        contentHtml,
        title,
        timestamp: now,
      };

      this.broadcastMessage(msg);

      // Also persist cloud snapshot to the room topic with caching enabled
      this.persistCloudSnapshot(this.activeRoomId, contentHtml, title);
    }, 350);
  }

  /**
   * Send message to both WebSocket relay and local BroadcastChannel
   */
  private broadcastMessage(msg: CollabMessage): void {
    const raw = JSON.stringify(msg);

    // 1. Send via local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. Publish to ntfy.sh relay
    if (this.activeRoomId) {
      try {
        fetch(`https://ntfy.sh/literia_collab_${this.activeRoomId}`, {
          method: 'POST',
          body: raw,
          headers: {
            'Content-Type': 'application/json',
            Title: 'literia_collab_msg',
          },
        }).catch(() => {
          // ignore network error
        });
      } catch {
        // ignore fetch error
      }
    }
  }

  /**
   * Handle incoming message from peer
   */
  private handleMessage(msg: CollabMessage): void {
    if (!msg || !msg.roomId || msg.roomId !== this.activeRoomId) return;
    if (this.currentUser && msg.senderId === this.currentUser.id) return; // Ignore own echo

    // Update presence
    this.activeCollaborators.set(msg.senderId, {
      id: msg.senderId,
      displayName: msg.senderName || 'Collaborator',
      color: msg.senderColor || '#10b981',
      lastActive: Date.now(),
    });
    this.notifyCollaborators();

    if (msg.type === 'leave') {
      this.activeCollaborators.delete(msg.senderId);
      this.notifyCollaborators();
      return;
    }

    if (msg.type === 'edit' && msg.contentHtml !== undefined) {
      if (msg.timestamp > this.lastReceivedTimestamp) {
        this.lastReceivedTimestamp = msg.timestamp;
        this.lastSentContent = msg.contentHtml;
        this.contentListeners.forEach((cb) => {
          try {
            cb(msg.contentHtml!, msg.senderName, msg.title);
          } catch (e) {
            console.error('Collab content listener error:', e);
          }
        });
      }
    }
  }

  /**
   * Remove collaborators that haven't sent a heartbeat in 30 seconds
   */
  private cleanStaleCollaborators(): void {
    const now = Date.now();
    let changed = false;
    this.activeCollaborators.forEach((collab, id) => {
      if (this.currentUser && id === this.currentUser.id) return;
      if (now - collab.lastActive > 30000) {
        this.activeCollaborators.delete(id);
        changed = true;
      }
    });
    if (changed) {
      this.notifyCollaborators();
    }
  }

  /**
   * Persist room snapshot to cloud storage topic
   */
  private async persistCloudSnapshot(roomId: string, contentHtml: string, title?: string): Promise<void> {
    try {
      const snapshot = {
        roomId,
        title: title || 'Collaborative Manuscript',
        contentHtml,
        updatedAt: Date.now(),
        updatedBy: this.currentUser?.displayName || 'Author',
      };
      await fetch(`https://ntfy.sh/literia_snapshot_${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Title: 'literia_room_snapshot',
        },
        body: JSON.stringify(snapshot),
      });
    } catch {
      // ignore cloud snapshot error
    }
  }

  /**
   * Retrieve latest snapshot when joining a room
   */
  private async fetchLatestRoomSnapshot(roomId: string): Promise<void> {
    try {
      const res = await fetch(`https://ntfy.sh/literia_snapshot_${roomId}/json?poll=1`);
      if (!res.ok) return;
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length === 0) return;

      const lastLine = lines[lines.length - 1];
      const parsed = JSON.parse(lastLine);
      if (parsed.message) {
        const snap = JSON.parse(parsed.message);
        if (snap.contentHtml && snap.contentHtml.length > 0) {
          this.contentListeners.forEach((cb) => {
            try {
              cb(snap.contentHtml, snap.updatedBy || 'Cloud', snap.title);
            } catch (e) {
              console.error(e);
            }
          });
        }
      }
    } catch {
      // ignore snapshot fetch error
    }
  }

  /**
   * Leave the collaboration room
   */
  leaveRoom(): void {
    if (this.activeRoomId && this.currentUser) {
      this.broadcastMessage({
        type: 'leave',
        roomId: this.activeRoomId,
        senderId: this.currentUser.id,
        senderName: this.currentUser.displayName || 'Author',
        senderColor: this.currentUser.avatarColor || '#d97706',
        timestamp: Date.now(),
      });
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.activeRoomId = null;
    this.activeCollaborators.clear();
    this.notifyCollaborators();
    this.notifyStatus(false);
  }

  /**
   * Get currently active room ID
   */
  getActiveRoomId(): string | null {
    return this.activeRoomId;
  }

  getRoomId(): string | null {
    return this.activeRoomId;
  }

  /**
   * Get list of active collaborators in current room
   */
  getCollaborators(): CollaboratorInfo[] {
    return Array.from(this.activeCollaborators.values());
  }

  /**
   * Subscriptions
   */
  onContent(cb: ContentListener): () => void {
    this.contentListeners.add(cb);
    return () => this.contentListeners.delete(cb);
  }

  onCollaborators(cb: CollaboratorsListener): () => void {
    this.collabListeners.add(cb);
    cb(this.getCollaborators());
    return () => this.collabListeners.delete(cb);
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.ws !== null && this.ws.readyState === WebSocket.OPEN, this.activeRoomId);
    return () => this.statusListeners.delete(cb);
  }

  private notifyCollaborators(): void {
    const list = this.getCollaborators();
    this.collabListeners.forEach((cb) => {
      try {
        cb(list);
      } catch (e) {
        console.error(e);
      }
    });
  }

  private notifyStatus(connected: boolean): void {
    this.statusListeners.forEach((cb) => {
      try {
        cb(connected, this.activeRoomId);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const realtimeCollabService = new RealtimeCollabService();
