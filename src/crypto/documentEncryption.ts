import type { Document } from '../types';
import type { CloudDocumentEnvelope } from '../sync/sync.types';

// Cache derived keys in memory per user to avoid repeated 100k PBKDF2 operations
const keyCache = new Map<string, CryptoKey>();

/**
 * Derives an AES-GCM-256 key using PBKDF2 with 100,000 SHA-256 iterations
 * anchored to the authenticated user's unique identity.
 */
export async function getDocumentCryptoKey(userId: string): Promise<CryptoKey> {
  if (keyCache.has(userId)) {
    return keyCache.get(userId)!;
  }

  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(`literia_cloud_vault_v1_${userId}_secure_key`);
  const salt = enc.encode(`literia_pbkdf2_salt_${userId}_vault`);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    rawKeyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(userId, derivedKey);
  return derivedKey;
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compute SHA-256 hex digest
 */
async function computeSha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypt a local Document into a secure CloudDocumentEnvelope.
 */
export async function encryptDocument(
  doc: Document,
  ownerUid: string,
  deviceId: string,
  targetRev?: number
): Promise<CloudDocumentEnvelope> {
  const key = await getDocumentCryptoKey(ownerUid);

  // Generate 96-bit (12-byte) initialization vector
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Serialize document payload
  const jsonString = JSON.stringify(doc);
  const encodedData = new TextEncoder().encode(jsonString);

  // Compute integrity hash before encryption
  const integritySignature = await computeSha256Hex(encodedData);

  // Encrypt with AES-GCM-256
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  const encryptedPayload = uint8ToBase64(new Uint8Array(encryptedBuffer));
  const ivBase64 = uint8ToBase64(iv);

  const rev = targetRev !== undefined ? targetRev : Math.max(1, doc.version || 1);

  return {
    documentId: doc.id,
    ownerUid,
    schemaVersion: 1,
    rev,
    updatedAt: doc.updatedAt || Date.now(),
    createdAt: doc.createdAt || Date.now(),
    isDeleted: !!doc.isDeleted,
    deviceId,
    encryptedPayload,
    iv: ivBase64,
    integritySignature,
    type: doc.type || 'blank',
    wordCount: doc.stats?.words || 0,
  };
}

/**
 * Decrypt a CloudDocumentEnvelope into a full Document with integrity verification.
 */
export async function decryptEnvelope(
  envelope: CloudDocumentEnvelope,
  ownerUid: string
): Promise<Document> {
  if (envelope.ownerUid !== ownerUid) {
    throw new Error(
      `Access denied: Envelope owner (${envelope.ownerUid}) does not match current user (${ownerUid})`
    );
  }

  const key = await getDocumentCryptoKey(ownerUid);
  const iv = base64ToUint8(envelope.iv);
  const cipherBytes = base64ToUint8(envelope.encryptedPayload);

  // Decrypt AES-GCM
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    cipherBytes as unknown as BufferSource
  );

  const decryptedBytes = new Uint8Array(decryptedBuffer);

  // Verify SHA-256 integrity signature
  const verifiedHash = await computeSha256Hex(decryptedBytes);
  if (verifiedHash !== envelope.integritySignature) {
    throw new Error(
      `Integrity violation for document ${envelope.documentId}: SHA-256 mismatch`
    );
  }

  const jsonStr = new TextDecoder().decode(decryptedBytes);
  const parsedDoc: Document = JSON.parse(jsonStr);

  // Ensure revision matches the cloud envelope
  parsedDoc.version = envelope.rev;
  parsedDoc.updatedAt = envelope.updatedAt;

  return parsedDoc;
}

/**
 * Clear cached crypto keys on logout / user switch
 */
export function clearKeyCache(): void {
  keyCache.clear();
}
