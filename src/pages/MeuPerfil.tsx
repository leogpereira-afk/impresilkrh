import { Link, useSearchParams } from "react-router-dom";
import {
  IdCard, Briefcase, FileText, Palmtree, Target, FileSignature,
  ExternalLink, UserCircle, Wallet,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, Field, EmptyState, Progress } from "@/components/ui/misc";
import { Badge, DotBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { AbaFinanceiro } from "./ColaboradorFicha";
import { useColecao } from "@/lib/store";
import { getBlob } from "@/lib/blobstore";
import { useDominio, senioridadeDe as senioridade } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { formatBRL, formatCPF, formatDate, tempoDeCasa, parseData } from "@/lib/format";
import { COR_POSICAO_FAIXA, JANELA_ALERTA_DIAS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";
import type { Colaborador } from "@/data/types";

const diasAte = (d?: string | null) => {
  const dt = parseData(d);
  return dt ? Math.round((dt.getTime() - HOJE.getTime()) / 86400000) : NaN;
};

function enqVar(e: string): "danger" | "warning" | "success" | "info" {
  return e === "Crítico" ? "danger" : e === "Abaixo" ? "warning" : e === "Acima" ? "info" : "success";
}

export default function MeuPerfil() {
  const sessao = useSessao();
  const d = useDominio();
  const [params] = useSearchParams();
  const abaInicial = params.get("tab") ?? undefined; // ex.: vindo do "Meus ganhos" no painel
  const c = sessao ? d.colabById.get(sessao.colaboradorId) : undefined;

  if (!c) {
    return (
      <EmptyState
        title="Perfil indisponível"
        description="Não foi possível localizar os dados do seu cadastro."
        icon={<UserCircle className="h-8 w-8" />}
      />
    );
  }

  const enq = d.enquadrarColab(c);
  const corEnq = COR_POSICAO_FAIXA[enq];

  return (
    <div>
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar nome={c.nome} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-brand-ink">{c.nome}</h1>
              <DotBadge label={d.nomeStatus(c.statusId)} cor={d.corStatus(c.statusId)} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {d.nomeCargo(c)} · {d.nomeArea(c.areaId)} · Nível {d.nomeNivel(c.nivelId)} ({senioridade(c.nivelId)})
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {tempoDeCasa(c.dataAdmissao)} de casa · Admissão em {formatDate(c.dataAdmissao)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DotBadge label={`Enquadramento: ${enq}`} cor={corEnq} />
            <Link to="/aceites" className="btn-outline">
              <FileSignature className="h-4 w-4" /> Termos e aceites
            </Link>
          </div>
        </CardBody>
      </Card>

      <Tabs
        inicial={abaInicial}
        abas={[
          { id: "dados", label: "Dados", icon: <IdCard className="h-4 w-4" />, conteudo: <AbaDados c={c} /> },
          { id: "ganhos", label: "Meus ganhos", icon: <Wallet className="h-4 w-4" />, conteudo: <AbaFinanceiro c={c} sens /> },
          { id: "docs", label: "Meus documentos", icon: <FileText className="h-4 w-4" />, conteudo: <AbaDocumentos colaboradorId={c.id} /> },
          { id: "ferias", label: "Férias", icon: <Palmtree className="h-4 w-4" />, conteudo: <AbaFerias colaboradorId={c.id} /> },
          { id: "desenv", label: "Desenvolvimento", icon: <Target className="h-4 w-4" />, conteudo: <AbaDesenvolvimento colaboradorId={c.id} /> },
        ]}
      />
    </div>
  );
}

function AbaDados({ c }: { c: Colaborador }) {
  const d = useDominio();
  const faixa = d.faixaColab(c);
  const enq = d.enquadrarColab(c);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Dados pessoais" icon={<IdCard className="h-[18px] w-[18px]" />} />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="CPF" value={formatCPF(c.cpf)} />
            <Field label="Nascimento" value={formatDate(c.dataNascimento)} />
            <Field label="E-mail" value={c.email ?? "—"} className="col-span-2" />
            <Field label="Telefone" value={c.telefone ?? "—"} />
            <Field label="CEP" value={c.enderecoCep ?? "—"} />
            <Field
              label="Endereço"
              value={c.enderecoRua ? `${c.enderecoRua}, ${c.enderecoNumero ?? "s/n"}` : "—"}
              className="col-span-2"
            />
            <Field label="Bairro" value={c.enderecoBairro ?? "—"} />
            <Field label="Filhos" value={c.filhos?.length ?? c.qtdFilhos ?? 0} />
            <Field label="Cônjuge" value={c.conjugeNome ?? "—"} className="col-span-2" />
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            Estes são os seus dados pessoais. Para correções, procure o RH.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Dados profissionais" icon={<Briefcase className="h-[18px] w-[18px]" />} />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Cargo" value={d.nomeCargo(c)} />
            <Field label="Área" value={d.nomeArea(c.areaId)} />
            <Field label="Nível" value={`${d.nomeNivel(c.nivelId)} · ${senioridade(c.nivelId)}`} />
            <Field label="Gestor" value={d.nomeColab(c.gestorId)} />
            <Field label="Salário" value={formatBRL(c.salario)} />
            <Field label="Faixa do nível" value={faixa ? formatBRL(faixa) : "—"} />
            <Field label="Matrícula eSocial" value={c.matriculaEsocial ?? "—"} />
            <Field label="Vale-transporte" value={c.valeTransporte ? "Sim" : "Não"} />
            <Field
              label="Enquadramento"
              value={<Badge variant={enqVar(enq)}>{enq}</Badge>}
              className="col-span-2"
            />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function AbaDocumentos({ colaboradorId }: { colaboradorId: string }) {
  const { items } = useColecao("documentos");
  const docs = items.filter((doc) => doc.colaboradorId === colaboradorId);

  const abrir = async (doc: import("@/data/types").Documento) => {
    const dataUrl = doc.arquivoEmBlob ? await getBlob(`doc:${doc.id}`) : doc.arquivoDataUrl;
    if (!dataUrl) return;
    const w = window.open();
    if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
  };

  return (
    <Card>
      <CardHeader
        title="Meus documentos"
        subtitle="Contratos, ASO, exames e certificados. Somente leitura — geridos pelo RH."
      />
      <CardBody>
        {docs.length === 0 ? (
          <EmptyState title="Nenhum documento" description="Você ainda não possui documentos arquivados." icon={<FileText className="h-8 w-8" />} />
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const dd = diasAte(doc.dataVencimento);
              return (
                <div key={doc.id} className="flex items-center justify-between gap-3 py-3">
                  <button
                    onClick={() => abrir(doc)}
                    disabled={!doc.arquivoEmBlob && !doc.arquivoDataUrl}
                    className="flex min-w-0 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                        {doc.nome} {(doc.arquivoEmBlob || doc.arquivoDataUrl) && <ExternalLink className="h-3 w-3 text-slate-400" />}
                      </span>
                      <span className="text-xs text-slate-400">{doc.categoria} · emitido {formatDate(doc.dataEmissao)}</span>
                    </span>
                  </button>
                  {doc.dataVencimento && (
                    <Badge variant={dd < 0 ? "danger" : dd <= JANELA_ALERTA_DIAS ? "warning" : "neutral"}>
                      {dd < 0 ? "Vencido" : `Vence ${formatDate(doc.dataVencimento)}`}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function AbaFerias({ colaboradorId }: { colaboradorId: string }) {
  const { items } = useColecao("ferias");
  const lista = items.filter((f) => f.colaboradorId === colaboradorId);
  return (
    <Card>
      <CardHeader title="Minhas férias" subtitle="Períodos aquisitivos, saldo e status" />
      <CardBody>
        {lista.length === 0 ? (
          <EmptyState title="Sem registros de férias" />
        ) : (
          <div className="space-y-3">
            {lista.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Período {formatDate(f.periodoAquisitivoInicio)} – {formatDate(f.periodoAquisitivoFim)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {f.dataInicio ? `Gozo: ${formatDate(f.dataInicio)} → ${formatDate(f.dataRetorno)}` : "Sem gozo agendado"} · Saldo {f.saldoDias} dias
                  </p>
                </div>
                <Badge variant={f.status === "Concluída" ? "neutral" : f.status === "Em andamento" ? "success" : f.status === "Agendada" ? "info" : "warning"}>
                  {f.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function AbaDesenvolvimento({ colaboradorId }: { colaboradorId: string }) {
  const { items: avaliacoes } = useColecao("avaliacoes");
  const { items: pdis } = useColecao("pdis");
  const aval = avaliacoes.find((a) => a.colaboradorId === colaboradorId && a.tipo === "GESTOR");
  const meusPdis = pdis.filter((p) => p.colaboradorId === colaboradorId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Avaliação de desempenho" subtitle="Ciclo 2026.1" />
        <CardBody>
          {aval ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Técnico</span><span className="font-medium">{aval.notaTecnico ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Comportamental</span><span className="font-medium">{aval.notaComportamental ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Resultado</span><span className="font-medium">{aval.notaResultado ?? "—"}</span></div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="font-medium text-slate-700">Nota final</span>
                <Badge variant={aval.statusDesempenho === "Apto" ? "success" : aval.statusDesempenho === "Não apto" ? "danger" : "warning"}>
                  {aval.notaFinal ?? "—"} · {aval.statusDesempenho ?? "—"}
                </Badge>
              </div>
              {aval.elegivelPromocao && (
                <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">
                  Elegível para promoção → {aval.proximoNivel}
                </div>
              )}
              {aval.planoAcao && <p className="pt-1 text-xs text-slate-500">{aval.planoAcao}</p>}
            </div>
          ) : (
            <EmptyState title="Sem avaliação registrada" />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Meu PDI" subtitle="Plano de Desenvolvimento Individual" icon={<Target className="h-[18px] w-[18px]" />} />
        <CardBody className="space-y-3">
          {meusPdis.length === 0 ? (
            <EmptyState title="Nenhum PDI ativo" />
          ) : (
            meusPdis.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{p.competencia}</span>
                  <span className="text-slate-400">{p.progresso}%</span>
                </div>
                <Progress value={p.progresso} />
                <p className="mt-1 text-xs text-slate-500">{p.acao}{p.resultadoEsperado ? ` → ${p.resultadoEsperado}` : ""}</p>
              </div>
            ))
          )}
          <div className="pt-1">
            <Link to="/aceites" className="text-xs font-medium text-brand hover:underline">
              Dar ciência aos meus PDIs →
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
