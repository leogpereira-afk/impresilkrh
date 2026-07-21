// ============================================================================
// Senha guardada com HASH (nunca em texto puro).
//
// Por que: a senha de cada usuário ficava legível dentro do cadastro (campo
// `senha`), que é gravado no localStorage E sincronizado para a nuvem. Quem
// abrisse o DevTools — ou lesse um backup — via a senha de todo mundo. Agora
// guardamos só a "impressão digital" da senha (PBKDF2-SHA256 com sal aleatório
// por pessoa): dá para CONFERIR se a senha digitada está certa, mas não dá para
// voltar dela para a senha original.
//
// A conferência é assíncrona porque usa a criptografia nativa do navegador
// (WebCrypto). Em contexto sem WebCrypto (navegador muito antigo ou http), o
// login cai no caminho antigo (texto puro) para ninguém ficar travado.
// ============================================================================

export interface SenhaGuardada {
  algo: "pbkdf2-sha256";
  sal: string; // base64
  iteracoes: number;
  hash: string; // base64
}

const ITERACOES = 120_000;

const subtle = (): SubtleCrypto | null => {
  try { return globalThis.crypto?.subtle ?? null; } catch { return null; }
};

const b64 = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivar(senha: string, sal: Uint8Array, iteracoes: number): Promise<string> {
  const sc = subtle();
  if (!sc) throw new Error("sem-webcrypto");
  const base = await sc.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await sc.deriveBits({ name: "PBKDF2", salt: sal as unknown as BufferSource, iterations: iteracoes, hash: "SHA-256" }, base, 256);
  return b64(bits);
}

/** É um registro de senha com hash (e não a senha antiga em texto)? */
export function ehHash(v: unknown): v is SenhaGuardada {
  const o = v as SenhaGuardada | null;
  return !!o && typeof o === "object" && o.algo === "pbkdf2-sha256" && typeof o.sal === "string" && typeof o.hash === "string";
}

/** O navegador consegue fazer hash? (https/localhost sim; http antigo não) */
export function podeHashear(): boolean { return !!subtle(); }

/** Transforma a senha digitada no registro que fica guardado. */
export async function criarHash(senha: string): Promise<SenhaGuardada> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(senha, sal, ITERACOES);
  return { algo: "pbkdf2-sha256", sal: b64(sal.buffer as ArrayBuffer), iteracoes: ITERACOES, hash };
}

/** Confere a senha digitada contra o registro guardado. */
export async function conferirHash(senha: string, guardada: SenhaGuardada): Promise<boolean> {
  if (!ehHash(guardada)) return false;
  try {
    const hash = await derivar(senha, deB64(guardada.sal), guardada.iteracoes || ITERACOES);
    // comparação de tempo constante (evita medir o tempo para adivinhar o hash)
    if (hash.length !== guardada.hash.length) return false;
    let dif = 0;
    for (let i = 0; i < hash.length; i++) dif |= hash.charCodeAt(i) ^ guardada.hash.charCodeAt(i);
    return dif === 0;
  } catch { return false; }
}
