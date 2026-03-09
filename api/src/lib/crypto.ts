import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from './env.js';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(env.encryptionKey, 'hex');

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv (12) + tag (16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]);
}

export function decrypt(data: Buffer): string {
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
