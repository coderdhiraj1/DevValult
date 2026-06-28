export function isJWT(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;

  const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
  // Segment 1 and 2 are header and payload, which must be non-empty base64url.
  // Segment 3 is signature, which might be empty in rare cases (unsigned JWT) but usually valid base64url.
  return (
    parts[0].length > 0 &&
    base64UrlPattern.test(parts[0]) &&
    parts[1].length > 0 &&
    base64UrlPattern.test(parts[1]) &&
    (parts[2] === '' || base64UrlPattern.test(parts[2]))
  );
}

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('Invalid base64url string');
    }
    base64 += '='.repeat(4 - pad);
  }
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export interface DecodedJWT {
  header: object;
  payload: object;
}

export function decodeJWT(token: string): DecodedJWT | null {
  if (!isJWT(token)) return null;

  try {
    const [headerB64, payloadB64] = token.split('.');
    const headerStr = decodeBase64Url(headerB64);
    const payloadStr = decodeBase64Url(payloadB64);

    return {
      header: JSON.parse(headerStr),
      payload: JSON.parse(payloadStr),
    };
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}
