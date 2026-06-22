"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PenLine, X } from "lucide-react";

type Acao = (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;

function Confirmar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary flex items-center gap-2">
      <PenLine className="h-4 w-4" /> {pending ? "Registrando…" : "Li e aceito"}
    </button>
  );
}

export function FormAceite({
  action,
  tipo,
  referencia,
  versao,
  titulo,
  conteudo,
}: {
  action: Acao;
  tipo: string;
  referencia?: string | null;
  versao?: string | null;
  titulo: string;
  conteudo?: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function wrap(fd: FormData) {
    setErro(null);
    const r = await action(fd);
    if (r?.erro) setErro(r.erro);
    else setAberto(false);
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-primary flex items-center gap-2">
        <PenLine className="h-4 w-4" /> Ler e aceitar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" onClick={() => setAberto(false)} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-brand-ink">{titulo}{versao ? ` · v${versao}` : ""}</h3>
          <button onClick={() => setAberto(false)} className="btn-ghost p-1"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {conteudo ? (
            <div className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{conteudo}</div>
          ) : (
            <p className="text-sm text-slate-500">Documento disponível para leitura e aceite.</p>
          )}
        </div>

        <form action={wrap} className="space-y-3 border-t border-slate-100 px-5 py-4">
          <input type="hidden" name="tipo" value={tipo} />
          {referencia && <input type="hidden" name="referencia" value={referencia} />}
          {versao && <input type="hidden" name="versao" value={versao} />}
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="confirmo" className="mt-0.5 rounded border-slate-300" />
            Declaro que li, compreendi e concordo com o conteúdo deste documento.
          </label>
          <div>
            <label className="label">Confirme digitando seu nome completo</label>
            <input name="nomeConfirmado" className="input" placeholder="Seu nome completo" />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className="btn-outline">Cancelar</button>
            <Confirmar />
          </div>
        </form>
      </div>
    </div>
  );
}
