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
import { obter, definirColecaoDinamica, type RegistroGenerico } from "@/lib/store";
import { idConta } from "@/data/planoContas";
import { enviarColecao } from "@/lib/sync";
import { criarHash, ehHash, podeHashear } from "@/lib/senha";

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
    definirColecaoDinamica(nome, corrigidos as RegistroGenerico[]);
    void enviarColecao(nome); // sobe já (ou entra na fila de retentativa se estiver offline)
  }
  aplicarPacoteConteudoRH();
  void migrarSenhasParaHash();
}

// ---------------------------------------------------------------------------
// Senhas em texto puro → hash. O campo `senha` do cadastro de usuários era
// gravado como o usuário digitou e SUBIA PARA A NUVEM assim. Qualquer pessoa com
// o app aberto (DevTools) ou com um backup em mãos lia a senha de todo mundo.
// Aqui trocamos pelo hash e apagamos o texto — local e na nuvem (o envio
// sobrescreve o registro antigo). Roda uma vez; se o navegador não tiver
// WebCrypto, não mexe em nada (o login antigo continua funcionando).
// ---------------------------------------------------------------------------
async function migrarSenhasParaHash(): Promise<void> {
  if (typeof window === "undefined" || !podeHashear()) return;
  const usuarios = obter("usuarios") as unknown as (RegSolto & { senha?: string; senhaHash?: unknown })[];
  if (!Array.isArray(usuarios) || !usuarios.some((u) => typeof u?.senha === "string" && u.senha.trim())) return;
  const convertidos = await Promise.all(
    usuarios.map(async (u) => {
      const texto = typeof u?.senha === "string" ? u.senha.trim() : "";
      if (!texto) return u;
      try {
        const senhaHash = ehHash(u.senhaHash) ? u.senhaHash : await criarHash(texto);
        const { senha: _fora, ...resto } = u;
        return { ...resto, senhaHash };
      } catch { return u; }
    }),
  );
  definirColecaoDinamica("usuarios", convertidos as RegistroGenerico[]);
  void enviarColecao("usuarios"); // apaga o texto puro também na nuvem
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
    definirColecaoDinamica("templatesMensagem", [...tpls, ...tplNovos.map((n) => ({ ...n, criadoEm: agora }))] as RegistroGenerico[]);
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
    definirColecaoDinamica("modelosChecklist", atualizados as RegistroGenerico[]);
    void enviarColecao("modelosChecklist");
  }

  try { window.localStorage.setItem(K_PACOTE, "1"); } catch { /* ignora */ }
}
