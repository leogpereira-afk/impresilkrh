import type { POP } from "./types";
import { HOJE } from "./_gen";

const ts = HOJE.toISOString();

// Apêndice E — POPs / Procedimentos (conteúdo COMPLETO, na íntegra).
export const POPS: POP[] = [
  {
    id: "pop-fluxo-pedido",
    titulo: "POP — Fluxo de Pedido (Comercial → PCP → Produção)",
    descricao: "Todo pedido entra completo e rastreável.",
    sla: "24h",
    versao: "1.0",
    ordem: 1,
    atualizadoEm: ts,
    blocos: [
      { tipo: "paragrafo", texto: "Objetivo: todo pedido entra completo e rastreável." },
      { tipo: "subtitulo", texto: "Antes de o PCP assumir" },
      { tipo: "passos", itens: [
        "O que será feito está claro.",
        "Medidas informadas.",
        "Material definido.",
        "Arquivos enviados.",
        "Prazo informado.",
      ] },
      { tipo: "lista", itens: [
        "❌ Pedido incompleto não entra.",
        "✔ Completo segue.",
      ] },
      { tipo: "destaque", texto: "SLA: 24h." },
    ],
  },
  {
    id: "pop-design-revisao",
    titulo: "POP — Fluxo de Design e Revisão",
    descricao: "O design só trabalha com pedido validado.",
    sla: "12h úteis",
    versao: "1.0",
    ordem: 2,
    atualizadoEm: ts,
    blocos: [
      { tipo: "paragrafo", texto: "O design só trabalha com pedido validado." },
      { tipo: "subtitulo", texto: "Antes de liberar" },
      { tipo: "passos", itens: [
        "Arte final conferida.",
        "Medidas corretas.",
        "Material certo.",
        "Nenhum ajuste pendente.",
      ] },
      { tipo: "lista", itens: ["❌ Sem revisão não produz."] },
      { tipo: "destaque", texto: "SLA: 12h úteis." },
    ],
  },
  {
    id: "pop-producao",
    titulo: "POP — Fluxo de Produção",
    descricao: "Produção trabalha com previsibilidade.",
    versao: "1.0",
    ordem: 3,
    atualizadoEm: ts,
    blocos: [
      { tipo: "paragrafo", texto: "Produção trabalha com previsibilidade:" },
      { tipo: "lista", itens: [
        "Só recebe pedido liberado.",
        "Ordem respeitada.",
        "Mudança de prioridade controlada.",
        "Tudo via PCP.",
      ] },
      { tipo: "destaque", texto: "A produção executa — não corrige erro de entrada." },
    ],
  },
  {
    id: "pop-urgencia",
    titulo: "POP — Fluxo de Urgência",
    descricao: "Nem tudo é urgente.",
    sla: "4h úteis",
    versao: "1.0",
    ordem: 4,
    atualizadoEm: ts,
    blocos: [
      { tipo: "paragrafo", texto: "Nem tudo é urgente. É urgente quando:" },
      { tipo: "lista", itens: [
        "Impacta o prazo do cliente agora.",
        "O PCP avaliou o impacto.",
        "A liderança está ciente.",
      ] },
      { tipo: "lista", itens: ["❌ Sem validação → pedido normal."] },
      { tipo: "destaque", texto: "SLA de retorno: 4h úteis." },
    ],
  },
  {
    id: "pop-rotinas-comunicacao",
    titulo: "POP — Rotinas de Comunicação e Alinhamento",
    descricao: "Reuniões e rotinas de alinhamento entre as áreas.",
    versao: "1.0",
    ordem: 5,
    atualizadoEm: ts,
    blocos: [
      { tipo: "subtitulo", texto: "Reunião semanal operacional" },
      { tipo: "paragrafo", texto: "Semanal, até 15 min, com PCP/Comercial/Produção." },
      { tipo: "lista", itens: [
        "Pauta: pedidos em andamento.",
        "Prioridades da semana.",
        "Pontos críticos.",
        "Ajustes.",
      ] },
      { tipo: "subtitulo", texto: "Reunião mensal de alinhamento" },
      { tipo: "paragrafo", texto: "Mensal, 30–60 min, lideranças e responsáveis de setor." },
      { tipo: "lista", itens: [
        "Pauta: resultados.",
        "Erros e aprendizados.",
        "Ajustes de processo.",
        "Melhorias no fluxo.",
      ] },
      { tipo: "subtitulo", texto: "Rotinas" },
      { tipo: "lista", itens: [
        "Validação de pedidos (PCP, diária).",
        "Revisão técnica (Design, sob demanda).",
        "Controle de urgência (PCP + liderança).",
      ] },
    ],
  },
];
