import { useMemo, useRef, useState } from "react";
import {
  Briefcase, Plus, Pencil, Trash2, Users, ChevronDown, ChevronRight,
  ExternalLink, Paperclip, Upload, Mail, Phone, Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Campo, Input, Textarea, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useToast } from "@/components/ui/toast";
import { putBlob, getBlob, delBlob } from "@/lib/blobstore";
import { cn } from "@/lib/cn";
import type { Vaga, Candidato, StatusVaga, EtapaCandidato } from "@/data/types";

const STATUS_VAGA: StatusVaga[] = ["Aberta", "Em triagem", "Fechada", "Cancelada"];
const ETAPAS: EtapaCandidato[] = ["Triagem", "Entrevista", "Teste", "Aprovado", "Reprovado", "Contratado"];

const corStatus = (s: StatusVaga) =>
  s === "Aberta" ? "success" : s === "Em triagem" ? "info" : s === "Cancelada" ? "danger" : "neutral";
const corEtapa = (e: EtapaCandidato) =>
  e === "Contratado" || e === "Aprovado" ? "success" : e === "Reprovado" ? "danger" : e === "Entrevista" || e === "Teste" ? "info" : "neutral";
const corNota = (n?: number | null) =>
  n == null ? "text-slate-300" : n >= 8 ? "text-green-600" : n >= 6 ? "text-amber-600" : "text-red-500";

export default function Vagas() {
  const { items: vagas, criar: criarVaga, atualizar: atualizarVaga, remover: removerVaga } = useColecao("vagas");
  const { items: candidatos, criar: criarCand, atualizar: atualizarCand, remover: removerCand } = useColecao("candidatos");
  const d = useDominio();
  const toast = useToast();

  const [formVaga, setFormVaga] = useState<Vaga | "nova" | null>(null);
  const [vagaExcluir, setVagaExcluir] = useState<Vaga | null>(null);
  const [formCand, setFormCand] = useState<{ vagaId: string; cand: Candidato | null } | null>(null);
  const [candExcluir, setCandExcluir] = useState<Candidato | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(vagas.filter((v) => v.status === "Aberta").map((v) => v.id)));

  const candPorVaga = useMemo(() => {
    const m = new Map<string, Candidato[]>();
    for (const c of candidatos) {
      const arr = m.get(c.vagaId) ?? [];
      arr.push(c);
      m.set(c.vagaId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1)); // ranqueia por nota
    return m;
  }, [candidatos]);

  const vagasOrdenadas = useMemo(() => {
    const ordem: Record<StatusVaga, number> = { "Aberta": 0, "Em triagem": 1, "Fechada": 2, "Cancelada": 3 };
    return [...vagas].sort((a, b) => (ordem[a.status] - ordem[b.status]) || a.titulo.localeCompare(b.titulo));
  }, [vagas]);

  const nAbertas = vagas.filter((v) => v.status === "Aberta" || v.status === "Em triagem").length;
  const emEntrevista = candidatos.filter((c) => c.etapa === "Entrevista" || c.etapa === "Teste").length;

  const toggle = (id: string) => setAbertas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const verCurriculo = async (c: Candidato) => {
    if (c.linkCurriculo) { window.open(c.linkCurriculo, "_blank", "noopener"); return; }
    if (c.curriculoEmBlob) {
      const dataUrl = await getBlob(`cv:${c.id}`);
      if (dataUrl) { const w = window.open(); if (w) w.document.write(`<iframe src="${dataUrl}" style="width:100%;height:100%;border:0"></iframe>`); }
      else toast("Currículo não encontrado neste computador.", "erro");
    }
  };

  const excluirVaga = (v: Vaga) => {
    for (const c of candPorVaga.get(v.id) ?? []) { if (c.curriculoEmBlob) void delBlob(`cv:${c.id}`); removerCand(c.id); }
    removerVaga(v.id);
    toast(`Vaga "${v.titulo}" removida.`);
  };
  const excluirCand = (c: Candidato) => {
    if (c.curriculoEmBlob) void delBlob(`cv:${c.id}`);
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
        <StatCard label="Vagas abertas" value={nAbertas} icon={<Briefcase className="h-5 w-5" />} accent="brand" />
        <StatCard label="Candidatos" value={candidatos.length} icon={<Users className="h-5 w-5" />} accent="blue" />
        <StatCard label="Em entrevista/teste" value={emEntrevista} icon={<Trophy className="h-5 w-5" />} accent="amber" />
      </div>

      {vagasOrdenadas.length === 0 ? (
        <EmptyState title="Nenhuma vaga cadastrada" description="Crie uma vaga para começar a registrar candidatos e classificá-los." icon={<Briefcase className="h-8 w-8" />} />
      ) : (
        <div className="space-y-4">
          {vagasOrdenadas.map((v) => {
            const lista = candPorVaga.get(v.id) ?? [];
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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    <Users className="h-3.5 w-3.5" /> {lista.length}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
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
                        {lista.map((c, i) => (
                          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500" title={`${i + 1}º classificado`}>{i + 1}º</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">{c.nome}</p>
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
                            {(c.curriculoEmBlob || c.linkCurriculo) && (
                              <button onClick={() => verCurriculo(c)} title="Ver currículo" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand">
                                {c.linkCurriculo ? <ExternalLink className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
                              </button>
                            )}
                            <div className="flex shrink-0 gap-0.5">
                              <button onClick={() => setFormCand({ vagaId: v.id, cand: c })} title="Editar candidato" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => setCandExcluir(c)} title="Remover candidato" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
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
            if (id) atualizarCand(id, dados);
            else { const r = criarCand({ etapa: "Triagem", criadoEm: new Date().toISOString(), ...dados }); alvoId = r.id; }
            if (arquivo && alvoId) {
              const ok = await putBlob(`cv:${alvoId}`, arquivo.dataUrl);
              if (ok) atualizarCand(alvoId, { curriculoEmBlob: true, curriculoNome: arquivo.nome, linkCurriculo: "" });
              else toast("Não foi possível guardar o arquivo (muito grande?).", "erro");
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
  const cargosArea = d.cargos.filter((c) => !areaId || c.areaId === areaId);

  const salvar = () => {
    if (!titulo.trim()) return;
    onSalvar({ titulo: titulo.trim(), areaId: areaId || null, cargoId: cargoId || null, nivelId: nivelId || null, quantidade: Number(quantidade) || 1, status, descricao: descricao.trim(), requisitos: requisitos.trim(), dataAbertura: vaga?.dataAbertura ?? new Date().toISOString().slice(0, 10) }, vaga?.id);
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

  const aoEscolherArquivo = (f: File) => {
    if (f.size > 5 * 1024 * 1024) { toast("Arquivo muito grande. Use até 5 MB.", "erro"); return; }
    const reader = new FileReader();
    reader.onload = () => setArquivo({ nome: f.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };

  const salvar = () => {
    if (!nome.trim()) return;
    const n = nota.trim() === "" ? null : Math.max(0, Math.min(10, Number(nota.replace(",", "."))));
    onSalvar({ vagaId, nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), origem: origem.trim(), linkCurriculo: arquivo ? "" : link.trim(), nota: n, etapa, observacao: observacao.trim() }, arquivo, cand?.id);
  };

  return (
    <Modal aberto onFechar={onFechar} titulo={cand ? "Editar candidato" : "Novo candidato"} largura="max-w-lg"
      rodape={<><button className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></>}>
      <div className="space-y-3">
        <Campo label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="E-mail"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          <Campo label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Campo>
          <Campo label="Origem"><Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="LinkedIn, indicação…" /></Campo>
          <Campo label="Nota (0–10)"><Input type="number" min={0} max={10} step="0.1" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: 8,5" /></Campo>
        </div>
        <Campo label="Etapa"><Select value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaCandidato)}>{ETAPAS.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Campo>
        <Campo label="Currículo (arquivo)">
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) aoEscolherArquivo(e.target.files[0]); e.target.value = ""; }} />
          <div className="flex items-center gap-2">
            <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Anexar</button>
            <span className="truncate text-xs text-slate-500">{arquivo?.nome ?? (cand?.curriculoNome ? `Atual: ${cand.curriculoNome}` : "Nenhum arquivo")}</span>
          </div>
        </Campo>
        <Campo label="…ou link do currículo"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…  (Drive, LinkedIn)" disabled={!!arquivo} /></Campo>
        <Campo label="Observações"><Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Avaliação, pontos fortes/fracos…" /></Campo>
      </div>
    </Modal>
  );
}
