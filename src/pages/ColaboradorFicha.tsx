import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Pencil, UserMinus, FileText, Upload, ExternalLink, Trash2, Plus,
  IdCard, Briefcase, Palmtree, Target, History, Lock,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, Field, EmptyState, Progress } from "@/components/ui/misc";
import { Badge, DotBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { ColaboradorForm } from "@/components/colaboradores/colaborador-form";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio, senioridadeDe as senioridade } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { podeVerColaborador, podeVerDadosSensiveis, ehRH } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";
import { formatBRL, formatCPF, maskCPF, formatDate, tempoDeCasa } from "@/lib/format";
import { CATEGORIAS_DOCUMENTO, COR_POSICAO_FAIXA, JANELA_ALERTA_DIAS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";

const diasAte = (d?: string | null) => (d ? Math.round((new Date(d).getTime() - HOJE.getTime()) / 86400000) : NaN);

export default function ColaboradorFicha() {
  const { id = "" } = useParams();
  const sessao = useSessao();
  const d = useDominio();
  const c = d.colabById.get(id);
  const podeVer = podeVerColaborador(sessao, id, d.colaboradores);
  const sens = podeVerDadosSensiveis(sessao, id);

  useEffect(() => {
    if (podeVer && sens && sessao && sessao.colaboradorId !== id) {
      const nome = d.colabById.get(sessao.colaboradorId)?.nome ?? "Usuário";
      registrarAcesso(sessao, nome, { acao: "VISUALIZAR_DADOS_SENSIVEIS", recurso: "Colaborador:Ficha", colaboradorId: id, detalhe: c?.nome });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!c) return <EmptyState title="Colaborador não encontrado" />;
  if (!podeVer) {
    return <EmptyState title="Acesso restrito" description="Você não tem permissão para ver este colaborador." icon={<Lock className="h-8 w-8" />} />;
  }

  return <FichaConteudo c={c} sens={sens} podeEditar={ehRH(sessao)} />;
}

function FichaConteudo({ c, sens, podeEditar }: { c: import("@/data/types").Colaborador; sens: boolean; podeEditar: boolean }) {
  const d = useDominio();
  const [editar, setEditar] = useState(false);
  const [desligar, setDesligar] = useState(false);
  const cargo = c.cargoId ? d.cargoById.get(c.cargoId) : undefined;
  const enq = d.enquadrarColab(c);
  const corEnq = COR_POSICAO_FAIXA[enq];

  return (
    <div>
      <Link to="/colaboradores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Voltar para colaboradores
      </Link>

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
            <p className="mt-1 text-xs text-slate-400">{tempoDeCasa(c.dataAdmissao)} de casa · Admissão em {formatDate(c.dataAdmissao)}</p>
          </div>
          <div className="flex items-center gap-2">
            <DotBadge label={`Enquadramento: ${enq}`} cor={corEnq} />
            {podeEditar && (
              <>
                <button className="btn-outline" onClick={() => setEditar(true)}><Pencil className="h-4 w-4" /> Editar</button>
                {!c.dataDesligamento && !c.ehDirecao && (
                  <button className="btn-ghost text-red-600" onClick={() => setDesligar(true)}><UserMinus className="h-4 w-4" /> Desligar</button>
                )}
              </>
            )}
          </div>
        </CardBody>
      </Card>

      <Tabs
        abas={[
          { id: "dados", label: "Dados", icon: <IdCard className="h-4 w-4" />, conteudo: <AbaDados c={c} sens={sens} cargo={cargo} /> },
          { id: "docs", label: "Documentos", icon: <FileText className="h-4 w-4" />, conteudo: <AbaDocumentos colaboradorId={c.id} podeEditar={podeEditar} /> },
          { id: "ferias", label: "Férias", icon: <Palmtree className="h-4 w-4" />, conteudo: <AbaFerias colaboradorId={c.id} podeEditar={podeEditar} /> },
          { id: "desenv", label: "Desenvolvimento", icon: <Target className="h-4 w-4" />, conteudo: <AbaDesenvolvimento colaboradorId={c.id} /> },
          { id: "hist", label: "Histórico", icon: <History className="h-4 w-4" />, conteudo: <AbaHistorico colaboradorId={c.id} /> },
        ]}
      />

      {editar && <ColaboradorForm aberto={editar} onFechar={() => setEditar(false)} editar={c} />}
      <DesligarModal aberto={desligar} onFechar={() => setDesligar(false)} c={c} />
    </div>
  );
}

function AbaDados({ c, sens, cargo }: { c: import("@/data/types").Colaborador; sens: boolean; cargo?: import("@/data/types").Cargo }) {
  const d = useDominio();
  const faixa = d.faixaColab(c);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Dados pessoais" icon={<IdCard className="h-[18px] w-[18px]" />} />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="CPF" value={sens ? formatCPF(c.cpf) : maskCPF(c.cpf)} />
            <Field label="Nascimento" value={formatDate(c.dataNascimento)} />
            <Field label="E-mail" value={c.email} />
            <Field label="Telefone" value={c.telefone} />
            <Field label="Endereço" value={c.enderecoRua ? `${c.enderecoRua}, ${c.enderecoNumero ?? ""}` : "—"} className="col-span-2" />
            <Field label="Bairro" value={c.enderecoBairro} />
            <Field label="CEP" value={c.enderecoCep} />
            {sens && <Field label="Cônjuge" value={c.conjugeNome ?? "—"} />}
            {sens && <Field label="Filhos" value={c.qtdFilhos ?? 0} />}
          </dl>
          {!sens && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" /> Dados sensíveis ocultados (LGPD).
            </p>
          )}
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
            <Field label="Salário" value={sens ? formatBRL(c.salario) : "•••••"} />
            <Field label="Faixa do nível" value={faixa ? formatBRL(faixa) : "—"} />
            <Field label="Matrícula eSocial" value={sens ? c.matriculaEsocial : "•••"} />
            <Field label="Vale-transporte" value={c.valeTransporte ? "Sim" : "Não"} />
            <Field label="Enquadramento" value={<Badge variant={enqVar(d.enquadrarColab(c))}>{d.enquadrarColab(c)}</Badge>} />
            <Field label="Risco de saída" value={c.riscoSaida} />
          </dl>
          {cargo && (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Faixa salarial do cargo</p>
              <div className="mt-2 flex items-end justify-between gap-1">
                {cargo.faixas.map((v, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="text-[10px] text-slate-400">N{i + 1}</div>
                    <div className={`mt-0.5 rounded px-1 py-1 text-xs font-medium ${c.nivelId === `N${i + 1}` ? "bg-brand text-white" : "bg-white text-slate-600"}`}>
                      {formatBRL(v).replace("R$", "").trim()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function enqVar(e: string): "danger" | "warning" | "success" | "info" {
  return e === "Crítico" ? "danger" : e === "Abaixo" ? "warning" : e === "Acima" ? "info" : "success";
}

function AbaDocumentos({ colaboradorId, podeEditar }: { colaboradorId: string; podeEditar: boolean }) {
  const toast = useToast();
  const { items, criar, remover } = useColecao("documentos");
  const docs = items.filter((doc) => doc.colaboradorId === colaboradorId);
  const [novo, setNovo] = useState(false);

  const abrir = (dataUrl?: string | null) => {
    if (!dataUrl) {
      toast("Este registro não possui arquivo anexado.", "info");
      return;
    }
    const w = window.open();
    if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
  };

  return (
    <Card>
      <CardHeader
        title="Documentos do colaborador"
        subtitle="Contratos, ASO, exames e certificados. Clique para abrir em nova aba."
        action={podeEditar ? <button className="btn-outline" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Anexar</button> : undefined}
      />
      <CardBody>
        {docs.length === 0 ? (
          <EmptyState title="Nenhum documento" description="Anexe contratos, ASO e exames." icon={<FileText className="h-8 w-8" />} />
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const dd = diasAte(doc.dataVencimento);
              return (
                <div key={doc.id} className="flex items-center justify-between gap-3 py-3">
                  <button onClick={() => abrir(doc.arquivoDataUrl)} className="flex min-w-0 items-center gap-3 text-left">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand"><FileText className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                        {doc.nome} {doc.arquivoDataUrl && <ExternalLink className="h-3 w-3 text-slate-400" />}
                      </span>
                      <span className="text-xs text-slate-400">{doc.categoria} · emitido {formatDate(doc.dataEmissao)}</span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    {doc.dataVencimento && (
                      <Badge variant={dd < 0 ? "danger" : dd <= JANELA_ALERTA_DIAS ? "warning" : "neutral"}>
                        {dd < 0 ? `Vencido` : `Vence ${formatDate(doc.dataVencimento)}`}
                      </Badge>
                    )}
                    {podeEditar && (
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => remover(doc.id)}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
      {novo && <NovoDocumentoModal aberto={novo} onFechar={() => setNovo(false)} colaboradorId={colaboradorId} onCriar={criar} />}
    </Card>
  );
}

function NovoDocumentoModal({ aberto, onFechar, colaboradorId, onCriar }: { aberto: boolean; onFechar: () => void; colaboradorId: string; onCriar: (x: Record<string, unknown>) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<string>("Contrato");
  const [emissao, setEmissao] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string; tamanho: number } | null>(null);

  const onFile = (f: File) => {
    if (f.size > 2 * 1024 * 1024) {
      toast("Arquivo acima de 2 MB. Escolha um arquivo menor.", "erro");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setArquivo({ nome: f.name, dataUrl: String(reader.result), tamanho: f.size });
    reader.readAsDataURL(f);
  };

  const salvar = () => {
    if (!nome.trim()) return toast("Informe o nome do documento.", "erro");
    onCriar({
      colaboradorId, categoria, nome,
      arquivoNome: arquivo?.nome ?? null, arquivoDataUrl: arquivo?.dataUrl ?? null, tamanhoBytes: arquivo?.tamanho ?? null,
      dataEmissao: emissao || null, dataVencimento: vencimento || null, enviadoPor: "RH", criadoEm: new Date().toISOString(),
    });
    toast("Documento anexado.");
    onFechar();
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Anexar documento"
      descricao="O arquivo é guardado no navegador (até 2 MB) e abre em nova aba."
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Anexar</button></>}>
      <div className="space-y-3">
        <Campo label="Nome do documento" obrigatorio><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Contrato de Trabalho (CLT)" /></Campo>
        <Campo label="Categoria">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS_DOCUMENTO.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </Select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Emissão"><Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} /></Campo>
          <Campo label="Vencimento"><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Campo>
        </div>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button className="btn-outline w-full" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {arquivo ? arquivo.nome : "Selecionar arquivo (≤ 2 MB)"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AbaFerias({ colaboradorId, podeEditar }: { colaboradorId: string; podeEditar: boolean }) {
  const toast = useToast();
  const { items, criar } = useColecao("ferias");
  const lista = items.filter((f) => f.colaboradorId === colaboradorId);
  const adicionar = () => {
    criar({ colaboradorId, periodoAquisitivoInicio: "2025-06-01", periodoAquisitivoFim: "2026-05-31", diasGozados: 0, saldoDias: 30, status: "Em aberto" });
    toast("Período de férias adicionado.");
  };
  return (
    <Card>
      <CardHeader title="Férias" subtitle="Períodos aquisitivos, saldo e status" action={podeEditar ? <button className="btn-outline" onClick={adicionar}><Plus className="h-4 w-4" /> Novo período</button> : undefined} />
      <CardBody>
        {lista.length === 0 ? <EmptyState title="Sem registros de férias" /> : (
          <div className="space-y-3">
            {lista.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Período {formatDate(f.periodoAquisitivoInicio)} – {formatDate(f.periodoAquisitivoFim)}</p>
                  <p className="text-xs text-slate-400">{f.dataInicio ? `Gozo: ${formatDate(f.dataInicio)} → ${formatDate(f.dataRetorno)}` : "Sem gozo agendado"} · Saldo {f.saldoDias} dias</p>
                </div>
                <Badge variant={f.status === "Concluída" ? "neutral" : f.status === "Em andamento" ? "success" : f.status === "Agendada" ? "info" : "warning"}>{f.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function AbaDesenvolvimento({ colaboradorId }: { colaboradorId: string }) {
  const d = useDominio();
  const { items: metas } = useColecao("metas");
  const { items: pdis } = useColecao("pdis");
  const { items: feedbacks } = useColecao("feedbacks");
  const { items: avaliacoes } = useColecao("avaliacoes");
  const aval = avaliacoes.find((a) => a.colaboradorId === colaboradorId && a.tipo === "GESTOR");
  const minhasMetas = metas.filter((m) => m.colaboradorId === colaboradorId);
  const meusPdis = pdis.filter((p) => p.colaboradorId === colaboradorId);
  const meusFb = feedbacks.filter((f) => f.colaboradorId === colaboradorId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Avaliação de desempenho" subtitle="Ciclo 2026.1" />
        <CardBody>
          {aval ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Técnico</span><span className="font-medium">{aval.notaTecnico}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Comportamental</span><span className="font-medium">{aval.notaComportamental}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Resultado</span><span className="font-medium">{aval.notaResultado}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-medium text-slate-700">Nota final</span><Badge variant={aval.statusDesempenho === "Apto" ? "success" : aval.statusDesempenho === "Não apto" ? "danger" : "warning"}>{aval.notaFinal} · {aval.statusDesempenho}</Badge></div>
              {aval.elegivelPromocao && <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">Elegível → {aval.proximoNivel}</div>}
            </div>
          ) : <EmptyState title="Sem avaliação" />}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="PDI" subtitle="Plano de Desenvolvimento Individual" />
        <CardBody className="space-y-3">
          {meusPdis.length === 0 ? <EmptyState title="Sem PDI" /> : meusPdis.map((p) => (
            <div key={p.id}>
              <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-700">{p.competencia}</span><span className="text-slate-400">{p.progresso}%</span></div>
              <Progress value={p.progresso} />
              <p className="mt-1 text-xs text-slate-500">{p.acao} → {p.resultadoEsperado}</p>
            </div>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Metas" />
        <CardBody className="space-y-2">
          {minhasMetas.length === 0 ? <EmptyState title="Sem metas individuais" /> : minhasMetas.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm"><span className="text-slate-700">{m.titulo}</span><span className="text-slate-400">{m.valorAtual}/{m.valorAlvo}{m.unidade}</span></div>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Feedbacks" />
        <CardBody className="space-y-3">
          {meusFb.length === 0 ? <EmptyState title="Sem feedbacks" /> : meusFb.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-100 px-3 py-2">
              <div className="mb-1 flex items-center justify-between"><Badge variant={f.tipo === "Positivo" ? "success" : f.tipo === "Desenvolvimento" ? "warning" : "info"}>{f.tipo}</Badge><span className="text-xs text-slate-400">{d.nomeColab(f.autorId)}</span></div>
              <p className="text-sm text-slate-600">{f.conteudo}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function AbaHistorico({ colaboradorId }: { colaboradorId: string }) {
  const { items } = useColecao("movimentacoes");
  const lista = items.filter((m) => m.colaboradorId === colaboradorId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  return (
    <Card>
      <CardHeader title="Histórico de movimentações" icon={<History className="h-[18px] w-[18px]" />} />
      <CardBody>
        {lista.length === 0 ? <EmptyState title="Sem movimentações" /> : (
          <ol className="relative space-y-5 border-l border-slate-200 pl-6">
            {lista.map((m) => (
              <li key={m.id}>
                <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                <div className="flex items-center gap-2">
                  <Badge variant={m.tipo === "Promoção" ? "success" : m.tipo === "Admissão" ? "info" : "neutral"}>{m.tipo}</Badge>
                  <span className="text-xs text-slate-400">{formatDate(m.data)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{m.descricao}</p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function DesligarModal({ aberto, onFechar, c }: { aberto: boolean; onFechar: () => void; c: import("@/data/types").Colaborador }) {
  const toast = useToast();
  const { atualizar } = useColecao("colaboradores");
  const { criar: criarMov } = useColecao("movimentacoes");
  const [data, setData] = useState(HOJE.toISOString().slice(0, 10));
  const confirmar = () => {
    atualizar(c.id, { statusId: "inativo", dataDesligamento: data });
    criarMov({ colaboradorId: c.id, tipo: "Afastamento", data, descricao: "Desligamento registrado.", registradoPor: "RH" });
    toast(`${c.nome} foi desligado(a).`);
    onFechar();
  };
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Desligar colaborador" largura="max-w-md"
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-danger" onClick={confirmar}>Confirmar desligamento</button></>}>
      <p className="mb-3 text-sm text-slate-600">Registrar o desligamento de <strong>{c.nome}</strong>. O status passará para Inativo e sairá do headcount.</p>
      <Campo label="Data do desligamento"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
    </Modal>
  );
}
