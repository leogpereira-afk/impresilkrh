/**
 * Seed do sistema de RH da Impresilk.
 * Carrega dados reais extraídos dos documentos institucionais:
 *  - Plano de Estruturação de Carreira v2.0 (níveis, faixas salariais, competências)
 *  - Planilha de Avaliação de Desempenho (30 colaboradores, enquadramento)
 *  - Código de Ética e Conduta (documento institucional)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ----------------- utilitários determinísticos -----------------
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260622);
const rint = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

function gerarCPF(seed: number): string {
  const base: number[] = [];
  let x = seed * 7 + 13;
  for (let i = 0; i < 9; i++) {
    x = (x * 9301 + 49297) % 233280;
    base.push(Math.floor((x / 233280) * 10) % 10);
  }
  const calc = (arr: number[], fator: number) => {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i] * (fator - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(base, 10);
  const d2 = calc([...base, d1], 11);
  return [...base, d1, d2].join("");
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function email(nome: string): string {
  const partes = semAcento(nome).toLowerCase().replace(/[*]/g, "").trim().split(/\s+/);
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return `${primeiro}.${ultimo}@impresilk.com.br`;
}
function telefone(): string {
  return `(38) 9${rint(8000, 9999)}-${rint(1000, 9999)}`;
}
const SENHA_PADRAO = "Impresilk@2026";

async function main() {
  console.log("🌱  Limpando base...");
  // ordem de dependência
  await db.accessLog.deleteMany();
  await db.consentimentoLGPD.deleteMany();
  await db.viagem.deleteMany();
  await db.feedback.deleteMany();
  await db.pDI.deleteMany();
  await db.meta.deleteMany();
  await db.avaliacao.deleteMany();
  await db.cicloAvaliacao.deleteMany();
  await db.movimentacao.deleteMany();
  await db.ferias.deleteMany();
  await db.documento.deleteMany();
  await db.documentoInstitucional.deleteMany();
  await db.user.deleteMany();
  await db.faixaSalarial.deleteMany();
  await db.colaborador.deleteMany();
  await db.cargo.deleteMany();
  await db.nivel.deleteMany();
  await db.area.deleteMany();
  await db.statusColaborador.deleteMany();
  await db.configuracao.deleteMany();

  // ----------------- Status configuráveis -----------------
  console.log("🌱  Status...");
  const statusDefs = [
    { nome: "Ativo", cor: "#16a34a", contaComoAtivo: true, ordem: 1 },
    { nome: "Em experiência", cor: "#2563eb", contaComoAtivo: true, ordem: 2 },
    { nome: "Afastado", cor: "#d97706", contaComoAtivo: true, ordem: 3 },
    { nome: "Inativo", cor: "#64748b", contaComoAtivo: false, ordem: 4 },
  ];
  const statusMap: Record<string, string> = {};
  for (const s of statusDefs) {
    const r = await db.statusColaborador.create({ data: s });
    statusMap[s.nome] = r.id;
  }

  // ----------------- Níveis (N1..N5) -----------------
  console.log("🌱  Níveis...");
  const niveisDefs = [
    { codigo: "N1", nome: "Júnior", senioridade: "Júnior", ordem: 1, descricao: "Até 2 anos na função. Execução supervisionada e domínio técnico em consolidação." },
    { codigo: "N2", nome: "Júnior", senioridade: "Júnior", ordem: 2, descricao: "Execução consistente e adaptação comprovada. Reduz erros básicos." },
    { codigo: "N3", nome: "Pleno", senioridade: "Pleno", ordem: 3, descricao: "2 a 5 anos. Autonomia operacional e baixo índice de retrabalho." },
    { codigo: "N4", nome: "Sênior", senioridade: "Sênior", ordem: 4, descricao: "Entrega acima da média e apoio ao time. Referência técnica em formação." },
    { codigo: "N5", nome: "Sênior", senioridade: "Sênior", ordem: 5, descricao: "Acima de 5 anos. Referência técnica da área e capacidade de resolver situações complexas." },
  ];
  const nivelMap: Record<string, string> = {};
  for (const n of niveisDefs) {
    const r = await db.nivel.create({ data: n });
    nivelMap[n.codigo] = r.id;
  }

  // ----------------- Áreas -----------------
  console.log("🌱  Áreas...");
  const areasDefs = [
    { nome: "Produção e Comunicação Visual", descricao: "Impressão, CNC, pintura, design e projetos.", ordem: 1 },
    { nome: "Montagem e Instalação", descricao: "Equipe de campo: montagem e instalação na região.", ordem: 2 },
    { nome: "Serralheria e Metalurgia", descricao: "Produção de estruturas metálicas e solda.", ordem: 3 },
    { nome: "Comercial e Atendimento", descricao: "Vendas consultivas, atendimento e relacionamento.", ordem: 4 },
    { nome: "Administrativo e Gestão", descricao: "Administração, suprimentos, PCP, RH e gestão.", ordem: 5 },
  ];
  const areaMap: Record<string, string> = {};
  for (const a of areasDefs) {
    const r = await db.area.create({ data: a });
    areaMap[a.nome] = r.id;
  }

  const trilhaPorArea: Record<string, string> = {
    "Produção e Comunicação Visual": "Produção / Operação",
    "Montagem e Instalação": "Produção / Operação",
    "Serralheria e Metalurgia": "Produção / Operação",
    "Comercial e Atendimento": "Comercial",
    "Administrativo e Gestão": "Administrativo",
  };

  // ----------------- Cargos + faixas salariais (Plano de Carreira) -----------------
  console.log("🌱  Cargos e faixas salariais...");
  type CargoDef = {
    nome: string;
    area: string;
    faixas: [number, number, number, number, number];
    descricao: string;
    tecnicas: string;
    comportamentais: string;
    indicadores: string;
    requisitos?: string;
  };
  const cargosDefs: CargoDef[] = [
    {
      nome: "Instalador Assistente", area: "Montagem e Instalação", faixas: [1621, 1666, 1711, 1755, 1800],
      descricao: "Apoio operacional nas instalações e organização de materiais.",
      tecnicas: "Apoio à instalação; Manuseio de ferramentas; Preparação de materiais",
      comportamentais: "Disciplina; Proatividade; Agilidade",
      indicadores: "Produtividade ≥ 100%; Erros ≤ 5%; Apoio à equipe",
    },
    {
      nome: "Instalador de Comunicação Visual", area: "Montagem e Instalação", faixas: [1800, 1975, 2150, 2325, 2500],
      descricao: "Execução técnica de instalações conforme projeto e padrão.",
      tecnicas: "Instalação técnica; Leitura de projeto; Acabamento",
      comportamentais: "Responsabilidade; Organização; Trabalho em equipe",
      indicadores: "Retrabalho ≤ 5%; Prazo ≥ 95%; Satisfação ≥ 90%",
    },
    {
      nome: "Líder de Montagem de Portas", area: "Montagem e Instalação", faixas: [2200, 2400, 2600, 2800, 3000],
      descricao: "Coordenação técnica da equipe de instalação garantindo execução conforme padrão.",
      tecnicas: "Coordenação de equipe; Leitura técnica de projetos; Controle de execução",
      comportamentais: "Liderança; Organização; Comunicação",
      indicadores: "Prazo ≥ 95%; Retrabalho ≤ 5%; Produtividade ≥ 100%",
    },
    {
      nome: "Gerente de Montagem de Portas", area: "Montagem e Instalação", faixas: [2200, 2400, 2600, 2800, 3000],
      descricao: "Gestão estratégica das frentes de instalação, garantindo qualidade, prazo e eficiência das equipes.",
      tecnicas: "Gestão de instalação; Planejamento de equipes externas; Controle de qualidade de entrega",
      comportamentais: "Liderança estratégica; Tomada de decisão; Visão de resultado",
      indicadores: "Prazo ≥ 95%; Satisfação ≥ 90%; Retrabalho ≤ 5%",
    },
    {
      nome: "Líder de Produção", area: "Produção e Comunicação Visual", faixas: [2200, 2400, 2600, 2800, 3000],
      descricao: "Responsável por liderar a equipe produtiva, garantindo metas, qualidade e prazos da operação.",
      tecnicas: "Gestão de equipe; Controle de produção; Qualidade operacional",
      comportamentais: "Liderança; Organização; Comunicação",
      indicadores: "Meta ≥ 100%; Retrabalho ≤ 5%; Prazo ≥ 95%",
    },
    {
      nome: "Impressor", area: "Produção e Comunicação Visual", faixas: [1800, 1950, 2100, 2250, 2400],
      descricao: "Operação de impressão garantindo padrão técnico e produtividade.",
      tecnicas: "Operação de impressoras; Ajustes técnicos; Controle de qualidade",
      comportamentais: "Atenção a detalhes; Disciplina; Organização",
      indicadores: "Produtividade ≥ 100%; Retrabalho ≤ 5%; Qualidade ≥ 95%",
    },
    {
      nome: "Operador de Comunicação Visual", area: "Produção e Comunicação Visual", faixas: [1621, 1766, 1911, 2055, 2200],
      descricao: "Execução técnica da produção e acabamento de elementos visuais conforme padrão.",
      tecnicas: "Operação de máquinas; Leitura de projeto; Execução técnica",
      comportamentais: "Disciplina; Atenção; Trabalho em equipe",
      indicadores: "Produtividade ≥ 100%; Retrabalho ≤ 5%; Prazo ≥ 95%",
    },
    {
      nome: "Operador de CNC", area: "Produção e Comunicação Visual", faixas: [1621, 1766, 1911, 2055, 2200],
      descricao: "Configuração e operação de máquinas CNC, garantindo precisão e qualidade dos cortes.",
      tecnicas: "Programação CNC; Operação com diversos materiais; Controle de qualidade",
      comportamentais: "Precisão; Disciplina; Atenção",
      indicadores: "Produtividade ≥ 100%; Retrabalho ≤ 5%; Prazo ≥ 95%",
    },
    {
      nome: "Pintor de Comunicação Visual", area: "Produção e Comunicação Visual", faixas: [2000, 2050, 2100, 2150, 2200],
      descricao: "Execução de pintura técnica e acabamento.",
      tecnicas: "Pintura técnica; Acabamento; Preparação de superfície",
      comportamentais: "Capricho; Organização; Disciplina",
      indicadores: "Qualidade ≥ 95%; Retrabalho ≤ 5%; Produtividade ≥ 100%",
    },
    {
      nome: "Designer Gráfico", area: "Produção e Comunicação Visual", faixas: [1800, 1925, 2050, 2175, 2300],
      descricao: "Desenvolvimento técnico e visual dos projetos.",
      tecnicas: "Softwares gráficos; Leitura técnica; Desenvolvimento de layout",
      comportamentais: "Criatividade; Atenção; Organização",
      indicadores: "Retrabalho ≤ 5%; Prazo ≥ 95%; Aprovação ≥ 90%",
    },
    {
      nome: "Projetista", area: "Produção e Comunicação Visual", faixas: [2200, 2525, 2850, 3175, 3500],
      descricao: "Desenvolvimento e detalhamento técnico dos projetos para produção.",
      tecnicas: "Softwares gráficos/CAD; Refinamento de conceitos; Preparação de arquivos finais",
      comportamentais: "Criatividade; Atenção; Organização",
      indicadores: "Retrabalho ≤ 5%; Prazo ≥ 95%; Aprovação ≥ 90%",
    },
    {
      nome: "Serralheiro", area: "Serralheria e Metalurgia", faixas: [1800, 1975, 2150, 2325, 2500],
      descricao: "Produção de estruturas metálicas e suporte técnico.",
      tecnicas: "Solda e corte; Montagem estrutural; Leitura de projeto",
      comportamentais: "Precisão; Responsabilidade; Organização",
      indicadores: "Qualidade ≥ 95%; Retrabalho ≤ 5%; Prazo ≥ 95%",
    },
    {
      nome: "Soldador", area: "Serralheria e Metalurgia", faixas: [1800, 1975, 2150, 2325, 2500],
      descricao: "Solda e produção de estruturas metálicas com qualidade estrutural.",
      tecnicas: "Solda e corte; Montagem estrutural; Leitura de projeto",
      comportamentais: "Precisão; Responsabilidade; Organização",
      indicadores: "Qualidade estrutural ≥ 95%; Retrabalho ≤ 5%; Prazo ≥ 95%",
    },
    {
      nome: "Consultor de Vendas", area: "Comercial e Atendimento", faixas: [1621, 1766, 1911, 2055, 2200],
      descricao: "Condução de negociações e fechamento de contratos.",
      tecnicas: "Vendas consultivas; Negociação; Fechamento",
      comportamentais: "Persuasão; Proatividade; Resiliência",
      indicadores: "Meta ≥ 100%; Conversão ≥ 30%; Ticket crescente",
    },
    {
      nome: "Atendente Comercial", area: "Comercial e Atendimento", faixas: [1621, 1716, 1811, 1905, 2000],
      descricao: "Atendimento inicial, qualificação e suporte ao cliente.",
      tecnicas: "Atendimento; Qualificação de leads; CRM",
      comportamentais: "Comunicação; Agilidade; Organização",
      indicadores: "Resposta ≤ 2h; Conversão ≥ 20%; Satisfação ≥ 90%",
    },
    {
      nome: "Gerente Administrativo", area: "Administrativo e Gestão", faixas: [3000, 3625, 4250, 4875, 5500],
      descricao: "Gestão de vendas, resultados comerciais e integração administrativa.",
      tecnicas: "Gestão comercial; Planejamento estratégico; Gestão de indicadores",
      comportamentais: "Liderança; Visão de negócio; Negociação",
      indicadores: "Meta ≥ 100%; Conversão ≥ 30%; Ticket médio em crescimento",
    },
    {
      nome: "Gerente de Operações", area: "Administrativo e Gestão", faixas: [3500, 4000, 4500, 5000, 5500],
      descricao: "Gestão global da produção, custos e eficiência operacional.",
      tecnicas: "Planejamento de produção; Gestão de custos; Gestão de processos",
      comportamentais: "Liderança; Visão estratégica; Tomada de decisão",
      indicadores: "Eficiência ≥ 95%; Redução de custos progressiva; Prazo ≥ 95%",
    },
    {
      nome: "Coordenador Administrativo", area: "Administrativo e Gestão", faixas: [2800, 3225, 3650, 4075, 4500],
      descricao: "Gestão administrativa e suporte estratégico à operação.",
      tecnicas: "Gestão administrativa; Controle financeiro; Processos internos",
      comportamentais: "Liderança; Organização; Tomada de decisão",
      indicadores: "Eficiência ≥ 90%; Erros ≤ 5%; Prazo ≥ 95%",
    },
    {
      nome: "Analista de PCP", area: "Administrativo e Gestão", faixas: [2500, 2875, 3250, 3625, 4000],
      descricao: "Planejamento e controle da produção e cronogramas.",
      tecnicas: "Planejamento produtivo; Controle de cronograma; Organização de fluxo",
      comportamentais: "Organização; Antecipação; Responsabilidade",
      indicadores: "Aderência ≥ 90%; Atrasos ≤ 10%; Fluxo sem gargalos críticos",
    },
    {
      nome: "Assistente de Suprimentos", area: "Administrativo e Gestão", faixas: [2800, 2875, 2950, 3025, 3100],
      descricao: "Apoio nas compras e controle de insumos.",
      tecnicas: "Controle de pedidos; Cadastro de fornecedores; Organização de estoque",
      comportamentais: "Organização; Agilidade; Responsabilidade",
      indicadores: "Erros ≤ 3%; Prazo ≥ 95%; Fluxo sem falhas",
    },
    {
      nome: "RH / DP", area: "Administrativo e Gestão", faixas: [1900, 2175, 2450, 2725, 3000],
      descricao: "Gestão de pessoas, processos trabalhistas e clima organizacional.",
      tecnicas: "Rotinas de DP; Recrutamento; Gestão de pessoas",
      comportamentais: "Comunicação; Sigilo; Empatia",
      indicadores: "Turnover ≤ 10%; Absenteísmo ≤ 5%; Prazo contratação ≤ 15 dias",
    },
  ];

  const cargoMap: Record<string, string> = {};
  for (const c of cargosDefs) {
    const cargo = await db.cargo.create({
      data: {
        nome: c.nome,
        areaId: areaMap[c.area],
        descricao: c.descricao,
        competenciasTecnicas: c.tecnicas,
        competenciasComportamentais: c.comportamentais,
        indicadores: c.indicadores,
        requisitos: c.requisitos ?? null,
        trilha: trilhaPorArea[c.area],
        faixaMin: c.faixas[0],
        faixaMax: c.faixas[4],
      },
    });
    cargoMap[c.nome] = cargo.id;
    for (let i = 0; i < 5; i++) {
      await db.faixaSalarial.create({
        data: {
          cargoId: cargo.id,
          nivelId: nivelMap[`N${i + 1}`],
          valor: c.faixas[i],
        },
      });
    }
  }

  // ----------------- Colaboradores (dados reais da planilha) -----------------
  console.log("🌱  Colaboradores...");
  type ColabDef = {
    nome: string;
    cargo: string;
    area: string;
    salario: number;
    nivel: string;
    refMin: number;
    refMax: number;
    defasagem: number;
    posicao: string;
    obs: string;
    gestor?: string;
    perfil?: "ADMIN_RH" | "GESTOR" | "COLABORADOR";
    nascimento: string; // ISO
    admissao: string; // ISO
    risco?: string;
    potencial?: string;
    status?: string;
  };

  const colabs: ColabDef[] = [
    // Liderança (topo)
    { nome: "Pedro Henrique Gonçalves", cargo: "Gerente de Operações", area: "Administrativo e Gestão", salario: 1926.0, nivel: "N1", refMin: 3500, refMax: 5500, defasagem: -0.4497142857, posicao: "Crítico", obs: "Ajuste prioritário", perfil: "GESTOR", nascimento: "1982-04-12", admissao: "2017-02-01", risco: "Alto", potencial: "Alto" },
    { nome: "Jéssica Fernanda S. Sampaio", cargo: "Gerente Administrativo", area: "Administrativo e Gestão", salario: 1816.64, nivel: "N1", refMin: 3000, refMax: 5500, defasagem: -0.3944533333, posicao: "Crítico", obs: "Ajuste prioritário", perfil: "GESTOR", nascimento: "1986-09-25", admissao: "2018-05-10", risco: "Alto", potencial: "Alto" },
    { nome: "Saulo Rodrigues Ferreira", cargo: "Gerente de Montagem de Portas", area: "Montagem e Instalação", salario: 2416.54, nivel: "N2", refMin: 2200, refMax: 3000, defasagem: 0.09842727273, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", perfil: "GESTOR", nascimento: "1984-11-03", admissao: "2016-08-15", risco: "Médio", potencial: "Alto" },
    { nome: "Camila Cristina R. Sampaio", cargo: "Coordenador Administrativo", area: "Administrativo e Gestão", salario: 1955.43, nivel: "N1", refMin: 2800, refMax: 4500, defasagem: -0.3016321429, posicao: "Crítico", obs: "Ajuste prioritário", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1990-01-18", admissao: "2019-03-01", risco: "Alto", potencial: "Alto" },

    // Montagem e Instalação (equipe de campo)
    { nome: "Adriano Nunes Araújo", cargo: "Líder de Montagem de Portas", area: "Montagem e Instalação", salario: 2473.04, nivel: "N2", refMin: 2200, refMax: 3000, defasagem: 0.1241090909, posicao: "Dentro", obs: "Posição adequada", gestor: "Saulo Rodrigues Ferreira", nascimento: "1988-06-15", admissao: "2015-09-20", risco: "Médio", potencial: "Alto" },
    { nome: "Adriano Pinheiro Lima", cargo: "Instalador de Comunicação Visual", area: "Montagem e Instalação", salario: 2140.0, nivel: "N3", refMin: 1800, refMax: 2500, defasagem: 0.1888888889, posicao: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1991-02-22", admissao: "2018-01-15", risco: "Médio", potencial: "Médio" },
    { nome: "Douglas Thiago Silva", cargo: "Instalador de Comunicação Visual", area: "Montagem e Instalação", salario: 2140.0, nivel: "N3", refMin: 1800, refMax: 2300, defasagem: 0.1888888889, posicao: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1993-07-30", admissao: "2019-06-03", risco: "Alto", potencial: "Médio" },
    { nome: "José Adilando Pereira", cargo: "Instalador Assistente", area: "Montagem e Instalação", salario: 1926.0, nivel: "N5", refMin: 1621, refMax: 1800, defasagem: 0.1881554596, posicao: "Acima", obs: "Monitorar compressão", gestor: "Adriano Nunes Araújo", nascimento: "1979-10-08", admissao: "2014-04-12", risco: "Médio", potencial: "Médio" },
    { nome: "Lucas Natalino Ferreira", cargo: "Instalador de Comunicação Visual", area: "Montagem e Instalação", salario: 2350.0, nivel: "N4", refMin: 1800, refMax: 2400, defasagem: 0.3055555556, posicao: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1990-12-11", admissao: "2016-11-01", risco: "Médio", potencial: "Alto" },
    { nome: "Ronivon Cardoso dos Santos", cargo: "Instalador de Comunicação Visual", area: "Montagem e Instalação", salario: 2247.0, nivel: "N4", refMin: 1800, refMax: 2500, defasagem: 0.2483333333, posicao: "Dentro", obs: "Posição adequada", gestor: "Adriano Nunes Araújo", nascimento: "1989-03-05", admissao: "2017-07-19", risco: "Médio", potencial: "Médio" },

    // Produção e Comunicação Visual
    { nome: "André Maia Costa", cargo: "Impressor", area: "Produção e Comunicação Visual", salario: 1840.4, nivel: "N1", refMin: 1800, refMax: 2400, defasagem: 0.02244444444, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1995-05-14", admissao: "2022-03-10", risco: "Baixo", potencial: "Médio" },
    { nome: "Ewerton Duarte Amaral", cargo: "Impressor", area: "Produção e Comunicação Visual", salario: 1897.91, nivel: "N2", refMin: 1800, refMax: 2400, defasagem: 0.05439444444, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1994-08-21", admissao: "2021-02-08", risco: "Baixo", potencial: "Médio" },
    { nome: "Bruno Dias do Nascimento", cargo: "Operador de Comunicação Visual", area: "Produção e Comunicação Visual", salario: 2033.0, nivel: "N4", refMin: 1621, refMax: 2200, defasagem: 0.2541640962, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1987-06-15", admissao: "2015-05-04", risco: "Baixo", potencial: "Alto" },
    { nome: "Charles Alves Dias", cargo: "Operador de Comunicação Visual", area: "Produção e Comunicação Visual", salario: 1872.5, nivel: "N3", refMin: 1621, refMax: 2200, defasagem: 0.1551511413, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1992-09-09", admissao: "2018-10-22", risco: "Baixo", potencial: "Médio" },
    { nome: "Elnata Pereira dos Santos", cargo: "Operador de Comunicação Visual", area: "Produção e Comunicação Visual", salario: 1872.5, nivel: "N3", refMin: 1621, refMax: 2200, defasagem: 0.1551511413, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1993-11-28", admissao: "2019-01-14", risco: "Baixo", potencial: "Médio" },
    { nome: "Osmané Vinicius Neponuceno", cargo: "Operador de Comunicação Visual", area: "Produção e Comunicação Visual", salario: 1897.91, nivel: "N3", refMin: 1621, refMax: 2200, defasagem: 0.1708266502, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1991-04-17", admissao: "2018-03-26", risco: "Baixo", potencial: "Médio" },
    { nome: "Sidney Nunes da Silva", cargo: "Operador de Comunicação Visual", area: "Produção e Comunicação Visual", salario: 1897.91, nivel: "N3", refMin: 1621, refMax: 2200, defasagem: 0.1708266502, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1990-07-02", admissao: "2017-12-05", risco: "Baixo", potencial: "Médio" },
    { nome: "Vinicius Aguiar Rodrigues", cargo: "Operador de CNC", area: "Produção e Comunicação Visual", salario: 2215.38, nivel: "N5", refMin: 1621, refMax: 2200, defasagem: 0.366674892, posicao: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1985-02-19", admissao: "2014-09-08", risco: "Médio", potencial: "Alto" },
    { nome: "Daniel Pereira de Oliveira", cargo: "Pintor de Comunicação Visual", area: "Produção e Comunicação Visual", salario: 1680.97, nivel: "N1", refMin: 2000, refMax: 2200, defasagem: -0.159515, posicao: "Abaixo", obs: "Ajuste planejado", gestor: "Pedro Henrique Gonçalves", nascimento: "1996-06-08", admissao: "2025-09-15", risco: "Alto", potencial: "Médio" },
    { nome: "Demerval Vieira", cargo: "Designer Gráfico", area: "Produção e Comunicação Visual", salario: 2140.0, nivel: "N4", refMin: 1800, refMax: 2300, defasagem: 0.1888888889, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1989-06-03", admissao: "2016-04-20", risco: "Médio", potencial: "Alto" },
    { nome: "Eberth Soares Santos", cargo: "Designer Gráfico", area: "Produção e Comunicação Visual", salario: 2668.79, nivel: "N5", refMin: 1800, refMax: 2300, defasagem: 0.4826611111, posicao: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1984-10-15", admissao: "2013-07-01", risco: "Baixo", potencial: "Alto" },
    { nome: "Vinicius Silva Lins", cargo: "Projetista", area: "Produção e Comunicação Visual", salario: 1840.4, nivel: "N1", refMin: 2200, refMax: 3500, defasagem: -0.1634545455, posicao: "Abaixo", obs: "Ajuste planejado", gestor: "Pedro Henrique Gonçalves", nascimento: "1997-01-27", admissao: "2024-02-12", risco: "Alto", potencial: "Alto" },

    // Serralheria e Metalurgia
    { nome: "Nailton Antunes da Silva", cargo: "Serralheiro", area: "Serralheria e Metalurgia", salario: 2588.06, nivel: "N5", refMin: 1800, refMax: 2500, defasagem: 0.4378111111, posicao: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1980-08-30", admissao: "2012-05-14", risco: "Baixo", potencial: "Médio" },
    { nome: "Paulo Alves Cordeiro", cargo: "Soldador", area: "Serralheria e Metalurgia", salario: 2588.06, nivel: "N5", refMin: 1800, refMax: 2500, defasagem: 0.4378111111, posicao: "Acima", obs: "Monitorar compressão", gestor: "Pedro Henrique Gonçalves", nascimento: "1981-12-19", admissao: "2013-02-26", risco: "Baixo", potencial: "Médio" },

    // Comercial e Atendimento
    { nome: "Adilson Barbosa", cargo: "Atendente Comercial", area: "Comercial e Atendimento", salario: 1955.43, nivel: "N5", refMin: 1621, refMax: 2000, defasagem: 0.2063109192, posicao: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1983-06-03", admissao: "2015-01-19", risco: "Baixo", potencial: "Médio" },
    { nome: "Barbara Patricia Ferreira", cargo: "Consultor de Vendas", area: "Comercial e Atendimento", salario: 1816.67, nivel: "N2", refMin: 1621, refMax: 2200, defasagem: 0.1207094386, posicao: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1994-03-22", admissao: "2021-08-30", risco: "Médio", potencial: "Alto" },
    { nome: "Candida Elia David Barros", cargo: "Consultor de Vendas", area: "Comercial e Atendimento", salario: 1680.97, nivel: "N1", refMin: 1621, refMax: 2200, defasagem: 0.03699568168, posicao: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1998-09-28", admissao: "2025-03-17", risco: "Médio", potencial: "Médio" },
    { nome: "Marcella Laiara Rocha", cargo: "Atendente Comercial", area: "Comercial e Atendimento", salario: 1816.67, nivel: "N3", refMin: 1650, refMax: 1950, defasagem: 0.1010121212, posicao: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1995-06-22", admissao: "2020-10-05", risco: "Baixo", potencial: "Alto" },

    // Administrativo e Gestão (suporte à operação)
    { nome: "Raphael Terra Alves", cargo: "Assistente de Suprimentos", area: "Administrativo e Gestão", salario: 2675.0, nivel: "N1", refMin: 2800, refMax: 3100, defasagem: -0.04464285714, posicao: "Abaixo", obs: "Ajuste planejado", gestor: "Pedro Henrique Gonçalves", nascimento: "1992-11-12", admissao: "2023-01-09", risco: "Médio", potencial: "Médio" },
    { nome: "Rodrigo Moreira Silva", cargo: "Analista de PCP", area: "Administrativo e Gestão", salario: 2675.0, nivel: "N1", refMin: 2500, refMax: 4000, defasagem: 0.07, posicao: "Dentro", obs: "Posição adequada", gestor: "Pedro Henrique Gonçalves", nascimento: "1991-08-07", admissao: "2022-06-13", risco: "Médio", potencial: "Alto" },
  ];

  // 31º colaborador: RH (Administrador do sistema)
  colabs.push({
    nome: "Larissa Andrade Souza", cargo: "RH / DP", area: "Administrativo e Gestão", salario: 2450.0, nivel: "N3", refMin: 1900, refMax: 3000, defasagem: 0.2894736842, posicao: "Dentro", obs: "Posição adequada", gestor: "Jéssica Fernanda S. Sampaio", perfil: "ADMIN_RH", nascimento: "1990-06-18", admissao: "2019-08-01", risco: "Baixo", potencial: "Alto",
  });

  // Colaboradores desligados (amostra para indicadores de turnover)
  const desligados: ColabDef[] = [
    { nome: "Tiago Mendes Rocha", cargo: "Instalador Assistente", area: "Montagem e Instalação", salario: 1666.0, nivel: "N2", refMin: 1621, refMax: 1800, defasagem: 0.02775, posicao: "Dentro", obs: "Desligado", gestor: "Adriano Nunes Araújo", nascimento: "1996-04-10", admissao: "2022-03-01", risco: "Alto", potencial: "Médio", status: "Inativo" },
    { nome: "Patrícia Gomes Lopes", cargo: "Atendente Comercial", area: "Comercial e Atendimento", salario: 1716.0, nivel: "N2", refMin: 1621, refMax: 2000, defasagem: 0.05860, posicao: "Dentro", obs: "Desligado", gestor: "Jéssica Fernanda S. Sampaio", nascimento: "1997-02-15", admissao: "2023-06-01", risco: "Alto", potencial: "Médio", status: "Inativo" },
  ];

  const todosColabs = [...colabs, ...desligados];
  const colabMap: Record<string, string> = {};
  let idx = 0;
  for (const c of todosColabs) {
    idx++;
    const cpf = gerarCPF(idx + 100);
    const ehDesligado = c.status === "Inativo";
    const statusNome = c.status ?? (idx % 17 === 0 ? "Em experiência" : "Ativo");
    const created = await db.colaborador.create({
      data: {
        nome: c.nome,
        cpf,
        email: email(c.nome),
        telefone: telefone(),
        dataNascimento: new Date(c.nascimento),
        dataAdmissao: new Date(c.admissao),
        dataDesligamento: ehDesligado
          ? new Date(c.nome.includes("Tiago") ? "2026-03-15" : "2026-05-20")
          : null,
        enderecoRua: ["Rua das Acácias", "Av. Cula Mangabeira", "Rua Coronel Prates", "Av. Mestra Fininha", "Rua Dois de Maio"][idx % 5],
        enderecoNumero: String(rint(50, 1500)),
        enderecoComplemento: idx % 4 === 0 ? `Apto ${rint(11, 305)}` : null,
        enderecoBairro: ["Centro", "Major Prates", "Cândida Câmara", "Todos os Santos", "Ibituruna"][idx % 5],
        enderecoCep: `393${rint(10, 99)}-${rint(100, 999)}`,
        conjugeNome: idx % 3 === 0 ? null : ["Maria", "João", "Ana", "Carlos", "Fernanda", "Roberto"][idx % 6] + " " + ["Silva", "Souza", "Santos", "Costa"][idx % 4],
        conjugeTelefone: idx % 3 === 0 ? null : telefone(),
        qtdFilhos: rint(0, 3),
        cargoId: cargoMap[c.cargo],
        nivelId: nivelMap[c.nivel],
        areaId: areaMap[c.area],
        salario: c.salario,
        matriculaEsocial: `${rint(10000, 99999)}-${rint(0, 9)}`,
        valeTransporte: idx % 3 !== 0,
        statusId: statusMap[statusNome],
        refMinMercado: c.refMin,
        refMaxMercado: c.refMax,
        defasagem: c.defasagem,
        posicaoFaixa: c.posicao,
        statusSalarial: c.posicao,
        observacaoEnquadramento: c.obs,
        riscoSaida: c.risco ?? "Baixo",
        potencial: c.potencial ?? "Médio",
      },
    });
    colabMap[c.nome] = created.id;
  }

  // Segunda passada: gestores + usuários + consentimento LGPD + admissão (movimentação)
  console.log("🌱  Hierarquia, usuários e LGPD...");
  for (const c of todosColabs) {
    const id = colabMap[c.nome];
    if (c.gestor && colabMap[c.gestor]) {
      await db.colaborador.update({
        where: { id },
        data: { gestorId: colabMap[c.gestor] },
      });
    }
    // usuário (todos podem logar; perfil padrão COLABORADOR)
    if (c.status !== "Inativo") {
      await db.user.create({
        data: {
          email: email(c.nome),
          senhaHash: await bcrypt.hash(SENHA_PADRAO, 10),
          perfil: c.perfil ?? "COLABORADOR",
          colaboradorId: id,
          ativo: true,
        },
      });
    }
    // consentimento LGPD
    await db.consentimentoLGPD.create({
      data: {
        colaboradorId: id,
        finalidade: "Tratamento de dados pessoais e sensíveis para gestão de RH",
        consentido: true,
        data: new Date(c.admissao),
      },
    });
    // movimentação de admissão
    await db.movimentacao.create({
      data: {
        colaboradorId: id,
        tipo: "Admissão",
        data: new Date(c.admissao),
        descricao: `Admissão no cargo de ${c.cargo}.`,
        cargoNovo: c.cargo,
        nivelNovo: c.nivel,
        salarioNovo: c.salario,
        registradoPor: "Sistema (migração de base)",
      },
    });
  }

  // Usuário RH "genérico" amigável (atalho de login do administrador)
  const larissaId = colabMap["Larissa Andrade Souza"];
  await db.user.update({
    where: { colaboradorId: larissaId },
    data: { email: "rh@impresilk.com.br", perfil: "ADMIN_RH" },
  });

  // ----------------- Movimentações adicionais (histórico) -----------------
  console.log("🌱  Histórico de movimentações...");
  const promocoes = [
    { nome: "Bruno Dias do Nascimento", de: "N3", para: "N4", data: "2023-06-01", sal: 2033.0, salAnt: 1872.5 },
    { nome: "Lucas Natalino Ferreira", de: "N3", para: "N4", data: "2022-09-01", sal: 2350.0, salAnt: 2150.0 },
    { nome: "Eberth Soares Santos", de: "N4", para: "N5", data: "2021-12-01", sal: 2668.79, salAnt: 2300.0 },
    { nome: "Nailton Antunes da Silva", de: "N4", para: "N5", data: "2020-03-01", sal: 2588.06, salAnt: 2325.0 },
  ];
  for (const p of promocoes) {
    if (!colabMap[p.nome]) continue;
    await db.movimentacao.create({
      data: {
        colaboradorId: colabMap[p.nome],
        tipo: "Promoção",
        data: new Date(p.data),
        descricao: `Promoção de nível ${p.de} para ${p.para} por desempenho consistente.`,
        nivelAnterior: p.de,
        nivelNovo: p.para,
        salarioAnterior: p.salAnt,
        salarioNovo: p.sal,
        registradoPor: "RH",
      },
    });
  }

  // ----------------- Ciclo de avaliação + avaliações -----------------
  console.log("🌱  Avaliações de desempenho...");
  const ciclo = await db.cicloAvaliacao.create({
    data: {
      nome: "Ciclo 2026.1",
      dataInicio: new Date("2026-01-01"),
      dataFim: new Date("2026-06-30"),
      status: "Aberto",
    },
  });

  const limiarPromocao: Record<string, number> = { N1: 80, N2: 80, N3: 85, N4: 90, N5: 100 };

  for (const c of colabs) {
    const id = colabMap[c.nome];
    let tecnico: number, comportamental: number, resultado: number, tempo: number, advert: boolean, aprov: boolean;

    if (c.nome === "Adriano Nunes Araújo") {
      // dados reais da planilha
      tecnico = 95; comportamental = 75; resultado = 70; tempo = 20; advert = false; aprov = true;
    } else {
      const base = c.potencial === "Alto" ? 78 : c.potencial === "Médio" ? 68 : 58;
      tecnico = Math.min(98, base + rint(0, 18));
      comportamental = Math.min(98, base + rint(-5, 15));
      resultado = Math.min(98, base + rint(-8, 16));
      tempo = rint(6, 30);
      advert = rng() < 0.12;
      aprov = rng() < 0.8;
    }
    const notaFinal = +(tecnico * 0.4 + comportamental * 0.3 + resultado * 0.3).toFixed(1);
    const statusDes = notaFinal >= 80 ? "Apto" : notaFinal >= 60 ? "Em desenvolvimento" : "Não apto";
    const proximo = c.nivel === "N5" ? null : `N${parseInt(c.nivel[1]) + 1}`;
    const limiar = limiarPromocao[c.nivel];
    const elegivel = !!proximo && notaFinal >= limiar && tempo >= 12 && !advert && aprov;

    await db.avaliacao.create({
      data: {
        cicloId: ciclo.id,
        colaboradorId: id,
        avaliadorId: c.gestor ? colabMap[c.gestor] : null,
        tipo: "GESTOR",
        notaTecnico: tecnico,
        notaComportamental: comportamental,
        notaResultado: resultado,
        notaFinal,
        statusDesempenho: statusDes,
        tempoNoNivelMeses: tempo,
        advertencia: advert,
        liderancaAprovou: aprov,
        elegivelPromocao: elegivel,
        proximoNivel: proximo,
        planoAcao: elegivel
          ? "Elegível para comitê de promoção."
          : statusDes === "Não apto"
            ? "Reforçar base técnica e comportamental."
            : "Desenvolver autonomia e consistência de resultado.",
        comentarios: null,
        status: "Concluída",
      },
    });

    // autoavaliação para uma parte da equipe
    if (rng() < 0.5) {
      await db.avaliacao.create({
        data: {
          cicloId: ciclo.id,
          colaboradorId: id,
          avaliadorId: id,
          tipo: "AUTO",
          notaTecnico: Math.min(100, tecnico + rint(-5, 8)),
          notaComportamental: Math.min(100, comportamental + rint(-5, 8)),
          notaResultado: Math.min(100, resultado + rint(-5, 8)),
          notaFinal: notaFinal,
          statusDesempenho: statusDes,
          tempoNoNivelMeses: tempo,
          status: "Concluída",
        },
      });
    }
  }

  // ----------------- Metas (por área e individuais) -----------------
  console.log("🌱  Metas...");
  const metasArea = [
    { area: "Montagem e Instalação", titulo: "Prazo de entrega das instalações", indicador: "Prazo", alvo: 95, atual: 91, unidade: "%" },
    { area: "Montagem e Instalação", titulo: "Redução de retrabalho em campo", indicador: "Retrabalho", alvo: 5, atual: 7, unidade: "%" },
    { area: "Produção e Comunicação Visual", titulo: "Produtividade da produção", indicador: "Produtividade", alvo: 100, atual: 96, unidade: "%" },
    { area: "Produção e Comunicação Visual", titulo: "Qualidade (índice de aprovação)", indicador: "Qualidade", alvo: 95, atual: 93, unidade: "%" },
    { area: "Comercial e Atendimento", titulo: "Taxa de conversão de vendas", indicador: "Conversão", alvo: 30, atual: 26, unidade: "%" },
    { area: "Serralheria e Metalurgia", titulo: "Qualidade estrutural", indicador: "Qualidade", alvo: 95, atual: 97, unidade: "%" },
    { area: "Administrativo e Gestão", titulo: "Eficiência administrativa", indicador: "Eficiência", alvo: 90, atual: 88, unidade: "%" },
  ];
  for (const m of metasArea) {
    await db.meta.create({
      data: {
        titulo: m.titulo,
        descricao: `Meta de área — ${m.area}.`,
        tipo: "Área",
        areaId: areaMap[m.area],
        indicador: m.indicador,
        valorAlvo: m.alvo,
        valorAtual: m.atual,
        unidade: m.unidade,
        prazo: new Date("2026-06-30"),
        status: m.atual >= m.alvo ? "Concluída" : "Em andamento",
      },
    });
  }
  const metasIndividuais = [
    { nome: "Barbara Patricia Ferreira", titulo: "Bater meta de vendas consultivas", indicador: "Meta", alvo: 100, atual: 92, unidade: "%" },
    { nome: "Vinicius Silva Lins", titulo: "Reduzir retrabalho em projetos", indicador: "Retrabalho", alvo: 5, atual: 8, unidade: "%" },
    { nome: "Daniel Pereira de Oliveira", titulo: "Atingir produtividade padrão", indicador: "Produtividade", alvo: 100, atual: 85, unidade: "%" },
    { nome: "Adriano Nunes Araújo", titulo: "Liderar 100% das frentes no prazo", indicador: "Prazo", alvo: 95, atual: 96, unidade: "%" },
  ];
  for (const m of metasIndividuais) {
    if (!colabMap[m.nome]) continue;
    await db.meta.create({
      data: {
        titulo: m.titulo,
        descricao: "Meta individual do ciclo 2026.1.",
        tipo: "Individual",
        colaboradorId: colabMap[m.nome],
        indicador: m.indicador,
        valorAlvo: m.alvo,
        valorAtual: m.atual,
        unidade: m.unidade,
        prazo: new Date("2026-06-30"),
        status: m.atual >= m.alvo ? "Concluída" : "Em andamento",
      },
    });
  }

  // ----------------- PDI -----------------
  console.log("🌱  PDI...");
  const pdis = [
    { nome: "Vinicius Silva Lins", competencia: "Autonomia técnica", acao: "Conduzir 3 projetos completos sem revisão crítica", resultado: "Reduzir retrabalho para ≤ 5%", prazo: "2026-05-30", status: "Em andamento", progresso: 60 },
    { nome: "Daniel Pereira de Oliveira", competencia: "Produtividade", acao: "Treinamento em técnicas de pintura e acabamento", resultado: "Atingir produtividade ≥ 100%", prazo: "2026-04-30", status: "Em andamento", progresso: 40 },
    { nome: "Barbara Patricia Ferreira", competencia: "Vendas consultivas", acao: "Programa de negociação avançada", resultado: "Passagem para nível Pleno (N3)", prazo: "2026-06-15", status: "Em andamento", progresso: 70 },
    { nome: "Camila Cristina R. Sampaio", competencia: "Gestão e liderança", acao: "Capacitação em gestão administrativa estratégica", resultado: "Consolidar atuação de coordenação", prazo: "2026-06-30", status: "Pendente", progresso: 10 },
    { nome: "Adriano Nunes Araújo", competencia: "Gestão de equipes", acao: "Mentoria de liderança de campo", resultado: "Preparação para N4", prazo: "2026-05-01", status: "Concluída", progresso: 100 },
  ];
  for (const p of pdis) {
    if (!colabMap[p.nome]) continue;
    await db.pDI.create({
      data: {
        colaboradorId: colabMap[p.nome],
        competencia: p.competencia,
        acao: p.acao,
        resultadoEsperado: p.resultado,
        prazo: new Date(p.prazo),
        status: p.status,
        progresso: p.progresso,
      },
    });
  }

  // ----------------- Feedbacks -----------------
  console.log("🌱  Feedbacks...");
  const feedbacks = [
    { nome: "Adriano Nunes Araújo", autor: "Saulo Rodrigues Ferreira", tipo: "Positivo", conteudo: "Excelente condução das frentes de montagem no último trimestre. Liderança reconhecida pela equipe." },
    { nome: "Bruno Dias do Nascimento", autor: "Pedro Henrique Gonçalves", tipo: "Positivo", conteudo: "Referência técnica na operação. Baixíssimo índice de retrabalho." },
    { nome: "Daniel Pereira de Oliveira", autor: "Pedro Henrique Gonçalves", tipo: "Desenvolvimento", conteudo: "Evoluir consistência de produtividade. Acompanhar plano de desenvolvimento." },
    { nome: "Vinicius Silva Lins", autor: "Pedro Henrique Gonçalves", tipo: "Desenvolvimento", conteudo: "Alto potencial. Precisa ganhar autonomia para assumir projetos completos." },
    { nome: "Barbara Patricia Ferreira", autor: "Jéssica Fernanda S. Sampaio", tipo: "Contínuo", conteudo: "Boa evolução em negociação. Manter ritmo para alcançar a meta do ciclo." },
  ];
  for (const f of feedbacks) {
    if (!colabMap[f.nome]) continue;
    await db.feedback.create({
      data: {
        colaboradorId: colabMap[f.nome],
        autorId: colabMap[f.autor] ?? null,
        tipo: f.tipo,
        conteudo: f.conteudo,
        contexto: "Ciclo 2026.1",
        criadoEm: new Date("2026-05-" + String(rint(10, 28))),
      },
    });
  }

  // ----------------- Documentos por colaborador -----------------
  console.log("🌱  Documentos...");
  const hoje = new Date("2026-06-22");
  function addDias(base: Date, dias: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    return d;
  }
  for (const c of colabs) {
    const id = colabMap[c.nome];
    // Contrato
    await db.documento.create({
      data: {
        colaboradorId: id,
        categoria: "Contrato",
        nome: "Contrato de Trabalho (CLT)",
        dataEmissao: new Date(c.admissao),
        enviadoPor: "RH",
      },
    });
    // ASO — alguns vencidos / a vencer / válidos
    const venc = rng();
    const vencimentoASO =
      venc < 0.18 ? addDias(hoje, -rint(1, 40)) : venc < 0.45 ? addDias(hoje, rint(1, 55)) : addDias(hoje, rint(120, 360));
    await db.documento.create({
      data: {
        colaboradorId: id,
        categoria: "ASO",
        nome: "Atestado de Saúde Ocupacional",
        dataEmissao: addDias(vencimentoASO, -365),
        dataVencimento: vencimentoASO,
        enviadoPor: "RH",
      },
    });
    // Exame periódico
    if (rng() < 0.7) {
      const vencEx = rng() < 0.3 ? addDias(hoje, rint(1, 50)) : addDias(hoje, rint(90, 300));
      await db.documento.create({
        data: {
          colaboradorId: id,
          categoria: "Exame Periódico",
          nome: "Exame Periódico Ocupacional",
          dataEmissao: addDias(vencEx, -180),
          dataVencimento: vencEx,
          enviadoPor: "RH",
        },
      });
    }
  }

  // ----------------- Férias -----------------
  console.log("🌱  Férias...");
  for (let i = 0; i < colabs.length; i++) {
    const c = colabs[i];
    const id = colabMap[c.nome];
    const r = rng();
    if (r < 0.25) {
      // agendada / retorno próximo
      const inicio = addDias(hoje, rint(-5, 20));
      await db.ferias.create({
        data: {
          colaboradorId: id,
          periodoAquisitivoInicio: new Date("2025-01-01"),
          periodoAquisitivoFim: new Date("2025-12-31"),
          dataInicio: inicio,
          dataRetorno: addDias(inicio, 30),
          diasGozados: 0,
          saldoDias: 30,
          status: inicio <= hoje ? "Em andamento" : "Agendada",
        },
      });
    } else if (r < 0.5) {
      // concluída (parcial)
      const inicio = addDias(hoje, -rint(60, 200));
      await db.ferias.create({
        data: {
          colaboradorId: id,
          periodoAquisitivoInicio: new Date("2024-01-01"),
          periodoAquisitivoFim: new Date("2024-12-31"),
          dataInicio: inicio,
          dataRetorno: addDias(inicio, 15),
          diasGozados: 15,
          saldoDias: 15,
          status: "Concluída",
        },
      });
    } else {
      // em aberto
      await db.ferias.create({
        data: {
          colaboradorId: id,
          periodoAquisitivoInicio: new Date("2025-06-01"),
          periodoAquisitivoFim: new Date("2026-05-31"),
          diasGozados: 0,
          saldoDias: 30,
          status: "Em aberto",
        },
      });
    }
  }

  // ----------------- Viagens e diárias (amostra) -----------------
  console.log("🌱  Viagens/diárias (amostra)...");
  const viagens = [
    { nome: "Adriano Pinheiro Lima", destino: "Janaúba/MG", dias: 3, diaria: 90, offset: -25, status: "Concluída" },
    { nome: "Douglas Thiago Silva", destino: "Pirapora/MG", dias: 2, diaria: 90, offset: -10, status: "Concluída" },
    { nome: "Lucas Natalino Ferreira", destino: "Bocaiúva/MG", dias: 1, diaria: 80, offset: -1, status: "Em andamento" },
    { nome: "Ronivon Cardoso dos Santos", destino: "Salinas/MG", dias: 4, diaria: 100, offset: 5, status: "Aprovada" },
    { nome: "Adriano Pinheiro Lima", destino: "Diamantina/MG", dias: 2, diaria: 90, offset: 12, status: "Planejada" },
    { nome: "Douglas Thiago Silva", destino: "Curvelo/MG", dias: 3, diaria: 90, offset: 20, status: "Planejada" },
  ];
  for (const v of viagens) {
    if (!colabMap[v.nome]) continue;
    const inicio = addDias(hoje, v.offset);
    await db.viagem.create({
      data: {
        colaboradorId: colabMap[v.nome],
        destino: v.destino,
        dataInicio: inicio,
        dataFim: addDias(inicio, v.dias),
        dias: v.dias,
        valorDiaria: v.diaria,
        valorTotal: v.dias * v.diaria,
        finalidade: "Instalação e montagem em campo",
        status: v.status,
      },
    });
  }

  // ----------------- Onboarding / Offboarding (amostra) -----------------
  console.log("🌱  Checklists de integração e desligamento...");
  const modeloOnboarding = [
    { titulo: "Assinatura do contrato de trabalho", responsavel: "RH" },
    { titulo: "Entrega e conferência de documentos (RG, CPF, CTPS)", responsavel: "RH" },
    { titulo: "Exame admissional (ASO)", responsavel: "SST" },
    { titulo: "Cadastro no eSocial", responsavel: "RH" },
    { titulo: "Abertura de conta salário / dados bancários", responsavel: "RH" },
    { titulo: "Entrega de uniforme e EPIs", responsavel: "SST" },
    { titulo: "Criação de e-mail e acessos", responsavel: "Gestor" },
    { titulo: "Apresentação à equipe e tour pela empresa", responsavel: "Gestor" },
    { titulo: "Leitura e aceite do Código de Ética", responsavel: "Colaborador" },
    { titulo: "Treinamento inicial do cargo", responsavel: "Gestor" },
  ];
  const modeloOffboarding = [
    { titulo: "Comunicado e aviso prévio", responsavel: "RH" },
    { titulo: "Exame demissional (ASO)", responsavel: "SST" },
    { titulo: "Devolução de uniforme, EPIs e equipamentos", responsavel: "Gestor" },
    { titulo: "Revogação de acessos e e-mail", responsavel: "Gestor" },
    { titulo: "Cálculo das verbas rescisórias", responsavel: "RH" },
    { titulo: "Baixa na CTPS e eSocial", responsavel: "RH" },
    { titulo: "Entrevista de desligamento", responsavel: "RH" },
    { titulo: "Homologação e entrega de documentos", responsavel: "RH" },
  ];

  // Onboarding para as 2 admissões mais recentes (ativas)
  const recentes = await db.colaborador.findMany({
    where: { dataDesligamento: null, dataAdmissao: { not: null } },
    orderBy: { dataAdmissao: "desc" },
    take: 2,
    select: { id: true },
  });
  for (const c of recentes) {
    await db.tarefa.createMany({
      data: modeloOnboarding.map((t, i) => ({
        colaboradorId: c.id,
        tipo: "Admissão",
        titulo: t.titulo,
        responsavel: t.responsavel,
        ordem: i,
        concluida: i < 6, // primeiras etapas concluídas
        concluidaEm: i < 6 ? addDias(hoje, -rint(1, 10)) : null,
      })),
    });
  }

  // Offboarding para os desligados
  const desligadosOff = await db.colaborador.findMany({
    where: { dataDesligamento: { not: null } },
    select: { id: true },
  });
  for (const c of desligadosOff) {
    await db.tarefa.createMany({
      data: modeloOffboarding.map((t, i) => ({
        colaboradorId: c.id,
        tipo: "Desligamento",
        titulo: t.titulo,
        responsavel: t.responsavel,
        ordem: i,
        concluida: true,
        concluidaEm: addDias(hoje, -rint(1, 20)),
      })),
    });
  }

  // ----------------- Documentos institucionais -----------------
  console.log("🌱  Documentos institucionais...");
  await db.documentoInstitucional.createMany({
    data: [
      {
        titulo: "Código de Ética e Conduta",
        categoria: "Código de Ética",
        versao: "2026.1",
        descricao: "Principal referencial orientador da conduta na Impresilk Comunicação Visual.",
        conteudo: [
          "MISSÃO",
          "Ajudar negócios a encontrarem sua essência e oportunidades para se diferenciar, crescer e transformar suas marcas por meio de soluções visuais inteligentes, promovendo um ambiente de trabalho inspirador para nossos colaboradores e impacto positivo na comunidade.",
          "",
          "VISÃO",
          "Ser reconhecida como a principal referência em comunicação visual, liderando o mercado por meio de inovações constantes, tecnologia de ponta e uma equipe de profissionais altamente qualificados.",
          "",
          "VALORES",
          "• Inovação com Inteligência — soluções visuais criativas, funcionais e com propósito.",
          "• Excelência em Execução — qualidade em cada etapa, do projeto à entrega.",
          "• Pessoas em Primeiro Lugar — respeitamos, desenvolvemos e valorizamos nossos colaboradores.",
          "• Relações de Confiança — ética, transparência e responsabilidade.",
          "• Impacto Social e Comunitário — transformar realidades ao nosso redor.",
          "• Sustentabilidade e Consciência — gerar valor com o menor impacto ambiental possível.",
          "",
          "ABRANGÊNCIA",
          "Aplica-se a todos os gestores, colaboradores, parceiros, fornecedores e prestadores de serviços. O cumprimento é obrigatório durante toda a vigência do contrato, não sendo permitido alegar desconhecimento de seu conteúdo.",
          "",
          "TEMAS PRINCIPAIS",
          "Relacionamento com clientes; sigilo e confidencialidade; pontualidade e jornada de trabalho; faltas e penalidades; férias; pagamento de salário; uniformes e EPIs; ponto biométrico; uso de veículos; saúde e segurança no trabalho.",
        ].join("\n"),
      },
      {
        titulo: "POP — Procedimentos Operacionais Padrão",
        categoria: "POP",
        versao: "1.0",
        descricao: "Procedimentos operacionais padrão de produção, montagem e atendimento.",
        conteudo:
          "Todos os colaboradores devem obrigatoriamente ler e estar cientes dos Procedimentos Operacionais (POPs). O conhecimento e a adesão a essas diretrizes são fundamentais para o bom funcionamento da equipe e o sucesso organizacional.",
      },
      {
        titulo: "PGR — Programa de Gerenciamento de Riscos",
        categoria: "SST",
        versao: "2026",
        descricao: "Documento de Saúde e Segurança do Trabalho (NR-01).",
        conteudo:
          "Programa de Gerenciamento de Riscos da Impresilk. Identifica perigos, avalia riscos ocupacionais e define plano de ação para os setores de produção, impressão/sublimação, CNC, serralheria e montagem em campo. Uso obrigatório de EPIs.",
      },
      {
        titulo: "PCMSO — Programa de Controle Médico de Saúde Ocupacional",
        categoria: "SST",
        versao: "2026",
        descricao: "Documento de Saúde e Segurança do Trabalho (NR-07).",
        conteudo:
          "Programa de Controle Médico de Saúde Ocupacional. Define a realização de exames admissionais, periódicos, de retorno ao trabalho, de mudança de função e demissionais (ASO).",
      },
      {
        titulo: "Treinamento de Integração (Onboarding)",
        categoria: "Treinamento",
        versao: "1.0",
        descricao: "Material de integração de novos colaboradores.",
        conteudo:
          "Boas-vindas à Impresilk Comunicação Visual. Apresentação da empresa, da missão, visão e valores, das normas de conduta, da estrutura de áreas e do plano de carreira por níveis (N1 a N5).",
      },
    ],
  });

  // ----------------- Configurações -----------------
  await db.configuracao.createMany({
    data: [
      { chave: "empresa.nome", valor: "Impresilk Comunicação Visual" },
      { chave: "empresa.cidade", valor: "Montes Claros/MG" },
      { chave: "marca.corPrimaria", valor: "#16334f" },
      { chave: "marca.corAcento", valor: "#c2a14d" },
    ],
  });

  // ----------------- Resumo -----------------
  const totalColab = await db.colaborador.count();
  const totalUsers = await db.user.count();
  const totalAval = await db.avaliacao.count();
  console.log("\n✅  Seed concluído!");
  console.log(`   Colaboradores: ${totalColab}  |  Usuários: ${totalUsers}  |  Avaliações: ${totalAval}`);
  console.log("\n   Acessos de demonstração (senha: " + SENHA_PADRAO + ")");
  console.log("   • RH (admin):        rh@impresilk.com.br");
  console.log("   • Gestor operações:  " + email("Pedro Henrique Gonçalves"));
  console.log("   • Gestor montagem:   " + email("Saulo Rodrigues Ferreira"));
  console.log("   • Gestor adm/com.:   " + email("Jéssica Fernanda S. Sampaio"));
  console.log("   • Colaborador:       " + email("Bruno Dias do Nascimento"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
