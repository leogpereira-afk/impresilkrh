// ============================================================================
// Utilidades de autenticação (sem dependências): JWT HS256 + hash de senha
// PBKDF2, usando apenas Web Crypto (global `crypto`), disponível no runtime
// do Netlify (Node 20). Mantido pequeno e auditável de propósito.
// ============================================================================

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---- base64url ----
function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlFromString = (s: string) => b64urlFromBytes(enc.encode(s));
const stringFromB64url = (s: string) => dec.decode(bytesFromB64url(s));

// ---- hex ----
const hexFromBytes = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
function bytesFromHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// ---- JWT HS256 ----
async function chaveHmac(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function assinarJwt(payload: Record<string, unknown>, secret: string, expSeg = 60 * 60 * 24 * 30): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = { ...payload, iat: agora, exp: agora + expSeg };
  const cabecalho = b64urlFromString(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const dados = `${cabecalho}.${b64urlFromString(JSON.stringify(corpo))}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(secret), enc.encode(dados)));
  return `${dados}.${b64urlFromBytes(sig)}`;
}

export async function verificarJwt(token: string, secret: string): Promise<Record<string, any> | null> {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const dados = `${partes[0]}.${partes[1]}`;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await chaveHmac(secret), bytesFromB64url(partes[2]), enc.encode(dados)); } catch { return null; }
  if (!ok) return null;
  let payload: any;
  try { payload = JSON.parse(stringFromB64url(partes[1])); } catch { return null; }
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null; // expirado
  return payload;
}

// ---- senha (PBKDF2-SHA256) ----
export interface RegistroSenha { hash: string; salt: string; iter: number }

export async function hashSenha(senha: string, saltHex?: string, iter = 120_000): Promise<RegistroSenha> {
  const salt = saltHex ? bytesFromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", enc.encode(senha), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, km, 256);
  return { hash: hexFromBytes(new Uint8Array(bits)), salt: hexFromBytes(salt), iter };
}

export async function conferirSenha(senha: string, reg: RegistroSenha): Promise<boolean> {
  if (!reg?.hash || !reg?.salt) return false;
  const { hash } = await hashSenha(senha, reg.salt, reg.iter || 120_000);
  // comparação em tempo constante
  if (hash.length !== reg.hash.length) return false;
  let dif = 0;
  for (let i = 0; i < hash.length; i++) dif |= hash.charCodeAt(i) ^ reg.hash.charCodeAt(i);
  return dif === 0;
}

// Normaliza o nome de usuário (sem acento, minúsculo, espaços colapsados).
export const normalizarUsuario = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
