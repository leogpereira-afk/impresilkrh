import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Users, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { DotBadge, Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { ColaboradorForm } from "@/components/colaboradores/colaborador-form";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, ehRH } from "@/lib/rbac";
import { COR_POSICAO_FAIXA } from "@/lib/constants";
import { tempoDeCasa } from "@/lib/format";

const varianteEnq: Record<string, "danger" | "warning" | "success" | "info"> = {
  Crítico: "danger", Abaixo: "warning", Dentro: "success", Acima: "info",
};

export default function Colaboradores() {
  const sessao = useSessao();
  const d = useDominio();
  const [busca, setBusca] = useState("");
  const [fArea, setFArea] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [novo, setNovo] = useState(false);

  const escopo = useMemo(() => colaboradoresVisiveis(sessao, d.colaboradores), [sessao, d.colaboradores]);

  const lista = useMemo(() => {
    return escopo
      .filter((c) => !c.ehDirecao)
      .filter((c) => (fArea ? c.areaId === fArea : true))
      .filter((c) => (fStatus ? c.statusId === fStatus : true))
      .filter((c) => (busca ? c.nome.toLowerCase().includes(busca.toLowerCase()) || d.nomeCargo(c).toLowerCase().includes(busca.toLowerCase()) : true))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [escopo, fArea, fStatus, busca, d]);

  return (
    <div>
      <PageHeader title="Colaboradores" description={`${lista.length} colaborador(es) no seu escopo de acesso.`}>
        {ehRH(sessao) && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Novo colaborador
          </button>
        )}
      </PageHeader>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar por nome ou cargo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={fArea} onChange={(e) => setFArea(e.target.value)} className="sm:w-56">
            <option value="">Todas as áreas</option>
            {d.areas.filter((a) => a.id !== "direcao").map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="sm:w-44">
            <option value="">Todos os status</option>
            {d.status.filter((s) => s.id !== "direcao" && s.id !== "externo").map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </div>
      </Card>

      {lista.length === 0 ? (
        <EmptyState title="Nenhum colaborador encontrado" description="Ajuste a busca ou os filtros." icon={<Users className="h-8 w-8" />} />
      ) : (
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
      )}

      {novo && <ColaboradorForm aberto={novo} onFechar={() => setNovo(false)} />}
    </div>
  );
}
