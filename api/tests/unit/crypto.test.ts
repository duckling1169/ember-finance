import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/lib/crypto.js';

describe('crypto', () => {
  it('encrypts and decrypts a simple string', () => {
    const plaintext = 'my-secret-token-12345';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('encrypts and decrypts JSON credentials', () => {
    const creds = JSON.stringify({
      accessToken: 'tok_abc123',
      enrollmentId: 'enr_xyz789',
      cursor: 'cur_456',
    });

    const encrypted = encrypt(creds);
    const decrypted = decrypt(encrypted);
    const parsed = JSON.parse(decrypted);

    expect(parsed.accessToken).toBe('tok_abc123');
    expect(parsed.enrollmentId).toBe('enr_xyz789');
    expect(parsed.cursor).toBe('cur_456');
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);

    expect(a).not.toEqual(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it('encrypted output is longer than input (iv + tag + ciphertext)', () => {
    const plaintext = 'short';
    const encrypted = encrypt(plaintext);

    // 12 (iv) + 16 (tag) + ciphertext >= 28 + plaintext length
    expect(encrypted.length).toBeGreaterThanOrEqual(28 + plaintext.length);
  });

  it('fails to decrypt tampered data', () => {
    const encrypted = encrypt('sensitive data');
    // Tamper with a byte in the ciphertext region
    encrypted[30] ^= 0xff;

    expect(() => decrypt(encrypted)).toThrow();
  });

  it('handles empty string', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('handles unicode content', () => {
    const plaintext = '🔥 FIRE App — ñoño €100';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('handles long strings', () => {
    const plaintext = 'x'.repeat(10000);
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});
