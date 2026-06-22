import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useAuth, escopo } from "@/lib/auth";
import { PageHeader, Card, Avatar, Badge, EmptyState } from "@/components/ui";
import { Search, Users } from "lucide-react";

export function Colaboradores() {
  const { db } = useStore();
  const { sessao } = useAuth();
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");

  const areaMap = new Map(db.areas.map((a) => [a.id, a.nome]));
  const cargoMap = new Map(db.cargos.map((c) => [c.id, c.nome]));
  const statusCor = new Map(db.statuses.map((s) => [s.nome, s.cor]));

  const lista = useMemo(() => {
    let l = escopo(sessao!, db.colaboradores);
    if (q) l = l.filter((c) => c.nome.toLowerCase().includes(q.toLowerCase()));
    if (area) l = l.filter((c) => c.areaId === area);
    if (status) l = l.filter((c) => c.status === status);
    return [...l].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [db, sessao, q, area, status]);

  return (
    <>
      <PageHeader title="Colaboradores" description={`${lista.length} pessoa(s)`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome…" className="input pl-9" />
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="input w-auto">
          <option value="">Todas as áreas</option>
          {db.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
          <option value="">Todos os status</option>
          {db.statuses.map((s) => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
        </select>
      </div>

      {lista.length === 0 ? (
        <EmptyState title="Nenhum colaborador encontrado" icon={<Users className="h-8 w-8" />} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="th">Nome</th><th className="th hidden md:table-cell">Cargo / Área</th>
              <th className="th hidden lg:table-cell">Nível</th><th className="th">Status</th><th className="th" />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="td"><div className="flex items-center gap-3"><Avatar nome={c.nome} size="sm" />
                    <div className="min-w-0"><p className="truncate font-medium text-slate-800">{c.nome}</p>
                    <p className="truncate text-xs text-slate-500">{c.email}</p></div></div></td>
                  <td className="td hidden md:table-cell"><p className="text-slate-700">{cargoMap.get(c.cargoId ?? "") ?? "—"}</p>
                    <p className="text-xs text-slate-500">{areaMap.get(c.areaId ?? "") ?? "—"}</p></td>
                  <td className="td hidden lg:table-cell">{c.nivel ? <Badge variant="info">{c.nivel}</Badge> : "—"}</td>
                  <td className="td"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: (statusCor.get(c.status) ?? "#64748b") + "22", color: statusCor.get(c.status) ?? "#64748b" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusCor.get(c.status) ?? "#64748b" }} />{c.status}</span></td>
                  <td className="td text-right"><Link to={`/colaboradores/${c.id}`} className="btn-outline px-2.5 py-1 text-xs">Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
