/**
 * Session tokens: signed, stateless, and readable from the Edge.
 *
 * There is no sessions table. A token carries the account id and an expiry,
 * signed with a server secret, so a request can be authenticated without
 * touching the database — which matters because the guard that redirects
 * signed-out visitors runs in middleware, before any database client exists.
 *
 * Everything here uses Web Crypto rather than node:crypto, because middleware
 * runs on the Edge runtime where node:crypto is unavailable. Password hashing
 * needs scrypt and therefore Node, so it lives apart in password.ts and is
 * only ever called from route handlers.
 */

const SESSION_COOKIE = 'campaign_session';

/** A week. Long enough not to nag, short enough that a stolen token expires. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionPayload {
  userId: string;
  /** Epoch milliseconds. */
  exp: number;
}

export { SESSION_COOKIE, SESSION_TTL_MS };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    // Read lazily, never at module load: `next build` collects page data
    // without the environment, and throwing there would fail the build rather
    // than the request.
    throw new Error('AUTH_SECRET is not set');
  }
  return value;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Backed by its own ArrayBuffer rather than Uint8Array.from, whose result is
// typed over ArrayBufferLike and so is not accepted as a BufferSource.
function fromBase64url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** `<payload>.<signature>`, both base64url. */
export async function signSession(userId: string): Promise<string> {
  const payload: SessionPayload = { userId, exp: Date.now() + SESSION_TTL_MS };
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}

/**
 * The payload if the token is genuine and unexpired, otherwise null.
 *
 * Verification is done by crypto.subtle.verify rather than by comparing
 * strings, so a forged signature cannot be found one character at a time.
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      fromBase64url(signature),
      new TextEncoder().encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as SessionPayload;
    if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    // Malformed base64, malformed JSON, or a missing secret — all of which
    // mean "not signed in" rather than "crash the request".
    return null;
  }
}

/** Cookie attributes shared by the routes that set and clear the session. */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
