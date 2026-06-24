// Central de notificações: junta num só lugar o que o app já calcula —
// documentos e NRs a vencer/vencidos, avaliações pendentes, férias e
// aniversários — respeitando o ESCOPO do usuário (RH vê tudo; gestor a equipe;
// colaborador a si). Cada item leva a uma tela. Tudo derivado das coleções, sem
// estado próprio: muda sozinho quando os dados mudam.
import { useMemo } from "react";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis } from "@/lib/rbac";
import { parseData } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import { JANELA_ALERTA_DIAS } from "@/lib/constants";

export type SeveridadeNotif = "alta" | "media" | "baixa";
export type CategoriaNotif = "documento" | "nr" | "avaliacao" | "ferias" | "aniversario";
export interface Notificacao {
  id: string;
  categoria: CategoriaNotif;
  titulo: string;
  descricao: string;
  severidade: SeveridadeNotif;
  href: string;
}

const diasAte = (d?: string | null) => { const dt = parseData(d); return dt ? Math.round((dt.getTime() - HOJE.getTime()) / 86400000) : NaN; };
const hojeBase = new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate());
function diasAteAniversario(nasc?: string | null): number {
  const d = parseData(nasc);
  if (!d) return NaN;
  let prox = new Date(HOJE.getFullYear(), d.getMonth(), d.getDate());
  if (prox.getTime() < hojeBase.getTime()) prox = new Date(HOJE.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((prox.getTime() - hojeBase.getTime()) / 86400000);
}
const ORDEM: Record<SeveridadeNotif, number> = { alta: 0, media: 1, baixa: 2 };

export function useNotificacoes(): Notificacao[] {
  const sessao = useSessao();
  const { items: colaboradores } = useColecao("colaboradores");
  const { items: documentos } = useColecao("documentos");
  const { items: certificacoesNr } = useColecao("certificacoesNr");
  const { items: avaliacoes } = useColecao("avaliacoes");
  const { items: ferias } = useColecao("ferias");

  return useMemo(() => {
    if (!sessao) return [];
    const escopo = colaboradoresVisiveis(sessao, colaboradores);
    const ids = new Set(escopo.map((c) => c.id));
    const nomeById = new Map(colaboradores.map((c) => [c.id, c.nome]));
    const nome = (id: string) => nomeById.get(id) ?? "—";
    const ativos = escopo.filter((c) => c.statusId === "ativo");
    const out: Notificacao[] = [];

    // Documentos a vencer / vencidos
    for (const doc of documentos) {
      if (!ids.has(doc.colaboradorId) || !doc.dataVencimento) continue;
      const dd = diasAte(doc.dataVencimento);
      if (isNaN(dd) || dd > JANELA_ALERTA_DIAS) continue;
      const vencido = dd < 0;
      out.push({
        id: `doc-${doc.id}`, categoria: "documento", severidade: vencido ? "alta" : "media",
        titulo: `${doc.nome} · ${nome(doc.colaboradorId)}`,
        descricao: vencido ? `Documento vencido há ${Math.abs(dd)} dia(s)` : `Documento vence em ${dd} dia(s)`,
        href: `/colaboradores/${doc.colaboradorId}`,
      });
    }

    // NRs (treinamentos de segurança) a vencer / vencidas
    for (const c of certificacoesNr) {
      if (!ids.has(c.colaboradorId) || !c.dataValidade) continue;
      const dd = diasAte(c.dataValidade);
      if (isNaN(dd) || dd > JANELA_ALERTA_DIAS) continue;
      const vencida = dd < 0;
      out.push({
        id: `nr-${c.id}`, categoria: "nr", severidade: vencida ? "alta" : "media",
        titulo: `${c.nr} · ${nome(c.colaboradorId)}`,
        descricao: vencida ? `NR vencida há ${Math.abs(dd)} dia(s)` : `NR vence em ${dd} dia(s)`,
        href: "/sst",
      });
    }

    // Avaliações pendentes (só gestão): ativos sem avaliação do gestor no ciclo.
    if (sessao.perfil === "ADMIN_RH" || sessao.perfil === "GESTOR") {
      const avaliados = new Set(avaliacoes.filter((a) => a.tipo === "GESTOR").map((a) => a.colaboradorId));
      const pendentes = ativos.filter((c) => !avaliados.has(c.id)).length;
      if (pendentes > 0) {
        out.push({
          id: "aval-pendentes", categoria: "avaliacao", severidade: "media",
          titulo: `${pendentes} avaliação(ões) pendente(s)`,
          descricao: "Ciclo atual sem avaliação do gestor", href: "/desempenho",
        });
      }
    }

    // Férias em andamento ou começando em até 7 dias
    for (const f of ferias) {
      if (!ids.has(f.colaboradorId)) continue;
      if (f.status === "Em andamento") {
        out.push({ id: `fer-${f.id}`, categoria: "ferias", severidade: "baixa", titulo: `${nome(f.colaboradorId)} está de férias`, descricao: "Período em andamento", href: "/ferias" });
      } else if (f.dataInicio) {
        const dd = diasAte(f.dataInicio);
        if (!isNaN(dd) && dd >= 0 && dd <= 7) {
          out.push({ id: `fer-${f.id}`, categoria: "ferias", severidade: "baixa", titulo: `Férias de ${nome(f.colaboradorId)}`, descricao: dd === 0 ? "Começa hoje" : `Começa em ${dd} dia(s)`, href: "/ferias" });
        }
      }
    }

    // Aniversariantes nos próximos 7 dias
    for (const c of ativos) {
      const dd = diasAteAniversario(c.dataNascimento);
      if (isNaN(dd) || dd > 7) continue;
      out.push({ id: `aniv-${c.id}`, categoria: "aniversario", severidade: "baixa", titulo: `Aniversário de ${c.nome}`, descricao: dd === 0 ? "É hoje! 🎉" : `Em ${dd} dia(s)`, href: "/painel" });
    }

    return out.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade]);
  }, [sessao, colaboradores, documentos, certificacoesNr, avaliacoes, ferias]);
}
