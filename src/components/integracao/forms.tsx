"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";

type Acao = (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;

function Salvar({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary">{pending ? "…" : label}</button>;
}

export function FormIniciar({
  action,
  colaboradores,
}: {
  action: Acao;
  colaboradores: { id: string; nome: string }[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  async function wrap(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro); else ref.current?.reset();
  }
  return (
    <form ref={ref} action={wrap} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <label className="label">Colaborador</label>
        <select name="colaboradorId" required className="input">
          <option value="">Selecione…</option>
          {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Tipo</label>
        <select name="tipo" className="input">
          <option value="Admissão">Integração (admissão)</option>
          <option value="Desligamento">Desligamento</option>
        </select>
      </div>
      <Salvar label="Iniciar checklist" />
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
    </form>
  );
}

export function FormAddTarefa({
  action,
  colaboradorId,
  tipo,
}: {
  action: Acao;
  colaboradorId: string;
  tipo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  async function wrap(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro); else { ref.current?.reset(); setAberto(false); }
  }
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
        <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
      </button>
    );
  }
  return (
    <form ref={ref} action={wrap} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2">
      <input type="hidden" name="colaboradorId" value={colaboradorId} />
      <input type="hidden" name="tipo" value={tipo} />
      <input name="titulo" required placeholder="Nova tarefa" className="input flex-1 text-sm" />
      <input name="responsavel" placeholder="Responsável" className="input w-32 text-sm" />
      <Salvar label="Adicionar" />
      <button type="button" onClick={() => setAberto(false)} className="btn-ghost p-1.5"><X className="h-4 w-4" /></button>
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
    </form>
  );
}
