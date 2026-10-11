import type { JWTPayload } from './auth';

const JWT_SECRET = process.env.JWT_SECRET || 'pharma_brain_patient_dmr_jwt_secret_key_2026_super_secure!';

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeString(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Pure Web Crypto JWT verification for Next.js Edge Runtime Middleware.
 * Has zero dependencies on Node.js native modules (no 'crypto', no 'fs', no 'buffer').
 */
export async function verifyTokenEdge(token: string | undefined | null): Promise<JWTPayload | null> {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const payloadJson = base64UrlDecodeString(payloadB64);
    const payload = JSON.parse(payloadJson);

    // Enforce token expiration (iat / exp in seconds)
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlToUint8Array(sigB64);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as unknown as BufferSource,
      dataToVerify
    );

    if (!isValid) return null;

    return payload as JWTPayload;
  } catch {
    return null;
  }
}
