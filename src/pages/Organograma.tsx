import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useAuth, escopo, idsDaEquipe } from "@/lib/auth";
import { PageHeader, Card, CardBody, Avatar, EmptyState, Badge } from "@/components/ui";
import type { Colaborador } from "@/data/seed";
import { Network, SlidersHorizontal, Check, AlertTriangle } from "lucide-react";

function corNo(c: Colaborador, areaNome: string | undefined, temFilhos: boolean) {
  if (c.cargoId === "fundadora" || c.cargoId === "fundador") return "bg-green-600 text-white border-green-700";
  if (c.cargoId === "diretor") return "bg-brand-ink text-white border-brand-ink";
  if (areaNome === "Direção") return "bg-brand text-white border-brand";
  if (temFilhos) return "bg-teal-500 text-white border-teal-600";
  return "bg-white text-slate-800 border-slate-200";
}

function No({ c, todos, areaMap, cargoMap }: { c: Colaborador; todos: Colaborador[]; areaMap: Map<string, string>; cargoMap: Map<string, string> }) {
  const filhos = todos.filter((x) => x.gestorId === c.id);
  const cor = corNo(c, areaMap.get(c.areaId ?? ""), filhos.length > 0);
  const claro = cor.includes("text-white");
  return (
    <li>
      <Link to={`/colaboradores/${c.id}`} className={`node items-center gap-2 rounded-xl border px-3 py-2 shadow-soft transition hover:shadow-card ${cor}`}>
        <Avatar nome={c.nome} size="sm" className={claro ? "bg-white/20 text-white" : ""} />
        <div className="min-w-0 text-left">
          <p className="truncate text-xs font-semibold leading-tight">{c.nome}</p>
          <p className={`truncate text-[10px] leading-tight ${claro ? "text-white/70" : "text-slate-500"}`}>{cargoMap.get(c.cargoId ?? "") ?? "—"}</p>
        </div>
      </Link>
      {filhos.length > 0 && <ul>{filhos.map((f) => <No key={f.id} c={f} todos={todos} areaMap={areaMap} cargoMap={cargoMap} />)}</ul>}
    </li>
  );
}

export function Organograma() {
  const { db, setColecao } = useStore();
  const { sessao } = useAuth();
  const ehRH = sessao!.perfil === "ADMIN_RH";
  const [aba, setAba] = useState<"arvore" | "painel">("arvore");
  const [msg, setMsg] = useState<{ id: string; erro: boolean; txt: string } | null>(null);

  const nos = escopo(sessao!, db.colaboradores);
  const idsEscopo = new Set(nos.map((n) => n.id));
  const norm = nos.map((n) => ({ ...n, gestorId: n.gestorId && idsEscopo.has(n.gestorId) ? n.gestorId : null }));
  const raizes = norm.filter((n) => !n.gestorId);
  const areaMap = new Map(db.areas.map((a) => [a.id, a.nome]));
  const cargoMap = new Map(db.cargos.map((c) => [c.id, c.nome]));

  function definirGestor(colaboradorId: string, gestorId: string) {
    if (gestorId === colaboradorId) { setMsg({ id: colaboradorId, erro: true, txt: "Não pode ser o próprio gestor" }); return; }
    if (gestorId) {
      const sub = idsDaEquipe(colaboradorId, db.colaboradores);
      if (sub.has(gestorId)) { setMsg({ id: colaboradorId, erro: true, txt: "Criaria um ciclo" }); return; }
    }
    setColecao("colaboradores", db.colaboradores.map((c) => c.id === colaboradorId ? { ...c, gestorId: gestorId || null } : c));
    setMsg({ id: colaboradorId, erro: false, txt: "Salvo" });
    setTimeout(() => setMsg(null), 3000);
  }

  const arvore = (
    <Card><CardBody className="overflow-x-auto">
      {raizes.length === 0 ? <EmptyState title="Sem estrutura" icon={<Network className="h-8 w-8" />} />
        : <div className="tree"><ul>{raizes.map((r) => <No key={r.id} c={r} todos={norm} areaMap={areaMap} cargoMap={cargoMap} />)}</ul></div>}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-600" /> Fundadores</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand-ink" /> Diretor</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand" /> Assessorias</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-teal-500" /> Gestores</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-slate-300 bg-white" /> Equipe</span>
      </div>
    </CardBody></Card>
  );

  const ordenadas = [...nos].sort((a, b) => a.nome.localeCompare(b.nome));
  const painel = (
    <Card><CardBody className="p-0">
      <p className="px-5 py-3 text-xs text-slate-500">Defina a quem cada pessoa se reporta. Salva automaticamente; o sistema bloqueia ciclos.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-slate-100 bg-slate-50"><th className="th">Colaborador</th><th className="th">Reporta-se a</th><th className="th" /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {ordenadas.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/60">
              <td className="td"><div className="flex items-center gap-2.5"><Avatar nome={p.nome} size="sm" /><span className="font-medium text-slate-800">{p.nome}</span></div></td>
              <td className="td"><select defaultValue={p.gestorId ?? ""} onChange={(e) => definirGestor(p.id, e.target.value)} className="input max-w-xs">
                <option value="">— Sem gestor (topo) —</option>
                {ordenadas.filter((g) => g.id !== p.id).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select></td>
              <td className="td">{msg?.id === p.id && <span className={`inline-flex items-center gap-1 text-xs ${msg.erro ? "text-red-600" : "text-green-600"}`}>{msg.erro ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{msg.txt}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </CardBody></Card>
  );

  return (
    <>
      <PageHeader title="Organograma" description="Estrutura hierárquica da organização" />
      {ehRH && (
        <div className="mb-4 flex gap-1 border-b border-slate-200">
          <button onClick={() => setAba("arvore")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${aba === "arvore" ? "border-b-2 border-brand text-brand" : "text-slate-500"}`}><Network className="h-4 w-4" /> Organograma</button>
          <button onClick={() => setAba("painel")} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${aba === "painel" ? "border-b-2 border-brand text-brand" : "text-slate-500"}`}><SlidersHorizontal className="h-4 w-4" /> Painel de controle</button>
        </div>
      )}
      {aba === "arvore" || !ehRH ? arvore : painel}
    </>
  );
}
