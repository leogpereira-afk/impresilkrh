"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function Salvar({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Salvando…" : label}
    </button>
  );
}

function useReset(action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  async function wrapper(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro);
    else ref.current?.reset();
  }
  return { ref, erro, wrapper };
}

export function FormStatus({
  action,
}: {
  action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
}) {
  const { ref, erro, wrapper } = useReset(action);
  return (
    <form ref={ref} action={wrapper} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Nome do status</label>
        <input name="nome" required className="input" placeholder="Ex.: Afastado" />
      </div>
      <div>
        <label className="label">Cor</label>
        <input type="color" name="cor" defaultValue="#64748b" className="h-10 w-16 rounded-lg border border-slate-200 p-1" />
      </div>
      <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-600">
        <input type="checkbox" name="contaComoAtivo" defaultChecked className="rounded border-slate-300" />
        Conta como ativo
      </label>
      <Salvar label="Adicionar" />
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
    </form>
  );
}

export function FormCiclo({
  action,
}: {
  action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
}) {
  const { ref, erro, wrapper } = useReset(action);
  return (
    <form ref={ref} action={wrapper} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="label">Nome do ciclo</label>
        <input name="nome" required className="input" placeholder="Ex.: 2026.2" />
      </div>
      <div>
        <label className="label">Início</label>
        <input type="date" name="dataInicio" required className="input" />
      </div>
      <div>
        <label className="label">Fim</label>
        <input type="date" name="dataFim" required className="input" />
      </div>
      <div>
        <label className="label">Nota mínima p/ promoção</label>
        <input name="notaMinPromocao" type="number" defaultValue="80" className="input" />
      </div>
      <div>
        <label className="label">Meses mínimos no nível</label>
        <input name="mesesMinNivel" type="number" defaultValue="12" className="input" />
      </div>
      <div className="flex items-end">
        <Salvar label="Criar ciclo" />
      </div>
      {erro && <p className="text-xs text-red-600 sm:col-span-2 lg:col-span-3">{erro}</p>}
    </form>
  );
}
