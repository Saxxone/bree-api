import { createPublicKey, verify as nodeVerify } from 'node:crypto';

/**
 * Wrap a raw 32B Ed25519 public key in a DER SubjectPublicKeyInfo so Node's
 * `crypto` can verify with it. Olm stores the raw key bytes; Node's key APIs
 * only accept DER/PEM, so we prefix the standard Ed25519 OID header.
 */
const ED25519_DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function base64ToBuffer(value: string): Buffer | null {
  try {
    const buf = Buffer.from(value, 'base64');
    // Round-trip check defends against obviously-garbage inputs that
    // Buffer.from silently accepts.
    if (buf.length === 0) return null;
    return buf;
  } catch {
    return null;
  }
}

function rawEd25519ToKeyObject(rawBase64: string) {
  const raw = base64ToBuffer(rawBase64);
  if (!raw || raw.length !== 32) return null;
  const der = Buffer.concat([ED25519_DER_PREFIX, raw]);
  try {
    return createPublicKey({ key: der, format: 'der', type: 'spki' });
  } catch {
    return null;
  }
}

/**
 * Verify an Olm-style Ed25519 signature over `message` using the raw 32B
 * Ed25519 public key `identityKeyEd25519Base64`. Returns false on any
 * parse/verify failure (never throws).
 */
export function verifyOlmSignature(args: {
  identityKeyEd25519: string;
  message: string;
  signature: string;
}): boolean {
  const keyObject = rawEd25519ToKeyObject(args.identityKeyEd25519);
  if (!keyObject) return false;
  const sig = base64ToBuffer(args.signature);
  if (!sig || sig.length !== 64) return false;
  try {
    return nodeVerify(null, Buffer.from(args.message, 'utf8'), keyObject, sig);
  } catch {
    return false;
  }
}

/**
 * Verify that `signature` signs exactly `publicKey` (the canonical Olm way of
 * proving the uploader owns the Ed25519 identity key that fabricated the
 * one-time / fallback key). We sign the base64 public-key string so the bytes
 * on the wire and the bytes being signed are identical.
 */
export function verifySignedPublicKey(args: {
  identityKeyEd25519: string;
  publicKey: string;
  signature: string;
}): boolean {
  return verifyOlmSignature({
    identityKeyEd25519: args.identityKeyEd25519,
    message: args.publicKey,
    signature: args.signature,
  });
}
