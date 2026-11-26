import crypto from 'crypto';

const SECRET = process.env.INVITE_TOKEN_SECRET || 'CHANGE_ME_IN_PRODUCTION_' + (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').slice(0, 16);

/**
 * Sign token data with HMAC-SHA256.
 * Returns: "base64url_payload.base64url_signature"
 */
export function signToken(data) {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', SECRET)
        .update(payload)
        .digest('base64url');
    return `${payload}.${signature}`;
}

/**
 * Verify and decode a signed token.
 * Returns decoded data object on success, or null if invalid/tampered.
 */
export function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    if (!payload || !signature) return null;

    const expected = crypto
        .createHmac('sha256', SECRET)
        .update(payload)
        .digest('base64url');

    // Timing-safe comparison to prevent timing attacks
    try {
        const sigBuf = Buffer.from(signature, 'base64url');
        const expBuf = Buffer.from(expected, 'base64url');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            return null;
        }
    } catch {
        return null;
    }

    try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
        return null;
    }
}
