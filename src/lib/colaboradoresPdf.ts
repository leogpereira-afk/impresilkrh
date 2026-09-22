// ============================================================================
// A lista de colaboradores em PDF.
//
// Pedido do Léo (22/09/2026): "onde tem o cadastro dos funcionários tem que ser
// possível ter uma parte pra ver em lista e baixar os dados via PDF para usar
// em outras coisas".
//
// "PARA USAR EM OUTRAS COISAS" É A PARTE QUE MANDA NO DESENHO. Um PDF sai da
// tela e vai viver sozinho: vira anexo de e-mail, entra numa reunião, volta
// daqui a três meses sem ninguém lembrar de onde veio. Então ele precisa dizer
// de si mesmo o que a tela dizia por ele:
//
//   - QUAL RECORTE produziu a lista. A tela tem busca, chips de área, filtro de
//     status, card clicado e "incluir inativos". Uma lista de 12 pessoas com
//     cara de quadro inteiro é o pior resultado possível — e é o caso normal,
//     porque quem exporta quase sempre exportou filtrado.
//   - QUANTOS FICARAM DE FORA, e por quê: o escopo de acesso de quem clicou, e
//     a direção, que a tela nunca lista.
//   - O ID DE CADA PESSOA. É a regra da casa (a pessoa é o ID; o nome só
//     exibe), e aqui ela é mais que regra: um PDF que vai ser cruzado com
//     outra planilha precisa da chave, não do nome, que repete e muda de
//     grafia.
//
// A montagem dos dados mora aqui e é pura — é o que tem teste. O desenho do
// documento usa o mesmo molde de lib/performancePdf.ts (jsPDF carregado sob
// demanda, para não pesar o bundle de quem nunca exporta).
// ============================================================================
import type { Colaborador } from "@/data/types";
import { idPessoa } from "./identidade";

export type VisaoLinha = "cadastro" | "custo" | "comportamental";

/** O que a tela estava filtrando quando a pessoa clicou em baixar. */
export interface FiltrosDaLista {
  busca?: string;
  /** Nomes das áreas escolhidas nos chips (já resolvidos, não ids). */
  areas?: string[];
  /** Nome do status escolhido no filtro (já resolvido). */
  status?: string;
  /** Rótulo do card do quadro que está selecionado, se houver. */
  cardSelecionado?: string;
  incluiInativos?: boolean;
}

/**
 * A frase que explica o recorte, em português corrido.
 *
 * Sem filtro nenhum ela diz isso em voz alta — "sem filtro: todo o quadro" —
 * em vez de ficar calada. Silêncio aqui seria lido como "é tudo", que é
 * justamente a conclusão perigosa quando o PDF está filtrado.
 */
export function descreverFiltros(f: FiltrosDaLista = {}): string {
  const partes: string[] = [];
  const busca = String(f.busca ?? "").trim();
  if (busca) partes.push(`busca "${busca}"`);
  const areas = (f.areas ?? []).filter(Boolean);
  if (areas.length === 1) partes.push(`área ${areas[0]}`);
  else if (areas.length > 1) partes.push(`áreas ${areas.join(", ")}`);
  if (f.status) partes.push(`status ${f.status}`);
  if (f.cardSelecionado) partes.push(f.cardSelecionado);
  if (f.incluiInativos) partes.push("incluindo desligados");
  return partes.length ? `Recorte: ${partes.join(" · ")}` : "Sem filtro: todo o quadro visível";
}

/**
 * Quantos ficaram de fora do papel, e por quê.
 *
 * Dois motivos, e os dois são invisíveis na tela: o escopo de acesso de quem
 * exportou (um gestor vê a equipe dele, não a casa) e a direção, que a lista
 * nunca mostra. Quem receber o PDF não tem como saber disso sozinho.
 */
export function descreverCobertura(
  mostrados: number,
  noEscopo: number,
  totalCadastro: number,
): string {
  const foraDoEscopo = Math.max(0, totalCadastro - noEscopo);
  const filtrados = Math.max(0, noEscopo - mostrados);
  const partes = [`${mostrados} colaborador(es) neste documento`];
  if (filtrados > 0) partes.push(`${filtrados} fora pelo recorte acima`);
  if (foraDoEscopo > 0) partes.push(`${foraDoEscopo} fora do seu acesso ou da direção`);
  return partes.join(" · ");
}

/** Cabeçalho de cada visão. A do PDF é a MESMA da tela, para não surpreender. */
export const COLUNAS: Record<VisaoLinha, string[]> = {
  cadastro: ["ID", "Colaborador", "Cargo", "Área", "Nível", "Admissão", "Status", "E-mail", "Telefone"],
  custo: ["ID", "Colaborador", "Área", "Custo do mês", "Lançamentos", "Status"],
  comportamental: ["ID", "Colaborador", "Perfil", "Motivação", "Área", "Status"],
};

export interface ApoioDaLinha {
  nomeCargo: (c: Colaborador) => string;
  nomeArea: (areaId: string | null | undefined) => string;
  nomeNivel: (nivelId: string | null | undefined) => string;
  nomeStatus: (statusId: string | null | undefined) => string;
  /** Só na visão de custo: total e quantos lançamentos, já formatados. */
  custoDe?: (c: Colaborador) => { total: string; lancamentos: number } | undefined;
}

const texto = (v: unknown) => String(v ?? "").trim();
const data = (v: unknown) => {
  const s = texto(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
  const [a, m, d] = s.split("-");
  return `${d}/${m}/${a}`;
};

/**
 * Uma linha do PDF.
 *
 * O ID vem primeiro e nunca fica em branco: cadastro sem CPF vira "sem ID", do
 * mesmo jeito que o crachá da tela faz. Campo vazio vira travessão — célula em
 * branco no papel se confunde com "o valor é zero" ou com erro de impressão.
 */
export function linhaDoColaborador(c: Colaborador, visao: VisaoLinha, apoio: ApoioDaLinha): string[] {
  const id = idPessoa(c.cpf) ?? "sem ID";
  const ou = (v: string) => (v ? v : "—");
  if (visao === "custo") {
    const x = apoio.custoDe?.(c);
    return [
      id,
      c.nome,
      ou(apoio.nomeArea(c.areaId)),
      x ? x.total : "—",
      x ? String(x.lancamentos) : "—",
      ou(apoio.nomeStatus(c.statusId)),
    ];
  }
  if (visao === "comportamental") {
    return [
      id,
      c.nome,
      ou(texto(c.perfilComportamental)),
      // Motivação é 0-100, não texto. Sem o "%" o número fica ambíguo no papel
      // (75 do quê?), e 0 é um valor legítimo — não pode virar travessão.
      Number.isFinite(c.motivacao) ? `${c.motivacao}%` : "—",
      ou(apoio.nomeArea(c.areaId)),
      ou(apoio.nomeStatus(c.statusId)),
    ];
  }
  return [
    id,
    c.nome,
    ou(apoio.nomeCargo(c)),
    ou(apoio.nomeArea(c.areaId)),
    ou(apoio.nomeNivel(c.nivelId)),
    data(c.dataAdmissao),
    ou(apoio.nomeStatus(c.statusId)),
    ou(texto(c.email)),
    ou(texto(c.telefone)),
  ];
}

/** Nome do arquivo: previsível, ordenável por data e sem espaço. */
export function nomeDoArquivo(visao: VisaoLinha, hoje: string): string {
  const sufixo = { cadastro: "cadastro", custo: "custo", comportamental: "comportamental" }[visao];
  return `Impresilk-Colaboradores-${sufixo}-${hoje.slice(0, 10)}.pdf`;
}

export interface PedidoDePdf {
  lista: Colaborador[];
  visao: VisaoLinha;
  apoio: ApoioDaLinha;
  filtros?: FiltrosDaLista;
  /** Quantos o usuário PODE ver (antes dos filtros da tela). */
  noEscopo: number;
  /** Quantos existem no cadastro inteiro. */
  totalCadastro: number;
  /** Rótulo da competência, só na visão de custo. */
  competencia?: string;
  /** Quem clicou — vai no rodapé, porque papel de RH circula. */
  quem?: string;
  /** Injetável para teste; em produção é a hora do clique. */
  agora?: Date;
}

export interface PdfMontado {
  arquivo: string;
  recorte: string;
  cobertura: string;
  linhas: number;
  /** O documento pronto. Quem chama decide salvar; o teste decide inspecionar. */
  doc: import("jspdf").jsPDF;
}

/**
 * Monta o documento — sem salvar.
 *
 * Separado do `exportar` de propósito: assim o teste exercita o gerador DE
 * VERDADE (jsPDF e autoTable, os mesmos do navegador) e confere o que saiu,
 * em vez de simular a biblioteca e provar só a minha aritmética. A tela de
 * Colaboradores exige login, então esta é a única prova honesta que eu
 * consigo dar de que o papel sai.
 */
export async function montarColaboradoresPdf(p: PedidoDePdf): Promise<PdfMontado> {
  const agora = p.agora ?? new Date();
  const recorte = descreverFiltros(p.filtros);
  const cobertura = descreverCobertura(p.lista.length, p.noEscopo, p.totalCadastro);
  const arquivo = nomeDoArquivo(p.visao, agora.toISOString());
  const head = COLUNAS[p.visao];
  const body = p.lista.map((c) => linhaDoColaborador(c, p.visao, p.apoio));

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });

  const titulo =
    p.visao === "custo"
      ? `Colaboradores | Custo${p.competencia ? ` de ${p.competencia}` : ""}`
      : p.visao === "comportamental"
        ? "Colaboradores | Perfil comportamental"
        : "Colaboradores | Cadastro";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(22, 51, 79);
  doc.text(`Impresilk | ${titulo}`, 14, 16);

  // As três linhas que fazem o papel se explicar sozinho longe da tela.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(recorte, 14, 23);
  doc.text(cobertura, 14, 28.5);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${agora.toLocaleString("pt-BR")}${p.quem ? ` por ${p.quem}` : ""}`, 14, 34);

  autoTable(doc, {
    head: [head],
    body: body.length ? body : [head.map((_, i) => (i === 0 ? "Nenhum colaborador neste recorte." : ""))],
    startY: 39,
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [22, 51, 79], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    margin: { left: 14, right: 14 },
  });

  const aviso =
    p.visao === "custo"
      ? "Confidencial RH. Contém custo por pessoa — não encaminhe fora da direção e do RH."
      : "Uso interno do RH. Contém dado pessoal (LGPD): guarde e descarte com o mesmo cuidado da ficha.";
  for (let n = 1; n <= doc.getNumberOfPages(); n++) {
    doc.setPage(n);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(aviso, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(
      `Página ${n} de ${doc.getNumberOfPages()}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  return { arquivo, recorte, cobertura, linhas: body.length, doc };
}

/** Monta e baixa. É o que a tela chama. */
export async function exportarColaboradoresPdf(p: PedidoDePdf): Promise<Omit<PdfMontado, "doc">> {
  const { doc, ...resto } = await montarColaboradoresPdf(p);
  doc.save(resto.arquivo);
  return resto;
}
