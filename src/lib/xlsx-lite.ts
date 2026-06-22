// Leitor de .xlsx SEM dependências externas. Um .xlsx é um ZIP de XML; aqui
// extraímos as entradas via DecompressionStream("deflate-raw") (nativo do
// navegador) e lemos as células da 1ª planilha. Suporta sharedStrings e
// inline strings. Retorna uma matriz de linhas (cada linha = array de células).
// Também aceita .csv como alternativa.

type Linha = (string | number | null)[];

async function inflateRaw(buf: Uint8Array): Promise<Uint8Array> {
  // Algumas entradas podem estar "stored" (sem compressão) — tratado pelo chamador.
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Response(new Blob([buf as BlobPart]).stream().pipeThrough(ds));
  return new Uint8Array(await stream.arrayBuffer());
}

interface ZipEntry {
  nome: string;
  metodo: number;
  offset: number;
  tamComp: number;
}

function lerZip(data: DataView): ZipEntry[] {
  // Acha o End Of Central Directory (assinatura 0x06054b50), varrendo do fim.
  let eocd = -1;
  for (let i = data.byteLength - 22; i >= 0; i--) {
    if (data.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Arquivo .xlsx inválido (ZIP não encontrado).");
  const total = data.getUint16(eocd + 10, true);
  let off = data.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < total; n++) {
    if (data.getUint32(off, true) !== 0x02014b50) break;
    const metodo = data.getUint16(off + 10, true);
    const tamComp = data.getUint32(off + 20, true);
    const nLen = data.getUint16(off + 28, true);
    const eLen = data.getUint16(off + 30, true);
    const cLen = data.getUint16(off + 32, true);
    const lho = data.getUint32(off + 42, true);
    const nome = new TextDecoder().decode(new Uint8Array(data.buffer, off + 46, nLen));
    entries.push({ nome, metodo, offset: lho, tamComp });
    off += 46 + nLen + eLen + cLen;
  }
  return entries;
}

async function lerEntrada(data: DataView, e: ZipEntry): Promise<string> {
  // Local file header: 30 bytes + nome + extra → dados comprimidos.
  const nLen = data.getUint16(e.offset + 26, true);
  const eLen = data.getUint16(e.offset + 28, true);
  const ini = e.offset + 30 + nLen + eLen;
  const comp = new Uint8Array(data.buffer, ini, e.tamComp);
  const bytes = e.metodo === 0 ? comp : await inflateRaw(comp);
  return new TextDecoder().decode(bytes);
}

function col2num(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml: string, shared: string[]): Linha[] {
  const linhas: Linha[] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const linha: Linha = [];
    const cellRe = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1]; const inner = cm[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const t = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const idx = ref ? col2num(ref) : linha.length;
      let val: string | number | null = null;
      if (t === "s") {
        const si = parseInt(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "-1", 10);
        val = shared[si] ?? null;
      } else if (t === "inlineStr") {
        val = (inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((s) => s.replace(/<[^>]+>/g, "")).join("");
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        val = raw != null ? (isNaN(Number(raw)) ? raw : Number(raw)) : null;
      }
      linha[idx] = typeof val === "string" ? descodificar(val) : val;
    }
    linhas.push(linha);
  }
  return linhas;
}

const descodificar = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function parseShared(xml: string): string[] {
  return (xml.match(/<si>([\s\S]*?)<\/si>/g) ?? []).map((si) =>
    descodificar((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("")),
  );
}

function parseCSV(texto: string): Linha[] {
  return texto.split(/\r?\n/).filter((l) => l.length).map((l) => {
    const cells: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === "," || c === ";") { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    return cells.map((v): string | number | null => { const n = Number(v.replace(/\./g, "").replace(",", ".")); return v.trim() !== "" && !isNaN(n) ? n : v; });
  });
}

// Lê um File (.xlsx ou .csv) e retorna as linhas da 1ª planilha.
export async function lerPlanilha(file: File): Promise<Linha[]> {
  if (/\.csv$/i.test(file.name)) return parseCSV(await file.text());
  const buf = await file.arrayBuffer();
  const data = new DataView(buf);
  const entries = lerZip(data);
  const sheetEntry =
    entries.find((e) => /xl\/worksheets\/sheet1\.xml$/i.test(e.nome)) ??
    entries.find((e) => /xl\/worksheets\/.*\.xml$/i.test(e.nome));
  if (!sheetEntry) throw new Error("Planilha não encontrada no arquivo.");
  const sharedEntry = entries.find((e) => /xl\/sharedStrings\.xml$/i.test(e.nome));
  const shared = sharedEntry ? parseShared(await lerEntrada(data, sharedEntry)) : [];
  return parseSheet(await lerEntrada(data, sheetEntry), shared);
}
