import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Pencil, UserMinus, FileText, Upload, ExternalLink, Trash2, Plus,
  IdCard, Briefcase, Palmtree, Target, History, Lock, Cake, PartyPopper, Wallet, Brain, Smile, Activity, Camera,
  Eye, Ear, Hand, Plane,
} from "lucide-react";
import { Card, CardBody, CardHeader, SecaoColapsavel } from "@/components/ui/card";
import { Avatar, Field, EmptyState, Progress } from "@/components/ui/misc";
import { HumorIndicador, PerfilComportamentalBadge, MotivacaoRosto, PerfilComportamentalGuia } from "@/components/ui/indicadores";
import { DESC_PERFIL_COMPORTAMENTAL, COR_PERFIL_COMPORTAMENTAL, ARQUETIPOS } from "@/lib/constants";
import { Badge, DotBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { ColaboradorForm } from "@/components/colaboradores/colaborador-form";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio, senioridadeDe as senioridade } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { podeVerColaborador, podeVerDadosSensiveis, podeVerGestao, ehRH } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";
import { formatBRL, formatCPF, maskCPF, formatDate, tempoDeCasa, parseData } from "@/lib/format";
import { somaPorTipo, serieMensal, totalDe, competenciasDisponiveis, competenciaLabelLongo, corDoTipo } from "@/lib/folha";
import { comprimirImagem } from "@/lib/imagem";
import { putBlob, getBlob, delBlob } from "@/lib/blobstore";
import { BarrasVerticais } from "@/components/charts/charts";
import { CATEGORIAS_DOCUMENTO, COR_POSICAO_FAIXA, JANELA_ALERTA_DIAS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";

const diasAte = (d?: string | null) => { const dt = parseData(d); return dt ? Math.round((dt.getTime() - HOJE.getTime()) / 86400000) : NaN; };

// Idade em anos a partir de uma data de nascimento (ISO). Retorna null se ausente/inválida.
function idadeAnos(nascimento?: string | null): number | null {
  const n = parseData(nascimento);
  if (!n) return null;
  let anos = HOJE.getFullYear() - n.getFullYear();
  const m = HOJE.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && HOJE.getDate() < n.getDate())) anos -= 1;
  return anos < 0 ? 0 : anos;
}

// Selo compacto do estilo de aprendizagem (ícone + nome). Visual/Auditivo/Cinestésico.
const ICONE_ESTILO: Record<string, typeof Eye> = { Visual: Eye, Auditivo: Ear, Cinestésico: Hand, Cinestesico: Hand };
function EstiloAprendizagemBadge({ estilo }: { estilo?: string | null }) {
  if (!estilo) return <span className="text-xs text-slate-400">—</span>;
  const Icon = ICONE_ESTILO[estilo] ?? Brain;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700" title={`Estilo de aprendizagem: ${estilo}`}>
      <Icon className="h-4 w-4 text-brand" /> {estilo}
    </span>
  );
}

// Selo compacto do arquétipo (ícone + nome, na cor do perfil) — mesmo padrão.
function ArquetipoMini({ perfil }: { perfil?: string | null }) {
  if (!perfil) return <span className="text-xs text-slate-400">—</span>;
  const cor = COR_PERFIL_COMPORTAMENTAL[perfil] ?? "#64748b";
  const nome = ARQUETIPOS[perfil]?.arquetipo ?? perfil;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: cor }} title={`Arquétipo: ${nome}`}>
      <Brain className="h-4 w-4" /> {nome}
    </span>
  );
}

export default function ColaboradorFicha() {
  const { id = "" } = useParams();
  const sessao = useSessao();
  const d = useDominio();
  const c = d.colabById.get(id);
  const podeVer = podeVerColaborador(sessao, id, d.colaboradores);
  const sens = podeVerDadosSensiveis(sessao, id);
  const verGestao = podeVerGestao(sessao, id, d.colaboradores);

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

  return <FichaConteudo c={c} sens={sens} verGestao={verGestao} podeEditar={ehRH(sessao)} />;
}

function FichaConteudo({ c, sens, verGestao, podeEditar }: { c: import("@/data/types").Colaborador; sens: boolean; verGestao: boolean; podeEditar: boolean }) {
  const d = useDominio();
  const toast = useToast();
  const { atualizar } = useColecao("colaboradores");
  const fotoRef = useRef<HTMLInputElement>(null);
  const [editar, setEditar] = useState(false);
  const [desligar, setDesligar] = useState(false);
  const cargo = c.cargoId ? d.cargoById.get(c.cargoId) : undefined;
  const enq = d.enquadrarColab(c);
  const corEnq = COR_POSICAO_FAIXA[enq];
  const mesAtual = HOJE.getMonth();
  const nascDt = parseData(c.dataNascimento);
  const admDt = parseData(c.dataAdmissao);
  const aniversario = !!nascDt && nascDt.getMonth() === mesAtual;
  const diaAniv = nascDt ? nascDt.getDate() : null;
  const aniversarioEmpresa = !!admDt && admDt.getMonth() === mesAtual;
  const anosCasa = admDt ? HOJE.getFullYear() - admDt.getFullYear() : 0;

  const onFoto = async (f: File) => {
    if (!f.type.startsWith("image/")) {
      toast("Selecione um arquivo de imagem.", "erro");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast("Imagem muito grande. Escolha uma de até 8 MB.", "erro");
      return;
    }
    try {
      // Comprime para miniatura leve (~20 KB) antes de salvar — evita estourar o armazenamento.
      const thumb = await comprimirImagem(f);
      atualizar(c.id, { fotoDataUrl: thumb });
      toast("Foto atualizada.");
    } catch {
      toast("Não foi possível processar a imagem.", "erro");
    }
  };

  return (
    <div>
      <Link to="/colaboradores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Voltar para colaboradores
      </Link>

      {(aniversario || (aniversarioEmpresa && anosCasa > 0)) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {aniversario && (
            <div className="flex items-center gap-2 rounded-lg border border-gold-200 bg-gold-50/70 px-3 py-2 text-sm font-medium text-gold-700">
              <Cake className="h-4 w-4" /> Aniversário este mês{diaAniv ? ` · dia ${diaAniv}` : ""} 🎉
            </div>
          )}
          {aniversarioEmpresa && anosCasa > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-2 text-sm font-medium text-brand">
              <PartyPopper className="h-4 w-4" /> {anosCasa} {anosCasa === 1 ? "ano" : "anos"} de casa este mês
            </div>
          )}
        </div>
      )}

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-4">
          <div className="flex w-full min-w-0 items-center gap-4 sm:w-auto sm:min-w-[20rem] sm:flex-1">
          <div className="relative shrink-0">
            {c.fotoDataUrl ? (
              <img src={c.fotoDataUrl} alt={c.nome} className="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200" />
            ) : (
              <Avatar nome={c.nome} size="lg" />
            )}
            {podeEditar && (
              <>
                <input
                  ref={fotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) onFoto(e.target.files[0]); e.target.value = ""; }}
                />
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  title="Enviar foto"
                  aria-label="Enviar foto do colaborador"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-brand"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-brand-ink">{c.nome}</h1>
              <DotBadge label={d.nomeStatus(c.statusId)} cor={d.corStatus(c.statusId)} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {d.nomeCargo(c)} · {d.nomeArea(c.areaId)} · Nível {d.nomeNivel(c.nivelId)} ({senioridade(c.nivelId)})
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {tempoDeCasa(c.dataAdmissao)} de casa · Admissão em {formatDate(c.dataAdmissao)}
              {c.dataInicioCargo && <> · {tempoDeCasa(c.dataInicioCargo)} no cargo atual</>}
            </p>
          </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
            {verGestao && c.motivacao != null && (
              <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Motivação</span>
                <MotivacaoRosto score={c.motivacao} anterior={c.motivacaoAnterior} tamanho="lg" />
              </div>
            )}
            {verGestao && c.perfilComportamental && (
              <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Arquétipo</span>
                <ArquetipoMini perfil={c.perfilComportamental} />
              </div>
            )}
            {c.estiloAprendizagem && (
              <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Aprendizagem</span>
                <EstiloAprendizagemBadge estilo={c.estiloAprendizagem} />
              </div>
            )}
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
          { id: "financeiro", label: "Financeiro", icon: <Wallet className="h-4 w-4" />, conteudo: <AbaFinanceiro c={c} sens={sens} /> },
          ...(verGestao ? [{ id: "comportamental", label: "Comportamental", icon: <Brain className="h-4 w-4" />, conteudo: <AbaComportamental c={c} /> }] : []),
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
      <SecaoColapsavel title="Dados pessoais" icon={<IdCard className="h-[18px] w-[18px]" />}>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="CPF" value={sens ? formatCPF(c.cpf) : maskCPF(c.cpf)} />
            <Field label="Nascimento" value={formatDate(c.dataNascimento)} />
            <Field label="E-mail" value={c.email} />
            <Field label="Telefone" value={c.telefone} />
            <Field label="Endereço" value={c.enderecoRua ? (c.enderecoNumero ? `${c.enderecoRua}, ${c.enderecoNumero}` : c.enderecoRua) : "—"} className="col-span-2" />
            <Field label="Bairro" value={c.enderecoBairro} />
            <Field label="Cidade" value={c.cidade} />
            <Field label="CEP" value={c.enderecoCep} />
            {sens && <Field label="Cônjuge" value={c.conjugeNome ?? "—"} />}
            {sens && <Field label="Filhos" value={c.filhos?.length ?? c.qtdFilhos ?? 0} />}
          </dl>
          {sens && (c.filhos?.length ?? 0) > 0 && (
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Filhos</p>
              <ul className="mt-2 space-y-1">
                {c.filhos!.map((f, i) => {
                  const idade = idadeAnos(f.nascimento);
                  return (
                    <li key={i} className="flex items-center justify-between text-sm text-slate-600">
                      <span className="font-medium text-slate-700">{f.nome}</span>
                      <span className="text-xs text-slate-400">{idade != null ? `${idade} ${idade === 1 ? "ano" : "anos"}` : "idade não informada"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {sens && c.contatoEmergencia && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-red-700">Contato de emergência</p>
              <p className="mt-1.5 text-sm font-medium text-slate-700">{c.contatoEmergencia.nome} <span className="text-xs font-normal text-slate-400">({c.contatoEmergencia.parentesco})</span></p>
              <p className="text-sm text-slate-600">{c.contatoEmergencia.telefone}</p>
            </div>
          )}
          {!sens && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" /> Dados sensíveis ocultados (LGPD).
            </p>
          )}
      </SecaoColapsavel>

      <SecaoColapsavel title="Dados profissionais" icon={<Briefcase className="h-[18px] w-[18px]" />}>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Cargo" value={d.nomeCargo(c)} />
            <Field label="Área" value={d.nomeArea(c.areaId)} />
            <Field label="Subárea" value={d.subareaDe(c)} />
            <Field label="Nível" value={`${d.nomeNivel(c.nivelId)} · ${senioridade(c.nivelId)}`} />
            <Field label="Gestor" value={d.nomeColab(c.gestorId)} />
            <Field label="Salário" value={sens ? formatBRL(c.salario) : "•••••"} />
            <Field label="Faixa do nível" value={faixa ? formatBRL(faixa) : "—"} />
            <Field label="Matrícula eSocial" value={sens ? c.matriculaEsocial : "•••"} />
            <Field label="Vale-transporte" value={c.valeTransporte ? "Sim" : "Não"} />
            <Field label="Enquadramento" value={<Badge variant={enqVar(d.enquadrarColab(c))}>{d.enquadrarColab(c)}</Badge>} />
            <Field label="Risco de saída" value={c.riscoSaida} />
            <Field label="Categoria CNH" value={c.cnh ? c.cnh : "Não informado"} />
          </dl>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-100 bg-brand-50/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tempo no cargo atual</p>
              <p className="mt-1 text-lg font-semibold text-brand-ink">{tempoDeCasa(c.dataInicioCargo)}</p>
              {c.dataInicioCargo && <p className="text-xs text-slate-400">Desde {formatDate(c.dataInicioCargo)}</p>}
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tempo de casa</p>
              <p className="mt-1 text-lg font-semibold text-brand-ink">{tempoDeCasa(c.dataAdmissao)}</p>
              {c.dataAdmissao && <p className="text-xs text-slate-400">Admissão em {formatDate(c.dataAdmissao)}</p>}
            </div>
          </div>
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
      </SecaoColapsavel>

      <SecaoColapsavel className="lg:col-span-2" title="Clima & estilo" subtitle="Engajamento, estilo de aprendizagem e enquadramento na empresa" icon={<Smile className="h-[18px] w-[18px]" />}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Humor / engajamento</p>
              <div className="mt-1.5"><HumorIndicador humor={c.humor} tamanho="lg" /></div>
            </div>
            <Field label="Estilo de aprendizagem" value={c.estiloAprendizagem} />
            <Field label="Empresa" value={c.empresa} />
            <Field label="Sexo" value={c.sexo} />
          </div>
      </SecaoColapsavel>
    </div>
  );
}

function AbaComportamental({ c }: { c: import("@/data/types").Colaborador }) {
  const score = c.motivacao;
  const tem = score != null;
  const delta = tem && c.motivacaoAnterior != null ? score! - c.motivacaoAnterior : null;
  const tendTexto =
    delta == null ? "Sem registro anterior para comparar."
    : delta > 2 ? `Em alta · ${delta} pontos acima da medição anterior.`
    : delta < -2 ? `Em queda · ${Math.abs(delta)} pontos abaixo da medição anterior.`
    : "Estável em relação à medição anterior.";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SecaoColapsavel
        className="lg:col-span-2"
        title="Perfil comportamental"
        subtitle="Mapeamento de temperamento e guia prático de gestão (uso interno)"
        icon={<Brain className="h-[18px] w-[18px]" />}
        action={c.perfilComportamental ? <PerfilComportamentalBadge perfil={c.perfilComportamental} /> : undefined}
      >
          <PerfilComportamentalGuia perfil={c.perfilComportamental} />
          {c.perfilComportamental && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <Link
                to={`/comportamental?perfil=${encodeURIComponent(c.perfilComportamental)}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                <Brain className="h-4 w-4" /> Como lidar com este perfil — abrir no Guia Comportamental
              </Link>
            </div>
          )}
      </SecaoColapsavel>

      <SecaoColapsavel title="Motivação" subtitle="Indicador de engajamento (0 a 100)" icon={<Activity className="h-[18px] w-[18px]" />}>
          {tem ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-5">
                <MotivacaoRosto score={score} anterior={c.motivacaoAnterior} tamanho="lg" />
                <p className="text-xs text-slate-500">Medição atual</p>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Nível de motivação</span>
                  <span className="font-medium text-slate-600">{score ?? 0}/100</span>
                </div>
                <Progress value={score ?? 0} />
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {tendTexto}
                {c.humor && <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">Clima atual: <HumorIndicador humor={c.humor} tamanho="sm" /></p>}
              </div>
            </div>
          ) : (
            <EmptyState title="Motivação não informada" description="Ainda não há medição de motivação para este colaborador." icon={<Activity className="h-8 w-8" />} />
          )}
      </SecaoColapsavel>

      {c.perfilComportamental && (
        <Card className="lg:col-span-3">
          <CardBody>
            <p className="flex items-start gap-2 text-xs text-slate-400">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Informação restrita à gestão. Perfil comportamental e motivação destinam-se ao RH e ao gestor da área para apoiar a liderança, e não são exibidos ao próprio colaborador. {DESC_PERFIL_COMPORTAMENTAL[c.perfilComportamental]}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export function AbaFinanceiro({ c, sens }: { c: import("@/data/types").Colaborador; sens: boolean }) {
  const { items: pagamentos } = useColecao("pagamentos");
  const { items: viagens } = useColecao("viagens");
  const d = useDominio();
  const toast = useToast();
  const meus = useMemo(() => pagamentos.filter((p) => p.colaboradorId === c.id), [pagamentos, c.id]);
  // Competências disponíveis, da mais recente para a mais antiga.
  const comps = useMemo(() => competenciasDisponiveis(meus).slice().reverse(), [meus]);
  const [comp, setComp] = useState<string>("");
  const compSel = comp || comps[0] || "";

  if (!sens) {
    return <EmptyState title="Informação restrita" description="Os dados financeiros do colaborador são visíveis apenas para o RH e para o próprio colaborador (LGPD)." icon={<Lock className="h-8 w-8" />} />;
  }

  const salarioRef = c.salario ?? 0;
  if (meus.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState title="Sem pagamentos registrados" description="Ainda não há extrato de folha real para este colaborador. O salário de referência do cadastro é exibido abaixo." icon={<Wallet className="h-8 w-8" />} />
        <Card className="max-w-xs"><CardBody><p className="text-xs uppercase tracking-wide text-slate-400">Salário de referência (cadastro)</p><p className="mt-1 text-2xl font-semibold text-brand-ink">{formatBRL(salarioRef)}</p></CardBody></Card>
      </div>
    );
  }

  const doMes = meus.filter((p) => p.competencia === compSel).slice().sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento));
  const porTipo = somaPorTipo(doMes);
  const totalMes = totalDe(doMes);
  const serie = serieMensal(meus); // total recebido por competência
  const mediaMensal = comps.length ? totalDe(meus) / comps.length : 0;
  const tiposMes = new Set(doMes.map((p) => p.tipo));
  const parcial = !tiposMes.has("Salário") || !tiposMes.has("Adiantamento");

  // --- Resumo anual: TUDO que o colaborador ganhou no ano (todos os tipos) ---
  const anos = useMemo(() => {
    const s = new Set<string>();
    for (const p of meus) s.add(p.competencia.slice(0, 4));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [meus]);
  const [ano, setAno] = useState<string>("");
  const anoSel = ano || anos[0] || String(HOJE.getFullYear());
  const doAno = useMemo(() => meus.filter((p) => p.competencia.startsWith(anoSel)), [meus, anoSel]);
  const porTipoAno = useMemo(() => somaPorTipo(doAno), [doAno]);
  const totalAno = totalDe(doAno);
  const mesesNoAno = new Set(doAno.map((p) => p.competencia)).size;
  const mediaMesAno = mesesNoAno ? totalAno / mesesNoAno : 0;
  const serieAno = serie.filter((s) => s.competencia.startsWith(anoSel));

  // Diárias de viagem do ano — também compõem o que o colaborador recebe.
  const diariasAno = useMemo(
    () => viagens
      .filter((v) => v.colaboradorId === c.id && v.status !== "Cancelada" && parseData(v.dataInicio)?.getFullYear() === Number(anoSel))
      .reduce((a, v) => a + (v.valorTotal ?? 0), 0),
    [viagens, c.id, anoSel],
  );
  const totalComDiarias = totalAno + diariasAno;

  const cargoNome = d.nomeCargo(c);
  const areaNome = d.nomeArea(c.areaId);

  // Gera um demonstrativo anual limpo e imprime/salva em PDF (abre nova aba).
  const gerarRelatorio = () => {
    const esc = (s: string) => s.replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[x] ?? x));
    const linhasTipo = porTipoAno
      .map((t) => `<tr><td>${esc(t.tipo)}</td><td class="r">${formatBRL(t.valor)}</td><td class="r">${totalAno ? Math.round((t.valor / totalAno) * 100) : 0}%</td></tr>`)
      .join("");
    const linhasMes = serieAno
      .map((m) => `<tr><td>${esc(m.nome)}</td><td class="r">${formatBRL(m.valor)}</td></tr>`)
      .join("");
    const hoje = new Date().toLocaleDateString("pt-BR");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Demonstrativo de ganhos — ${esc(c.nome)} — ${anoSel}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1e293b;margin:0;padding:40px;max-width:820px;margin:0 auto}
  h1{font-size:18px;margin:0;color:#16334f} .sub{color:#64748b;font-size:12px;margin:2px 0 0}
  .cab{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16334f;padding-bottom:14px;margin-bottom:18px}
  .pessoa{margin:14px 0 6px} .pessoa b{font-size:15px}
  .total{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 18px;margin:16px 0}
  .total .lab{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#15803d}
  .total .val{font-size:30px;font-weight:700;color:#15803d;margin-top:2px}
  .total .meta{font-size:12px;color:#64748b;margin-top:4px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#16334f;margin:22px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px} th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
  th{font-size:11px;text-transform:uppercase;color:#64748b;background:#f8fafc} td.r,th.r{text-align:right}
  tfoot td{font-weight:700;border-top:2px solid #cbd5e1;border-bottom:none}
  .rodape{margin-top:26px;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:0}}
</style></head><body>
  <div class="cab">
    <div><h1>Impresilk Soluções Visuais</h1><p class="sub">Demonstrativo de ganhos · ${anoSel}</p></div>
    <div class="sub" style="text-align:right">Emitido em ${hoje}</div>
  </div>
  <div class="pessoa"><b>${esc(c.nome)}</b><p class="sub">${esc(cargoNome)} · ${esc(areaNome)}</p></div>
  <div class="total"><div class="lab">Total recebido em ${anoSel}</div><div class="val">${formatBRL(totalAno)}</div>
    <div class="meta">Média de ${formatBRL(mediaMesAno)} por mês · ${mesesNoAno} mês(es) com pagamento</div></div>
  <h2>Ganhos por tipo</h2>
  <table><thead><tr><th>Tipo</th><th class="r">Valor no ano</th><th class="r">%</th></tr></thead>
    <tbody>${linhasTipo}</tbody>
    <tfoot><tr><td>Total</td><td class="r">${formatBRL(totalAno)}</td><td class="r">100%</td></tr></tfoot></table>
  <h2>Ganhos mês a mês</h2>
  <table><thead><tr><th>Mês</th><th class="r">Recebido</th></tr></thead><tbody>${linhasMes}</tbody></table>
  <p class="rodape">Valores reais efetivamente pagos (folha), incluindo salário, adiantamento, horas extras, comissão, incentivos e benefícios. Documento informativo gerado pelo sistema de RH da Impresilk.</p>
  <script>window.onload=function(){window.print()}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast("Permita pop-ups para gerar o relatório.", "info"); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Remuneração real · extrato de folha</p>
          <p className="text-sm text-slate-500">Salário + adiantamento + extras + benefícios efetivamente pagos. Use para dar feedback.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Competência</span>
          <Select value={compSel} onChange={(e) => setComp(e.target.value)} className="w-full sm:w-44">
            {comps.map((k) => <option key={k} value={k}>{competenciaLabelLongo(k)}</option>)}
          </Select>
        </label>
      </div>

      {/* Resumo anual — quanto ganhou no ano, com todos os tipos de ganho */}
      <SecaoColapsavel
        title={`Ganhos em ${anoSel}`}
        subtitle="Tudo que recebeu no ano — salário, adiantamento, horas extras, comissão, incentivos e benefícios."
        icon={<Wallet className="h-[18px] w-[18px]" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {anos.length > 1 && (
              <Select value={anoSel} onChange={(e) => setAno(e.target.value)} className="w-24">
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            )}
            <button className="btn-outline" onClick={gerarRelatorio} title="Abre um demonstrativo limpo para imprimir ou salvar em PDF">
              <FileText className="h-4 w-4" /> Gerar relatório (PDF)
            </button>
          </div>
        }
      >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100"><tr><th className="th">Tipo de ganho</th><th className="th text-right">Valor no ano</th><th className="th text-right">% do total</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {porTipoAno.map((t) => (
                    <tr key={t.tipo}>
                      <td className="td font-medium text-slate-700"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: corDoTipo(t.tipo) }} />{t.tipo}</td>
                      <td className="td text-right tabular-nums">{formatBRL(t.valor)}</td>
                      <td className="td text-right text-slate-500">{totalAno ? `${Math.round((t.valor / totalAno) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-slate-200"><td className="td font-semibold text-brand-ink">Total no ano</td><td className="td text-right text-base font-semibold text-green-700 tabular-nums">{formatBRL(totalAno)}</td><td className="td" /></tr></tfoot>
              </table>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-green-100 bg-green-50/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-green-700">Total recebido em {anoSel}</p>
                <p className="mt-0.5 text-3xl font-bold text-green-700">{formatBRL(totalAno)}</p>
                <p className="mt-1 text-xs text-slate-500">{mesesNoAno} mês(es) com pagamento</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Média por mês</p>
                <p className="mt-0.5 text-2xl font-semibold text-brand-ink">{formatBRL(mediaMesAno)}</p>
              </div>
              {diariasAno > 0 && (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-gold-100 bg-gold-50/40 px-4 py-3">
                    <Plane className="h-5 w-5 shrink-0 text-gold-600" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gold-700">Diárias de viagem</p>
                      <p className="mt-0.5 text-2xl font-semibold text-gold-700">{formatBRL(diariasAno)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-brand">Total com diárias ({anoSel})</p>
                    <p className="mt-0.5 text-2xl font-bold text-brand-ink">{formatBRL(totalComDiarias)}</p>
                    <p className="mt-1 text-xs text-slate-500">Folha + diárias de viagem</p>
                  </div>
                </>
              )}
            </div>
          </div>
      </SecaoColapsavel>

      <div className="grid gap-4 lg:grid-cols-3">
        <SecaoColapsavel className="lg:col-span-2" title={`O que recebeu em ${competenciaLabelLongo(compSel)}`} subtitle={parcial ? "Competência em andamento (uma das parcelas ainda não foi paga)" : "Composição do pagamento da competência"} icon={<Wallet className="h-[18px] w-[18px]" />}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-100"><tr><th className="th">Tipo</th><th className="th text-right">Valor</th><th className="th text-right">% do mês</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {porTipo.map((t) => (
                    <tr key={t.tipo}>
                      <td className="td font-medium text-slate-700"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: corDoTipo(t.tipo) }} />{t.tipo}</td>
                      <td className="td text-right tabular-nums">{formatBRL(t.valor)}</td>
                      <td className="td text-right text-slate-500">{totalMes ? `${Math.round((t.valor / totalMes) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-slate-200"><td className="td font-semibold text-brand-ink">Total recebido no mês</td><td className="td text-right text-base font-semibold text-green-700 tabular-nums">{formatBRL(totalMes)}</td><td className="td" /></tr></tfoot>
              </table>
            </div>
        </SecaoColapsavel>
        <div className="space-y-4">
          <Card><CardBody><p className="text-xs uppercase tracking-wide text-slate-400">Total em {competenciaLabelLongo(compSel)}</p><p className="mt-1 text-2xl font-semibold text-green-700">{formatBRL(totalMes)}</p></CardBody></Card>
          <Card><CardBody><p className="text-xs uppercase tracking-wide text-slate-400">Média mensal recebida</p><p className="mt-1 text-2xl font-semibold text-brand-ink">{formatBRL(mediaMensal)}</p><p className="mt-1 text-xs text-slate-400">{comps.length} competência(s)</p></CardBody></Card>
          <Card><CardBody><p className="text-xs uppercase tracking-wide text-slate-400">Salário de referência (cadastro)</p><p className="mt-1 text-2xl font-semibold text-gold-700">{formatBRL(salarioRef)}</p></CardBody></Card>
        </div>
      </div>

      <SecaoColapsavel title="Lançamentos da competência" subtitle="Cada pagamento com a data efetiva (vencimento)" icon={<History className="h-[18px] w-[18px]" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100"><tr><th className="th">Data</th><th className="th">Tipo</th><th className="th">Descrição</th><th className="th text-right">Valor</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {doMes.map((p) => (
                  <tr key={p.id}>
                    <td className="td whitespace-nowrap text-slate-600">{formatDate(p.dataPagamento)}</td>
                    <td className="td"><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: corDoTipo(p.tipo) }} />{p.tipo}</td>
                    <td className="td text-slate-500">{p.descricao ?? "—"}</td>
                    <td className="td text-right tabular-nums">{formatBRL(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SecaoColapsavel>

      <SecaoColapsavel title="Histórico mês a mês" subtitle="Total recebido por competência (para acompanhar a evolução e dar feedback)" icon={<Wallet className="h-[18px] w-[18px]" />}>
          <BarrasVerticais data={serie.map((s) => ({ nome: s.nome, valor: s.valor }))} moeda cor="#16334f" altura={220} />
      </SecaoColapsavel>
    </div>
  );
}

function enqVar(e: string): "danger" | "warning" | "success" | "info" {
  return e === "Crítico" ? "danger" : e === "Abaixo" ? "warning" : e === "Acima" ? "info" : "success";
}

function AbaDocumentos({ colaboradorId, podeEditar }: { colaboradorId: string; podeEditar: boolean }) {
  const toast = useToast();
  const { items, criar, atualizar, remover } = useColecao("documentos");
  const docs = items.filter((doc) => doc.colaboradorId === colaboradorId);
  const [novo, setNovo] = useState(false);

  // Anexa: metadados no localStorage, conteúdo do arquivo no IndexedDB (cota maior).
  // Retorna true se o anexo foi gravado (ou não havia anexo); false se o arquivo não coube.
  const adicionar = async (meta: Partial<import("@/data/types").Documento>, dataUrl: string | null): Promise<boolean> => {
    const rec = criar({ ...meta, arquivoDataUrl: null, arquivoEmBlob: false });
    if (!dataUrl) return true;
    const ok = await putBlob(`doc:${rec.id}`, dataUrl);
    if (ok) {
      atualizar(rec.id, { arquivoEmBlob: true });
      return true;
    }
    if (dataUrl.length < 1_200_000) {
      atualizar(rec.id, { arquivoDataUrl: dataUrl }); // fallback só p/ arquivos pequenos
      return true;
    }
    toast("Não foi possível guardar o arquivo (armazenamento indisponível). O registro foi salvo sem anexo.", "erro");
    return false;
  };

  const abrir = async (doc: import("@/data/types").Documento) => {
    const dataUrl = doc.arquivoEmBlob ? await getBlob(`doc:${doc.id}`) : doc.arquivoDataUrl;
    if (!dataUrl) {
      toast("Este registro não possui arquivo anexado.", "info");
      return;
    }
    const w = window.open();
    if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
  };
  const excluirDoc = async (doc: import("@/data/types").Documento) => {
    if (doc.arquivoEmBlob) await delBlob(`doc:${doc.id}`); // remove o blob antes do metadado (evita órfão)
    remover(doc.id);
  };

  return (
    <>
      <SecaoColapsavel
        title="Documentos do colaborador"
        subtitle="Contratos, ASO, exames e certificados. Clique para abrir em nova aba."
        action={podeEditar ? <button className="btn-outline" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Anexar</button> : undefined}
      >
        {docs.length === 0 ? (
          <EmptyState title="Nenhum documento" description="Anexe contratos, ASO e exames." icon={<FileText className="h-8 w-8" />} />
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const dd = diasAte(doc.dataVencimento);
              return (
                <div key={doc.id} className="flex items-center justify-between gap-3 py-3">
                  <button onClick={() => abrir(doc)} className="flex min-w-0 items-center gap-3 text-left">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand"><FileText className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                        {doc.nome} {(doc.arquivoEmBlob || doc.arquivoDataUrl) && <ExternalLink className="h-3 w-3 text-slate-400" />}
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
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => excluirDoc(doc)}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SecaoColapsavel>
      {novo && <NovoDocumentoModal aberto={novo} onFechar={() => setNovo(false)} colaboradorId={colaboradorId} onCriar={adicionar} />}
    </>
  );
}

function NovoDocumentoModal({ aberto, onFechar, colaboradorId, onCriar }: { aberto: boolean; onFechar: () => void; colaboradorId: string; onCriar: (x: Record<string, unknown>, dataUrl: string | null) => Promise<boolean> }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<string>("Contrato");
  const [emissao, setEmissao] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string; tamanho: number } | null>(null);
  const [lendo, setLendo] = useState(false);

  const onFile = (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      toast("Arquivo acima de 10 MB. Escolha um arquivo menor.", "erro");
      return;
    }
    setLendo(true);
    const reader = new FileReader();
    reader.onload = () => { setArquivo({ nome: f.name, dataUrl: String(reader.result), tamanho: f.size }); setLendo(false); };
    reader.onerror = () => { setLendo(false); toast("Não foi possível ler o arquivo. Tente novamente.", "erro"); };
    reader.readAsDataURL(f);
  };

  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!nome.trim()) return toast("Informe o nome do documento.", "erro");
    if (lendo) return toast("Aguarde o anexo terminar de carregar.", "info");
    setSalvando(true);
    try {
      const ok = await onCriar(
        {
          colaboradorId, categoria, nome,
          arquivoNome: arquivo?.nome ?? null, tamanhoBytes: arquivo?.tamanho ?? null,
          dataEmissao: emissao || null, dataVencimento: vencimento || null, enviadoPor: "RH", criadoEm: new Date().toISOString(),
        },
        arquivo?.dataUrl ?? null,
      );
      if (ok) toast("Documento anexado."); // se falhou, o erro já foi sinalizado
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Anexar documento"
      descricao="O arquivo é guardado no navegador (até 10 MB) e abre em nova aba."
      rodape={<><button className="btn-outline" onClick={onFechar} disabled={salvando}>Cancelar</button><button className="btn-primary" onClick={salvar} disabled={salvando || lendo}>{salvando ? "Anexando…" : "Anexar"}</button></>}>
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
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
          <button className="btn-outline w-full" onClick={() => fileRef.current?.click()} disabled={lendo}><Upload className="h-4 w-4" /> {lendo ? "Lendo arquivo…" : arquivo ? arquivo.nome : "Selecionar arquivo (≤ 10 MB)"}</button>
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
    <SecaoColapsavel title="Férias" subtitle="Períodos aquisitivos, saldo e status" action={podeEditar ? <button className="btn-outline" onClick={adicionar}><Plus className="h-4 w-4" /> Novo período</button> : undefined}>
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
      </SecaoColapsavel>
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
      <SecaoColapsavel title="Avaliação de desempenho" subtitle="Ciclo 2026.1">
          {aval ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Técnico</span><span className="font-medium">{aval.notaTecnico}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Comportamental</span><span className="font-medium">{aval.notaComportamental}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Resultado</span><span className="font-medium">{aval.notaResultado}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-medium text-slate-700">Nota final</span><Badge variant={aval.statusDesempenho === "Apto" ? "success" : aval.statusDesempenho === "Não apto" ? "danger" : "warning"}>{aval.notaFinal} · {aval.statusDesempenho}</Badge></div>
              {aval.elegivelPromocao && <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">Elegível → {aval.proximoNivel}</div>}
            </div>
          ) : <EmptyState title="Sem avaliação" />}
      </SecaoColapsavel>
      <SecaoColapsavel title="PDI" subtitle="Plano de Desenvolvimento Individual" bodyClassName="space-y-3">
          {meusPdis.length === 0 ? <EmptyState title="Sem PDI" /> : meusPdis.map((p) => (
            <div key={p.id}>
              <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-700">{p.competencia}</span><span className="text-slate-400">{p.progresso}%</span></div>
              <Progress value={p.progresso} />
              <p className="mt-1 text-xs text-slate-500">{p.acao} → {p.resultadoEsperado}</p>
            </div>
          ))}
      </SecaoColapsavel>
      <SecaoColapsavel title="Metas" bodyClassName="space-y-2">
          {minhasMetas.length === 0 ? <EmptyState title="Sem metas individuais" /> : minhasMetas.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm"><span className="text-slate-700">{m.titulo}</span><span className="text-slate-400">{m.valorAtual}/{m.valorAlvo}{m.unidade}</span></div>
          ))}
      </SecaoColapsavel>
      <SecaoColapsavel title="Feedbacks" bodyClassName="space-y-3">
          {meusFb.length === 0 ? <EmptyState title="Sem feedbacks" /> : meusFb.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-100 px-3 py-2">
              <div className="mb-1 flex items-center justify-between"><Badge variant={f.tipo === "Positivo" ? "success" : f.tipo === "Desenvolvimento" ? "warning" : "info"}>{f.tipo}</Badge><span className="text-xs text-slate-400">{d.nomeColab(f.autorId)}</span></div>
              <p className="text-sm text-slate-600">{f.conteudo}</p>
            </div>
          ))}
      </SecaoColapsavel>
    </div>
  );
}

function AbaHistorico({ colaboradorId }: { colaboradorId: string }) {
  const { items } = useColecao("movimentacoes");
  const lista = items.filter((m) => m.colaboradorId === colaboradorId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  return (
    <SecaoColapsavel title="Histórico de movimentações" icon={<History className="h-[18px] w-[18px]" />}>
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
      </SecaoColapsavel>
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
