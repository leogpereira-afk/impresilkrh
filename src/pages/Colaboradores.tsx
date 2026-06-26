import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Users, ChevronRight, ChevronDown, Building2, LayoutGrid, Rows3, ArrowDownAZ, Download, Palmtree, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { DotBadge, Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { MotivacaoRosto } from "@/components/ui/indicadores";
import { ColaboradorForm } from "@/components/colaboradores/colaborador-form";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, ehRH, podeVerGestao } from "@/lib/rbac";
import { tempoDeCasa } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Colaborador } from "@/data/types";

const varianteEnq: Record<string, "danger" | "warning" | "success" | "info"> = {
  Crítico: "danger", Abaixo: "warning", Dentro: "success", Acima: "info",
};

export default function Colaboradores() {
  const sessao = useSessao();
  const d = useDominio();
  const [busca, setBusca] = useState("");
  const [fArea, setFArea] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false); // padrão: só ativos
  const [novo, setNovo] = useState(false);
  const [verNomes, setVerNomes] = useState(false); // lista simples de nomes (A–Z)

  // Áreas/setores navegáveis (sem a Direção).
  const areasNav = useMemo(() => d.areas.filter((a) => a.id !== "direcao"), [d.areas]);

  // Visão padrão: agrupada por setor. Chips de área para navegação rápida.
  const [visao, setVisao] = useState<"setor" | "lista">("setor");
  const [chips, setChips] = useState<Set<string>>(() => new Set());
  // Sanfonas: primeira área aberta por padrão; subáreas começam fechadas.
  const [areasAbertas, setAreasAbertas] = useState<Set<string>>(
    () => new Set(areasNav.length ? [areasNav[0].id] : []),
  );
  const [subsAbertas, setSubsAbertas] = useState<Set<string>>(() => new Set());

  const escopo = useMemo(() => colaboradoresVisiveis(sessao, d.colaboradores), [sessao, d.colaboradores]);
  const { items: ferias } = useColecao("ferias");

  // Inativo = desligado (data de desligamento) ou status "inativo".
  const ehInativo = (c: Colaborador) => c.statusId === "inativo" || !!c.dataDesligamento;

  // Cards de resumo — sobre o escopo de acesso, sem a Direção (mesma base da lista).
  const resumo = useMemo(() => {
    const base = escopo.filter((c) => !c.ehDirecao);
    const emFerias = new Set(
      ferias.filter((f) => f.status === "Em andamento").map((f) => f.colaboradorId),
    );
    return {
      total: base.length,
      ativos: base.filter((c) => !ehInativo(c)).length,
      ferias: base.filter((c) => emFerias.has(c.id) && !ehInativo(c)).length,
      desligados: base.filter((c) => ehInativo(c)).length,
    };
  }, [escopo, ferias]);

  // Exporta a lista filtrada atual para CSV (Excel-friendly, separador ;).
  const exportarCsv = () => {
    const cols: [string, (c: Colaborador) => string | number][] = [
      ["Nome", (c) => c.nome],
      ["E-mail", (c) => c.email ?? ""],
      ["Telefone", (c) => c.telefone ?? ""],
      ["Cargo", (c) => d.nomeCargo(c)],
      ["Área", (c) => d.nomeArea(c.areaId)],
      ["Nível", (c) => d.nomeNivel(c.nivelId)],
      ["Status", (c) => d.nomeStatus(c.statusId)],
      ["Enquadramento", (c) => d.enquadrarColab(c)],
      ["Admissão", (c) => (c.dataAdmissao ?? "").slice(0, 10)],
    ];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      cols.map((x) => x[0]).join(";"),
      ...lista.map((c) => cols.map(([, fn]) => esc(fn(c))).join(";")),
    ];
    const blob = new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `colaboradores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Lista filtrada (busca + filtros + chips). Compartilhada pelas duas visões.
  // Por padrão mostra só os ativos; "Incluir inativos" libera os desligados.
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return escopo
      .filter((c) => !c.ehDirecao)
      .filter((c) => mostrarInativos || !ehInativo(c))
      .filter((c) => (fArea ? c.areaId === fArea : true))
      .filter((c) => (chips.size ? !!c.areaId && chips.has(c.areaId) : true))
      .filter((c) => (fStatus ? c.statusId === fStatus : true))
      .filter((c) =>
        termo
          ? c.nome.toLowerCase().includes(termo) ||
            d.nomeCargo(c).toLowerCase().includes(termo) ||
            (c.email ?? "").toLowerCase().includes(termo) ||
            d.nomeArea(c.areaId).toLowerCase().includes(termo)
          : true,
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [escopo, fArea, fStatus, busca, chips, mostrarInativos, d]);

  // Lista simples de nomes, agrupada por inicial (A, B, C…) — só os nomes, sem
  // cargo/setor. Usa a mesma lista já filtrada e ordenada alfabeticamente.
  const inicial = (nome: string) =>
    (nome.trim()[0] || "#").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const porLetra = useMemo(() => {
    const m = new Map<string, Colaborador[]>();
    for (const c of lista) {
      const L = inicial(c.nome);
      const arr = m.get(L) ?? [];
      arr.push(c);
      m.set(L, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [lista]);

  // Agrupamento por setor (área) → subárea, sobre a lista já filtrada.
  const grupos = useMemo(() => {
    return areasNav
      .map((area) => {
        const pessoas = lista.filter((c) => c.areaId === area.id);
        const porSub = new Map<string, Colaborador[]>();
        for (const c of pessoas) {
          const sub = d.subareaDe(c);
          const arr = porSub.get(sub) ?? [];
          arr.push(c);
          porSub.set(sub, arr);
        }
        const subareas = [...porSub.entries()]
          .map(([nome, itens]) => ({ nome, itens }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        return { area, total: pessoas.length, subareas };
      })
      .filter((g) => g.total > 0);
  }, [areasNav, lista, d]);

  const toggleChip = (id: string) =>
    setChips((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleArea = (id: string) =>
    setAreasAbertas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSub = (chave: string) =>
    setSubsAbertas((prev) => {
      const next = new Set(prev);
      next.has(chave) ? next.delete(chave) : next.add(chave);
      return next;
    });

  return (
    <div>
      <PageHeader title="Colaboradores" description={`${lista.length} colaborador(es) no seu escopo de acesso.`}>
        <button className="btn-outline" onClick={exportarCsv} disabled={lista.length === 0} title="Exporta a lista filtrada para CSV">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
        {ehRH(sessao) && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Novo colaborador
          </button>
        )}
      </PageHeader>

      {/* Cards de resumo do quadro */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", valor: resumo.total, icon: Users, cor: "text-slate-500", bg: "bg-slate-100" },
          { label: "Ativos", valor: resumo.ativos, icon: UserCheck, cor: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Em férias", valor: resumo.ferias, icon: Palmtree, cor: "text-amber-600", bg: "bg-amber-50" },
          { label: "Desligados", valor: resumo.desligados, icon: UserX, cor: "text-slate-500", bg: "bg-slate-100" },
        ].map(({ label, valor, icon: Icon, cor, bg }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", bg)}>
              <Icon className={cn("h-5 w-5", cor)} />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-slate-800">{valor}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Chips de área (multi-seleção) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setChips(new Set())}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
            chips.size === 0
              ? "border-brand bg-brand text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          <Building2 className="h-3.5 w-3.5" /> Todas
        </button>
        {areasNav.map((a) => {
          const ativo = chips.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleChip(a.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                ativo
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {a.nome}
            </button>
          );
        })}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar por nome, cargo, e-mail ou área…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={fArea} onChange={(e) => setFArea(e.target.value)} className="sm:w-56">
            <option value="">Todas as áreas</option>
            {areasNav.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="sm:w-44">
            <option value="">Todos os status</option>
            {d.status.filter((s) => s.id !== "direcao" && s.id !== "externo").map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-600" title="Por padrão a lista mostra só os colaboradores ativos">
            <input
              type="checkbox"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Incluir inativos
          </label>
          {/* Alternador de visão */}
          <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setVisao("setor")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                visao === "setor" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Por setor
            </button>
            <button
              type="button"
              onClick={() => setVisao("lista")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                visao === "lista" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Rows3 className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
        </div>
      </Card>

      {lista.length === 0 ? (
        <EmptyState title="Nenhum colaborador encontrado" description="Ajuste a busca ou os filtros." icon={<Users className="h-8 w-8" />} />
      ) : visao === "lista" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th hidden md:table-cell">Área</th>
                  <th className="th hidden sm:table-cell">Nível</th>
                  <th className="th hidden lg:table-cell">Tempo de casa</th>
                  <th className="th">Enquadramento</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((c) => (
                  <tr key={c.id} className="group transition hover:bg-slate-50/60">
                    <td className="td">
                      <Link to={`/colaboradores/${c.id}`} className="flex items-center gap-3">
                        <Avatar nome={c.nome} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{c.nome}</p>
                          <p className="truncate text-xs text-slate-500">{d.nomeCargo(c)}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="td hidden md:table-cell text-slate-500">{d.nomeArea(c.areaId)}</td>
                    <td className="td hidden sm:table-cell">{d.nomeNivel(c.nivelId)}</td>
                    <td className="td hidden lg:table-cell text-slate-500">{tempoDeCasa(c.dataAdmissao)}</td>
                    <td className="td">
                      <Badge variant={varianteEnq[d.enquadrarColab(c)] ?? "neutral"}>{d.enquadrarColab(c)}</Badge>
                    </td>
                    <td className="td"><DotBadge label={d.nomeStatus(c.statusId)} cor={d.corStatus(c.statusId)} /></td>
                    <td className="td text-right">
                      <Link to={`/colaboradores/${c.id}`} className="inline-flex text-slate-300 transition group-hover:text-brand">
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Visão por setor — sanfona de áreas → subáreas → mini-cards */
        <div className="space-y-3">
          {grupos.map(({ area, total, subareas }) => {
            const aberta = areasAbertas.has(area.id);
            return (
              <Card key={area.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleArea(area.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50/60"
                >
                  <span className="flex items-center gap-3">
                    {aberta ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <Building2 className="h-4 w-4 text-brand" />
                    <span className="text-sm font-semibold text-slate-800">{area.nome}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    <Users className="h-3.5 w-3.5" /> {total}
                  </span>
                </button>

                {aberta && (
                  <div className="space-y-2 border-t border-slate-100 bg-slate-50/40 p-3">
                    {subareas.map(({ nome, itens }) => {
                      const chaveSub = `${area.id}::${nome}`;
                      const subAberta = subsAbertas.has(chaveSub);
                      return (
                        <div key={chaveSub} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => toggleSub(chaveSub)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                          >
                            <span className="flex items-center gap-2">
                              {subAberta ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                              <span className="text-sm font-medium text-slate-700">{nome}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              <Users className="h-3 w-3" /> {itens.length}
                            </span>
                          </button>

                          {subAberta && (
                            <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-3">
                              {itens.map((c) => (
                                <Link
                                  key={c.id}
                                  to={`/colaboradores/${c.id}`}
                                  className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand/40 hover:bg-slate-50/80 hover:shadow-sm"
                                >
                                  {c.fotoDataUrl ? (
                                    <img src={c.fotoDataUrl} alt={c.nome} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                                  ) : (
                                    <Avatar nome={c.nome} size="sm" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-800">{c.nome}</p>
                                    <p className="truncate text-xs text-slate-500">{d.nomeCargo(c)}</p>
                                    <p className="mt-0.5 text-[11px] text-slate-400">{tempoDeCasa(c.dataInicioCargo)} no cargo</p>
                                  </div>
                                  {podeVerGestao(sessao, c.id, d.colaboradores) && (
                                    <MotivacaoRosto score={c.motivacao} tamanho="sm" comTexto={false} />
                                  )}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Atalho ao final: lista simples de nomes (A–Z), fora de cargos/setores */}
      {lista.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => setVerNomes(true)} className="btn-outline">
            <ArrowDownAZ className="h-4 w-4" /> Ver todos os nomes (A–Z)
          </button>
        </div>
      )}

      <Modal
        aberto={verNomes}
        onFechar={() => setVerNomes(false)}
        titulo="Colaboradores em ordem alfabética"
        descricao={`${lista.length} nome(s). Toque em um nome para abrir a ficha.`}
        largura="max-w-2xl"
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {porLetra.map(([letra, itens]) => (
            <div key={letra}>
              <p className="sticky top-0 z-10 bg-white py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand">{letra}</p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {itens.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/colaboradores/${c.id}`}
                      onClick={() => setVerNomes(false)}
                      className="block truncate rounded-md px-2 py-1 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-brand"
                    >
                      {c.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>

      {novo && <ColaboradorForm aberto={novo} onFechar={() => setNovo(false)} />}
    </div>
  );
}
