import { useStore } from "@/lib/store";
import { useAuth, escopo } from "@/lib/auth";
import { PageHeader, Card, CardHeader, CardBody, Avatar, EmptyState } from "@/components/ui";
import { Link } from "react-router-dom";
import { Grid3x3 } from "lucide-react";

const NIVEIS = ["Alto", "Médio", "Baixo"];
const COR: Record<string, string> = { Alto: "#16a34a", Médio: "#d97706", Baixo: "#dc2626" };

export function Desempenho() {
  const { db } = useStore();
  const { sessao } = useAuth();
  const time = escopo(sessao!, db.colaboradores).filter((c) => db.statuses.find((s) => s.nome === c.status)?.ativo);

  function celula(pot: string, risco: string) {
    return time.filter((c) => (c.potencial ?? "Médio") === pot && (c.riscoSaida ?? "Baixo") === risco);
  }

  return (
    <>
      <PageHeader title="Desempenho e Retenção" description="Matriz potencial × risco de saída da equipe" />
      <Card>
        <CardHeader title="Matriz de Retenção (9-Box)" subtitle="Potencial (linhas) × Risco de saída (colunas)" icon={<Grid3x3 className="h-4 w-4" />} />
        <CardBody>
          {time.length === 0 ? <EmptyState title="Sem dados" /> : (
            <div className="flex gap-3">
              <div className="flex items-center"><span className="rotate-180 text-xs font-semibold uppercase tracking-wider text-slate-400 [writing-mode:vertical-rl]">Potencial →</span></div>
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-2">
                  {NIVEIS.map((pot) => NIVEIS.slice().reverse().map((risco) => {
                    const itens = celula(pot, risco);
                    return (
                      <div key={pot + risco} className="min-h-[110px] rounded-xl border border-slate-200 p-2.5" style={{ backgroundColor: COR[pot] + "0d" }}>
                        <p className="mb-2 text-[10px] font-semibold uppercase text-slate-400">Pot. {pot} · Risco {risco}</p>
                        <div className="flex flex-wrap gap-1">{itens.map((c) => <Link key={c.id} to={`/colaboradores/${c.id}`} title={c.nome}><Avatar nome={c.nome} size="sm" /></Link>)}</div>
                      </div>
                    );
                  }))}
                </div>
                <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">Risco de saída →</p>
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">Ajuste potencial e risco de cada pessoa no Painel de Controle (RH).</p>
        </CardBody>
      </Card>
    </>
  );
}
