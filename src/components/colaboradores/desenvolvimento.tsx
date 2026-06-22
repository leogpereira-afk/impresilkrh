"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X, Pencil, Trash2, Target, GitBranch, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress, EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { STATUS_META, STATUS_PDI, TIPOS_FEEDBACK } from "@/lib/constants";

type Acao = (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;

interface Meta {
  id: string; titulo: string; descricao: string | null; indicador: string | null;
  valorAlvo: number | null; valorAtual: number | null; unidade: string | null;
  prazo: Date | string | null; status: string;
}
interface Pdi {
  id: string; competencia: string; acao: string; resultadoEsperado: string | null;
  prazo: Date | string | null; progresso: number; status: string;
}
interface Fb {
  id: string; tipo: string; conteudo: string; contexto: string | null;
  criadoEm: Date | string; autor: { nome: string } | null;
}

function Salvar({ label = "Salvar" }: { label?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary">{pending ? "Salvando…" : label}</button>;
}

function badgeStatus(s: string) {
  if (s === "Concluída") return "success" as const;
  if (s === "Atrasada") return "danger" as const;
  if (s === "Não iniciada" || s === "Pendente") return "neutral" as const;
  return "info" as const;
}

function dataInput(d: Date | string | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

// ---------- METAS ----------
function MetaForm({ colaboradorId, action, meta, onDone }: { colaboradorId: string; action: Acao; meta?: Meta; onDone: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function wrap(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro); else { ref.current?.reset(); onDone(); }
  }
  return (
    <form ref={ref} action={wrap} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <input type="hidden" name="colaboradorId" value={colaboradorId} />
      {meta && <input type="hidden" name="id" value={meta.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">Título *</label><input name="titulo" required defaultValue={meta?.titulo} className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Descrição</label><input name="descricao" defaultValue={meta?.descricao ?? ""} className="input" /></div>
        <div><label className="label">Indicador</label><input name="indicador" defaultValue={meta?.indicador ?? ""} className="input" /></div>
        <div><label className="label">Unidade</label><input name="unidade" defaultValue={meta?.unidade ?? ""} className="input" placeholder="%, R$, un." /></div>
        <div><label className="label">Valor alvo</label><input name="valorAlvo" defaultValue={meta?.valorAlvo ?? ""} className="input" /></div>
        <div><label className="label">Valor atual</label><input name="valorAtual" defaultValue={meta?.valorAtual ?? ""} className="input" /></div>
        <div><label className="label">Prazo</label><input type="date" name="prazo" defaultValue={dataInput(meta?.prazo ?? null)} className="input" /></div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={meta?.status ?? "Em andamento"} className="input">
            {STATUS_META.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2"><Salvar /><button type="button" onClick={onDone} className="btn-outline">Cancelar</button></div>
    </form>
  );
}

function MetaRow({ meta, colaboradorId, salvar, remover }: { meta: Meta; colaboradorId: string; salvar: Acao; remover: (fd: FormData) => void }) {
  const [edit, setEdit] = useState(false);
  if (edit) return <MetaForm colaboradorId={colaboradorId} action={salvar} meta={meta} onDone={() => setEdit(false)} />;
  const pct = meta.valorAlvo && meta.valorAtual != null ? Math.min(100, (meta.valorAtual / meta.valorAlvo) * 100) : null;
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{meta.titulo}</span>
        <div className="flex items-center gap-1">
          <Badge variant={badgeStatus(meta.status)}>{meta.status}</Badge>
          <button onClick={() => setEdit(true)} className="btn-ghost p-1 text-slate-400 hover:text-brand"><Pencil className="h-3.5 w-3.5" /></button>
          <form action={remover}><input type="hidden" name="id" value={meta.id} /><input type="hidden" name="colaboradorId" value={colaboradorId} /><button className="btn-ghost p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></form>
        </div>
      </div>
      {meta.descricao && <p className="mb-2 text-xs text-slate-500">{meta.descricao}</p>}
      {pct != null && (<><Progress value={pct} /><p className="mt-1 text-xs text-slate-400">{meta.valorAtual} / {meta.valorAlvo} {meta.unidade ?? ""}{meta.prazo ? ` · prazo ${formatDate(meta.prazo)}` : ""}</p></>)}
    </div>
  );
}

// ---------- PDI ----------
function PdiForm({ colaboradorId, action, pdi, onDone }: { colaboradorId: string; action: Acao; pdi?: Pdi; onDone: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function wrap(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro); else { ref.current?.reset(); onDone(); }
  }
  return (
    <form ref={ref} action={wrap} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <input type="hidden" name="colaboradorId" value={colaboradorId} />
      {pdi && <input type="hidden" name="id" value={pdi.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">Competência *</label><input name="competencia" required defaultValue={pdi?.competencia} className="input" /></div>
        <div><label className="label">Prazo</label><input type="date" name="prazo" defaultValue={dataInput(pdi?.prazo ?? null)} className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Ação de desenvolvimento *</label><input name="acao" required defaultValue={pdi?.acao} className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Resultado esperado</label><input name="resultadoEsperado" defaultValue={pdi?.resultadoEsperado ?? ""} className="input" /></div>
        <div><label className="label">Progresso (%)</label><input type="number" name="progresso" min="0" max="100" defaultValue={pdi?.progresso ?? 0} className="input" /></div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={pdi?.status ?? "Em andamento"} className="input">
            {STATUS_PDI.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2"><Salvar /><button type="button" onClick={onDone} className="btn-outline">Cancelar</button></div>
    </form>
  );
}

function PdiRow({ pdi, colaboradorId, salvar, remover }: { pdi: Pdi; colaboradorId: string; salvar: Acao; remover: (fd: FormData) => void }) {
  const [edit, setEdit] = useState(false);
  if (edit) return <PdiForm colaboradorId={colaboradorId} action={salvar} pdi={pdi} onDone={() => setEdit(false)} />;
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{pdi.competencia}</span>
        <div className="flex items-center gap-1">
          <Badge variant={badgeStatus(pdi.status)}>{pdi.status}</Badge>
          <button onClick={() => setEdit(true)} className="btn-ghost p-1 text-slate-400 hover:text-brand"><Pencil className="h-3.5 w-3.5" /></button>
          <form action={remover}><input type="hidden" name="id" value={pdi.id} /><input type="hidden" name="colaboradorId" value={colaboradorId} /><button className="btn-ghost p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></form>
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-500">{pdi.acao}</p>
      <Progress value={pdi.progresso} cor="#c2a14d" />
      <p className="mt-1 text-xs text-slate-400">{pdi.progresso}%{pdi.prazo ? ` · prazo ${formatDate(pdi.prazo)}` : ""}</p>
    </div>
  );
}

// ---------- FEEDBACK ----------
function FeedbackForm({ colaboradorId, action, onDone }: { colaboradorId: string; action: Acao; onDone: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function wrap(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro); else { ref.current?.reset(); onDone(); }
  }
  return (
    <form ref={ref} action={wrap} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <input type="hidden" name="colaboradorId" value={colaboradorId} />
      <div>
        <label className="label">Tipo</label>
        <select name="tipo" className="input"> {TIPOS_FEEDBACK.map((t) => <option key={t} value={t}>{t}</option>)} </select>
      </div>
      <div><label className="label">Feedback *</label><textarea name="conteudo" required rows={3} className="input" /></div>
      <div><label className="label">Contexto</label><input name="contexto" className="input" placeholder="Ex.: projeto, reunião 1:1" /></div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2"><Salvar label="Registrar" /><button type="button" onClick={onDone} className="btn-outline">Cancelar</button></div>
    </form>
  );
}

function Secao({ titulo, icon, children, onAdd }: { titulo: string; icon: React.ReactNode; children: React.ReactNode; onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">{icon}{titulo}</h3>
        <button onClick={onAdd} className="btn-outline flex items-center gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function GestaoDesenvolvimento({
  colaboradorId, metas, pdis, feedbacks, podeGerir,
  salvarMeta, removerMeta, salvarPDI, removerPDI, salvarFeedback,
}: {
  colaboradorId: string;
  metas: Meta[]; pdis: Pdi[]; feedbacks: Fb[];
  podeGerir: boolean;
  salvarMeta: Acao; removerMeta: (fd: FormData) => void;
  salvarPDI: Acao; removerPDI: (fd: FormData) => void;
  salvarFeedback: Acao;
}) {
  const [addMeta, setAddMeta] = useState(false);
  const [addPdi, setAddPdi] = useState(false);
  const [addFb, setAddFb] = useState(false);

  if (!podeGerir) {
    return <EmptyState title="Gestão de desenvolvimento disponível para RH e gestores" />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Secao titulo="Metas" icon={<Target className="h-4 w-4 text-brand" />} onAdd={() => setAddMeta(true)}>
        {addMeta && <MetaForm colaboradorId={colaboradorId} action={salvarMeta} onDone={() => setAddMeta(false)} />}
        {metas.length === 0 && !addMeta ? <EmptyState title="Nenhuma meta" /> :
          metas.map((m) => <MetaRow key={m.id} meta={m} colaboradorId={colaboradorId} salvar={salvarMeta} remover={removerMeta} />)}
      </Secao>

      <Secao titulo="PDI" icon={<GitBranch className="h-4 w-4 text-brand" />} onAdd={() => setAddPdi(true)}>
        {addPdi && <PdiForm colaboradorId={colaboradorId} action={salvarPDI} onDone={() => setAddPdi(false)} />}
        {pdis.length === 0 && !addPdi ? <EmptyState title="Nenhuma ação de PDI" /> :
          pdis.map((p) => <PdiRow key={p.id} pdi={p} colaboradorId={colaboradorId} salvar={salvarPDI} remover={removerPDI} />)}
      </Secao>

      <div className="lg:col-span-2">
        <Secao titulo="Feedbacks" icon={<MessageSquare className="h-4 w-4 text-brand" />} onAdd={() => setAddFb(true)}>
          {addFb && <FeedbackForm colaboradorId={colaboradorId} action={salvarFeedback} onDone={() => setAddFb(false)} />}
          {feedbacks.length === 0 && !addFb ? <EmptyState title="Nenhum feedback" /> :
            feedbacks.map((f) => (
              <div key={f.id} className="rounded-xl border border-slate-100 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant={f.tipo === "Positivo" ? "success" : f.tipo === "Desenvolvimento" ? "warning" : "neutral"}>{f.tipo}</Badge>
                  <span className="text-xs text-slate-400">{formatDate(f.criadoEm)}</span>
                </div>
                <p className="text-sm text-slate-700">{f.conteudo}</p>
                {f.contexto && <p className="mt-1 text-xs text-slate-400">Contexto: {f.contexto}</p>}
                {f.autor && <p className="mt-1 text-xs text-slate-400">— {f.autor.nome}</p>}
              </div>
            ))}
        </Secao>
      </div>
    </div>
  );
}
