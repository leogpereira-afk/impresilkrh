// ============================================================================
// Gerador de anúncio de vaga.
//
// O texto sai do que JÁ ESTÁ no sistema: o cargo tem descrição, competências
// técnicas e comportamentais, requisitos e faixa salarial por nível; a vaga tem
// título, área, quantidade e requisitos próprios. Antes disso tudo ficava
// guardado e o anúncio era escrito do zero no WhatsApp, toda vez, com um texto
// diferente e às vezes com o cargo descrito de um jeito que não bate com a
// descrição oficial.
//
// Não há inteligência artificial aqui, e é de propósito: a chave de uma API não
// pode ir para o navegador, e um texto montado por regra é previsível — sai
// igual toda vez, dá para conferir e não inventa requisito que ninguém pediu.
// O RH edita o resultado antes de publicar.
//
// Cada canal tem um formato próprio porque as pessoas leem de jeitos diferentes:
// no WhatsApp o texto é encaminhado e precisa caber na tela; no mural interno
// quem lê já é da casa e o que importa é o caminho para se candidatar.
// ============================================================================
import { formatBRL } from "@/lib/format";

export type CanalAnuncio = "whatsapp" | "instagram" | "mural" | "completo";

export const CANAIS: { id: CanalAnuncio; rotulo: string; dica: string }[] = [
  { id: "whatsapp", rotulo: "WhatsApp", dica: "Curto, para encaminhar em grupo" },
  { id: "instagram", rotulo: "Instagram / Feed", dica: "Com espaçamento e emoji" },
  { id: "mural", rotulo: "Mural interno", dica: "Para quem já é da casa disputar" },
  { id: "completo", rotulo: "Completo", dica: "Para site de vagas e e-mail" },
];

export interface DadosAnuncio {
  titulo: string;
  empresa: string;
  cidade: string;
  area?: string;
  quantidade?: number;
  /** Descrição do cargo (do cadastro de cargos) ou da vaga. */
  descricao?: string;
  /** Uma por linha. */
  requisitos?: string;
  /** Uma por linha. */
  diferenciais?: string;
  /** Uma por linha. */
  beneficios?: string;
  tipoContratacao?: string;
  jornada?: string;
  /** Faixa do nível, quando o RH escolher divulgar. */
  salario?: number | null;
  mostrarSalario?: boolean;
  comoCandidatar?: string;
}

/** Quebra um texto de várias linhas em itens, ignorando linha vazia e marcador. */
export function itens(texto?: string): string[] {
  return (texto ?? "")
    .split(/[\n;]+/)
    .map((l) => l.replace(/^[\s•\-*–]+/, "").trim())
    .filter(Boolean);
}

const lista = (texto: string | undefined, marcador: string): string =>
  itens(texto).map((i) => `${marcador} ${i}`).join("\n");

const bloco = (titulo: string, corpo: string): string => (corpo ? `${titulo}\n${corpo}` : "");

/** Junta as partes preenchidas com linha em branco entre elas. */
const juntar = (partes: string[]): string => partes.filter((p) => p && p.trim()).join("\n\n");

function remuneracao(d: DadosAnuncio): string {
  if (!d.mostrarSalario || !d.salario || d.salario <= 0) return "A combinar";
  return formatBRL(d.salario);
}

export function gerarAnuncio(d: DadosAnuncio, canal: CanalAnuncio): string {
  const vagas = d.quantidade && d.quantidade > 1 ? `${d.quantidade} vagas` : "1 vaga";
  const onde = [d.cidade].filter(Boolean).join("");
  const contrato = [d.tipoContratacao, d.jornada].filter(Boolean).join(" · ");

  if (canal === "whatsapp") {
    // Curto de propósito: no WhatsApp o texto é encaminhado e ninguém rola
    // muito. Fica o essencial e o caminho para se candidatar.
    return juntar([
      `*VAGA: ${d.titulo.toUpperCase()}*${d.area ? `\n${d.area}` : ""}`,
      [
        `📍 ${onde}`,
        contrato ? `📄 ${contrato}` : "",
        `👤 ${vagas}`,
        d.mostrarSalario ? `💰 ${remuneracao(d)}` : "",
      ].filter(Boolean).join("\n"),
      bloco("*O que você vai fazer:*", lista(d.descricao, "•")),
      bloco("*O que precisamos:*", lista(d.requisitos, "•")),
      bloco("*Oferecemos:*", lista(d.beneficios, "•")),
      d.comoCandidatar ? `👉 ${d.comoCandidatar}` : "",
      `_${d.empresa}_`,
    ]);
  }

  if (canal === "instagram") {
    return juntar([
      `🚀 ESTAMOS CONTRATANDO`,
      `${d.titulo}${d.area ? `\n${d.area}` : ""}`,
      [
        `📍 ${onde}`,
        contrato ? `📄 ${contrato}` : "",
        `👤 ${vagas}`,
        d.mostrarSalario ? `💰 ${remuneracao(d)}` : "",
      ].filter(Boolean).join("\n"),
      bloco("✅ O QUE VOCÊ VAI FAZER", lista(d.descricao, "•")),
      bloco("🎯 O QUE PRECISAMOS", lista(d.requisitos, "•")),
      bloco("⭐ CONTA PONTO", lista(d.diferenciais, "•")),
      bloco("🎁 OFERECEMOS", lista(d.beneficios, "•")),
      d.comoCandidatar ? `📩 ${d.comoCandidatar}` : "",
      `#vagas #${(d.cidade || "").replace(/[^A-Za-zÀ-ÿ]/g, "").toLowerCase()} #${d.empresa.replace(/\s/g, "").toLowerCase()} #oportunidade`,
    ]);
  }

  if (canal === "mural") {
    // Quem lê já é da casa: não precisa de venda da empresa, precisa saber o
    // prazo, o que muda e como se inscrever.
    return juntar([
      `OPORTUNIDADE INTERNA — ${d.titulo}`,
      `${d.area ? `Área: ${d.area}\n` : ""}Vagas: ${vagas}${contrato ? `\nContratação: ${contrato}` : ""}`,
      bloco("Atividades:", lista(d.descricao, "-")),
      bloco("Pré-requisitos:", lista(d.requisitos, "-")),
      bloco("Conta ponto:", lista(d.diferenciais, "-")),
      "Como participar:\nEntre no sistema, abra o Mural de Vagas e clique em \"Quero disputar\". A inscrição é registrada no seu nome e o RH acompanha por lá.",
      "Quem já está na casa tem prioridade na avaliação. Falar com o gestor antes é recomendado, não obrigatório.",
    ]);
  }

  // completo
  return juntar([
    `${d.titulo} — ${d.empresa}`,
    `Local: ${onde}${contrato ? `\nContratação: ${contrato}` : ""}\nPosições: ${vagas}\nRemuneração: ${remuneracao(d)}`,
    bloco("SOBRE A VAGA", (d.descricao ?? "").trim()),
    bloco("RESPONSABILIDADES", lista(d.descricao, "-")),
    bloco("REQUISITOS", lista(d.requisitos, "-")),
    bloco("DIFERENCIAIS", lista(d.diferenciais, "-")),
    bloco("BENEFÍCIOS", lista(d.beneficios, "-")),
    d.comoCandidatar ? bloco("COMO SE CANDIDATAR", d.comoCandidatar) : "",
  ]);
}
