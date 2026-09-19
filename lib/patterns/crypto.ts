const te = new TextEncoder();
const td = new TextDecoder();

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(pin: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", te.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: unb64(saltB64), iterations: 250000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(text));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return b64(out);
}

export async function decryptText(s: string, key: CryptoKey): Promise<string> {
  const d = unb64(s);
  return td.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: d.slice(0, 12) }, key, d.slice(12)));
}

export async function safeDecrypt(s: string, key: CryptoKey): Promise<string> {
  try {
    return await decryptText(s, key);
  } catch {
    return "(illisible)";
  }
}

export function newSalt(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}
