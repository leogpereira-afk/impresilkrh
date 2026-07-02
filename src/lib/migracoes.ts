// ============================================================================
// Migrações de dados locais. Rodam UMA vez a cada abertura do app, antes do
// primeiro render — consertam dados antigos que ficaram em formato velho no
// localStorage de cada computador.
//
// Caso concreto: o plano de contas importado antes de 2026-06 não tinha `id`
// em cada linha. O envio para a nuvem descarta registro sem id — por isso o
// plano ficou meses SÓ no computador que importou (0 registros na nuvem),
// enquanto folha e classificação subiam normalmente. Aqui geramos o id
// determinístico (mesma competência+código ⇒ mesmo id em qualquer computador)
// e empurramos a coleção para a nuvem.
// ============================================================================
import { NOMES_COLECOES } from "@/data";
import { obter, definirColecao } from "@/lib/store";
import { idConta } from "@/data/planoContas";
import { enviarColecao } from "@/lib/sync";

type RegSolto = { id?: string } & Record<string, unknown>;

function idPara(nome: string, reg: RegSolto, indice: number): string {
  if (nome === "planoContas" && reg.competencia && reg.codigo) {
    return idConta(String(reg.competencia), String(reg.codigo));
  }
  // Demais casos (raros): id aleatório no padrão do store.
  return `${nome}_mig_${Math.random().toString(36).slice(2, 9)}${indice.toString(36)}`;
}

export function rodarMigracoes(): void {
  for (const nome of NOMES_COLECOES) {
    const itens = obter(nome) as unknown as RegSolto[];
    if (!Array.isArray(itens) || !itens.some((r) => !r?.id)) continue;
    const vistos = new Set<string>();
    const corrigidos = itens.map((r, i) => {
      let id = r?.id || idPara(nome, r ?? {}, i);
      while (vistos.has(id)) id = `${id}_dup`; // competência+código repetido não se sobrescreve
      vistos.add(id);
      return r?.id === id ? r : { ...r, id };
    });
    definirColecao(nome as never, corrigidos as never);
    void enviarColecao(nome); // sobe já (ou entra na fila de retentativa se estiver offline)
  }
  aplicarPacoteConteudoRH();
}

// ---------------------------------------------------------------------------
// Pacote de conteúdo RH v1 (aditivo). Os seeds novos só valem para instalação
// zerada — computadores que JÁ têm dados recebem os mesmos itens por aqui.
// Regras: nunca sobrescreve nem remove; templates usam ids fixos (iguais aos do
// seed) para não duplicar entre computadores; itens de checklist entram por
// título, só se não existirem. Marcador local evita reaplicar a cada abertura.
// ---------------------------------------------------------------------------
const K_PACOTE = "impresilk.rh.v1:conteudo-rh";

const TEMPLATES_RH: { id: string; titulo: string; corpo: string }[] = [
  { id: "tpl-rh-treinamento", titulo: "Convocação de treinamento", corpo: "Olá {{nome}}, você foi convocado(a) para um treinamento. Confirme sua presença com o RH e fique atento(a) à data e ao horário." },
  { id: "tpl-rh-aso", titulo: "Exame periódico (ASO)", corpo: "{{nome}}, seu exame periódico está para ser agendado. Procure o RH para combinar data e local." },
  { id: "tpl-rh-nr", titulo: "Reciclagem de NR vencendo", corpo: "{{nome}}, sua certificação de segurança (NR) está perto de vencer. Vamos agendar a reciclagem para você continuar liberado(a) para o trabalho." },
];

const ITENS_ADMISSAO_RH: { titulo: string; responsavel: string }[] = [
  { titulo: "Apresentação às máquinas e áreas de risco do setor", responsavel: "Gestor" },
  { titulo: "Treinamento de segurança do setor (NRs aplicáveis)", responsavel: "SST" },
  { titulo: "Liberação de softwares e licenças da função", responsavel: "Gestor" },
];

function aplicarPacoteConteudoRH(): void {
  if (typeof window === "undefined") return;
  try { if (window.localStorage.getItem(K_PACOTE) === "1") return; } catch { return; }

  // Templates de mensagem (dedup por id E por título — quem renomeou mantém o seu)
  const tpls = obter("templatesMensagem") as unknown as RegSolto[];
  const tplNovos = TEMPLATES_RH.filter((n) => !tpls.some((t) => t.id === n.id || t.titulo === n.titulo));
  if (tplNovos.length) {
    const agora = new Date().toISOString();
    definirColecao("templatesMensagem" as never, [...tpls, ...tplNovos.map((n) => ({ ...n, criadoEm: agora }))] as never);
    void enviarColecao("templatesMensagem");
  }

  // Itens novos no modelo de checklist de Admissão (por título)
  const modelos = obter("modelosChecklist") as unknown as (RegSolto & { tipo?: string; itens?: { titulo: string; responsavel: string }[] })[];
  let mudou = false;
  const atualizados = modelos.map((m) => {
    if (m.tipo !== "Admissão") return m;
    const atuais = m.itens ?? [];
    const faltam = ITENS_ADMISSAO_RH.filter((n) => !atuais.some((i) => i.titulo === n.titulo));
    if (faltam.length === 0) return m;
    mudou = true;
    return { ...m, itens: [...atuais, ...faltam] };
  });
  if (mudou) {
    definirColecao("modelosChecklist" as never, atualizados as never);
    void enviarColecao("modelosChecklist");
  }

  try { window.localStorage.setItem(K_PACOTE, "1"); } catch { /* ignora */ }
}
