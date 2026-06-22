/**
 * Extras idempotentes aplicados após o seed (inclusive no banco de produção).
 * - Inclui a cúpula do organograma (Fundadores → Diretor → Assessorias) acima
 *   dos gerentes já cadastrados, mantendo todas as pessoas existentes.
 * - Insere/atualiza os documentos de Comunicação e os POPs estruturados.
 * Pode rodar várias vezes sem duplicar (usa nome/título como chave).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function ensureArea(nome: string, descricao?: string) {
  const a = await db.area.findFirst({ where: { nome } });
  if (a) return a;
  return db.area.create({ data: { nome, descricao: descricao ?? null } });
}

async function ensureStatus(nome: string, cor: string, contaComoAtivo: boolean) {
  const s = await db.statusColaborador.findUnique({ where: { nome } }).catch(() => null);
  if (s) return s;
  const count = await db.statusColaborador.count();
  return db.statusColaborador.create({ data: { nome, cor, contaComoAtivo, ordem: count + 10 } });
}

async function ensureCargo(nome: string, areaId: string) {
  const c = await db.cargo.findFirst({ where: { nome } });
  if (c) return c;
  return db.cargo.create({ data: { nome, areaId } });
}

async function ensureColaborador(opts: {
  nome: string;
  cargoId: string;
  areaId: string;
  statusId: string;
  gestorNome?: string | null;
  email?: string | null;
}) {
  const existente = await db.colaborador.findFirst({ where: { nome: opts.nome } });
  const gestor = opts.gestorNome
    ? await db.colaborador.findFirst({ where: { nome: opts.gestorNome } })
    : null;
  if (existente) {
    return db.colaborador.update({
      where: { id: existente.id },
      data: {
        cargoId: opts.cargoId,
        areaId: opts.areaId,
        statusId: opts.statusId,
        gestorId: gestor?.id ?? null,
      },
    });
  }
  return db.colaborador.create({
    data: {
      nome: opts.nome,
      email: opts.email ?? null,
      cargoId: opts.cargoId,
      areaId: opts.areaId,
      statusId: opts.statusId,
      gestorId: gestor?.id ?? null,
      dataAdmissao: new Date("1985-01-01"),
    },
  });
}

async function ensureDocumento(d: {
  titulo: string;
  categoria: string;
  descricao: string;
  conteudo: string;
  versao?: string;
}) {
  const existente = await db.documentoInstitucional.findFirst({ where: { titulo: d.titulo } });
  if (existente) {
    return db.documentoInstitucional.update({
      where: { id: existente.id },
      data: { categoria: d.categoria, descricao: d.descricao, conteudo: d.conteudo, versao: d.versao ?? "1.0" },
    });
  }
  return db.documentoInstitucional.create({
    data: { ...d, versao: d.versao ?? "1.0" },
  });
}

async function main() {
  console.log("🏛️  Extras: cúpula do organograma + comunicação/POPs…");

  // ---- Estrutura de apoio ----
  const direcao = await ensureArea("Direção", "Direção, fundadores e assessorias.");
  const stDirecao = await ensureStatus("Direção", "#16334f", false);
  const stExterno = await ensureStatus("Externo", "#64748b", false);

  const cgFundadora = await ensureCargo("Fundadora", direcao.id);
  const cgFundador = await ensureCargo("Fundador", direcao.id);
  const cgDiretor = await ensureCargo("Diretor Geral", direcao.id);
  const cgConsult = await ensureCargo("Consultoria", direcao.id);
  const cgContab = await ensureCargo("Contabilidade", direcao.id);
  const cgJuridico = await ensureCargo("Jurídico", direcao.id);

  // ---- Cúpula (fundadores → diretor → assessorias) ----
  await ensureColaborador({ nome: "Maria Inês", cargoId: cgFundadora.id, areaId: direcao.id, statusId: stDirecao.id, gestorNome: null });
  await ensureColaborador({ nome: "Pedro Ramos", cargoId: cgFundador.id, areaId: direcao.id, statusId: stDirecao.id, gestorNome: null });
  const diretor = await ensureColaborador({ nome: "Leonardo Gonçalves", cargoId: cgDiretor.id, areaId: direcao.id, statusId: stDirecao.id, gestorNome: "Pedro Ramos", email: "diretoria@impresilk.com.br" });
  await ensureColaborador({ nome: "Consultorias", cargoId: cgConsult.id, areaId: direcao.id, statusId: stExterno.id, gestorNome: "Leonardo Gonçalves" });
  await ensureColaborador({ nome: "Contabilidade", cargoId: cgContab.id, areaId: direcao.id, statusId: stExterno.id, gestorNome: "Leonardo Gonçalves" });
  await ensureColaborador({ nome: "Jurídico", cargoId: cgJuridico.id, areaId: direcao.id, statusId: stExterno.id, gestorNome: "Leonardo Gonçalves" });

  // ---- Liga os gerentes (raízes atuais) ao diretor ----
  const nomesDirecao = ["Maria Inês", "Pedro Ramos", "Leonardo Gonçalves", "Consultorias", "Contabilidade", "Jurídico"];
  const direcaoColabs = await db.colaborador.findMany({ where: { nome: { in: nomesDirecao } }, select: { id: true } });
  const idsDirecao = direcaoColabs.map((c) => c.id);
  const raizes = await db.colaborador.findMany({
    where: { gestorId: null, dataDesligamento: null, id: { notIn: idsDirecao } },
    select: { id: true, nome: true },
  });
  for (const r of raizes) {
    await db.colaborador.update({ where: { id: r.id }, data: { gestorId: diretor.id } });
    console.log(`   ↳ ${r.nome} agora reporta ao Diretor`);
  }

  // ---- Documentos de Comunicação + POPs ----
  await ensureDocumento({
    titulo: "Guia de Comunicação — Fluxos Claros",
    categoria: "Comunicação",
    descricao: "Como nos comunicamos na Impresilk: canais, SLAs e princípios.",
    conteudo: [
      "COMO NOS COMUNICAMOS NA IMPRESILK",
      "Comunicação boa evita retrabalho, respeita o fluxo e chega clara para quem executa. Aqui não é sobre pessoas, é sobre fluxo.",
      "Antes de falar, pedir ou decidir: Isso está claro? Está no fluxo? Está no canal certo?",
      "",
      "CANAIS OFICIAIS",
      "• Pedidos e demandas → canal oficial definido",
      "• Urgências → canal exclusivo de urgência",
      "• Decisões → dentro do fluxo",
      "• Informações importantes → nada de conversa paralela",
      "Mensagem fora do canal não orienta execução.",
      "",
      "PRAZOS DE RESPOSTA (SLA)",
      "• Validação de pedido no PCP: até 24h",
      "• Revisão técnica: até 12h úteis",
      "• Retorno sobre urgência: até 4h úteis",
      "",
      "BOAS PRÁTICAS",
      "Seja claro · Use o canal certo · Respeite o fluxo · Avise antes de mudar prioridade · Pense no impacto no outro setor.",
    ].join("\n"),
  });

  await ensureDocumento({
    titulo: "POP — Fluxo de Pedido (Comercial → PCP → Produção)",
    categoria: "POP",
    descricao: "Procedimento padrão para entrada e validação de pedidos.",
    conteudo: [
      "OBJETIVO: garantir que todo pedido entre no fluxo de forma completa e rastreável.",
      "FLUXO: Comercial → PCP → Produção.",
      "",
      "ANTES DO PCP ASSUMIR O PEDIDO, CONFERIR:",
      "1. O que será feito está claro",
      "2. Medidas informadas",
      "3. Material definido",
      "4. Arquivos enviados",
      "5. Prazo informado",
      "",
      "REGRAS:",
      "❌ Pedido incompleto não entra no fluxo.",
      "✔ Pedido completo segue normalmente.",
      "SLA de validação no PCP: até 24h.",
    ].join("\n"),
  });

  await ensureDocumento({
    titulo: "POP — Fluxo de Design e Revisão",
    categoria: "POP",
    descricao: "Procedimento de revisão técnica antes da produção.",
    conteudo: [
      "OBJETIVO: o design só trabalha com pedido validado; proteger contra retrabalho.",
      "ANTES DE LIBERAR PARA PRODUÇÃO, CONFERIR:",
      "1. Arte final conferida",
      "2. Medidas corretas",
      "3. Material certo",
      "4. Nenhum ajuste pendente",
      "",
      "REGRAS:",
      "❌ Sem revisão → não produz.",
      "✔ Revisado → produção liberada.",
      "SLA de revisão técnica: até 12h úteis.",
    ].join("\n"),
  });

  await ensureDocumento({
    titulo: "POP — Fluxo de Produção",
    categoria: "POP",
    descricao: "Procedimento padrão da produção com previsibilidade.",
    conteudo: [
      "OBJETIVO: produção trabalha com previsibilidade e ordem.",
      "REGRAS BÁSICAS:",
      "• Produção só recebe pedido liberado",
      "• Ordem de produção é respeitada",
      "• Mudança de prioridade é controlada",
      "• Produção recebe tudo via PCP",
      "A produção executa. Não corrige erro de entrada.",
    ].join("\n"),
  });

  await ensureDocumento({
    titulo: "POP — Fluxo de Urgência",
    categoria: "POP",
    descricao: "Critérios e tratamento de urgências.",
    conteudo: [
      "NEM TUDO É URGENTE. Para algo ser urgente:",
      "1. Impacta o prazo do cliente agora",
      "2. PCP avaliou o impacto",
      "3. Liderança está ciente",
      "",
      "REGRAS:",
      "❌ Sem validação → pedido normal.",
      "✔ Urgência validada segue fluxo especial.",
      "SLA de retorno sobre urgência: até 4h úteis.",
    ].join("\n"),
  });

  await ensureDocumento({
    titulo: "POP — Rotinas de Comunicação e Alinhamento",
    categoria: "POP",
    descricao: "Reuniões e rotinas que mantêm o fluxo previsível.",
    conteudo: [
      "REUNIÃO SEMANAL OPERACIONAL",
      "Periodicidade: semanal · Duração: até 15 min · Participantes: PCP, Comercial, Produção.",
      "Pauta: pedidos em andamento, prioridades da semana, pontos críticos, ajustes necessários.",
      "",
      "REUNIÃO MENSAL DE ALINHAMENTO",
      "Periodicidade: mensal · Duração: 30–60 min · Participantes: lideranças e responsáveis de setor.",
      "Pauta: resultados do período, erros e aprendizados, ajustes de processo, melhorias no fluxo.",
      "",
      "ROTINAS DIÁRIAS",
      "• Validação de pedidos (PCP, diária)",
      "• Revisão técnica (Design, conforme demanda)",
      "• Controle de urgência (PCP + liderança)",
    ].join("\n"),
  });

  await ensureDocumento({
    titulo: "Plano de Endomarketing — Campanhas Internas",
    categoria: "Comunicação",
    descricao: "Campanhas de engajamento e reconhecimento interno.",
    conteudo: [
      "OBJETIVO: fortalecer o engajamento, o reconhecimento e o pertencimento.",
      "",
      "CAMPANHA 1 — ORGULHO DE FAZER PARTE (mensal)",
      "“Cada projeto entregue carrega o trabalho de muitas mãos.” Seleção do projeto do mês, coleta de informações, registro visual, montagem e divulgação no mural e reunião.",
      "",
      "CAMPANHA 2 — BASTIDORES DA PRODUÇÃO (quinzenal/mensal)",
      "“Por trás de cada entrega, existe processo, cuidado e dedicação.” Mostrar a execução real (impressão, corte, montagem, instalação) e a equipe envolvida.",
      "",
      "CAMPANHA 3 — RESULTADO DO MÊS (mensal)",
      "“Resultado é consequência de processo bem feito.” Compartilhar entregas e destaques do período na reunião mensal e no mural.",
    ].join("\n"),
  });

  console.log("✅  Extras aplicados.");
}

main()
  .catch((e) => {
    console.error("Erro nos extras:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
