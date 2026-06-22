import { exigirPerfil } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { maskCPF, formatDate, tempoDeCasa } from "@/lib/format";
import { PERFIS } from "@/lib/constants";
import Link from "next/link";
import { Users, UserPlus, Search, FileSpreadsheet } from "lucide-react";

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: { q?: string; area?: string; status?: string; nivel?: string };
}) {
  const sessao = await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);
  const escopo = await escopoColaboradores(sessao);

  const [areas, statuses, niveis] = await Promise.all([
    db.area.findMany({ orderBy: { nome: "asc" } }),
    db.statusColaborador.findMany({ orderBy: { ordem: "asc" } }),
    db.nivel.findMany({ orderBy: { ordem: "asc" } }),
  ]);

  const filtro: Record<string, unknown> = { ...escopo };
  if (searchParams.q) {
    filtro.nome = { contains: searchParams.q, mode: "insensitive" };
  }
  if (searchParams.area) filtro.areaId = searchParams.area;
  if (searchParams.status) filtro.statusId = searchParams.status;
  if (searchParams.nivel) filtro.nivelId = searchParams.nivel;

  const colaboradores = await db.colaborador.findMany({
    where: filtro,
    include: { cargo: true, area: true, nivel: true, status: true, gestor: { select: { nome: true } } },
    orderBy: { nome: "asc" },
  });

  const isRH = sessao.perfil === PERFIS.ADMIN_RH;

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description={`${colaboradores.length} pessoa${colaboradores.length !== 1 ? "s" : ""} encontrada${colaboradores.length !== 1 ? "s" : ""}`}
      >
        <a href="/colaboradores/export" className="btn-outline flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
        </a>
        {isRH && (
          <Link href="/colaboradores/novo" className="btn-primary flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Novo colaborador
          </Link>
        )}
      </PageHeader>

      {/* Filtros */}
      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Buscar por nome…"
            className="input pl-9 w-full"
          />
        </div>
        <select name="area" defaultValue={searchParams.area ?? ""} className="input w-auto">
          <option value="">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="input w-auto">
          <option value="">Todos os status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
        <select name="nivel" defaultValue={searchParams.nivel ?? ""} className="input w-auto">
          <option value="">Todos os níveis</option>
          {niveis.map((n) => (
            <option key={n.id} value={n.id}>{n.codigo} · {n.senioridade}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary">Filtrar</button>
        <Link href="/colaboradores" className="btn-outline">Limpar</Link>
      </form>

      {colaboradores.length === 0 ? (
        <EmptyState
          title="Nenhum colaborador encontrado"
          description="Tente ajustar os filtros de busca."
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="th">Nome</th>
                <th className="th hidden md:table-cell">Cargo / Área</th>
                <th className="th hidden lg:table-cell">Nível</th>
                <th className="th hidden lg:table-cell">Admissão</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colaboradores.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar nome={c.nome} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{c.nome}</p>
                        <p className="truncate text-xs text-slate-500">{c.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td hidden md:table-cell">
                    <p className="text-slate-700">{c.cargo?.nome ?? "—"}</p>
                    <p className="text-xs text-slate-500">{c.area?.nome ?? "—"}</p>
                  </td>
                  <td className="td hidden lg:table-cell">
                    {c.nivel ? (
                      <Badge variant="info">{c.nivel.codigo} · {c.nivel.senioridade}</Badge>
                    ) : "—"}
                  </td>
                  <td className="td hidden lg:table-cell text-slate-600">
                    {c.dataAdmissao ? (
                      <div>
                        <p>{formatDate(c.dataAdmissao)}</p>
                        <p className="text-xs text-slate-400">{tempoDeCasa(c.dataAdmissao)}</p>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="td">
                    {c.status ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: c.status.cor + "22", color: c.status.cor }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: c.status.cor }}
                        />
                        {c.status.nome}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="td text-right">
                    <Link
                      href={`/colaboradores/${c.id}`}
                      className="btn-outline text-xs px-2.5 py-1"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
