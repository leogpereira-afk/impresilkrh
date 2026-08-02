// Histórico de alterações — a aba "Histórico" do Painel de Controle.
//
// Responde a uma pergunta só, e responde inteira: QUEM mexeu, NO QUÊ, QUANDO e
// O QUE mudou. O "o que mudou" é o que separa um log útil de uma lista de
// carimbos: saber que alguém editou o cadastro do Fulano às 14h não ajuda;
// saber QUAIS campos ele mexeu, ajuda.
//
// O valor de campo sensível (salário, CPF, endereço) aparece como "•••" de
// propósito — o histórico sincroniza, e guardar o número aqui entregaria a
// folha por uma porta lateral. Quem precisa do valor abre a ficha, que tem
// controle de acesso.
import { useMemo, useState } from "react";
import { History, Filter, ChevronDown, ChevronRight, Download, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { ehMaster } from "@/lib/rbac";
import { rotuloColecao } from "@/lib/auditoria";
import { podarAntigos } from "@/lib/historico";
import type { Alteracao } from "@/data/types";

const COR_ACAO: Record<string, string> = {
  CRIOU: "bg-green-50 text-green-700 ring-green-200",
  ALTEROU: "bg-blue-50 text-blue-700 ring-blue-200",
  REMOVEU: "bg-red-50 text-red-700 ring-red-200",
  LOTE: "bg-violet-50 text-violet-700 ring-violet-200",
};
const LABEL_ACAO: Record<string, string> = {
  CRIOU: "Criou",
  ALTEROU: "Alterou",
  REMOVEU: "Removeu",
  LOTE: "Importou",
  VISUALIZAR_DADOS_SENSIVEIS: "Consultou",
};

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const soDia = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
};

export function HistoricoSecao() {
  const registros = useColecao("alteracoes");
  const toast = useToast();
  const sessao = useSessao();
  const master = ehMaster(sessao);

  const [quem, setQuem] = useState("");
  const [oQue, setOQue] = useState("");
  const [acao, setAcao] = useState("");
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [mostrar, setMostrar] = useState(80);
  const [limpar, setLimpar] = useState(false);

  const linhas = useMemo(
    () => [...(registros.items as Alteracao[])].sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "")),
    [registros.items],
  );

  const pessoas = useMemo(
    () => [...new Set(linhas.map((l) => l.usuarioNome).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [linhas],
  );
  const colecoes = useMemo(
    () => [...new Set(linhas.map((l) => l.colecao).filter(Boolean) as string[])].sort(),
    [linhas],
  );

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (quem && l.usuarioNome !== quem) return false;
      if (oQue && l.colecao !== oQue) return false;
      if (acao && l.acao !== acao) return false;
      if (!t) return true;
      const alvo = `${l.usuarioNome} ${l.recurso} ${l.detalhe ?? ""} ${(l.mudancas ?? []).map((m) => `${m.campo} ${m.de} ${m.para}`).join(" ")}`;
      return alvo.toLowerCase().includes(t);
    });
  }, [linhas, quem, oQue, acao, busca]);

  const visiveis = filtradas.slice(0, mostrar);

  // Cabeçalho de dia: separa "hoje" de "semana passada" sem o usuário ter de
  // ler data em toda linha.
  const comDia = useMemo(() => {
    const out: { dia?: string; linha: Alteracao }[] = [];
    let ultimo = "";
    for (const l of visiveis) {
      const dia = (l.criadoEm ?? "").slice(0, 10);
      out.push({ dia: dia !== ultimo ? soDia(l.criadoEm) : undefined, linha: l });
      ultimo = dia;
    }
    return out;
  }, [visiveis]);

  const exportar = () => {
    const cab = ["Quando", "Quem", "Perfil", "Ação", "O quê", "Detalhe", "Mudanças"];
    const linhasCsv = filtradas.map((l) => [
      dataHora(l.criadoEm),
      l.usuarioNome,
      l.perfil,
      LABEL_ACAO[l.acao] ?? l.acao,
      l.recurso,
      l.detalhe ?? "",
      (l.mudancas ?? []).map((m) => `${m.campo}: ${m.de} → ${m.para}`).join(" | "),
    ]);
    const csv = [cab, ...linhasCsv]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${filtradas.length} linha(s) exportada(s).`);
  };

  // Poda explícita: o histórico cresce para sempre e o navegador tem limite de
  // espaço. Fica com o master, é manual e diz exatamente o que vai sumir —
  // apagar sozinho um registro de auditoria seria justamente o que uma
  // auditoria não pode fazer.
  const CORTE_MESES = 12;
  const antigas = useMemo(() => {
    const limite = new Date();
    limite.setMonth(limite.getMonth() - CORTE_MESES);
    const iso = limite.toISOString();
    return linhas.filter((l) => (l.criadoEm ?? "") < iso);
  }, [linhas]);

  const podar = () => {
    podarAntigos(antigas.map((l) => l.id));
    toast(`${antigas.length} registro(s) com mais de ${CORTE_MESES} meses removidos.`);
    setLimpar(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Histórico de alterações"
          subtitle="Quem mexeu, no quê e quando. Valor sensível aparece como ••• — o número fica na ficha."
          icon={<History className="h-5 w-5" />}
          action={
            <div className="flex items-center gap-2">
              <button className="btn-outline h-9" onClick={exportar} disabled={filtradas.length === 0}>
                <Download className="h-4 w-4" /> Exportar
              </button>
              {master && antigas.length > 0 && (
                <button className="btn-ghost h-9 text-red-600" onClick={() => setLimpar(true)} title={`Remove ${antigas.length} registro(s) com mais de ${CORTE_MESES} meses`}>
                  <Trash2 className="h-4 w-4" /> Limpar antigos
                </button>
              )}
            </div>
          }
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-[11px] text-slate-500">
              Quem
              <Select value={quem} onChange={(e) => setQuem(e.target.value)} className="mt-0.5 w-[190px] text-sm">
                <option value="">Todos</option>
                {pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </label>
            <label className="flex flex-col text-[11px] text-slate-500">
              O quê
              <Select value={oQue} onChange={(e) => setOQue(e.target.value)} className="mt-0.5 w-[190px] text-sm">
                <option value="">Tudo</option>
                {colecoes.map((c) => <option key={c} value={c}>{rotuloColecao(c)}</option>)}
              </Select>
            </label>
            <label className="flex flex-col text-[11px] text-slate-500">
              Ação
              <Select value={acao} onChange={(e) => setAcao(e.target.value)} className="mt-0.5 w-[150px] text-sm">
                <option value="">Todas</option>
                <option value="CRIOU">Criou</option>
                <option value="ALTEROU">Alterou</option>
                <option value="REMOVEU">Removeu</option>
                <option value="LOTE">Importou</option>
                <option value="VISUALIZAR_DADOS_SENSIVEIS">Consultou dado sensível</option>
              </Select>
            </label>
            <label className="flex min-w-[200px] flex-1 flex-col text-[11px] text-slate-500">
              Buscar
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome, campo, valor…" className="mt-0.5" />
            </label>
            {(quem || oQue || acao || busca) && (
              <button className="btn-ghost h-9 text-xs" onClick={() => { setQuem(""); setOQue(""); setAcao(""); setBusca(""); }}>
                Limpar filtros
              </button>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            {filtradas.length === linhas.length
              ? `${linhas.length} registro(s) no histórico`
              : `${filtradas.length} de ${linhas.length} registro(s)`}
          </p>
        </CardBody>
      </Card>

      {filtradas.length === 0 ? (
        <EmptyState
          title={linhas.length === 0 ? "Nada registrado ainda" : "Nada com esses filtros"}
          description={
            linhas.length === 0
              ? "A partir de agora, toda criação, alteração e remoção feita no sistema aparece aqui — com o nome de quem fez e o horário."
              : "Tente afrouxar os filtros acima."
          }
          icon={<History className="h-10 w-10" />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {comDia.map(({ dia, linha: l }) => {
            const temDetalhe = (l.mudancas?.length ?? 0) > 0;
            const aberto = abertos.has(l.id);
            return (
              <div key={l.id}>
                {dia && (
                  <div className="border-y border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 first:border-t-0">
                    {dia}
                  </div>
                )}
                <div className="border-b border-slate-50 last:border-b-0">
                  <button
                    type="button"
                    disabled={!temDetalhe}
                    onClick={() => setAbertos((s) => { const x = new Set(s); if (x.has(l.id)) x.delete(l.id); else x.add(l.id); return x; })}
                    className={"flex w-full items-start gap-3 px-3 py-2 text-left " + (temDetalhe ? "hover:bg-slate-50/70" : "cursor-default")}
                  >
                    <span className="w-[42px] shrink-0 pt-0.5 text-xs tabular-nums text-slate-400">
                      {dataHora(l.criadoEm).slice(-5)}
                    </span>
                    <span
                      className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 " + (COR_ACAO[l.acao] ?? "bg-slate-50 text-slate-600 ring-slate-200")}
                    >
                      {LABEL_ACAO[l.acao] ?? l.acao}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-700">{l.recurso}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {l.usuarioNome}
                        {l.perfil ? ` · ${l.perfil}` : ""}
                        {l.detalhe ? ` · ${l.detalhe}` : ""}
                        {temDetalhe ? ` · ${l.totalCampos && l.totalCampos > l.mudancas!.length ? `${l.mudancas!.length} de ${l.totalCampos}` : l.mudancas!.length} campo(s)` : ""}
                      </span>
                    </span>
                    {temDetalhe && (
                      <span className="shrink-0 pt-0.5 text-slate-300">
                        {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    )}
                  </button>
                  {aberto && temDetalhe && (
                    <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-2 pl-[68px]">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-slate-100">
                          {l.mudancas!.map((m, i) => (
                            <tr key={i}>
                              <td className="py-1 pr-3 font-medium text-slate-600">{m.campo}</td>
                              <td className="py-1 pr-2 text-right text-slate-400 line-through">{m.de}</td>
                              <td className="w-4 py-1 text-center text-slate-300">→</td>
                              <td className="py-1 font-medium text-slate-800">{m.para}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {l.totalCampos && l.totalCampos > l.mudancas!.length && (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          Mais {l.totalCampos - l.mudancas!.length} campo(s) alterados não detalhados aqui.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtradas.length > visiveis.length && (
            <button className="w-full border-t border-slate-100 py-2.5 text-xs font-medium text-brand hover:bg-slate-50" onClick={() => setMostrar((n) => n + 200)}>
              Mostrar mais ({filtradas.length - visiveis.length} restante(s))
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        aberto={limpar}
        onFechar={() => setLimpar(false)}
        onConfirmar={podar}
        titulo="Limpar histórico antigo"
        mensagem={`Serão removidos ${antigas.length} registro(s) com mais de ${CORTE_MESES} meses. O histórico recente permanece. Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
