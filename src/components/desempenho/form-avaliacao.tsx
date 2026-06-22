"use client";

import { useState, useMemo, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardCheck, X, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AvaliacaoExistente {
  notaTecnico: number | null;
  notaComportamental: number | null;
  notaResultado: number | null;
  tempoNoNivelMeses: number | null;
  advertencia: boolean;
  liderancaAprovou: boolean;
  planoAcao: string | null;
  comentarios: string | null;
}

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Salvando…" : "Salvar avaliação"}
    </button>
  );
}

export function FormAvaliacao({
  action,
  cicloId,
  cicloNome,
  pesos,
  notaMinPromocao,
  mesesMinNivel,
  colaboradores,
  existentes,
}: {
  action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
  cicloId: string;
  cicloNome: string;
  pesos: { tecnico: number; comportamental: number; resultado: number };
  notaMinPromocao: number;
  mesesMinNivel: number;
  colaboradores: { id: string; nome: string; cargo: string | null }[];
  existentes: Record<string, AvaliacaoExistente>;
}) {
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState("");
  const [nt, setNt] = useState("");
  const [nc, setNc] = useState("");
  const [nr, setNr] = useState("");
  const [tempo, setTempo] = useState("");
  const [adv, setAdv] = useState(false);
  const [lider, setLider] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function carregar(id: string) {
    setSel(id);
    const e = existentes[id];
    setNt(e?.notaTecnico != null ? String(e.notaTecnico) : "");
    setNc(e?.notaComportamental != null ? String(e.notaComportamental) : "");
    setNr(e?.notaResultado != null ? String(e.notaResultado) : "");
    setTempo(e?.tempoNoNivelMeses != null ? String(e.tempoNoNivelMeses) : "");
    setAdv(e?.advertencia ?? false);
    setLider(e?.liderancaAprovou ?? false);
  }

  const notaFinal = useMemo(() => {
    const t = parseFloat(nt.replace(",", ".")) || 0;
    const c = parseFloat(nc.replace(",", ".")) || 0;
    const r = parseFloat(nr.replace(",", ".")) || 0;
    if (!nt && !nc && !nr) return null;
    return +(t * pesos.tecnico + c * pesos.comportamental + r * pesos.resultado).toFixed(1);
  }, [nt, nc, nr, pesos]);

  const elegivel = useMemo(() => {
    if (notaFinal == null) return false;
    const m = parseInt(tempo, 10) || 0;
    return notaFinal >= notaMinPromocao && m >= mesesMinNivel && lider && !adv;
  }, [notaFinal, tempo, lider, adv, notaMinPromocao, mesesMinNivel]);

  async function wrapper(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro);
    else {
      formRef.current?.reset();
      setSel(""); setNt(""); setNc(""); setNr(""); setTempo(""); setAdv(false); setLider(false);
      setAberto(false);
    }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-primary flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4" /> Registrar avaliação
      </button>
    );
  }

  const editando = sel && existentes[sel];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ClipboardCheck className="h-4 w-4 text-brand" />
          {editando ? "Editar avaliação" : "Nova avaliação"} · {cicloNome}
        </h3>
        <button onClick={() => setAberto(false)} className="btn-ghost p-1"><X className="h-4 w-4" /></button>
      </div>

      <form ref={formRef} action={wrapper} className="space-y-4">
        <input type="hidden" name="cicloId" value={cicloId} />

        <div>
          <label className="label">Colaborador *</label>
          <select name="colaboradorId" required value={sel} onChange={(e) => carregar(e.target.value)} className="input">
            <option value="">Selecione…</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}{c.cargo ? ` — ${c.cargo}` : ""}{existentes[c.id] ? " (avaliado)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Técnico ({Math.round(pesos.tecnico * 100)}%)</label>
            <input name="notaTecnico" value={nt} onChange={(e) => setNt(e.target.value)} inputMode="decimal" className="input" placeholder="0–100" />
          </div>
          <div>
            <label className="label">Comportamental ({Math.round(pesos.comportamental * 100)}%)</label>
            <input name="notaComportamental" value={nc} onChange={(e) => setNc(e.target.value)} inputMode="decimal" className="input" placeholder="0–100" />
          </div>
          <div>
            <label className="label">Resultados ({Math.round(pesos.resultado * 100)}%)</label>
            <input name="notaResultado" value={nr} onChange={(e) => setNr(e.target.value)} inputMode="decimal" className="input" placeholder="0–100" />
          </div>
        </div>

        {/* Prévia da nota final e elegibilidade */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Nota final (ponderada):</span>
            <span className="text-lg font-bold text-brand-ink">{notaFinal != null ? notaFinal.toFixed(1) : "—"}</span>
          </div>
          {elegivel && (
            <Badge variant="gold"><Award className="h-3 w-3" /> Elegível a promoção</Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Tempo no nível (meses)</label>
            <input name="tempoNoNivelMeses" value={tempo} onChange={(e) => setTempo(e.target.value)} inputMode="numeric" className="input" placeholder={`mín. ${mesesMinNivel}`} />
          </div>
          <label className="flex items-center gap-2 pt-7 text-sm text-slate-600">
            <input type="checkbox" name="liderancaAprovou" checked={lider} onChange={(e) => setLider(e.target.checked)} className="rounded border-slate-300" />
            Liderança aprovou
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm text-slate-600">
            <input type="checkbox" name="advertencia" checked={adv} onChange={(e) => setAdv(e.target.checked)} className="rounded border-slate-300" />
            Possui advertência
          </label>
        </div>

        <div>
          <label className="label">Plano de ação</label>
          <input name="planoAcao" defaultValue={editando ? existentes[sel].planoAcao ?? "" : ""} className="input" />
        </div>
        <div>
          <label className="label">Comentários</label>
          <textarea name="comentarios" defaultValue={editando ? existentes[sel].comentarios ?? "" : ""} rows={3} className="input" />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setAberto(false)} className="btn-outline">Cancelar</button>
          <Salvar />
        </div>
      </form>
    </div>
  );
}
