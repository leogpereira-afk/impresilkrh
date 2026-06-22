"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";

export function BotaoDigest({ action }: { action: () => Promise<{ ok?: boolean; simulado?: boolean; erro?: string }> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() =>
          start(async () => {
            const r = await action();
            if (r?.erro) setMsg(r.erro);
            else if (r?.simulado) setMsg("Resumo gerado (e-mail em modo simulado — configure um provedor).");
            else setMsg("Resumo enviado por e-mail.");
          })
        }
        disabled={pending}
        className="btn-outline flex items-center gap-2"
      >
        <Mail className="h-4 w-4" /> {pending ? "Enviando…" : "Enviar resumo por e-mail"}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
