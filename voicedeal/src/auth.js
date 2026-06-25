// Toegangsbeveiliging van de app via een zelfgekozen wachtwoord (APP_PASSWORD).
// We zetten na het inloggen een ondertekende cookie (HMAC-SHA256), zodat we
// geen aparte sessie-opslag nodig hebben. De sleutel is APP_PASSWORD zelf.

const encoder = new TextEncoder();

function b64urlEncode(bytes) {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Maakt een ondertekende sessietoken aan (standaard 7 dagen geldig).
export async function createSession(secret, ttlSeconds = 60 * 60 * 24 * 7) {
  const payload = { exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payloadB64 = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

// Controleert de handtekening én de vervaldatum van een sessietoken.
export async function verifySession(secret, token) {
  if (!token || !token.includes(".")) return false;
  const [payloadB64, sigB64] = token.split(".");
  const key = await hmacKey(secret);
  let valid;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sigB64),
      encoder.encode(payloadB64)
    );
  } catch {
    return false;
  }
  if (!valid) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// Timing-veilige vergelijking van het ingetypte wachtwoord met APP_PASSWORD.
export async function passwordMatches(secret, attempt) {
  if (typeof attempt !== "string" || attempt.length === 0) return false;
  const key = await hmacKey(secret);
  const a = await crypto.subtle.sign("HMAC", key, encoder.encode("pw:" + attempt));
  const b = await crypto.subtle.sign("HMAC", key, encoder.encode("pw:" + secret));
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  if (av.length !== bv.length) return false;
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > -1) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

const SESSION_COOKIE = "vd_session";

export async function isLoggedIn(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  return verifySession(env.APP_PASSWORD, token);
}

export function sessionCookie(token) {
  const maxAge = 60 * 60 * 24 * 7;
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
