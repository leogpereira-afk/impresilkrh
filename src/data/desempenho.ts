import type { Avaliacao, CicloAvaliacao, Feedback, Meta, PDI } from "./types";
import { COLABORADORES } from "./colaboradores";
import { mulberry32, HOJE } from "./_gen";

export const CICLOS: CicloAvaliacao[] = [
  {
    id: "ciclo-2026-1",
    nome: "Ciclo 2026.1",
    dataInicio: "2026-01-01",
    dataFim: "2026-06-30",
    status: "Aberto",
    pesoTecnico: 0.4,
    pesoComportamental: 0.3,
    pesoResultado: 0.3,
    notaMinPromocao: 80,
    mesesMinNivel: 12,
  },
];

const ativos = COLABORADORES.filter((c) => !c.ehDirecao && c.statusId !== "inativo");
const limiarPromocao: Record<string, number> = { N1: 80, N2: 80, N3: 85, N4: 90, N5: 100 };

const avaliacoes: Avaliacao[] = [];
ativos.forEach((c, i) => {
  const rng = mulberry32(9000 + i * 71);
  const rint = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
  let tecnico: number, comportamental: number, resultado: number, tempo: number, advert: boolean, aprov: boolean;

  if (c.id === "adriano-nunes-araujo") {
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
  const nivelNum = c.nivelId ? parseInt(c.nivelId.slice(1)) : 1;
  const proximo = !c.nivelId || c.nivelId === "N5" ? null : `N${nivelNum + 1}`;
  const limiar = limiarPromocao[c.nivelId ?? "N1"] ?? 80;
  const elegivel = !!proximo && notaFinal >= limiar && tempo >= 12 && !advert && aprov;

  avaliacoes.push({
    id: `aval-gestor-${c.id}`,
    cicloId: "ciclo-2026-1",
    colaboradorId: c.id,
    avaliadorId: c.gestorId ?? null,
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
    status: "Concluída",
    criadoEm: HOJE.toISOString(),
  });

  if (rng() < 0.5) {
    avaliacoes.push({
      id: `aval-auto-${c.id}`,
      cicloId: "ciclo-2026-1",
      colaboradorId: c.id,
      avaliadorId: c.id,
      tipo: "AUTO",
      notaTecnico: Math.min(100, tecnico + rint(-5, 8)),
      notaComportamental: Math.min(100, comportamental + rint(-5, 8)),
      notaResultado: Math.min(100, resultado + rint(-5, 8)),
      notaFinal,
      statusDesempenho: statusDes,
      tempoNoNivelMeses: tempo,
      status: "Concluída",
      criadoEm: HOJE.toISOString(),
    });
  }
});
export const AVALIACOES: Avaliacao[] = avaliacoes;

export const METAS: Meta[] = [
  { id: "meta-a1", titulo: "Prazo de entrega das instalações", descricao: "Meta de área — Montagem e Instalação.", tipo: "Área", areaId: "montagem", indicador: "Prazo", valorAlvo: 95, valorAtual: 91, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-a2", titulo: "Redução de retrabalho em campo", descricao: "Meta de área — Montagem e Instalação.", tipo: "Área", areaId: "montagem", indicador: "Retrabalho", valorAlvo: 5, valorAtual: 7, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-a3", titulo: "Produtividade da produção", descricao: "Meta de área — Produção e Comunicação Visual.", tipo: "Área", areaId: "producao", indicador: "Produtividade", valorAlvo: 100, valorAtual: 96, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-a4", titulo: "Qualidade (índice de aprovação)", descricao: "Meta de área — Produção e Comunicação Visual.", tipo: "Área", areaId: "producao", indicador: "Qualidade", valorAlvo: 95, valorAtual: 93, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-a5", titulo: "Taxa de conversão de vendas", descricao: "Meta de área — Comercial e Atendimento.", tipo: "Área", areaId: "comercial", indicador: "Conversão", valorAlvo: 30, valorAtual: 26, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-a6", titulo: "Qualidade estrutural", descricao: "Meta de área — Serralheria e Metalurgia.", tipo: "Área", areaId: "serralheria", indicador: "Qualidade", valorAlvo: 95, valorAtual: 97, unidade: "%", prazo: "2026-06-30", status: "Concluída" },
  { id: "meta-a7", titulo: "Eficiência administrativa", descricao: "Meta de área — Administrativo e Gestão.", tipo: "Área", areaId: "adm", indicador: "Eficiência", valorAlvo: 90, valorAtual: 88, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-i1", titulo: "Bater meta de vendas consultivas", descricao: "Meta individual do ciclo 2026.1.", tipo: "Individual", colaboradorId: "barbara-patricia-ferreira", indicador: "Meta", valorAlvo: 100, valorAtual: 92, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-i2", titulo: "Reduzir retrabalho em projetos", descricao: "Meta individual do ciclo 2026.1.", tipo: "Individual", colaboradorId: "vinicius-silva-lins", indicador: "Retrabalho", valorAlvo: 5, valorAtual: 8, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-i3", titulo: "Atingir produtividade padrão", descricao: "Meta individual do ciclo 2026.1.", tipo: "Individual", colaboradorId: "daniel-pereira-de-oliveira", indicador: "Produtividade", valorAlvo: 100, valorAtual: 85, unidade: "%", prazo: "2026-06-30", status: "Em andamento" },
  { id: "meta-i4", titulo: "Liderar 100% das frentes no prazo", descricao: "Meta individual do ciclo 2026.1.", tipo: "Individual", colaboradorId: "adriano-nunes-araujo", indicador: "Prazo", valorAlvo: 95, valorAtual: 96, unidade: "%", prazo: "2026-06-30", status: "Concluída" },
];

export const PDIS: PDI[] = [
  { id: "pdi-1", colaboradorId: "vinicius-silva-lins", competencia: "Autonomia técnica", acao: "Conduzir 3 projetos completos sem revisão crítica", resultadoEsperado: "Reduzir retrabalho para ≤ 5%", prazo: "2026-05-30", status: "Em andamento", progresso: 60 },
  { id: "pdi-2", colaboradorId: "daniel-pereira-de-oliveira", competencia: "Produtividade", acao: "Treinamento em técnicas de pintura e acabamento", resultadoEsperado: "Atingir produtividade ≥ 100%", prazo: "2026-04-30", status: "Em andamento", progresso: 40 },
  { id: "pdi-3", colaboradorId: "barbara-patricia-ferreira", competencia: "Vendas consultivas", acao: "Programa de negociação avançada", resultadoEsperado: "Passagem para nível Pleno (N3)", prazo: "2026-06-15", status: "Em andamento", progresso: 70 },
  { id: "pdi-4", colaboradorId: "camila-cristina-r-sampaio", competencia: "Gestão e liderança", acao: "Capacitação em gestão administrativa estratégica", resultadoEsperado: "Consolidar atuação de coordenação", prazo: "2026-06-30", status: "Pendente", progresso: 10 },
  { id: "pdi-5", colaboradorId: "adriano-nunes-araujo", competencia: "Gestão de equipes", acao: "Mentoria de liderança de campo", resultadoEsperado: "Preparação para N4", prazo: "2026-05-01", status: "Concluída", progresso: 100 },
];

export const FEEDBACKS: Feedback[] = [
  { id: "fb-1", colaboradorId: "adriano-nunes-araujo", autorId: "saulo-rodrigues-ferreira", tipo: "Positivo", conteudo: "Excelente condução das frentes de montagem no último trimestre. Liderança reconhecida pela equipe.", contexto: "Ciclo 2026.1", criadoEm: "2026-05-18" },
  { id: "fb-2", colaboradorId: "bruno-dias-do-nascimento", autorId: "pedro-henrique-goncalves", tipo: "Positivo", conteudo: "Referência técnica na operação. Baixíssimo índice de retrabalho.", contexto: "Ciclo 2026.1", criadoEm: "2026-05-20" },
  { id: "fb-3", colaboradorId: "daniel-pereira-de-oliveira", autorId: "pedro-henrique-goncalves", tipo: "Desenvolvimento", conteudo: "Evoluir consistência de produtividade. Acompanhar plano de desenvolvimento.", contexto: "Ciclo 2026.1", criadoEm: "2026-05-22" },
  { id: "fb-4", colaboradorId: "vinicius-silva-lins", autorId: "pedro-henrique-goncalves", tipo: "Desenvolvimento", conteudo: "Alto potencial. Precisa ganhar autonomia para assumir projetos completos.", contexto: "Ciclo 2026.1", criadoEm: "2026-05-24" },
  { id: "fb-5", colaboradorId: "barbara-patricia-ferreira", autorId: "jessica-fernanda-s-sampaio", tipo: "Contínuo", conteudo: "Boa evolução em negociação. Manter ritmo para alcançar a meta do ciclo.", contexto: "Ciclo 2026.1", criadoEm: "2026-05-26" },
];
