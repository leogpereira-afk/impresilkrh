import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const RAIZ = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage", "uploads");

function sanitizar(nome: string): string {
  return nome.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

// Salva um arquivo enviado e retorna metadados para persistir no banco.
export async function salvarArquivo(
  file: File,
): Promise<{ caminho: string; nome: string; tamanho: number }> {
  await mkdir(RAIZ, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const id = randomBytes(8).toString("hex");
  const nomeSeguro = sanitizar(file.name || "arquivo");
  const armazenado = `${id}-${nomeSeguro}`;
  await writeFile(path.join(RAIZ, armazenado), bytes);
  return { caminho: armazenado, nome: file.name || nomeSeguro, tamanho: bytes.length };
}

export async function lerArquivo(caminho: string): Promise<Buffer> {
  // Impede path traversal — usa apenas o basename.
  const seguro = path.basename(caminho);
  return readFile(path.join(RAIZ, seguro));
}

export async function removerArquivo(caminho: string): Promise<void> {
  try {
    await unlink(path.join(RAIZ, path.basename(caminho)));
  } catch {
    /* arquivo pode não existir — ignora */
  }
}

const TIPOS: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function tipoConteudo(nome: string): string {
  const ext = path.extname(nome).toLowerCase();
  return TIPOS[ext] ?? "application/octet-stream";
}
