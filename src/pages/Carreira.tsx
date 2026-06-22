import { useMemo, useState } from "react";
import { GitBranch, TrendingUp, ArrowRight, Calculator } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { useDominio, indiceNivel } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeVerDadosSensiveis } from "@/lib/rbac";
import { formatBRL, formatPercent } from "@/lib/format";

const CORES_NIVEL = ["#7ea4c6", "#4f7ea8", "#16334f", "#a9883a", "#c2a14d"];

export default function Carreira() {
  const sessao = useSessao();
  const d = useDominio();
  const escopo = useMemo(() => colaboradoresVisiveis(sessao, d.colaboradores).filter((c) => !c.ehDirecao && c.cargoId), [sessao, d.colaboradores]);
  const [colabId, setColabId] = useState(() => (sessao?.perfil === "COLABORADOR" ? sessao.colaboradorId : escopo[0]?.id ?? ""));

  const colab = d.colabById.get(colabId);
  const cargo = colab?.cargoId ? d.cargoById.get(colab.cargoId) : undefined;
  const nivelAtual = indiceNivel(colab?.nivelId);
  const [nivelAlvo, setNivelAlvo] = useState(Math.min(5, Math.max(nivelAtual + 1, 2)));
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

  return (
    <div>
      <PageHeader title="Carreira e Salários" description="Régua de senioridade, tabela salarial por cargo e simulador de progressão." />

      {/* Régua de senioridade */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {d.niveis.map((n, i) => (
          <Card key={n.id} className="p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: CORES_NIVEL[i] }}>{n.codigo}</span>
              <Badge variant={n.senioridade === "Sênior" ? "gold" : n.senioridade === "Pleno" ? "info" : "neutral"}>{n.senioridade}</Badge>
            </div>
            <p className="mt-2 text-xs leading-snug text-slate-500">{n.descricao}</p>
          </Card>
        ))}
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
                <FragmentArea key={g.area.id} nome={g.area.nome} cargos={g.cargos} colabCargoId={cargo?.id} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FragmentArea({ nome, cargos, colabCargoId }: { nome: string; cargos: import("@/data/types").Cargo[]; colabCargoId?: string }) {
  return (
    <>
      <tr className="bg-brand-50/40">
        <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand">{nome}</td>
      </tr>
      {cargos.map((c) => (
        <tr key={c.id} className={`border-b border-slate-50 ${c.id === colabCargoId ? "bg-gold-50/40" : "hover:bg-slate-50/50"}`}>
          <td className="td font-medium text-slate-700">{c.nome}</td>
          {c.faixas.map((v, i) => (
            <td key={i} className="td text-right tabular-nums text-slate-600">{formatBRL(v)}</td>
          ))}
        </tr>
      ))}
    </>
  );
}
