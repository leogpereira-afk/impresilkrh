import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader, Card, CardHeader, CardBody, Badge, Field } from "@/components/ui";
import { formatBRL } from "@/lib/format";
import { Layers, GitBranch, Calculator, ArrowRight, TrendingUp } from "lucide-react";

export function Carreira() {
  const { db } = useStore();
  const { sessao } = useAuth();
  const meu = db.colaboradores.find((c) => c.id === sessao!.colaboradorId);
  const cargosComFaixa = db.cargos.filter((c) => c.faixas?.N1);
  const areaMap = new Map(db.areas.map((a) => [a.id, a.nome]));

  const porArea = useMemo(() => {
    const m = new Map<string, typeof cargosComFaixa>();
    for (const c of cargosComFaixa) {
      const a = areaMap.get(c.areaId) ?? "Outros";
      if (!m.has(a)) m.set(a, []);
      m.get(a)!.push(c);
    }
    return [...m.entries()];
  }, [db]);

  const [cargoId, setCargoId] = useState(meu?.cargoId && db.cargos.find((c) => c.id === meu.cargoId)?.faixas?.N1 ? meu.cargoId : cargosComFaixa[0]?.id);
  const [de, setDe] = useState(meu?.nivel ?? "N1");
  const [para, setPara] = useState("N3");
  const cargoSim = db.cargos.find((c) => c.id === cargoId);
  const vDe = cargoSim?.faixas[de] ?? 0;
  const vPara = cargoSim?.faixas[para] ?? 0;
  const delta = vPara - vDe;
  const pct = vDe ? (delta / vDe) * 100 : 0;

  return (
    <>
      <PageHeader title="Carreira e Salários" description="Régua de senioridade, faixas salariais e simulador" />

      <Card className="mb-6">
        <CardHeader title="Régua de senioridade" subtitle="Trilha N1 → N5" icon={<Layers className="h-4 w-4" />} />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {db.niveis.map((n) => (
              <div key={n.codigo} className="rounded-xl border border-slate-200 p-4 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{n.codigo}</div>
                <p className="text-sm font-semibold text-slate-800">{n.senioridade}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {meu && (
        <Card className="mb-6 border-gold-200 bg-gold-50/40">
          <CardHeader title="Minha posição" icon={<GitBranch className="h-4 w-4" />} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Cargo" value={db.cargos.find((c) => c.id === meu.cargoId)?.nome} />
              <Field label="Nível" value={meu.nivel} />
              <Field label="Salário" value={formatBRL(meu.salario)} />
              <Field label="Área" value={areaMap.get(meu.areaId ?? "")} />
            </dl>
          </CardBody>
        </Card>
      )}

      {cargoSim && (
        <Card className="mb-6">
          <CardHeader title="Simulador de progressão" subtitle="Impacto salarial de mudar de nível" icon={<Calculator className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className="label">Cargo</label><select className="input" value={cargoId} onChange={(e) => setCargoId(e.target.value)}>{cargosComFaixa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div><label className="label">Nível atual</label><select className="input" value={de} onChange={(e) => setDe(e.target.value)}>{db.niveis.map((n) => <option key={n.codigo} value={n.codigo}>{n.codigo} · {n.senioridade}</option>)}</select></div>
              <div><label className="label">Nível desejado</label><select className="input" value={para} onChange={(e) => setPara(e.target.value)}>{db.niveis.map((n) => <option key={n.codigo} value={n.codigo}>{n.codigo} · {n.senioridade}</option>)}</select></div>
            </div>
            <div className="flex items-center justify-center gap-4 rounded-xl bg-slate-50 p-5">
              <div className="text-center"><p className="text-xs uppercase text-slate-400">{de}</p><p className="text-lg font-semibold text-slate-700">{formatBRL(vDe)}</p></div>
              <ArrowRight className="h-5 w-5 text-slate-300" />
              <div className="text-center"><p className="text-xs uppercase text-gold-600">{para}</p><p className="text-lg font-semibold text-brand-ink">{formatBRL(vPara)}</p></div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-brand-ink px-5 py-4 text-white">
              <span className="flex items-center gap-2 text-sm text-slate-200"><TrendingUp className="h-5 w-5 text-gold-200" /> Variação</span>
              <div className="text-right"><p className="text-lg font-semibold">{delta >= 0 ? "+" : ""}{formatBRL(delta)}</p><Badge variant="gold">{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</Badge></div>
            </div>
          </CardBody>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tabela salarial por cargo</h2>
      {porArea.map(([area, lista]) => (
        <Card key={area} className="mb-4">
          <CardHeader title={area} icon={<GitBranch className="h-4 w-4" />} />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50"><th className="th">Cargo</th>{db.niveis.map((n) => <th key={n.codigo} className="th text-right">{n.codigo}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((c) => {
                  const meuCargo = meu?.cargoId === c.id;
                  return (
                    <tr key={c.id} className={meuCargo ? "bg-gold-50/50" : "hover:bg-slate-50/60"}>
                      <td className="td font-medium text-slate-800">{c.nome}{meuCargo && <Badge variant="gold" className="ml-2">Você</Badge>}</td>
                      {db.niveis.map((n) => {
                        const meuNivel = meuCargo && meu?.nivel === n.codigo;
                        return <td key={n.codigo} className={`td text-right tabular-nums ${meuNivel ? "font-bold text-brand" : "text-slate-600"}`}>{c.faixas[n.codigo] != null ? formatBRL(c.faixas[n.codigo]) : "—"}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}
    </>
  );
}
