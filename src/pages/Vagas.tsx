import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase, Plus, Pencil, Trash2, Users, ChevronDown, ChevronRight,
  ExternalLink, Paperclip, Upload, Mail, Phone, Trophy, Megaphone,
  FolderOpen, Search, MessageSquareReply, Copy, BookmarkPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Campo, Input, Textarea, Select, Toggle } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useToast } from "@/components/ui/toast";
import { LinkFicha } from "@/components/ui/link-ficha";
import { GeradorAnuncio } from "@/components/vagas/gerador-anuncio";
import { putBlob, getBlob, delBlob } from "@/lib/blobstore";
import { enviarArquivoNuvem, buscarArquivoNuvem } from "@/lib/sync";
import { abrirAnexoEmNovaAba } from "@/lib/abrirArquivo";
import { cn } from "@/lib/cn";
import { tempoDeCasa, diaLocalISO, formatDate } from "@/lib/format";
import { Tabs } from "@/components/ui/tabs";
import { estaNoBanco, textoDevolutiva, MOTIVOS_DEVOLUTIVA, type MotivoDevolutiva } from "@/lib/selecao";
import type { Vaga, Candidato, StatusVaga, EtapaCandidato } from "@/data/types";

const STATUS_VAGA: StatusVaga[] = ["Aberta", "Em triagem", "Fechada", "Cancelada"];
const ETAPAS: EtapaCandidato[] = ["Triagem", "Entrevista", "Teste", "Aprovado", "Reprovado", "Contratado"];

const corStatus = (s: StatusVaga) =>
  s === "Aberta" ? "success" : s === "Em triagem" ? "info" : s === "Cancelada" ? "danger" : "neutral";
const corEtapa = (e: EtapaCandidato) =>
  e === "Contratado" || e === "Aprovado" ? "success" : e === "Reprovado" ? "danger" : e === "Entrevista" || e === "Teste" ? "info" : "neutral";
const corNota = (n?: number | null) =>
  n == null ? "text-slate-300" : n >= 8 ? "text-green-600" : n >= 6 ? "text-amber-600" : "text-red-500";

// Filtros acionados pelos cartões do topo.
type FocoVagas = "abertas" | "comCandidatos" | "entrevista";
const emEntrevistaOuTeste = (c: Candidato) => c.etapa === "Entrevista" || c.etapa === "Teste";

export default function Vagas() {
  const { items: vagas, criar: criarVaga, atualizar: atualizarVaga, remover: removerVaga } = useColecao("vagas");
  const { items: candidatos, criar: criarCand, atualizar: atualizarCand, remover: removerCand } = useColecao("candidatos");
  const { items: advertencias } = useColecao("advertencias");
  const { criar: criarMov } = useColecao("movimentacoes");
  const d = useDominio();
  const toast = useToast();

  const [formVaga, setFormVaga] = useState<Vaga | "nova" | null>(null);
  const [vagaExcluir, setVagaExcluir] = useState<Vaga | null>(null);
  const [anuncio, setAnuncio] = useState<Vaga | null>(null);
  const [formCand, setFormCand] = useState<{ vagaId: string; cand: Candidato | null } | null>(null);
  const [candExcluir, setCandExcluir] = useState<Candidato | null>(null);
  const [devolutiva, setDevolutiva] = useState<Candidato | null>(null);

  /* BANCO DE TALENTOS: currículo que chegou sem vaga, ou que o RH guardou
     depois de um processo. Antes disso, quem não era contratado sumia — e no
     mês seguinte a busca recomeçava do zero. */
  const noBanco = useMemo(
    () => candidatos.filter(estaNoBanco).sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "")),
    [candidatos],
  );
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(vagas.filter((v) => v.status === "Aberta").map((v) => v.id)));

  const candPorVaga = useMemo(() => {
    const m = new Map<string, Candidato[]>();
    for (const c of candidatos) {
      // Sem vaga = currículo do banco de talentos; ele tem aba própria.
      if (!c.vagaId) continue;
      const arr = m.get(c.vagaId) ?? [];
      arr.push(c);
      m.set(c.vagaId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1)); // ranqueia por nota
    return m;
  }, [candidatos]);

  const vagasOrdenadas = useMemo(() => {
    // Prevista fica DEPOIS das que já estão correndo: o que precisa de gente
    // hoje vem antes do que vai precisar.
    const ordem: Record<StatusVaga, number> = { "Aberta": 0, "Em triagem": 1, "Prevista": 2, "Fechada": 3, "Cancelada": 4 };
    return [...vagas].sort((a, b) => (ordem[a.status] - ordem[b.status]) || a.titulo.localeCompare(b.titulo));
  }, [vagas]);

  const nAbertas = vagas.filter((v) => v.status === "Aberta" || v.status === "Em triagem").length;
  const emEntrevista = candidatos.filter(emEntrevistaOuTeste).length;

  const [foco, setFoco] = useState<FocoVagas | null>(null);
  const combinaFoco = (v: Vaga, f: FocoVagas) => {
    const lista = candPorVaga.get(v.id) ?? [];
    if (f === "abertas") return v.status === "Aberta" || v.status === "Em triagem";
    if (f === "comCandidatos") return lista.length > 0;
    return lista.some(emEntrevistaOuTeste);
  };
  // Os números de candidatos só aparecem dentro da vaga expandida — ao filtrar
  // por eles, abre as vagas que sobraram para o clique não parecer sem efeito.
  const alternarFoco = (f: FocoVagas) => {
    const limpar = foco === f;
    setFoco(limpar ? null : f);
    if (!limpar && f !== "abertas") {
      setAbertas((s) => { const n = new Set(s); for (const v of vagas) if (combinaFoco(v, f)) n.add(v.id); return n; });
    }
  };
  const vagasVisiveis = foco ? vagasOrdenadas.filter((v) => combinaFoco(v, foco)) : vagasOrdenadas;

  const toggle = (id: string) => setAbertas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const verCurriculo = async (c: Candidato) => {
    if (c.linkCurriculo) { window.open(c.linkCurriculo, "_blank", "noopener"); return; }
    if (c.curriculoArquivo) {
      // A janela tem de abrir DENTRO do clique: buscar o PDF na nuvem primeiro
      // (são megabytes) estourava a ativação do gesto e o navegador bloqueava a
      // aba — o botão não fazia nada e não dizia por quê.
      await abrirAnexoEmNovaAba(async () => {
        let dataUrl = await getBlob(`cv:${c.id}`); // cache local
        if (!dataUrl) { dataUrl = await buscarArquivoNuvem(`cv:${c.id}`); if (dataUrl) void putBlob(`cv:${c.id}`, dataUrl); }
        return dataUrl;
      }, (m) => toast(m, "erro"), `Currículo — ${c.nome}`);
    }
  };

  const excluirVaga = (v: Vaga) => {
    for (const c of candPorVaga.get(v.id) ?? []) { if (c.curriculoArquivo) void delBlob(`cv:${c.id}`); removerCand(c.id); }
    removerVaga(v.id);
    toast(`Vaga "${v.titulo}" removida.`);
  };
  const excluirCand = (c: Candidato) => {
    if (c.curriculoArquivo) void delBlob(`cv:${c.id}`);
    removerCand(c.id);
    toast(`${c.nome} removido(a).`);
  };

  return (
    <div>
      <PageHeader title="Vagas em aberto" description="Posições abertas e candidatos com nota para classificar e ranquear.">
        <button className="btn-primary" onClick={() => setFormVaga("nova")}>
          <Plus className="h-4 w-4" /> Nova vaga
        </button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Vagas abertas" value={nAbertas} icon={<Briefcase className="h-5 w-5" />} accent="brand"
          onClick={() => alternarFoco("abertas")} ativo={foco === "abertas"} title="Ver só as vagas abertas e em triagem" />
        <StatCard label="Candidatos" value={candidatos.length} icon={<Users className="h-5 w-5" />} accent="blue"
          onClick={() => alternarFoco("comCandidatos")} ativo={foco === "comCandidatos"} title="Ver só as vagas que já têm candidatos" />
        <StatCard label="Em entrevista/teste" value={emEntrevista} icon={<Trophy className="h-5 w-5" />} accent="amber"
          onClick={() => alternarFoco("entrevista")} ativo={foco === "entrevista"} title="Ver só quem está em entrevista ou teste" />
      </div>

      <Tabs
        idPersistencia="vagas"
        abas={[
          {
            id: "vagas",
            label: "Vagas",
            icon: <Briefcase className="h-4 w-4" />,
            conteudo: (
              <>
        {vagasVisiveis.length === 0 ? (
          <EmptyState
            title={foco ? "Nenhuma vaga neste filtro" : "Nenhuma vaga cadastrada"}
            description={foco ? "Clique de novo no cartão para ver todas as vagas." : "Crie uma vaga para começar a registrar candidatos e classificá-los."}
            icon={<Briefcase className="h-8 w-8" />}
          />
        ) : (
          <div className="space-y-4">
            {vagasVisiveis.map((v) => {
              const lista = candPorVaga.get(v.id) ?? [];
              // Com o foco em entrevista/teste, a lista da vaga mostra só quem está nessa etapa.
              const visiveis = foco === "entrevista" ? lista.filter(emEntrevistaOuTeste) : lista;
              const aberta = abertas.has(v.id);
              const media = lista.length ? lista.reduce((s, c) => s + (c.nota ?? 0), 0) / lista.filter((c) => c.nota != null).length : 0;
              return (
                <Card key={v.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <button type="button" onClick={() => toggle(v.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      {aberta ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                      <Briefcase className="h-4 w-4 shrink-0 text-brand" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{v.titulo}</p>
                        <p className="truncate text-xs text-slate-400">
                          {d.nomeArea(v.areaId)}{v.cargoId ? ` · ${d.cargoById.get(v.cargoId)?.nome ?? ""}` : ""}{v.nivelId ? ` · ${v.nivelId}` : ""}
                        </p>
                      </div>
                    </button>
                    <Badge variant={corStatus(v.status)}>{v.status}</Badge>
                    {v.divulgacaoInterna && (
                      <Link to="/mural-vagas" className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100" title="Ver como esta vaga aparece no Mural de Vagas">
                        <Trophy className="h-3.5 w-3.5" /> No mural
                      </Link>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      <Users className="h-3.5 w-3.5" /> {lista.length}
                    </span>
                    <div className="flex shrink-0 gap-0.5">
                      <button onClick={() => setAnuncio(v)} title="Gerar anúncio para divulgar esta vaga" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand"><Megaphone className="h-4 w-4" /></button>
                      <button onClick={() => setFormVaga(v)} title="Editar vaga" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setVagaExcluir(v)} title="Remover vaga" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  {aberta && (
                    <div className="border-t border-slate-100 bg-slate-50/40 p-4">
                      {(v.descricao || v.requisitos) && (
                        <div className="mb-3 space-y-1 text-xs text-slate-500">
                          {v.descricao && <p><span className="font-medium text-slate-600">Descrição:</span> {v.descricao}</p>}
                          {v.requisitos && <p><span className="font-medium text-slate-600">Requisitos:</span> {v.requisitos}</p>}
                        </div>
                      )}
                      {(() => {
                        // Comparador da disputa interna: os colaboradores candidatos
                        // lado a lado, com dados do RH para uma decisão justa.
                        const internos = lista.filter((c) => c.colaboradorId);
                        if (internos.length === 0) return null;
                        return (
                          <div className="mb-4 overflow-hidden rounded-lg border border-amber-200/70 bg-white">
                            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-3 py-2">
                              <Trophy className="h-4 w-4 text-amber-600" />
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Disputa interna · {internos.length} colaborador(es)</p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="border-b border-slate-100 bg-slate-50/50">
                                  <tr>
                                    <th className="th">Colaborador</th>
                                    <th className="th hidden sm:table-cell">Cargo atual</th>
                                    <th className="th hidden md:table-cell">Tempo de casa</th>
                                    <th className="th hidden md:table-cell">Advertências</th>
                                    <th className="th">Nota</th>
                                    <th className="th">Etapa</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {internos.map((c) => {
                                    const colab = c.colaboradorId ? d.colabById.get(c.colaboradorId) : undefined;
                                    const nAdv = c.colaboradorId ? advertencias.filter((a) => a.colaboradorId === c.colaboradorId).length : 0;
                                    return (
                                      <tr key={c.id}>
                                        <td className="td font-medium text-slate-800"><LinkFicha id={c.colaboradorId} titulo="Abrir a ficha do candidato interno">{c.nome}</LinkFicha></td>
                                        <td className="td hidden sm:table-cell text-slate-500">{colab ? `${d.nomeCargo(colab)} · ${d.nomeArea(colab.areaId)}` : "—"}</td>
                                        <td className="td hidden md:table-cell text-slate-500">{colab?.dataAdmissao ? tempoDeCasa(colab.dataAdmissao) : "—"}</td>
                                        <td className="td hidden md:table-cell">
                                          <Badge variant={nAdv === 0 ? "success" : nAdv === 1 ? "warning" : "danger"}>{nAdv}</Badge>
                                        </td>
                                        <td className={cn("td font-semibold tabular-nums", corNota(c.nota))}>{c.nota != null ? c.nota.toLocaleString("pt-BR") : "—"}</td>
                                        <td className="td"><Badge variant={corEtapa(c.etapa)}>{c.etapa}</Badge></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">A motivação de cada um está nas observações do candidato. Ao marcar "Contratado", a movimentação entra no histórico automaticamente.</p>
                          </div>
                        );
                      })()}
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Candidatos {lista.length > 0 && `· classificados por nota`}</p>
                        <button className="btn-outline px-2.5 py-1 text-xs" onClick={() => setFormCand({ vagaId: v.id, cand: null })}>
                          <Plus className="h-3.5 w-3.5" /> Adicionar candidato
                        </button>
                      </div>
                      {lista.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">Nenhum candidato ainda. Adicione o primeiro currículo.</p>
                      ) : (
                        <div className="space-y-2">
                          {visiveis.map((c) => {
                            const i = lista.indexOf(c); // a classificação continua sendo a da vaga inteira
                            return (
                            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500" title={`${i + 1}º classificado`}>{i + 1}º</span>
                              <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-800">
                                  <LinkFicha id={c.colaboradorId} titulo="Abrir a ficha deste candidato interno">{c.nome}</LinkFicha>
                                  {c.colaboradorId && <Badge variant="info">Interno</Badge>}
                                </p>
                                <p className="flex flex-wrap gap-x-3 truncate text-[11px] text-slate-400">
                                  {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                                  {c.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefone}</span>}
                                  {c.origem && <span>{c.origem}</span>}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className={cn("text-xl font-bold tabular-nums leading-none", corNota(c.nota))}>{c.nota != null ? c.nota.toLocaleString("pt-BR") : "—"}</p>
                                <p className="text-[10px] uppercase tracking-wide text-slate-400">nota</p>
                              </div>
                              <Badge variant={corEtapa(c.etapa)}>{c.etapa}</Badge>
                              {(c.curriculoArquivo || c.linkCurriculo) && (
                                <button onClick={() => verCurriculo(c)} title="Ver currículo" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand">
                                  {c.linkCurriculo ? <ExternalLink className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                                </button>
                              )}
                              <div className="flex shrink-0 gap-0.5">
                                {/* Guardar no banco e dar devolutiva ficam AQUI, na linha do
                                    candidato, porque é neste momento que se decide não seguir
                                    com ele — mandar o RH procurar outra tela depois é o mesmo
                                    que não acontecer. */}
                                <button onClick={() => { atualizarCand(c.id, { noBanco: !c.noBanco }); toast(c.noBanco ? `${c.nome.split(" ")[0]} saiu do banco.` : `${c.nome.split(" ")[0]} guardado(a) no banco de talentos.`); }} title={c.noBanco ? "Tirar do banco de talentos" : "Guardar no banco de talentos"} className={"rounded-full p-1.5 hover:bg-slate-100 " + (c.noBanco ? "text-gold hover:text-gold-600" : "text-slate-400 hover:text-brand")}><BookmarkPlus className="h-4 w-4" /></button>
                                <button onClick={() => setDevolutiva(c)} title={c.devolutivaEm ? "Devolutiva já dada — ver/refazer" : "Registrar devolutiva"} className={"rounded-full p-1.5 hover:bg-slate-100 " + (c.devolutivaEm ? "text-emerald-600" : "text-slate-400 hover:text-brand")}><MessageSquareReply className="h-4 w-4" /></button>
                                <button onClick={() => setFormCand({ vagaId: v.id, cand: c })} title="Editar candidato" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand"><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => setCandExcluir(c)} title="Remover candidato" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {anuncio && <GeradorAnuncio vaga={anuncio} onFechar={() => setAnuncio(null)} />}
              </>
            ),
          },
          {
            id: "banco",
            label: `Banco de talentos${noBanco.length ? ` (${noBanco.length})` : ""}`,
            icon: <FolderOpen className="h-4 w-4" />,
            conteudo: (
              <BancoTalentos
                lista={noBanco}
                d={d}
                onEditar={(c) => setFormCand({ vagaId: c.vagaId ?? "", cand: c })}
                onDevolutiva={setDevolutiva}
                onExcluir={setCandExcluir}
                onVerCurriculo={verCurriculo}
                onNovo={() => setFormCand({ vagaId: "", cand: null })}
              />
            ),
          },
        ]}
      />

      {devolutiva && (
        <DevolutivaModal
          cand={devolutiva}
          vaga={devolutiva.vagaId ? vagas.find((v) => v.id === devolutiva.vagaId)?.titulo : null}
          onFechar={() => setDevolutiva(null)}
          onSalvar={(dados) => { atualizarCand(devolutiva.id, dados); toast(`Devolutiva registrada para ${devolutiva.nome.split(" ")[0]}.`); }}
          toast={toast}
        />
      )}

      {formVaga && (
        <VagaForm
          vaga={formVaga === "nova" ? null : formVaga}
          onFechar={() => setFormVaga(null)}
          onSalvar={(dados, id) => {
            if (id) atualizarVaga(id, dados);
            else { const r = criarVaga({ status: "Aberta", criadoEm: new Date().toISOString(), ...dados }); setAbertas((s) => new Set(s).add(r.id)); }
            toast("Vaga salva.");
            setFormVaga(null);
          }}
        />
      )}
      {formCand && (
        <CandidatoForm
          vagaId={formCand.vagaId}
          cand={formCand.cand}
          onFechar={() => setFormCand(null)}
          onSalvar={async (dados, arquivo, id) => {
            let alvoId = id;
            if (id) {
              const anterior = candidatos.find((c) => c.id === id);
              atualizarCand(id, dados);
              // Disputa interna vencida: ao virar "Contratado", registra a
              // movimentação no histórico do colaborador (promoção/transferência).
              if (anterior?.colaboradorId && dados.etapa === "Contratado" && anterior.etapa !== "Contratado") {
                const vaga = vagas.find((v) => v.id === anterior.vagaId);
                const colab = d.colabById.get(anterior.colaboradorId);
                criarMov({
                  colaboradorId: anterior.colaboradorId,
                  tipo: "Promoção",
                  // Dia LOCAL: toISOString() às 21h (UTC-3) já devolve o dia
                  // seguinte, e a promoção entrava no histórico datada de amanhã.
                  data: diaLocalISO(new Date()),
                  descricao: `Venceu a disputa interna da vaga "${vaga?.titulo ?? ""}" (Mural de Vagas).`,
                  cargoAnterior: colab ? d.nomeCargo(colab) : null,
                  cargoNovo: vaga?.cargoId ? d.cargoById.get(vaga.cargoId)?.nome ?? null : null,
                  registradoPor: "RH",
                });
                toast(`${colab?.nome ?? "Colaborador"} venceu a disputa — movimentação registrada no histórico.`, "sucesso");
              }
            }
            else { const r = criarCand({ etapa: "Triagem", criadoEm: new Date().toISOString(), ...dados }); alvoId = r.id; }
            if (arquivo && alvoId) {
              void putBlob(`cv:${alvoId}`, arquivo.dataUrl); // cache local (rápido/offline)
              const subiu = await enviarArquivoNuvem(`cv:${alvoId}`, arquivo.dataUrl); // sobe para a nuvem (todos os PCs)
              atualizarCand(alvoId, { curriculoArquivo: true, curriculoNome: arquivo.nome, linkCurriculo: "" });
              if (!subiu) toast("Candidato salvo, mas o currículo não subiu agora (sem rede?). Reabra a vaga online e salve de novo para enviar.", "erro");
            }
            toast("Candidato salvo.");
            setFormCand(null);
          }}
        />
      )}
      {vagaExcluir && (
        <ConfirmDialog aberto onFechar={() => setVagaExcluir(null)} onConfirmar={() => excluirVaga(vagaExcluir)} titulo="Remover vaga" textoConfirmar="Remover"
          mensagem={<>Remover a vaga <strong>{vagaExcluir.titulo}</strong> e todos os {candPorVaga.get(vagaExcluir.id)?.length ?? 0} candidato(s)?</>} />
      )}
      {candExcluir && (
        <ConfirmDialog aberto onFechar={() => setCandExcluir(null)} onConfirmar={() => excluirCand(candExcluir)} titulo="Remover candidato" textoConfirmar="Remover"
          mensagem={<>Remover <strong>{candExcluir.nome}</strong> desta vaga?</>} />
      )}
    </div>
  );
}


/* ---------------------------------------------------------------------------
   BANCO DE TALENTOS
   Currículo que chegou sem vaga, ou que sobrou de um processo e o RH guardou.
   Existe porque hoje quem não é contratado simplesmente some: no mês seguinte
   a busca recomeça do zero, e a pressa é o que faz a contratação sair ruim.
   Fica no escopo do módulo, não dentro do Vagas — componente declarado dentro
   de outro remonta a cada desenho (a regra do lint barra isso).
--------------------------------------------------------------------------- */
function BancoTalentos({
  lista, d, onEditar, onDevolutiva, onExcluir, onVerCurriculo, onNovo,
}: {
  lista: Candidato[];
  d: ReturnType<typeof useDominio>;
  onEditar: (c: Candidato) => void;
  onDevolutiva: (c: Candidato) => void;
  onExcluir: (c: Candidato) => void;
  onVerCurriculo: (c: Candidato) => void;
  onNovo: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");

  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista
      .filter((c) => (area ? c.interesseAreaId === area : true))
      .filter((c) => (t
        ? c.nome.toLowerCase().includes(t)
          || (c.observacao ?? "").toLowerCase().includes(t)
          || (c.origem ?? "").toLowerCase().includes(t)
        : true));
  }, [lista, busca, area]);

  return (
    <>
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, origem ou anotação" className="pl-9" />
          </div>
          <Select value={area} onChange={(e) => setArea(e.target.value)} className="w-auto min-w-[12rem]">
            <option value="">Todas as áreas de interesse</option>
            {d.areas.filter((a) => a.id !== "direcao").map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
          <span className="text-sm text-slate-500">{filtrada.length} currículo(s)</span>
          <button className="btn-outline" onClick={onNovo}>
            <Plus className="h-4 w-4" /> Guardar currículo
          </button>
        </CardBody>
      </Card>

      {filtrada.length === 0 ? (
        <EmptyState
          title={lista.length === 0 ? "Banco vazio" : "Nenhum currículo neste filtro"}
          description={lista.length === 0
            ? "Guarde aqui os currículos que chegam sem vaga e os candidatos que não seguiram — quando abrir uma vaga, a procura começa por eles."
            : "Ajuste a busca ou a área de interesse."}
          icon={<FolderOpen className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-2">
          {filtrada.map((c) => (
            <Card key={c.id}>
              <CardBody className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.nome}</p>
                  <p className="truncate text-xs text-slate-400">
                    {c.interesseCargoId ? d.cargoById.get(c.interesseCargoId)?.nome : d.nomeArea(c.interesseAreaId) || "Sem área definida"}
                    {c.origem ? ` · ${c.origem}` : ""}
                    {c.criadoEm ? ` · guardado em ${formatDate(c.criadoEm)}` : ""}
                  </p>
                </div>
                {/* A devolutiva fica VISÍVEL na linha: quem ainda não recebeu
                    aparece como pendência, senão ela nunca acontece. */}
                {c.devolutivaEm ? (
                  <Badge variant="success">Devolutiva dada</Badge>
                ) : (
                  <Badge variant="neutral">Sem devolutiva</Badge>
                )}
                {(c.linkCurriculo || c.curriculoArquivo) && (
                  <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" title="Ver currículo" onClick={() => onVerCurriculo(c)}>
                    <Paperclip className="h-4 w-4" />
                  </button>
                )}
                <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" title="Registrar devolutiva" onClick={() => onDevolutiva(c)}>
                  <MessageSquareReply className="h-4 w-4" />
                </button>
                <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" title="Editar" onClick={() => onEditar(c)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" title="Remover do banco" onClick={() => onExcluir(c)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
   DEVOLUTIVA AO CANDIDATO
   O sistema monta o texto e o RH copia; NÃO dispara sozinho. Mensagem em nome
   da empresa para gente de fora, indo para a pessoa errada, não tem volta.
--------------------------------------------------------------------------- */
function DevolutivaModal({
  cand, vaga, onFechar, onSalvar, toast,
}: {
  cand: Candidato;
  vaga?: string | null;
  onFechar: () => void;
  onSalvar: (dados: Partial<Candidato>) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [motivo, setMotivo] = useState<MotivoDevolutiva>(
    (cand.devolutivaMotivo as MotivoDevolutiva) ?? "outro-perfil",
  );
  const [texto, setTexto] = useState(() => cand.devolutivaTexto ?? textoDevolutiva({ nome: cand.nome, vaga, motivo: "outro-perfil" }));
  // Só reescreve o texto enquanto o RH não tiver mexido nele.
  const [tocado, setTocado] = useState(!!cand.devolutivaTexto);

  const trocarMotivo = (m: MotivoDevolutiva) => {
    setMotivo(m);
    if (!tocado) setTexto(textoDevolutiva({ nome: cand.nome, vaga, motivo: m }));
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast("Texto copiado — é só colar no WhatsApp.");
    } catch {
      toast("Não consegui copiar. Selecione o texto e copie à mão.", "erro");
    }
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Devolutiva ao candidato"
      descricao={`${cand.nome}${vaga ? ` · ${vaga}` : ""}. O sistema monta o texto; você copia e manda.`}
      largura="max-w-lg"
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-outline" onClick={copiar}><Copy className="h-4 w-4" /> Copiar texto</button>
          <button
            className="btn-primary"
            onClick={() => {
              onSalvar({
                devolutivaEm: new Date().toISOString(),
                devolutivaMotivo: motivo,
                devolutivaTexto: texto.trim() || null,
              });
              onFechar();
            }}
          >
            Registrar como dada
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label="Motivo" hint="O que se diz é sobre o que a VAGA pedia, nunca sobre a pessoa.">
          <Select value={motivo} onChange={(e) => trocarMotivo(e.target.value as MotivoDevolutiva)}>
            {MOTIVOS_DEVOLUTIVA.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </Select>
        </Campo>
        <Campo label="Mensagem" hint="Pode ajustar antes de mandar.">
          <Textarea rows={8} value={texto} onChange={(e) => { setTexto(e.target.value); setTocado(true); }} />
        </Campo>
        {cand.devolutivaEm && (
          <p className="text-xs text-slate-500">Já registrada em {formatDate(cand.devolutivaEm)}.</p>
        )}
      </div>
    </Modal>
  );
}

function VagaForm({ vaga, onFechar, onSalvar }: { vaga: Vaga | null; onFechar: () => void; onSalvar: (dados: Partial<Vaga>, id?: string) => void }) {
  const d = useDominio();
  const [titulo, setTitulo] = useState(vaga?.titulo ?? "");
  const [areaId, setAreaId] = useState(vaga?.areaId ?? "");
  const [cargoId, setCargoId] = useState(vaga?.cargoId ?? "");
  const [nivelId, setNivelId] = useState(vaga?.nivelId ?? "");
  const [quantidade, setQuantidade] = useState(String(vaga?.quantidade ?? 1));
  const [status, setStatus] = useState<StatusVaga>(vaga?.status ?? "Aberta");
  const [descricao, setDescricao] = useState(vaga?.descricao ?? "");
  const [requisitos, setRequisitos] = useState(vaga?.requisitos ?? "");
  const [divulgacaoInterna, setDivulgacaoInterna] = useState<boolean>(vaga?.divulgacaoInterna ?? false);
  const cargosArea = d.cargos.filter((c) => !areaId || c.areaId === areaId);

  const salvar = () => {
    if (!titulo.trim()) return;
    onSalvar({ titulo: titulo.trim(), areaId: areaId || null, cargoId: cargoId || null, nivelId: nivelId || null, quantidade: Number(quantidade) || 1, status, descricao: descricao.trim(), requisitos: requisitos.trim(), divulgacaoInterna, dataAbertura: vaga?.dataAbertura ?? new Date().toISOString().slice(0, 10) }, vaga?.id);
  };

  return (
    <Modal aberto onFechar={onFechar} titulo={vaga ? "Editar vaga" : "Nova vaga"} largura="max-w-lg"
      rodape={<><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></>}>
      <div className="space-y-3">
        <Campo label="Título da vaga"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Designer Gráfico Pleno" autoFocus /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Área"><Select value={areaId} onChange={(e) => { setAreaId(e.target.value); setCargoId(""); }}><option value="">—</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></Campo>
          <Campo label="Cargo"><Select value={cargoId} onChange={(e) => setCargoId(e.target.value)}><option value="">—</option>{cargosArea.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Campo>
          <Campo label="Nível"><Select value={nivelId} onChange={(e) => setNivelId(e.target.value)}><option value="">—</option>{d.niveis.map((n) => <option key={n.id} value={n.id}>{n.codigo} — {n.nome}</option>)}</Select></Campo>
          <Campo label="Vagas"><Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></Campo>
        </div>
        <Campo label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as StatusVaga)}>{STATUS_VAGA.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Campo>
        <Campo label="Descrição"><Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Resumo da vaga…" /></Campo>
        <Campo label="Requisitos"><Textarea rows={2} value={requisitos} onChange={(e) => setRequisitos(e.target.value)} placeholder="Requisitos e diferenciais…" /></Campo>
        <div className="rounded-lg bg-amber-50/60 p-3">
          <Toggle checked={divulgacaoInterna} onChange={setDivulgacaoInterna} label="Divulgar no Mural de Vagas (disputa interna)" />
          <p className="mt-1 text-[11px] text-slate-500">Todos os colaboradores veem a vaga no mural e podem se candidatar. Enquanto a vaga estiver Aberta ou Em triagem.</p>
        </div>
      </div>
    </Modal>
  );
}

function CandidatoForm({ vagaId, cand, onFechar, onSalvar }: { vagaId: string; cand: Candidato | null; onFechar: () => void; onSalvar: (dados: Partial<Candidato>, arquivo: { nome: string; dataUrl: string } | null, id?: string) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(cand?.nome ?? "");
  const [email, setEmail] = useState(cand?.email ?? "");
  const [telefone, setTelefone] = useState(cand?.telefone ?? "");
  const [origem, setOrigem] = useState(cand?.origem ?? "");
  const [link, setLink] = useState(cand?.linkCurriculo ?? "");
  const [nota, setNota] = useState(cand?.nota != null ? String(cand.nota) : "");
  const [etapa, setEtapa] = useState<EtapaCandidato>(cand?.etapa ?? "Triagem");
  const [observacao, setObservacao] = useState(cand?.observacao ?? "");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string } | null>(null);
  /* Sem vaga = currículo do BANCO. Aí o que orienta a busca depois é a área e o
     cargo de interesse, não a etapa de um processo que não existe. */
  const noBanco = !vagaId;
  const [interesseAreaId, setInteresseAreaId] = useState(cand?.interesseAreaId ?? "");
  const [interesseCargoId, setInteresseCargoId] = useState(cand?.interesseCargoId ?? "");
  const dom = useDominio();

  const aoEscolherArquivo = (f: File) => {
    if (f.size > 5 * 1024 * 1024) { toast("Arquivo muito grande. Use até 5 MB.", "erro"); return; }
    const reader = new FileReader();
    reader.onload = () => setArquivo({ nome: f.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };

  const salvar = () => {
    if (!nome.trim()) return;
    const n = nota.trim() === "" ? null : Math.max(0, Math.min(10, Number(nota.replace(",", "."))));
    onSalvar({
      // `null`, não string vazia: é `!vagaId` que define "está no banco", e "" e
      // null se comportam igual aqui — null deixa a intenção explícita no dado.
      vagaId: vagaId || null,
      nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), origem: origem.trim(),
      linkCurriculo: arquivo ? "" : link.trim(), nota: n, etapa, observacao: observacao.trim(),
      interesseAreaId: interesseAreaId || null,
      interesseCargoId: interesseCargoId || null,
    }, arquivo, cand?.id);
  };

  return (
    <Modal aberto onFechar={onFechar} titulo={cand ? "Editar candidato" : noBanco ? "Guardar currículo no banco" : "Novo candidato"} largura="max-w-lg"
      rodape={<><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></>}>
      <div className="space-y-3">
        <Campo label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="E-mail"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          <Campo label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Campo>
          <Campo label="Origem"><Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="LinkedIn, indicação…" /></Campo>
          <Campo label="Nota (0–10)"><Input type="number" min={0} max={10} step="0.1" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: 8,5" /></Campo>
        </div>
        {noBanco ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Área de interesse" hint="É por aqui que se procura no banco.">
              <Select value={interesseAreaId} onChange={(e) => { setInteresseAreaId(e.target.value); setInteresseCargoId(""); }}>
                <option value="">Não definida</option>
                {dom.areas.filter((a) => a.id !== "direcao").map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Select>
            </Campo>
            <Campo label="Cargo de interesse">
              <Select value={interesseCargoId} onChange={(e) => setInteresseCargoId(e.target.value)}>
                <option value="">Não definido</option>
                {dom.cargos.filter((c) => !interesseAreaId || c.areaId === interesseAreaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Campo>
          </div>
        ) : (
          <Campo label="Etapa"><Select value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaCandidato)}>{ETAPAS.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Campo>
        )}
        <Campo label="Currículo (arquivo)">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) aoEscolherArquivo(e.target.files[0]); e.target.value = ""; }} />
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Anexar</button>
            <span className="truncate text-xs text-slate-500">{arquivo?.nome ?? (cand?.curriculoNome ? `Atual: ${cand.curriculoNome}` : "Nenhum arquivo")}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">O arquivo vai para a nuvem e aparece em todos os computadores (até 5 MB).</p>
        </Campo>
        <Campo label="…ou link do currículo"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…  (Drive, LinkedIn)" disabled={!!arquivo} /></Campo>
        <Campo label="Observações"><Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Avaliação, pontos fortes/fracos…" /></Campo>
      </div>
    </Modal>
  );
}
