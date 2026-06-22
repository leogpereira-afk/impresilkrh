"use client";

import { useState, useMemo, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plane, X, Plus } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { STATUS_VIAGEM } from "@/lib/constants";

type Acao = (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;

function Salvar() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary">{pending ? "Salvando…" : "Salvar viagem"}</button>;
}

export function FormViagem({
  action,
  colaboradores,
}: {
  action: Acao;
  colaboradores: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [diaria, setDiaria] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  const previsao = useMemo(() => {
    if (!ini || !fim) return null;
    const di = new Date(ini), df = new Date(fim);
    if (isNaN(di.getTime()) || isNaN(df.getTime()) || df < di) return null;
    const dias = Math.round((df.getTime() - di.getTime()) / 86400000) + 1;
    const d = parseFloat(diaria.replace(",", ".")) || 0;
    return { dias, total: dias * d };
  }, [ini, fim, diaria]);

  async function wrap(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro);
    else { ref.current?.reset(); setIni(""); setFim(""); setDiaria(""); setAberto(false); }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-primary flex items-center gap-2">
        <Plus className="h-4 w-4" /> Nova viagem
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Plane className="h-4 w-4 text-brand" /> Nova viagem</h3>
        <button onClick={() => setAberto(false)} className="btn-ghost p-1"><X className="h-4 w-4" /></button>
      </div>
      <form ref={ref} action={wrap} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Colaborador *</label>
            <select name="colaboradorId" required className="input">
              <option value="">Selecione…</option>
              {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div><label className="label">Destino *</label><input name="destino" required className="input" placeholder="Cidade/UF" /></div>
          <div><label className="label">Início *</label><input type="date" name="dataInicio" required value={ini} onChange={(e) => setIni(e.target.value)} className="input" /></div>
          <div><label className="label">Fim *</label><input type="date" name="dataFim" required value={fim} onChange={(e) => setFim(e.target.value)} className="input" /></div>
          <div><label className="label">Valor da diária</label><input name="valorDiaria" value={diaria} onChange={(e) => setDiaria(e.target.value)} inputMode="decimal" className="input" placeholder="0,00" /></div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input">{STATUS_VIAGEM.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>
        </div>
        <div><label className="label">Finalidade</label><input name="finalidade" className="input" defaultValue="Instalação e montagem em campo" /></div>

        {previsao && (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">{previsao.dias} diária(s)</span>
            <span className="font-semibold text-brand-ink">Total estimado: {formatBRL(previsao.total)}</span>
          </div>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setAberto(false)} className="btn-outline">Cancelar</button>
          <Salvar />
        </div>
      </form>
    </div>
  );
}
