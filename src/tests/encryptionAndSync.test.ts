import assert from 'node:assert';
import {
  encryptDocument,
  decryptEnvelope,
} from '../crypto/documentEncryption';
import type { Document } from '../types';

async function runTests() {
  console.log('--- RUNNING LITERIA ENCRYPTION & SYNC TESTS ---');

  const sampleDoc: Document = {
    id: 'doc_test_123',
    title: 'The Secret Manuscript',
    type: 'novel',
    content: '<h1>Chapter One</h1><p>It was a dark and stormy night...</p>',
    plainTextPreview: 'It was a dark and stormy night...',
    tags: ['mystery', 'novel'],
    isFavorite: true,
    isArchived: false,
    isDraft: false,
    isDeleted: false,
    version: 3,
    stats: {
      words: 10,
      characters: 54,
      sentences: 1,
      paragraphs: 1,
      readingTimeMinutes: 1,
      estimatedPages: 1,
    },
    metadata: {
      novel: {
        synopsis: 'A classic mystery thriller.',
        targetWordCount: 50000,
      },
    },
    createdAt: 1700000000000,
    updatedAt: 1700000050000,
  };

  const ownerUid = 'firebase_user_abc_789';
  const deviceId = 'android_dev_456';

  // Test 1: Encryption Round-Trip
  console.log('Test 1: Encrypting local document to AES-GCM-256 envelope...');
  const envelope = await encryptDocument(sampleDoc, ownerUid, deviceId, 4);

  assert.strictEqual(envelope.documentId, sampleDoc.id, 'documentId must match');
  assert.strictEqual(envelope.ownerUid, ownerUid, 'ownerUid must match');
  assert.strictEqual(envelope.schemaVersion, 1, 'schemaVersion must be 1');
  assert.strictEqual(envelope.rev, 4, 'rev must be targetRev');
  assert.strictEqual(envelope.isDeleted, false, 'isDeleted must be false');
  assert.ok(envelope.encryptedPayload.length > 0, 'encryptedPayload must not be empty');
  assert.ok(envelope.iv.length > 0, 'iv must not be empty');
  assert.strictEqual(envelope.integritySignature.length, 64, 'integritySignature must be 64-char SHA-256 hex');

  console.log('✓ Document encrypted successfully.');

  // Test 2: Decryption & Integrity Verification
  console.log('Test 2: Decrypting envelope with correct owner key...');
  const decrypted = await decryptEnvelope(envelope, ownerUid);

  assert.strictEqual(decrypted.id, sampleDoc.id);
  assert.strictEqual(decrypted.title, sampleDoc.title);
  assert.strictEqual(decrypted.content, sampleDoc.content);
  assert.strictEqual(decrypted.tags.length, 2);
  assert.strictEqual(decrypted.version, 4, 'Version updated to envelope rev');

  console.log('✓ Decryption & SHA-256 integrity signature verified.');

  // Test 3: Unauthorized Access Prevention
  console.log('Test 3: Attempting decryption with different user identity...');
  let unauthorizedErrorCaught = false;
  try {
    await decryptEnvelope(envelope, 'attacker_user_xyz');
  } catch (e: unknown) {
    unauthorizedErrorCaught = true;
    console.log(`✓ Caught expected access control rejection: ${(e as Error).message}`);
  }
  assert.ok(unauthorizedErrorCaught, 'Decryption must fail for unauthorized user');

  // Test 4: Tamper Detection (Integrity Violation)
  console.log('Test 4: Tampering with ciphertext to verify integrity check...');
  let tamperErrorCaught = false;
  const tamperedEnvelope = {
    ...envelope,
    // Corrupt the ciphertext
    encryptedPayload: envelope.encryptedPayload.substring(0, 10) + 'AAAA' + envelope.encryptedPayload.substring(14),
  };
  try {
    await decryptEnvelope(tamperedEnvelope, ownerUid);
  } catch (e: unknown) {
    tamperErrorCaught = true;
    console.log(`✓ Caught expected tampering/decryption rejection: ${(e as Error).message}`);
  }
  assert.ok(tamperErrorCaught, 'Decryption of tampered ciphertext must fail');

  console.log('\n=======================================');
  console.log('ALL ENCRYPTION & SYNC TESTS PASSED! (4/4)');
  console.log('=======================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
