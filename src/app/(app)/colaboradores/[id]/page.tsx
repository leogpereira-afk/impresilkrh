import { exigirSessao } from "@/lib/auth";
import { podeVerColaborador, podeVerDadosSensiveis, podeEditarColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, Field, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import {
  formatBRL,
  formatDate,
  formatCPF,
  maskCPF,
  tempoDeCasa,
} from "@/lib/format";
import { COR_RISCO, COR_POSICAO_FAIXA } from "@/lib/constants";
import {
  adicionarDocumento,
  removerDocumento,
  registrarFerias,
  registrarMovimentacao,
  logVisualizacaoSensivel,
} from "../actions";
import {
  FormDocumento,
  FormFerias,
  FormMovimentacao,
} from "@/components/colaboradores/detail-forms";
import {
  ArrowLeft,
  User,
  FileText,
  Palmtree,
  History,
  Mail,
  Phone,
  MapPin,
  Trash2,
  ShieldAlert,
  Briefcase,
} from "lucide-react";

export default async function ColaboradorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sessao = await exigirSessao();
  if (!(await podeVerColaborador(sessao, params.id))) redirect("/colaboradores");

  const c = await db.colaborador.findUnique({
    where: { id: params.id },
    include: {
      cargo: { include: { area: true } },
      nivel: true,
      area: true,
      status: true,
      gestor: { select: { id: true, nome: true, cargo: { select: { nome: true } } } },
      liderados: { select: { id: true, nome: true, cargo: { select: { nome: true } } } },
      documentos: { orderBy: { criadoEm: "desc" } },
      ferias: { orderBy: { dataInicio: "desc" } },
      movimentacoes: { orderBy: { data: "desc" } },
    },
  });

  if (!c) notFound();

  const verSensivel = podeVerDadosSensiveis(sessao, c.id);
  const podeEditar = podeEditarColaboradores(sessao);
  if (verSensivel) await logVisualizacaoSensivel(c.id);

  const hoje = new Date();

  const abaDados = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Dados pessoais" icon={<User className="h-4 w-4" />} />
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="Nome completo" value={c.nome} />
            <Field
              label={
                <span className="inline-flex items-center gap-1">
                  CPF {!verSensivel && <ShieldAlert className="h-3 w-3 text-amber-500" />}
                </span>
              }
              value={verSensivel ? formatCPF(c.cpf) : maskCPF(c.cpf)}
            />
            <Field
              label="E-mail"
              value={
                c.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {c.email}
                  </span>
                ) : "—"
              }
            />
            <Field
              label="Telefone"
              value={
                c.telefone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {verSensivel ? c.telefone : "•••••••••"}
                  </span>
                ) : "—"
              }
            />
            <Field label="Data de nascimento" value={verSensivel ? formatDate(c.dataNascimento) : "•••"} />
            <Field label="Data de admissão" value={formatDate(c.dataAdmissao)} />
            {verSensivel && (
              <>
                <Field
                  label="Endereço"
                  value={
                    c.enderecoRua ? (
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
                        {`${c.enderecoRua}, ${c.enderecoNumero ?? "s/n"} — ${c.enderecoBairro ?? ""}`}
                      </span>
                    ) : "—"
                  }
                />
                <Field label="Cônjuge" value={c.conjugeNome ?? "—"} />
                <Field label="Filhos" value={c.qtdFilhos} />
                <Field label="Vale-transporte" value={c.valeTransporte ? "Sim" : "Não"} />
              </>
            )}
          </dl>
          {!verSensivel && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-100">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Dados sensíveis ocultos conforme política de privacidade (LGPD). Apenas o RH e o próprio colaborador têm acesso completo.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Cargo e remuneração" icon={<Briefcase className="h-4 w-4" />} />
          <CardBody>
            <dl className="space-y-3">
              <Field label="Cargo" value={c.cargo?.nome} />
              <Field label="Área" value={c.area?.nome} />
              <Field label="Nível" value={c.nivel ? `${c.nivel.codigo} · ${c.nivel.senioridade}` : "—"} />
              <Field
                label="Salário"
                value={verSensivel ? formatBRL(c.salario) : "•••••"}
              />
              <Field
                label="Enquadramento"
                value={
                  c.posicaoFaixa ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: (COR_POSICAO_FAIXA[c.posicaoFaixa] ?? "#64748b") + "22",
                        color: COR_POSICAO_FAIXA[c.posicaoFaixa] ?? "#64748b",
                      }}
                    >
                      {c.posicaoFaixa}
                    </span>
                  ) : "—"
                }
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Hierarquia" />
          <CardBody className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reporta-se a</p>
              {c.gestor ? (
                <Link href={`/colaboradores/${c.gestor.id}`} className="mt-1 flex items-center gap-2 text-sm text-brand hover:underline">
                  <Avatar nome={c.gestor.nome} size="sm" />
                  {c.gestor.nome}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Sem gestor direto</p>
              )}
            </div>
            {c.liderados.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Lidera {c.liderados.length}
                </p>
                <div className="space-y-1">
                  {c.liderados.map((l) => (
                    <Link
                      key={l.id}
                      href={`/colaboradores/${l.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Avatar nome={l.nome} size="sm" />
                      <span className="truncate">{l.nome}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );

  const abaDocumentos = (
    <div className="space-y-4">
      {podeEditar && <FormDocumento colaboradorId={c.id} action={adicionarDocumento} />}
      {c.documentos.length === 0 ? (
        <EmptyState title="Nenhum documento cadastrado" icon={<FileText className="h-8 w-8" />} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="th">Documento</th>
                <th className="th hidden sm:table-cell">Categoria</th>
                <th className="th hidden md:table-cell">Emissão</th>
                <th className="th">Vencimento</th>
                {podeEditar && <th className="th" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.documentos.map((d) => {
                const vencido = d.dataVencimento && d.dataVencimento < hoje;
                return (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <p className="font-medium text-slate-800">{d.nome}</p>
                      {d.arquivoNome && <p className="text-xs text-slate-400">{d.arquivoNome}</p>}
                    </td>
                    <td className="td hidden sm:table-cell">
                      <Badge variant="neutral">{d.categoria}</Badge>
                    </td>
                    <td className="td hidden md:table-cell text-slate-600">{formatDate(d.dataEmissao)}</td>
                    <td className="td">
                      {d.dataVencimento ? (
                        <Badge variant={vencido ? "danger" : "success"}>
                          {formatDate(d.dataVencimento)}
                        </Badge>
                      ) : "—"}
                    </td>
                    {podeEditar && (
                      <td className="td text-right">
                        <form action={removerDocumento}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="colaboradorId" value={c.id} />
                          <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" title="Remover">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const abaFerias = (
    <div className="space-y-4">
      {podeEditar && <FormFerias colaboradorId={c.id} action={registrarFerias} />}
      {c.ferias.length === 0 ? (
        <EmptyState title="Sem registros de férias" icon={<Palmtree className="h-8 w-8" />} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="th">Período</th>
                <th className="th">Dias</th>
                <th className="th">Saldo</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.ferias.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/60">
                  <td className="td text-slate-700">
                    {formatDate(f.dataInicio)} — {formatDate(f.dataRetorno)}
                  </td>
                  <td className="td text-slate-600">{f.diasGozados}</td>
                  <td className="td text-slate-600">{f.saldoDias}</td>
                  <td className="td">
                    <Badge
                      variant={
                        f.status === "Concluída" ? "success"
                          : f.status === "Em andamento" ? "info"
                            : f.status === "Agendada" ? "gold" : "neutral"
                      }
                    >
                      {f.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const abaHistorico = (
    <div className="space-y-4">
      {podeEditar && <FormMovimentacao colaboradorId={c.id} action={registrarMovimentacao} />}
      {c.movimentacoes.length === 0 ? (
        <EmptyState title="Sem movimentações registradas" icon={<History className="h-8 w-8" />} />
      ) : (
        <div className="relative space-y-0 pl-6">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
          {c.movimentacoes.map((m) => (
            <div key={m.id} className="relative pb-5">
              <span className="absolute -left-[22px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand shadow" />
              <div className="flex items-center gap-2">
                <Badge variant="info">{m.tipo}</Badge>
                <span className="text-xs text-slate-400">{formatDate(m.data)}</span>
              </div>
              {m.descricao && <p className="mt-1 text-sm text-slate-700">{m.descricao}</p>}
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                {m.cargoNovo && <span>Cargo: <strong className="text-slate-700">{m.cargoNovo}</strong></span>}
                {m.nivelNovo && <span>Nível: <strong className="text-slate-700">{m.nivelNovo}</strong></span>}
                {m.salarioNovo != null && verSensivel && (
                  <span>Salário: <strong className="text-slate-700">{formatBRL(m.salarioNovo)}</strong></span>
                )}
              </div>
              {m.registradoPor && (
                <p className="mt-1 text-[11px] text-slate-400">Registrado por {m.registradoPor}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Link href="/colaboradores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Voltar para colaboradores
      </Link>

      {/* Cabeçalho do colaborador */}
      <div className="mb-6 flex flex-col items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <Avatar nome={c.nome} size="lg" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-brand-ink">{c.nome}</h1>
          <p className="text-sm text-slate-500">
            {c.cargo?.nome ?? "Sem cargo"} · {c.area?.nome ?? "Sem área"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {c.nivel && <Badge variant="info">{c.nivel.codigo} · {c.nivel.senioridade}</Badge>}
            {c.status && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: c.status.cor + "22", color: c.status.cor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.status.cor }} />
                {c.status.nome}
              </span>
            )}
            {c.dataAdmissao && (
              <Badge variant="neutral">{tempoDeCasa(c.dataAdmissao)} de casa</Badge>
            )}
            {c.riscoSaida && c.riscoSaida !== "Baixo" && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: (COR_RISCO[c.riscoSaida] ?? "#64748b") + "22", color: COR_RISCO[c.riscoSaida] ?? "#64748b" }}
              >
                Risco de saída: {c.riscoSaida}
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs
        abas={[
          { id: "dados", label: "Dados", icon: <User className="h-4 w-4" />, conteudo: abaDados },
          { id: "documentos", label: `Documentos (${c.documentos.length})`, icon: <FileText className="h-4 w-4" />, conteudo: abaDocumentos },
          { id: "ferias", label: "Férias", icon: <Palmtree className="h-4 w-4" />, conteudo: abaFerias },
          { id: "historico", label: "Histórico", icon: <History className="h-4 w-4" />, conteudo: abaHistorico },
        ]}
      />
    </>
  );
}
