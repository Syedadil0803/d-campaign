import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing for the seeded test account.
 *
 * scrypt from Node's standard library, so no dependency is added for something
 * that is meant to be temporary: once sign-in moves to Google there are no
 * passwords left to hash and this file goes with them.
 *
 * node:crypto is unavailable on the Edge runtime, so nothing here may be
 * imported by middleware. Session verification lives in session.ts on Web
 * Crypto precisely so the guard can run without this file.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** `<salt hex>:<derived key hex>` — the salt travels with the hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;

  try {
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
    // Length-checked first: timingSafeEqual throws on a mismatch rather than
    // returning false, and a wrong-length hash is a wrong password anyway.
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
