import { exigirPerfil } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PERFIS, JANELA_ALERTA_DIAS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { HardHat, ShieldCheck, AlertTriangle, CalendarClock, FileWarning, Stethoscope } from "lucide-react";

const CATEGORIAS_SAUDE = ["ASO", "Exame Periódico"];

export default async function SstPage() {
  const sessao = await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);
  const escopo = await escopoColaboradores(sessao);
  const hoje = new Date();
  const janela = new Date();
  janela.setDate(janela.getDate() + JANELA_ALERTA_DIAS);

  const [docsSaude, institucionais] = await Promise.all([
    db.documento.findMany({
      where: {
        categoria: { in: CATEGORIAS_SAUDE },
        dataVencimento: { not: null },
        colaborador: escopo,
      },
      include: { colaborador: { select: { id: true, nome: true, cargo: { select: { nome: true } }, area: { select: { nome: true } } } } },
      orderBy: { dataVencimento: "asc" },
    }),
    db.documentoInstitucional.findMany({ where: { categoria: "SST" }, orderBy: { titulo: "asc" } }),
  ]);

  const vencidos = docsSaude.filter((d) => d.dataVencimento! < hoje);
  const aVencer = docsSaude.filter((d) => d.dataVencimento! >= hoje && d.dataVencimento! <= janela);
  const emDia = docsSaude.filter((d) => d.dataVencimento! > janela);

  function situacao(d: (typeof docsSaude)[number]) {
    if (d.dataVencimento! < hoje) return { label: "Vencido", variant: "danger" as const };
    if (d.dataVencimento! <= janela) return { label: "A vencer", variant: "warning" as const };
    return { label: "Em dia", variant: "success" as const };
  }

  // Prioriza vencidos e a vencer na listagem
  const prioritarios = [...vencidos, ...aVencer];

  return (
    <>
      <PageHeader
        title="Saúde e Segurança do Trabalho (SST)"
        description="Conformidade de exames ocupacionais e programas de segurança"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Exames vencidos" value={vencidos.length} icon={<AlertTriangle className="h-5 w-5" />} accent="red" hint="Ação imediata" />
        <StatCard label="A vencer (60 dias)" value={aVencer.length} icon={<CalendarClock className="h-5 w-5" />} accent="amber" />
        <StatCard label="Em dia" value={emDia.length} icon={<ShieldCheck className="h-5 w-5" />} accent="green" />
        <StatCard label="Programas SST" value={institucionais.length} icon={<HardHat className="h-5 w-5" />} accent="brand" hint="PGR, PCMSO…" />
      </div>

      {/* Exames ocupacionais */}
      <Card className="mb-6">
        <CardHeader
          title="Exames ocupacionais"
          subtitle="ASO e exames periódicos — priorizando vencidos e a vencer"
          icon={<Stethoscope className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          {docsSaude.length === 0 ? (
            <div className="p-5"><EmptyState title="Nenhum exame com vencimento cadastrado" icon={<FileWarning className="h-8 w-8" />} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="th">Colaborador</th>
                    <th className="th hidden md:table-cell">Área</th>
                    <th className="th">Exame</th>
                    <th className="th">Vencimento</th>
                    <th className="th">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(prioritarios.length ? prioritarios : docsSaude).map((d) => {
                    const s = situacao(d);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/60">
                        <td className="td">
                          <Link href={`/colaboradores/${d.colaborador.id}`} className="flex items-center gap-2.5">
                            <Avatar nome={d.colaborador.nome} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{d.colaborador.nome}</p>
                              <p className="truncate text-xs text-slate-500">{d.colaborador.cargo?.nome}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="td hidden md:table-cell text-slate-600">{d.colaborador.area?.nome ?? "—"}</td>
                        <td className="td"><Badge variant="neutral">{d.categoria}</Badge></td>
                        <td className="td text-slate-700">{formatDate(d.dataVencimento)}</td>
                        <td className="td"><Badge variant={s.variant}>{s.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Programas institucionais de SST */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <HardHat className="h-4 w-4 text-brand" /> Programas e documentos de SST
      </h2>
      {institucionais.length === 0 ? (
        <EmptyState title="Nenhum programa de SST cadastrado" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {institucionais.map((d) => (
            <Card key={d.id}>
              <CardBody>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-brand-ink">{d.titulo}</h3>
                  {d.versao && <Badge variant="gold">v{d.versao}</Badge>}
                </div>
                {d.descricao && <p className="text-sm text-slate-500">{d.descricao}</p>}
                <p className="mt-3 text-xs text-slate-400">Atualizado em {formatDate(d.atualizadoEm)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Os exames ocupacionais (ASO admissional, periódico, de retorno e demissional) e os programas PGR e PCMSO
        são obrigatórios pelas Normas Regulamentadoras. Mantenha os vencimentos em dia para garantir a conformidade.
      </p>
    </>
  );
}
