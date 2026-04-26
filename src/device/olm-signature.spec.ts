import {
  createPrivateKey,
  generateKeyPairSync,
  sign as nodeSign,
} from 'node:crypto';
import { verifyOlmSignature, verifySignedPublicKey } from './olm-signature';

/**
 * The Olm protocol signs over the *base64-encoded* public key string with the
 * device's Ed25519 identity key. These tests use Node's `crypto` to produce a
 * signature exactly the way a well-behaved Olm client would, then confirm the
 * server-side verifier accepts it — and rejects every tampering attempt.
 *
 * We deliberately regenerate keys per-test instead of baking a fixture in;
 * that way a future bump to Node's key format cannot silently pass.
 */
function rawPublicFromKeyPair(publicDer: Buffer): string {
  // Node exports Ed25519 public keys as a 44-byte DER SPKI; the raw 32B key
  // sits at the tail.
  return publicDer.slice(-32).toString('base64');
}

function signedKeyFixture(message: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  const identityKeyEd25519 = rawPublicFromKeyPair(pubDer);
  const keyObj = createPrivateKey(
    privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
  );
  const signature = nodeSign(
    null,
    Buffer.from(message, 'utf8'),
    keyObj,
  ).toString('base64');
  return { identityKeyEd25519, signature };
}

describe('verifyOlmSignature', () => {
  it('accepts a freshly generated Ed25519 signature', () => {
    const message = 'curve25519-public-key-base64';
    const { identityKeyEd25519, signature } = signedKeyFixture(message);
    expect(verifyOlmSignature({ identityKeyEd25519, message, signature })).toBe(
      true,
    );
  });

  it('rejects a signature when the message is altered', () => {
    const message = 'curve25519-public-key-base64';
    const { identityKeyEd25519, signature } = signedKeyFixture(message);
    expect(
      verifyOlmSignature({
        identityKeyEd25519,
        message: message + 'x',
        signature,
      }),
    ).toBe(false);
  });

  it('rejects a wrong-length Ed25519 public key', () => {
    const message = 'msg';
    const { signature } = signedKeyFixture(message);
    // Padding by one byte yields a 33B raw key which must be rejected before
    // even trying to verify.
    const identityKeyEd25519 = Buffer.alloc(33).toString('base64');
    expect(verifyOlmSignature({ identityKeyEd25519, message, signature })).toBe(
      false,
    );
  });

  it('rejects a non-64B signature', () => {
    const message = 'msg';
    const { identityKeyEd25519 } = signedKeyFixture(message);
    const signature = Buffer.alloc(32).toString('base64');
    expect(verifyOlmSignature({ identityKeyEd25519, message, signature })).toBe(
      false,
    );
  });
});

describe('verifySignedPublicKey', () => {
  it('verifies the exact-bytes public key the uploader signed', () => {
    const publicKey = 'AAAAA_signed_public_key_base64';
    const { identityKeyEd25519, signature } = signedKeyFixture(publicKey);
    expect(
      verifySignedPublicKey({
        identityKeyEd25519,
        publicKey,
        signature,
      }),
    ).toBe(true);
  });

  it('rejects a substituted public key', () => {
    const publicKey = 'AAAAA_signed_public_key_base64';
    const { identityKeyEd25519, signature } = signedKeyFixture(publicKey);
    expect(
      verifySignedPublicKey({
        identityKeyEd25519,
        publicKey: publicKey + 'tamper',
        signature,
      }),
    ).toBe(false);
  });
});
