import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The GitHub App installation callback (`GET /github/callback`) is invoked
 * directly by GitHub's redirect — it cannot be protected by JwtAuthGuard
 * because the browser hop does not reliably carry the app's own cookies in
 * every GitHub App flow. Instead, the `state` value is a short-lived,
 * HMAC-signed token binding the callback to the exact user who requested the
 * install URL, so it cannot be forged or replayed against another account.
 *
 * Format: base64url(userId.expiryEpochMs).hexHmacSignature
 */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes is more than enough to complete an install

export function signGitHubState(userId: string, secret: string): string {
  const expiresAt = Date.now() + STATE_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const payloadEncoded = Buffer.from(payload).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('hex');
  return `${payloadEncoded}.${signature}`;
}

export function verifyGitHubState(
  state: string | undefined,
  secret: string,
): { valid: boolean; userId?: string; reason?: string } {
  if (!state || typeof state !== 'string' || !state.includes('.')) {
    return { valid: false, reason: 'Missing or malformed state parameter' };
  }

  const lastDot = state.lastIndexOf('.');
  const payloadEncoded = state.slice(0, lastDot);
  const signature = state.slice(lastDot + 1);

  if (!payloadEncoded || !signature) {
    return { valid: false, reason: 'Malformed state parameter' };
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payloadEncoded)
    .digest('hex');

  const providedBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');

  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, reason: 'Invalid state signature' };
  }

  let decodedPayload: string;
  try {
    decodedPayload = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
  } catch {
    return { valid: false, reason: 'Malformed state payload' };
  }

  const separatorIndex = decodedPayload.lastIndexOf('.');
  if (separatorIndex === -1) {
    return { valid: false, reason: 'Malformed state payload' };
  }

  const userId = decodedPayload.slice(0, separatorIndex);
  const expiresAt = Number(decodedPayload.slice(separatorIndex + 1));

  if (!userId || Number.isNaN(expiresAt)) {
    return { valid: false, reason: 'Malformed state payload' };
  }

  if (Date.now() > expiresAt) {
    return { valid: false, reason: 'State has expired, please try again' };
  }

  return { valid: true, userId };
}
