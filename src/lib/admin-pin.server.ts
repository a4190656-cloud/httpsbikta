import { createHmac, timingSafeEqual } from "node:crypto";

export const PIN_COOKIE = "bikta_admin_pin";
export const PIN_TTL_SEC = 60 * 60 * 12; // 12 hours

function key() {
  const k = process.env["ADMIN_ACCESS_KEY"];
  if (!k || k.length < 6) return null;
  return k;
}

function sign(payload: string, k: string) {
  return createHmac("sha256", `pin-session:${k}`).update(payload).digest("base64url");
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPin(pin: string) {
  const k = key();
  if (!k) return false;
  // Compare HMACs so lengths always match (no length leak).
  return safeEq(sign(pin, k), sign(k, k));
}

export function issuePinToken() {
  const k = key()!;
  const exp = String(Math.floor(Date.now() / 1000) + PIN_TTL_SEC);
  return `${exp}.${sign(exp, k)}`;
}

export function verifyPinToken(token: string | undefined | null) {
  const k = key();
  if (!k || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEq(sig, sign(exp, k));
}

export function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [n, ...v] = part.trim().split("=");
    if (n === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
