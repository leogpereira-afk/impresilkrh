import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GitBranch, ArrowRight, Calculator, Lock, ChevronRight, ChevronDown, Trophy, Medal, CheckCircle2, Plus, Circle, Trash2, Route } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, Campo, Input, Textarea, Toggle } from "@/components/ui/form";
import { EmptyState, Avatar, Progress } from "@/components/ui/misc";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao } from "@/lib/store";
import { useDominio, indiceNivel } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeVerDadosSensiveis, ehRH } from "@/lib/rbac";
import { formatBRL, formatPercent, tempoDeCasa } from "@/lib/format";
import type { EtapaEvolucao } from "@/data/types";

const CORES_NIVEL = ["#7ea4c6", "#4f7ea8", "#16334f", "#a9883a", "#c2a14d"];

export default function Carreira() {
  const sessao = useSessao();
  const d = useDominio();
  const drill = useDrill();
  const escopo = useMemo(() => colaboradoresVisiveis(sessao, d.colaboradores).filter((c) => !c.ehDirecao && c.cargoId), [sessao, d.colaboradores]);
  const [colabId, setColabId] = useState(() => (sessao?.perfil === "COLABORADOR" ? sessao.colaboradorId : escopo[0]?.id ?? ""));
  // Conjunto de cargos expandidos na tabela salarial (Módulo 3 — "Pessoas no cargo").
  const [cargosExpandidos, setCargosExpandidos] = useState<Set<string>>(() => new Set());

  // Ativos por nível (todos os cargos) — para os badges e o drill da régua.
  const ativosPorNivel = useMemo(() => {
    const m = new Map<string, import("@/data/types").Colaborador[]>();
    for (const c of d.ativos) {
      if (!c.nivelId) continue;
      const arr = m.get(c.nivelId) ?? [];
      arr.push(c);
      m.set(c.nivelId, arr);
    }
    return m;
  }, [d.ativos]);

  const colab = d.colabById.get(colabId);
  const cargo = colab?.cargoId ? d.cargoById.get(colab.cargoId) : undefined;
  const nivelAtual = indiceNivel(colab?.nivelId);
  const [nivelAlvo, setNivelAlvo] = useState(Math.min(5, Math.max(nivelAtual + 1, 2)));
  // Ao trocar o colaborador no simulador, o nível-alvo volta para "próximo nível"
  // (evita alvo defasado/abaixo do nível atual da nova pessoa).
  useEffect(() => {
    setNivelAlvo(Math.min(5, Math.max(nivelAtual + 1, 2)));
  }, [colabId, nivelAtual]);
  const podeVerSalario = colab ? podeVerDadosSensiveis(sessao, colab.id) : false;

  const valorAtualFaixa = cargo && nivelAtual ? cargo.faixas[nivelAtual - 1] : null;
  const valorAlvoFaixa = cargo ? cargo.faixas[nivelAlvo - 1] : null;
  const baseAtual = podeVerSalario && colab?.salario != null ? colab.salario : valorAtualFaixa;
  const delta = valorAlvoFaixa != null && baseAtual != null ? valorAlvoFaixa - baseAtual : null;
  const deltaPct = delta != null && baseAtual ? delta / baseAtual : null;

  const cargosPorArea = useMemo(() => {
    return d.areas
      .filter((a) => a.id !== "direcao")
      .map((a) => ({ area: a, cargos: d.cargos.filter((c) => c.areaId === a.id) }))
      .filter((g) => g.cargos.length > 0);
  }, [d.areas, d.cargos]);

  // ===== Trilha de evolução de cargo (gamificação, v3 item 11) =====
  // Reaproveita o `colabId` do simulador: o colaborador selecionado conduz a trilha.
  const ehRHFlag = ehRH(sessao);
  const toast = useToast();
  const { items: evolucao, criar: criarEtapa, atualizar: atualizarEtapa, remover: removerEtapa } = useColecao("evolucao");

  // Etapas do colaborador selecionado, ordenadas por `ordem`.
  const etapasColab = useMemo(
    () => evolucao.filter((e) => e.colaboradorId === colabId).sort((a, b) => a.ordem - b.ordem),
    [evolucao, colabId],
  );
  const totalEtapas = etapasColab.length;
  const concluidas = etapasColab.filter((e) => e.concluida).length;
  const pctEvolucao = totalEtapas > 0 ? (concluidas / totalEtapas) * 100 : 0;
  const trilhaCompleta = totalEtapas > 0 && concluidas === totalEtapas;
  // cargoAlvo de referência: o da última etapa que o definir (ou o nível seguinte do simulador).
  const cargoAlvoTrilha =
    [...etapasColab].reverse().find((e) => e.cargoAlvo)?.cargoAlvo ?? (cargo ? `N${nivelAlvo}` : undefined);
  // Cor da barra conforme a %: vermelho < 40, amarelo < 80, verde >= 80.
  const corBarra = pctEvolucao >= 80 ? "#16a34a" : pctEvolucao >= 40 ? "#d4a017" : "#dc2626";

  // Estado da UI de gestão da trilha (modal de criação + confirmação de exclusão).
  const [modalEtapaAberto, setModalEtapaAberto] = useState(false);
  const [formEtapa, setFormEtapa] = useState({ titulo: "", descricao: "", cargoAlvo: "" });
  const [etapaExcluir, setEtapaExcluir] = useState<EtapaEvolucao | null>(null);

  // LGPD: a área de Carreira e Salários é restrita ao RH / Gestor Principal.
  // (Todos os hooks acima já executaram antes deste retorno antecipado.)
  if (!ehRHFlag) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="A área de Carreira e Salários é restrita ao RH / Gestor Principal."
        icon={<Lock className="h-8 w-8" />}
      />
    );
  }

  // Abre o drill com os ativos de um cargo+nível específico.
  const abrirCargoNivel = (cargo: import("@/data/types").Cargo, nivelId: string) => {
    const lista = d.ativos.filter((c) => c.cargoId === cargo.id && c.nivelId === nivelId);
    drill.abrir(`${cargo.nome} · ${nivelId}`, lista, `${d.nomeNivel(nivelId)} — ${lista.length} colaborador(es) ativo(s)`);
  };
  // Abre o drill com todos os ativos de um cargo (todos os níveis).
  const abrirCargo = (cargo: import("@/data/types").Cargo) => {
    const lista = d.ativos.filter((c) => c.cargoId === cargo.id);
    drill.abrir(cargo.nome, lista, `${lista.length} colaborador(es) ativo(s) no cargo`);
  };
  // Alterna a expansão de um cargo para listar as pessoas reais enquadradas.
  const alternarCargo = (cargoId: string) => {
    setCargosExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(cargoId)) proximo.delete(cargoId);
      else proximo.add(cargoId);
      return proximo;
    });
  };

  // ===== Ações da trilha de evolução =====
  const alternarEtapa = (etapa: EtapaEvolucao) => {
    atualizarEtapa(etapa.id, { concluida: !etapa.concluida });
  };

  const salvarNovaEtapa = () => {
    if (!colabId || !formEtapa.titulo.trim()) {
      toast("Informe um título para a etapa.", "erro");
      return;
    }
    const proximaOrdem = etapasColab.length ? Math.max(...etapasColab.map((e) => e.ordem)) + 1 : 0;
    criarEtapa({
      colaboradorId: colabId,
      titulo: formEtapa.titulo.trim(),
      descricao: formEtapa.descricao.trim() || undefined,
      cargoAlvo: formEtapa.cargoAlvo.trim() || (cargo ? `N${nivelAlvo}` : undefined),
      concluida: false,
      ordem: proximaOrdem,
    });
    setFormEtapa({ titulo: "", descricao: "", cargoAlvo: "" });
    setModalEtapaAberto(false);
    toast("Etapa adicionada à trilha.");
  };

  // Cria uma trilha padrão (etapas iniciais) para colaboradores ainda sem trilha.
  const criarTrilhaPadrao = () => {
    if (!colabId) return;
    const alvo = cargo ? `N${nivelAlvo}` : undefined;
    const PADRAO = [
      "Domínio técnico consolidado no nível atual",
      "Bater as metas por 2 ciclos consecutivos",
      "Reduzir retrabalho ao alvo do cargo",
      "Conduzir um projeto/frente sem supervisão",
      "Apoiar e orientar um colega (mentoria)",
      "Avaliação de desempenho no limiar do próximo nível",
    ];
    PADRAO.forEach((titulo, i) => {
      criarEtapa({ colaboradorId: colabId, titulo, cargoAlvo: alvo, concluida: false, ordem: i });
    });
    toast("Trilha padrão criada.");
  };

  const confirmarExclusaoEtapa = () => {
    if (etapaExcluir) {
      removerEtapa(etapaExcluir.id);
      toast("Etapa removida da trilha.", "info");
    }
  };

  return (
    <div>
      <PageHeader title="Carreira e Salários" description="Régua de senioridade, tabela salarial por cargo e simulador de progressão." />

      {/* Régua de senioridade — clicável: abre os ativos do nível (todos os cargos) */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {d.niveis.map((n, i) => {
          const ativosNivel = ativosPorNivel.get(n.id) ?? [];
          return (
            <Card key={n.id} className="p-0">
              <button
                type="button"
                onClick={() => drill.abrir(`Nível ${n.codigo} · ${n.senioridade}`, ativosNivel, `${ativosNivel.length} colaborador(es) ativo(s) neste nível`)}
                className="group flex w-full flex-col p-4 text-left transition-colors hover:bg-slate-50/70"
                title={`Ver colaboradores no nível ${n.codigo}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: CORES_NIVEL[i] }}>{n.codigo}</span>
                  <Badge variant={n.senioridade === "Sênior" ? "gold" : n.senioridade === "Pleno" ? "info" : "neutral"}>{n.senioridade}</Badge>
                  <span className="ml-auto flex items-center gap-1 text-slate-300 transition-colors group-hover:text-brand">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 group-hover:bg-brand-50 group-hover:text-brand">{ativosNivel.length}</span>
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-xs leading-snug text-slate-500">{n.descricao}</p>
              </button>
            </Card>
          );
        })}
      </div>

      {/* Simulador */}
      <Card className="mb-6">
        <CardHeader title="Simulador de progressão" subtitle="Impacto salarial de subir de nível na faixa do cargo" icon={<Calculator className="h-[18px] w-[18px]" />} />
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block lg:col-span-2">
              <span className="label">Colaborador</span>
              <Select value={colabId} onChange={(e) => { setColabId(e.target.value); }}>
                {escopo.map((c) => <option key={c.id} value={c.id}>{c.nome} · {d.nomeCargo(c)}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="label">Nível atual</span>
              <div className="input flex items-center bg-slate-50 font-medium">{colab?.nivelId ?? "—"}</div>
            </label>
            <label className="block">
              <span className="label">Simular para</span>
              <Select value={nivelAlvo} onChange={(e) => setNivelAlvo(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((nv) => <option key={nv} value={nv}>N{nv}</option>)}
              </Select>
            </label>
          </div>

          {cargo ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{podeVerSalario ? "Base atual" : `Faixa N${nivelAtual}`}</p>
                <p className="mt-1 text-2xl font-semibold text-brand-ink">{baseAtual != null ? formatBRL(baseAtual) : "—"}</p>
                <p className="text-xs text-slate-400">{podeVerSalario && colab?.salario != null ? "Salário atual" : "Referência da faixa"}</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-400"><ArrowRight className="h-6 w-6" /></div>
              </div>
              <div className="rounded-xl border border-gold-200 bg-gold-50/50 p-4">
                <p className="text-xs uppercase tracking-wide text-gold-700">Faixa N{nivelAlvo}</p>
                <p className="mt-1 text-2xl font-semibold text-gold-700">{valorAlvoFaixa != null ? formatBRL(valorAlvoFaixa) : "—"}</p>
                {delta != null && (
                  <p className={`text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {delta >= 0 ? "+" : ""}{formatBRL(delta)} ({deltaPct != null ? formatPercent(deltaPct) : "—"})
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Selecione um colaborador com cargo definido.</p>
          )}
        </CardBody>
      </Card>

      {/* Trilha de evolução de cargo: gamificação (v3 item 11) */}
      <Card className="mb-6">
        <CardHeader
          title="Trilha de evolução de cargo"
          subtitle={`Etapas de evolução de ${colab ? colab.nome : "colaborador"}; a % evolui conforme você marca`}
          icon={<Route className="h-[18px] w-[18px]" />}
          action={
            ehRHFlag && colabId ? (
              <button
                type="button"
                className="btn-outline inline-flex items-center gap-1.5 text-sm"
                onClick={() => { setFormEtapa({ titulo: "", descricao: "", cargoAlvo: cargo ? `N${nivelAlvo}` : "" }); setModalEtapaAberto(true); }}
              >
                <Plus className="h-4 w-4" /> Adicionar etapa
              </button>
            ) : undefined
          }
        />
        <CardBody>
          {!colab ? (
            <p className="text-sm text-slate-400">Selecione um colaborador no simulador acima para ver a trilha de evolução.</p>
          ) : totalEtapas === 0 ? (
            <EmptyState
              title="Sem trilha de evolução"
              description={`${colab.nome} ainda não possui uma trilha. Crie a trilha padrão com etapas iniciais para começar a gamificação.`}
              icon={<Route className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-5">
              {/* Barra de progresso + destaque de promoção */}
              <div>
                <div className="mb-1.5 flex items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold tabular-nums" style={{ color: corBarra }}>{Math.round(pctEvolucao)}%</span>
                    <span className="text-xs text-slate-400">{concluidas} de {totalEtapas} etapa(s) concluída(s)</span>
                  </div>
                  {cargoAlvoTrilha && (
                    <Badge variant={trilhaCompleta ? "gold" : "info"}>Alvo: {cargoAlvoTrilha}</Badge>
                  )}
                </div>
                <Progress value={pctEvolucao} cor={corBarra} className="h-2.5" />
              </div>

              {trilhaCompleta && (
                <div className="flex items-center gap-3 rounded-xl border border-gold-200 bg-gold-50/60 px-4 py-3">
                  <Trophy className="h-7 w-7 shrink-0 text-gold-700" />
                  <div>
                    <p className="text-sm font-semibold text-gold-700">Pronto para promoção{cargoAlvoTrilha ? ` a ${cargoAlvoTrilha}` : ""}</p>
                    <p className="text-xs text-gold-700/80">Todas as etapas da trilha foram concluídas. Encaminhe ao comitê de carreira.</p>
                  </div>
                  <Medal className="ml-auto hidden h-6 w-6 shrink-0 text-gold-700 sm:block" />
                </div>
              )}

              {/* Lista de etapas */}
              <ul className="space-y-2">
                {etapasColab.map((etapa) => (
                  <li
                    key={etapa.id}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${etapa.concluida ? "border-green-200 bg-green-50/50" : "border-slate-200 bg-white"}`}
                  >
                    <button
                      type="button"
                      onClick={() => alternarEtapa(etapa)}
                      className="mt-0.5 shrink-0 transition-colors"
                      title={etapa.concluida ? "Marcar como pendente" : "Marcar como concluída"}
                      aria-pressed={etapa.concluida}
                    >
                      {etapa.concluida ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300 hover:text-brand" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${etapa.concluida ? "text-slate-500 line-through" : "text-slate-700"}`}>{etapa.titulo}</p>
                      {etapa.descricao && <p className="mt-0.5 text-xs text-slate-400">{etapa.descricao}</p>}
                      {etapa.cargoAlvo && <span className="mt-1 inline-block text-[11px] font-medium uppercase tracking-wide text-slate-400">Alvo: {etapa.cargoAlvo}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Toggle checked={etapa.concluida} onChange={() => alternarEtapa(etapa)} />
                      {ehRHFlag && (
                        <button
                          type="button"
                          onClick={() => setEtapaExcluir(etapa)}
                          className="text-slate-300 transition-colors hover:text-red-600"
                          title="Excluir etapa"
                          aria-label="Excluir etapa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ehRHFlag && colab && totalEtapas === 0 && (
            <div className="mt-4 flex justify-center">
              <button type="button" className="btn-primary inline-flex items-center gap-1.5" onClick={criarTrilhaPadrao}>
                <Plus className="h-4 w-4" /> Criar trilha padrão
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Tabela salarial */}
      <Card className="overflow-hidden">
        <CardHeader title="Tabela salarial por cargo" subtitle="Valores em R$ por nível (N1 → N5) — Plano de Carreira" icon={<GitBranch className="h-[18px] w-[18px]" />} />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-slate-100 bg-slate-50/50">
              <tr>
                <th className="th">Cargo</th>
                {["N1", "N2", "N3", "N4", "N5"].map((n) => <th key={n} className="th text-right">{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {cargosPorArea.map((g) => (
                <FragmentArea
                  key={g.area.id}
                  nome={g.area.nome}
                  cargos={g.cargos}
                  colabCargoId={cargo?.id}
                  ativos={d.ativos}
                  niveis={d.niveis}
                  expandidos={cargosExpandidos}
                  onToggle={alternarCargo}
                  onCargo={abrirCargo}
                  onCargoNivel={abrirCargoNivel}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <DrillModal {...drill.props} />

      {/* Modal: adicionar etapa à trilha de evolução */}
      <Modal
        aberto={modalEtapaAberto}
        onFechar={() => setModalEtapaAberto(false)}
        titulo="Adicionar etapa à trilha"
        descricao={colab ? `Nova etapa de evolução para ${colab.nome}` : undefined}
        rodape={
          <>
            <button className="btn-outline" onClick={() => setModalEtapaAberto(false)}>Cancelar</button>
            <button className="btn-primary" onClick={salvarNovaEtapa}>Adicionar</button>
          </>
        }
      >
        <div className="space-y-4">
          <Campo label="Título" obrigatorio>
            <Input
              value={formEtapa.titulo}
              onChange={(e) => setFormEtapa((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex.: Conduzir um projeto sem supervisão"
              autoFocus
            />
          </Campo>
          <Campo label="Descrição" hint="Opcional. Detalhe o que comprova a etapa.">
            <Textarea
              value={formEtapa.descricao}
              onChange={(e) => setFormEtapa((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Critério de conclusão, evidências esperadas..."
            />
          </Campo>
          <Campo label="Cargo/nível alvo" hint="Opcional. Para onde esta trilha leva (ex.: N3).">
            <Input
              value={formEtapa.cargoAlvo}
              onChange={(e) => setFormEtapa((f) => ({ ...f, cargoAlvo: e.target.value }))}
              placeholder={cargo ? `N${nivelAlvo}` : "Ex.: N3"}
            />
          </Campo>
        </div>
      </Modal>

      <ConfirmDialog
        aberto={etapaExcluir != null}
        onFechar={() => setEtapaExcluir(null)}
        onConfirmar={confirmarExclusaoEtapa}
        titulo="Excluir etapa"
        mensagem={etapaExcluir ? `Remover a etapa "${etapaExcluir.titulo}" da trilha de evolução? Esta ação não pode ser desfeita.` : ""}
      />
    </div>
  );
}

function FragmentArea({
  nome,
  cargos,
  colabCargoId,
  ativos,
  niveis,
  expandidos,
  onToggle,
  onCargo,
  onCargoNivel,
}: {
  nome: string;
  cargos: import("@/data/types").Cargo[];
  colabCargoId?: string;
  ativos: import("@/data/types").Colaborador[];
  niveis: import("@/data/types").Nivel[];
  expandidos: Set<string>;
  onToggle: (cargoId: string) => void;
  onCargo: (cargo: import("@/data/types").Cargo) => void;
  onCargoNivel: (cargo: import("@/data/types").Cargo, nivelId: string) => void;
}) {
  return (
    <>
      <tr className="bg-brand-50/40">
        <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand">{nome}</td>
      </tr>
      {cargos.map((c) => {
        const pessoas = ativos.filter((p) => p.cargoId === c.id);
        const aberto = expandidos.has(c.id);
        return (
          <FragmentCargo
            key={c.id}
            cargo={c}
            pessoas={pessoas}
            niveis={niveis}
            aberto={aberto}
            destacado={c.id === colabCargoId}
            onToggle={onToggle}
            onCargo={onCargo}
            onCargoNivel={onCargoNivel}
          />
        );
      })}
    </>
  );
}

function FragmentCargo({
  cargo,
  pessoas,
  niveis,
  aberto,
  destacado,
  onToggle,
  onCargo,
  onCargoNivel,
}: {
  cargo: import("@/data/types").Cargo;
  pessoas: import("@/data/types").Colaborador[];
  niveis: import("@/data/types").Nivel[];
  aberto: boolean;
  destacado: boolean;
  onToggle: (cargoId: string) => void;
  onCargo: (cargo: import("@/data/types").Cargo) => void;
  onCargoNivel: (cargo: import("@/data/types").Cargo, nivelId: string) => void;
}) {
  const Chevron = aberto ? ChevronDown : ChevronRight;
  return (
    <>
      <tr className={`border-b border-slate-50 ${destacado ? "bg-gold-50/40" : aberto ? "bg-slate-50/60" : "hover:bg-slate-50/50"}`}>
        <td className="td font-medium text-slate-700">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggle(cargo.id)}
              aria-expanded={aberto}
              className="flex shrink-0 items-center text-slate-400 transition-colors hover:text-brand"
              title={aberto ? `Recolher pessoas no cargo ${cargo.nome}` : `Ver pessoas no cargo ${cargo.nome}`}
            >
              <Chevron className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onCargo(cargo)}
              className="group inline-flex items-center gap-2 text-left font-medium text-slate-700 hover:text-brand"
              title={`Ver colaboradores no cargo ${cargo.nome}`}
            >
              {cargo.nome}
              {pessoas.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 transition-colors group-hover:bg-brand-50 group-hover:text-brand">{pessoas.length}</span>
              )}
            </button>
          </div>
        </td>
        {cargo.faixas.map((v, i) => (
          <td key={i} className="td p-0 text-right">
            <button
              type="button"
              onClick={() => onCargoNivel(cargo, `N${i + 1}`)}
              className="w-full px-4 py-3 text-right tabular-nums text-slate-600 transition-colors hover:bg-brand-50/50 hover:text-brand"
              title={`Ver colaboradores · ${cargo.nome} · N${i + 1}`}
            >
              {formatBRL(v)}
            </button>
          </td>
        ))}
      </tr>
      {aberto && (
        <tr className="border-b border-slate-100 bg-slate-50/40">
          <td colSpan={6} className="px-4 py-3 sm:px-6">
            {pessoas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum colaborador ativo enquadrado neste cargo.</p>
            ) : (
              <div className="space-y-3">
                {niveis.map((n) => {
                  const doNivel = pessoas.filter((p) => p.nivelId === n.id);
                  if (doNivel.length === 0) return null;
                  return (
                    <div key={n.id}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-brand">{n.codigo}</span>
                        <span className="text-xs text-slate-400">{n.senioridade} · {doNivel.length} pessoa(s)</span>
                      </div>
                      <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                        {doNivel.map((p) => (
                          <PessoaItem key={p.id} pessoa={p} cargo={cargo} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function PessoaItem({
  pessoa,
  cargo,
}: {
  pessoa: import("@/data/types").Colaborador;
  cargo: import("@/data/types").Cargo;
}) {
  const idx = indiceNivel(pessoa.nivelId);
  const faixa = idx > 0 ? cargo.faixas[idx - 1] : null;
  return (
    <li>
      <Link
        to={`/colaboradores/${pessoa.id}`}
        className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
        title={`Abrir ficha de ${pessoa.nome}`}
      >
        {pessoa.fotoDataUrl ? (
          <img src={pessoa.fotoDataUrl} alt={pessoa.nome} className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <Avatar nome={pessoa.nome} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-700 group-hover:text-brand">{pessoa.nome}</p>
          <p className="truncate text-xs text-slate-400">{tempoDeCasa(pessoa.dataInicioCargo)} no cargo</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold tabular-nums text-slate-600">{faixa != null ? formatBRL(faixa) : "—"}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{pessoa.nivelId ?? "—"}</p>
        </div>
      </Link>
    </li>
  );
}
