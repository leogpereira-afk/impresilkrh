import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { FormAceite } from "@/components/aceites/form-aceite";
import { registrarAceite } from "./actions";
import { formatDate } from "@/lib/format";
import { ScrollText, CheckCircle2, Clock, FileSignature, ShieldCheck, Target } from "lucide-react";

export default async function AceitesPage() {
  const sessao = await exigirSessao();
  const ehRH = sessao.perfil === PERFIS.ADMIN_RH;

  // Documentos que exigem aceite (Código de Ética e políticas)
  const docsParaAceite = await db.documentoInstitucional.findMany({
    where: { categoria: "Código de Ética" },
    orderBy: { titulo: "asc" },
  });

  // ---------- Seção pessoal (qualquer colaborador) ----------
  let pessoal: React.ReactNode = null;
  if (sessao.colaboradorId) {
    const [aceites, pdis] = await Promise.all([
      db.aceite.findMany({ where: { colaboradorId: sessao.colaboradorId }, orderBy: { criadoEm: "desc" } }),
      db.pDI.findMany({ where: { colaboradorId: sessao.colaboradorId }, orderBy: { criadoEm: "desc" } }),
    ]);
    const aceitouDoc = (docId: string, versao: string | null) =>
      aceites.some((a) => a.tipo === "Código de Ética" && a.referencia === docId && a.versao === versao);
    const cientedoPdi = (pdiId: string) => aceites.some((a) => a.tipo === "PDI" && a.referencia === pdiId);

    pessoal = (
      <>
        <Card className="mb-6">
          <CardHeader title="Documentos e políticas" subtitle="Leitura e aceite eletrônico" icon={<ScrollText className="h-4 w-4" />} />
          <CardBody className="space-y-3">
            {docsParaAceite.length === 0 ? (
              <EmptyState title="Nenhum documento pendente de aceite" />
            ) : (
              docsParaAceite.map((d) => {
                const aceito = aceitouDoc(d.id, d.versao);
                return (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.titulo}{d.versao ? ` · v${d.versao}` : ""}</p>
                      {d.descricao && <p className="text-xs text-slate-500">{d.descricao}</p>}
                    </div>
                    {aceito ? (
                      <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Aceito</Badge>
                    ) : (
                      <FormAceite action={registrarAceite} tipo="Código de Ética" referencia={d.id} versao={d.versao} titulo={d.titulo} conteudo={d.conteudo} />
                    )}
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        {pdis.length > 0 && (
          <Card className="mb-6">
            <CardHeader title="Ciência do meu PDI" subtitle="Confirme que está ciente das ações do seu plano" icon={<Target className="h-4 w-4" />} />
            <CardBody className="space-y-3">
              {pdis.map((p) => {
                const ciente = cientedoPdi(p.id);
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.competencia}</p>
                      <p className="text-xs text-slate-500">{p.acao}</p>
                    </div>
                    {ciente ? (
                      <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Ciente</Badge>
                    ) : (
                      <FormAceite action={registrarAceite} tipo="PDI" referencia={p.id} titulo={`PDI — ${p.competencia}`} conteudo={`Ação: ${p.acao}\n${p.resultadoEsperado ? `Resultado esperado: ${p.resultadoEsperado}` : ""}`} />
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader title="Meu histórico de aceites" icon={<FileSignature className="h-4 w-4" />} />
          <CardBody className="p-0">
            {aceites.length === 0 ? (
              <div className="p-5"><EmptyState title="Nenhum aceite registrado" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="th">Documento</th>
                    <th className="th">Versão</th>
                    <th className="th">Data/Hora</th>
                    <th className="th hidden sm:table-cell">Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aceites.map((a) => (
                    <tr key={a.id}>
                      <td className="td font-medium text-slate-800">{a.tipo}</td>
                      <td className="td text-slate-600">{a.versao ?? "—"}</td>
                      <td className="td text-slate-600">{a.criadoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="td hidden sm:table-cell font-mono text-xs text-slate-400">{a.hashConteudo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </>
    );
  }

  // ---------- Seção de conformidade (RH) ----------
  let compliance: React.ReactNode = null;
  if (ehRH) {
    const ativos = await db.colaborador.findMany({
      where: { dataDesligamento: null, status: { contaComoAtivo: true } },
      select: { id: true, nome: true, cargo: { select: { nome: true } }, aceites: { where: { tipo: "Código de Ética" }, select: { criadoEm: true } } },
      orderBy: { nome: "asc" },
    });
    const aceitaram = ativos.filter((c) => c.aceites.length > 0);
    const pct = ativos.length ? Math.round((aceitaram.length / ativos.length) * 100) : 0;

    compliance = (
      <Card>
        <CardHeader
          title="Conformidade — Código de Ética"
          subtitle={`${aceitaram.length}/${ativos.length} colaboradores (${pct}%) com aceite registrado`}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="th">Colaborador</th>
                <th className="th">Situação</th>
                <th className="th">Data do aceite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ativos.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <Avatar nome={c.nome} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{c.nome}</p>
                        <p className="truncate text-xs text-slate-500">{c.cargo?.nome}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    {c.aceites.length > 0 ? (
                      <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Aceito</Badge>
                    ) : (
                      <Badge variant="warning"><Clock className="h-3 w-3" /> Pendente</Badge>
                    )}
                  </td>
                  <td className="td text-slate-600">
                    {c.aceites[0]?.criadoEm ? formatDate(c.aceites[0].criadoEm) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Termos e Aceites" description="Leitura e assinatura eletrônica de documentos e políticas" />
      {pessoal}
      {compliance}
      {!pessoal && !compliance && <EmptyState title="Nada por aqui" />}
    </>
  );
}
