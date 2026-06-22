import { useMemo, useRef, useState } from "react";
import { Plane, Wallet, CalendarClock, MapPin, Plus, Trophy, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DotBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BarrasVerticais } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatBRL, formatDate, formatNumber } from "@/lib/format";
import { STATUS_VIAGEM, COR_STATUS_VIAGEM } from "@/lib/constants";
import { HOJE } from "@/data/_gen";

const noMesAtual = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getMonth() === HOJE.getMonth() && d.getFullYear() === HOJE.getFullYear();
};

interface FormViagem {
  colaboradorId: string;
  destino: string;
  dataInicio: string;
  dataFim: string;
  dias: string;
  valorDiaria: string;
  finalidade: string;
  status: string;
}

const FORM_VAZIO: FormViagem = {
  colaboradorId: "",
  destino: "",
  dataInicio: "",
  dataFim: "",
  dias: "",
  valorDiaria: "",
  finalidade: "",
  status: STATUS_VIAGEM[0],
};

export default function Viagens() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const drill = useDrill();
  const { items: viagens, criar, atualizar } = useColecao("viagens");

  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState<FormViagem>(FORM_VAZIO);
  const fileRef = useRef<HTMLInputElement>(null);

  const podeEditar = podeGerir(sessao);

  // Escopo: equipe de campo visível, sem direção e sem inativos.
  const escopo = useMemo(
    () =>
      colaboradoresVisiveis(sessao, d.colaboradores)
        .filter((c) => !c.ehDirecao && c.statusId !== "inativo"),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  const lista = useMemo(
    () =>
      viagens
        .filter((v) => idsEscopo.has(v.colaboradorId))
        .sort((a, b) => new Date(b.dataInicio).getTime() - new Date(a.dataInicio).getTime()),
    [viagens, idsEscopo],
  );

  const doMes = useMemo(() => lista.filter((v) => noMesAtual(v.dataInicio)), [lista]);
  const gastoMes = useMemo(() => doMes.reduce((acc, v) => acc + (v.valorTotal ?? 0), 0), [doMes]);
  const emAndamento = useMemo(() => lista.filter((v) => v.status === "Em andamento").length, [lista]);
  const planejadas = useMemo(() => lista.filter((v) => v.status === "Planejada").length, [lista]);

  // Gasto por colaborador (desconsidera viagens canceladas).
  const gastoPorColab = useMemo(() => {
    const mapa = new Map<string, number>();
    lista
      .filter((v) => v.status !== "Cancelada")
      .forEach((v) => mapa.set(v.colaboradorId, (mapa.get(v.colaboradorId) ?? 0) + (v.valorTotal ?? 0)));
    return [...mapa.entries()]
      .map(([id, valor]) => ({ nome: d.nomeColab(id).split(" ")[0], valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [lista, d]);

  // Ranking de quem mais viaja: nº de viagens, dias e R$ por colaborador (escopo).
  const ranking = useMemo(() => {
    const mapa = new Map<string, { viagens: number; dias: number; valor: number }>();
    lista.forEach((v) => {
      const atual = mapa.get(v.colaboradorId) ?? { viagens: 0, dias: 0, valor: 0 };
      atual.viagens += 1;
      atual.dias += v.dias ?? 0;
      atual.valor += v.valorTotal ?? 0;
      mapa.set(v.colaboradorId, atual);
    });
    return [...mapa.entries()]
      .map(([id, m]) => ({ id, nome: d.nomeColab(id), ...m }))
      .sort((a, b) => b.viagens - a.viagens || b.valor - a.valor);
  }, [lista, d]);

  const rankingChart = useMemo(
    () => ranking.slice(0, 8).map((r) => ({ nome: r.nome.split(" ")[0], valor: r.viagens })),
    [ranking],
  );

  // Drill-down: abre a ficha analítica de um colaborador a partir do ranking.
  const abrirDrillColab = (id: string) => {
    const c = d.colabById.get(id);
    if (c) drill.abrir(`Viagens de ${c.nome}`, [c], "Viagens registradas no escopo atual");
  };

  const setCampo = (campo: keyof FormViagem, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  // Importação de viagens via arquivo .json (gestores/RH). Arquitetura estática:
  // não há backend — os registros são criados localmente após resolução do colaborador.
  const importarViagens = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          toast("Arquivo inválido: esperado um array de viagens.", "erro");
          return;
        }
        const porNome = new Map(d.colaboradores.map((c) => [c.nome.trim().toLowerCase(), c]));
        let importadas = 0;
        let ignoradas = 0;
        for (const row of parsed) {
          if (!row || typeof row !== "object") {
            ignoradas++;
            continue;
          }
          const ref = String((row as { colaborador?: unknown }).colaborador ?? "").trim();
          const colab =
            d.colabById.get(ref) ?? porNome.get(ref.toLowerCase());
          const destino = String((row as { destino?: unknown }).destino ?? "").trim();
          const dias = Number((row as { dias?: unknown }).dias);
          const valorDiaria = Number((row as { valorDiaria?: unknown }).valorDiaria);
          if (!colab || !destino || !Number.isFinite(dias) || dias <= 0 || !Number.isFinite(valorDiaria) || valorDiaria < 0) {
            ignoradas++;
            continue;
          }
          const r = row as { dataInicio?: unknown; dataFim?: unknown; finalidade?: unknown; status?: unknown };
          const statusBruto = String(r.status ?? "").trim();
          const finalidade = String(r.finalidade ?? "").trim();
          criar({
            colaboradorId: colab.id,
            destino,
            dataInicio: r.dataInicio ? String(r.dataInicio) : "",
            dataFim: r.dataFim ? String(r.dataFim) : "",
            dias,
            valorDiaria,
            valorTotal: dias * valorDiaria,
            finalidade: finalidade || undefined,
            status: (STATUS_VIAGEM as readonly string[]).includes(statusBruto) ? statusBruto : STATUS_VIAGEM[0],
          });
          importadas++;
        }
        if (importadas === 0) {
          toast(`Nenhuma viagem importada. ${ignoradas} registro(s) ignorado(s).`, "erro");
        } else {
          toast(
            `${importadas} viagem(ns) importada(s)${ignoradas ? ` · ${ignoradas} ignorada(s)` : ""}.`,
          );
        }
      } catch {
        toast("Não foi possível ler o arquivo. Verifique se é um JSON válido.", "erro");
      }
    };
    reader.onerror = () => toast("Falha ao ler o arquivo.", "erro");
    reader.readAsText(file);
  };

  const resetForm = () => {
    setForm(FORM_VAZIO);
    setNovo(false);
  };

  const salvar = () => {
    const dias = Number(form.dias);
    const valorDiaria = Number(form.valorDiaria);
    if (!form.colaboradorId || !form.destino.trim() || !form.dataInicio || !form.dataFim) {
      toast("Preencha colaborador, destino e o período da viagem.", "erro");
      return;
    }
    if (!Number.isFinite(dias) || dias <= 0 || !Number.isFinite(valorDiaria) || valorDiaria < 0) {
      toast("Informe dias e valor da diária válidos.", "erro");
      return;
    }
    criar({
      colaboradorId: form.colaboradorId,
      destino: form.destino.trim(),
      dataInicio: new Date(`${form.dataInicio}T12:00:00`).toISOString(),
      dataFim: new Date(`${form.dataFim}T12:00:00`).toISOString(),
      dias,
      valorDiaria,
      valorTotal: dias * valorDiaria,
      finalidade: form.finalidade.trim() || undefined,
      status: form.status,
    });
    toast(`Viagem para ${form.destino.trim()} registrada.`);
    resetForm();
  };

  const totalGeral = lista.reduce((acc, v) => acc + (v.valorTotal ?? 0), 0);

  return (
    <div>
      <PageHeader title="Viagens e Diárias" description="Deslocamentos e custos de diárias da equipe de campo.">
        {podeEditar && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Nova viagem
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Viagens no mês" value={doMes.length} icon={<Plane className="h-5 w-5" />} accent="brand" hint="Iniciadas neste mês" />
        <StatCard label="Gasto no mês" value={formatBRL(gastoMes)} icon={<Wallet className="h-5 w-5" />} accent="gold" hint="Soma das diárias" />
        <StatCard label="Em andamento" value={emAndamento} icon={<MapPin className="h-5 w-5" />} accent="amber" hint="Equipe em campo" />
        <StatCard label="Planejadas" value={planejadas} icon={<CalendarClock className="h-5 w-5" />} accent="blue" hint="Aguardando início" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Gasto por colaborador" subtitle="Total de diárias por pessoa (exclui canceladas)" icon={<Wallet className="h-[18px] w-[18px]" />} />
        <CardBody>
          {gastoPorColab.length === 0 ? (
            <EmptyState title="Sem dados de gasto" description="Nenhuma viagem registrada no seu escopo." icon={<Wallet className="h-8 w-8" />} />
          ) : (
            <BarrasVerticais data={gastoPorColab} cor="#c2a14d" moeda />
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Ranking de viagens"
          subtitle="Quem mais se desloca: nº de viagens, dias e custo por colaborador"
          icon={<Trophy className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {ranking.length === 0 ? (
            <EmptyState title="Sem ranking disponível" description="Nenhuma viagem registrada no seu escopo." icon={<Trophy className="h-8 w-8" />} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Nº de viagens por colaborador</p>
                <BarrasVerticais data={rankingChart} cor="#16334f" onItemClick={(nome) => {
                  const alvo = ranking.find((r) => r.nome.split(" ")[0] === nome);
                  if (alvo) abrirDrillColab(alvo.id);
                }} />
              </div>
              <ol className="space-y-1">
                {ranking.map((r, i) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => abrirDrillColab(r.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                          (i === 0
                            ? "bg-gold/15 text-gold"
                            : i === 1
                              ? "bg-slate-200 text-slate-600"
                              : i === 2
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500")
                        }
                      >
                        {i + 1}º
                      </span>
                      <Avatar nome={r.nome} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{r.nome}</p>
                        <p className="text-xs text-slate-500">
                          {formatNumber(r.dias)} dia(s) · {formatBRL(r.valor)}
                        </p>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-slate-800">{r.viagens}</span>
                        <span className="text-[11px] text-slate-400">viagem(ns)</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Viagens e diárias"
          subtitle={`${lista.length} viagem(ns) · ${formatBRL(totalGeral)} no total`}
          icon={<Plane className="h-[18px] w-[18px]" />}
          action={
            podeEditar ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importarViagens(file);
                    e.target.value = "";
                  }}
                />
                <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Importar
                </button>
              </>
            ) : undefined
          }
        />
        {lista.length === 0 ? (
          <CardBody>
            <EmptyState title="Sem viagens registradas" description="Nenhuma viagem no seu escopo de acesso." icon={<Plane className="h-8 w-8" />} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th">Destino</th>
                  <th className="th hidden md:table-cell">Período</th>
                  <th className="th hidden sm:table-cell">Dias</th>
                  <th className="th hidden lg:table-cell">Diária</th>
                  <th className="th">Total</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((v) => (
                  <tr key={v.id} className="transition hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar nome={d.nomeColab(v.colaboradorId)} size="sm" />
                        <span className="font-medium text-slate-800">{d.nomeColab(v.colaboradorId)}</span>
                      </div>
                    </td>
                    <td className="td">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{v.destino}</p>
                        {v.finalidade && <p className="truncate text-xs text-slate-400">{v.finalidade}</p>}
                      </div>
                    </td>
                    <td className="td hidden md:table-cell text-slate-500">{formatDate(v.dataInicio)} – {formatDate(v.dataFim)}</td>
                    <td className="td hidden sm:table-cell text-slate-500">{formatNumber(v.dias)}</td>
                    <td className="td hidden lg:table-cell text-slate-500">{formatBRL(v.valorDiaria)}</td>
                    <td className="td font-medium text-slate-800">{formatBRL(v.valorTotal)}</td>
                    <td className="td">
                      {podeEditar ? (
                        <Select
                          value={v.status}
                          onChange={(e) => {
                            atualizar(v.id, { status: e.target.value });
                            toast(`Status atualizado para "${e.target.value}".`);
                          }}
                          className="h-8 py-0 text-xs"
                          aria-label={`Status da viagem para ${v.destino}`}
                        >
                          {STATUS_VIAGEM.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </Select>
                      ) : (
                        <DotBadge label={v.status} cor={COR_STATUS_VIAGEM[v.status] ?? "#64748b"} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {podeEditar && (
        <Modal
          aberto={novo}
          onFechar={resetForm}
          titulo="Nova viagem"
          descricao="Registre um deslocamento e o custo das diárias."
          rodape={
            <>
              <button className="btn-outline" onClick={resetForm}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}>
                <Plus className="h-4 w-4" /> Salvar
              </button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Colaborador" obrigatorio className="sm:col-span-2">
              <Select value={form.colaboradorId} onChange={(e) => setCampo("colaboradorId", e.target.value)}>
                <option value="">Selecione…</option>
                {escopo
                  .slice()
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
              </Select>
            </Campo>
            <Campo label="Destino" obrigatorio className="sm:col-span-2">
              <Input value={form.destino} onChange={(e) => setCampo("destino", e.target.value)} placeholder="Cidade/UF" />
            </Campo>
            <Campo label="Data de início" obrigatorio>
              <Input type="date" value={form.dataInicio} onChange={(e) => setCampo("dataInicio", e.target.value)} />
            </Campo>
            <Campo label="Data de término" obrigatorio>
              <Input type="date" value={form.dataFim} onChange={(e) => setCampo("dataFim", e.target.value)} />
            </Campo>
            <Campo label="Dias" obrigatorio>
              <Input type="number" min={1} value={form.dias} onChange={(e) => setCampo("dias", e.target.value)} placeholder="0" />
            </Campo>
            <Campo label="Valor da diária (R$)" obrigatorio>
              <Input type="number" min={0} step="0.01" value={form.valorDiaria} onChange={(e) => setCampo("valorDiaria", e.target.value)} placeholder="0,00" />
            </Campo>
            <Campo label="Finalidade" className="sm:col-span-2">
              <Input value={form.finalidade} onChange={(e) => setCampo("finalidade", e.target.value)} placeholder="Ex.: Instalação e montagem em campo" />
            </Campo>
            <Campo label="Status" className="sm:col-span-2">
              <Select value={form.status} onChange={(e) => setCampo("status", e.target.value)}>
                {STATUS_VIAGEM.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Campo>
            {Number(form.dias) > 0 && Number(form.valorDiaria) >= 0 && form.valorDiaria !== "" && (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Valor total estimado: <span className="font-medium text-slate-700">{formatBRL(Number(form.dias) * Number(form.valorDiaria))}</span>
              </p>
            )}
          </div>
        </Modal>
      )}

      <DrillModal
        {...drill.props}
        colunaExtra={{
          titulo: "Viagens",
          render: (c) => {
            const r = ranking.find((x) => x.id === c.id);
            return r ? (
              <span className="text-slate-600">
                {r.viagens} viagem(ns) · {formatNumber(r.dias)} dia(s) · {formatBRL(r.valor)}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            );
          },
        }}
      />
    </div>
  );
}
