// Stateless, HMAC-signed session cookie for the "Мои заказы" SMS-OTP login
// (functions/api/auth/verify-otp.js mints it, functions/api/customer-orders.js
// reads it). No server-side session table — the cookie itself is the source
// of truth, verified on every request against SESSION_SIGNING_SECRET.
//
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 of that JSON)

export const SESSION_COOKIE_NAME = "gmk_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload, secret) {
  const data = JSON.stringify(payload);
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${bytesToBase64Url(new TextEncoder().encode(data))}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

// Returns the payload (e.g. { phone: "996700000000", exp: 1234567890 }) if
// the token's signature is valid and it hasn't expired, otherwise null.
export async function verifySession(token, secret) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [dataB64, sigB64] = token.split(".");
  if (!dataB64 || !sigB64) return null;

  let dataBytes;
  let signatureBytes;
  try {
    dataBytes = base64UrlToBytes(dataB64);
    signatureBytes = base64UrlToBytes(sigB64);
  } catch {
    return null;
  }

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, dataBytes);
  if (!valid) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(dataBytes));
  } catch {
    return null;
  }
  if (!payload || typeof payload.phone !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function buildSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function buildLogoutCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Pure: extract this cookie's value from a raw `Cookie` request header.
export function parseSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
}
