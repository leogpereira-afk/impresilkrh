// ============================================================================
// Leitura do Cartão Ponto (Secullum) em PDF, no próprio navegador (pdfjs).
// Extrai, por funcionário: horas NORMAIS, FALTAS e EXTRAS já calculadas pelo
// Secullum (sistema regido pela CLT — não recalculamos, para não divergir da
// folha legal). Casa cada página com um colaborador do cadastro pelo nome.
//
// O pdfjs é carregado sob demanda (import dinâmico) — não pesa no bundle de
// quem nunca usa o import de ponto.
// ============================================================================

import type { PontoDia, SituacaoDia } from "@/data/types";

export interface PontoLinha {
  nomePdf: string;                 // nome como veio no cabeçalho do PDF
  colaboradorId: string | null;    // casado no cadastro (null = não encontrado)
  colaboradorNome: string | null;
  normaisMin: number;              // minutos (para somar no custo depois)
  faltasMin: number;
  extrasMin: number;
  normaisTxt: string;              // "158:24" (como no PDF)
  faltasTxt: string;
  extrasTxt: string;
  dias: PontoDia[];                // detalhe diário (extrato do mês)
}

export interface PontoImportado {
  competencia: string;             // "YYYY-MM" (derivada do fim do período)
  periodoInicio: string | null;    // "YYYY-MM-DD"
  periodoFim: string | null;
  totalPaginas: number;
  linhas: PontoLinha[];
}

const norm = (s: string) =>
  (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

const ehHora = (s: string) => /^\d{1,3}:\d{2}$/.test(s.trim());
export function horaParaMin(hhmm: string): number {
  const m = (hhmm || "").trim().match(/^(\d{1,3}):(\d{2})$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
export function minParaHora(min: number): string {
  const neg = min < 0; const a = Math.abs(Math.round(min));
  return `${neg ? "-" : ""}${Math.floor(a / 60).toString().padStart(2, "0")}:${(a % 60).toString().padStart(2, "0")}`;
}

// --- Extrato diário -----------------------------------------------------------
// A tabela do Secullum tem colunas fixas por posição-x (em pontos de PDF).
// Validado: a soma dos dias bate EXATAMENTE com os TOTAIS do mês (26/26 páginas).
//   data<100 · batidas 100–265 · NORMAIS 265–300 · FALTAS 300–335 · EXTRAS 335–375
function colunaDia(x: number): "data" | "marc" | "norm" | "falt" | "extra" | "resto" {
  if (x < 100) return "data";
  if (x < 265) return "marc";
  if (x < 300) return "norm";
  if (x < 335) return "falt";
  if (x < 375) return "extra";
  return "resto";
}

// Situação do dia a partir dos marcadores que o Secullum imprime na área das
// batidas ("Feriado", "Folga", "Falta", "Atestado", "Abono", "Férias").
function situacaoDia(marcadores: string): SituacaoDia {
  const t = norm(marcadores);
  if (t.includes("FERIADO")) return "feriado";
  if (t.includes("ATESTAD")) return "atestado";
  if (t.includes("ABONO")) return "abono";
  if (t.includes("FERIAS")) return "ferias";
  if (t.includes("FALTA")) return "falta";
  if (t.includes("FOLGA") || t.includes("DSR") || t.includes("DESCANSO")) return "folga";
  return "normal";
}

// Lê as linhas diárias de uma página. Cada linha começa por uma data DD/MM/AA
// na 1ª coluna; as demais colunas saem pela posição-x.
function lerDiasDaPagina(items: { str: string; x: number; y: number }[]): PontoDia[] {
  const porLinha = new Map<number, { str: string; x: number }[]>();
  for (const it of items) {
    const k = Math.round(it.y); // itens da mesma linha compartilham a baseline
    const arr = porLinha.get(k) ?? [];
    arr.push({ str: it.str, x: it.x });
    porLinha.set(k, arr);
  }

  const dias: PontoDia[] = [];
  for (const linha0 of porLinha.values()) {
    const linha = linha0.sort((a, b) => a.x - b.x);
    const dataItem = linha.find((w) => w.x < 100 && /^\d{2}\/\d{2}\/\d{2}$/.test(w.str.trim()));
    if (!dataItem) continue; // não é uma linha de dia (cabeçalho, TOTAIS, etc.)
    const [dd, mm, yy] = dataItem.str.trim().split("/");
    const data = `20${yy}-${mm}-${dd}`;

    const marc: string[] = [];
    let diaSemana: string | undefined;
    let normaisMin = 0, faltasMin = 0, extrasMin = 0;
    for (const w of linha) {
      const s = w.str.trim();
      switch (colunaDia(w.x)) {
        case "data":
          // dia da semana (seg, ter…) — qualquer token alfabético que não seja a data
          if (/[A-Za-zÀ-ÿ]/.test(s) && !/\d/.test(s)) diaSemana = s.replace(/\.$/, "").toLowerCase();
          break;
        case "marc": {
          const limpo = s.replace(/\*/g, "").trim(); // "07:30*" → "07:30"
          if (/^\d{1,2}:\d{2}$/.test(limpo)) marc.push(limpo);
          else if (/[A-Za-zÀ-ÿ]/.test(limpo)) marc.push(limpo); // marcador (Feriado, Falta…)
          break;
        }
        case "norm": if (ehHora(s)) normaisMin = horaParaMin(s); break;
        case "falt": if (ehHora(s)) faltasMin = horaParaMin(s); break;
        case "extra": if (ehHora(s)) extrasMin = horaParaMin(s); break;
      }
    }
    dias.push({ data, diaSemana, situacao: situacaoDia(marc.join(" ")), marcacoes: marc, normaisMin, extrasMin, faltasMin });
  }
  return dias.sort((a, b) => a.data.localeCompare(b.data));
}

// Rótulos/textos do template que NUNCA são o nome da pessoa.
const ROTULOS = ["IMPRESILK", "CARTAO", "CARTÃO", "PONTO", "SECULLUM", "TOTAIS", "NORMAIS", "FALTAS", "EXTRAS", "BTOTAL", "DEPARTAMENTO", "FUNCAO", "FUNÇÃO", "EMPRESA", "HORARIO", "FOLGA", "FERIADO", "SISTEMA", "REGIDO", "CLT", "EMITIDO", "PAGINA", "PÁGINA", "INSCRICAO", "ADMISSAO", "TRABALHO"];

let workerConfigurado = false;

export async function lerPontoPdf(
  buffer: ArrayBuffer,
  colaboradores: { id: string; nome: string }[],
): Promise<PontoImportado> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigurado) {
    // Worker empacotado pelo Vite (roda o parse fora da thread da UI).
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    workerConfigurado = true;
  }
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  // Índice dos colaboradores por tokens do nome (>=2 tokens).
  const idx = colaboradores
    .map((c) => ({ id: c.id, nome: c.nome, toks: norm(c.nome).split(/\s+/).filter(Boolean) }))
    .filter((c) => c.toks.length >= 2);

  let periodoInicio: string | null = null;
  let periodoFim: string | null = null;
  const linhas: PontoLinha[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const h = vp.height;
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => ({ str: (it as { str: string }).str, x: (it as { transform: number[] }).transform[4], y: (it as { transform: number[] }).transform[5] }))
      .filter((it) => it.str && it.str.trim());

    // Período (só uma vez): "DE 29/06/2026 ATÉ 28/07/2026".
    if (!periodoFim) {
      const full = items.map((i) => i.str).join(" ");
      const mp = full.match(/DE\s+(\d{2})\/(\d{2})\/(\d{4})\s+AT[ÉE]\s+(\d{2})\/(\d{2})\/(\d{4})/i);
      if (mp) {
        periodoInicio = `${mp[3]}-${mp[2]}-${mp[1]}`;
        periodoFim = `${mp[6]}-${mp[5]}-${mp[4]}`;
      }
    }

    // Nome no cabeçalho: metade de cima da página (y alto = topo, origem embaixo).
    const topo = items.filter((it) => it.y > h * 0.55);
    const topoTxt = norm(topo.map((it) => it.str).join(" "));

    // Casa o colaborador cujos tokens do nome estejam TODOS no cabeçalho.
    let colId: string | null = null;
    let colNome: string | null = null;
    let best = 0;
    for (const c of idx) {
      if (c.toks.every((t) => topoTxt.includes(t)) && c.toks.length > best) {
        best = c.toks.length;
        colId = c.id;
        colNome = c.nome;
      }
    }

    // Nome cru do PDF (para exibir, sobretudo os não casados): entre os itens do
    // cabeçalho que parecem nome (>=2 palavras, só letras, não é rótulo), escolhe
    // o que tem MAIOR sobreposição de tokens com algum colaborador — assim mostra
    // o nome real mesmo quando não casou 100% (ex.: grafia/acento diferente).
    let nomePdf = colNome || "";
    if (!nomePdf) {
      let melhor = "";
      let melhorInter = -1;
      for (const it of topo) {
        const s = it.str.trim();
        if (s.split(/\s+/).length < 2 || !/^[A-Za-zÀ-ÿ' .]+$/.test(s)) continue;
        if (ROTULOS.some((r) => norm(s).includes(r))) continue;
        const itoks = new Set(norm(s).split(/\s+/).filter(Boolean));
        let inter = 0;
        for (const c of idx) { const n = c.toks.filter((t) => itoks.has(t)).length; if (n > inter) inter = n; }
        if (inter > melhorInter) { melhorInter = inter; melhor = s; }
      }
      nomePdf = melhor || `Página ${p}`;
    }

    // TOTAIS do mês: os 3 primeiros HH:MM à direita do rótulo "TOTAIS", mesma linha.
    const totItem = items.find((it) => it.str.trim() === "TOTAIS");
    let vals: string[] = [];
    if (totItem) {
      vals = items
        .filter((it) => Math.abs(it.y - totItem.y) < 4 && it.x > totItem.x && ehHora(it.str))
        .sort((a, b) => a.x - b.x)
        .slice(0, 3)
        .map((it) => it.str.trim());
    }
    const [normaisTxt = "", faltasTxt = "", extrasTxt = ""] = vals;

    linhas.push({
      nomePdf,
      colaboradorId: colId,
      colaboradorNome: colNome,
      normaisMin: horaParaMin(normaisTxt),
      faltasMin: horaParaMin(faltasTxt),
      extrasMin: horaParaMin(extrasTxt),
      normaisTxt, faltasTxt, extrasTxt,
      dias: lerDiasDaPagina(items),
    });
  }

  const competencia = periodoFim ? periodoFim.slice(0, 7) : "";
  return { competencia, periodoInicio, periodoFim, totalPaginas: doc.numPages, linhas };
}
