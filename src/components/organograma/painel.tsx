"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/misc";
import { Check, AlertTriangle } from "lucide-react";

interface Pessoa {
  id: string;
  nome: string;
  cargo: string | null;
  gestorId: string | null;
}

export function PainelOrganograma({
  pessoas,
  action,
}: {
  pessoas: Pessoa[];
  action: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ id: string; texto: string; erro: boolean } | null>(null);

  function alterar(colaboradorId: string, gestorId: string) {
    start(async () => {
      const fd = new FormData();
      fd.append("colaboradorId", colaboradorId);
      fd.append("gestorId", gestorId);
      const r = await action(fd);
      setMsg({ id: colaboradorId, texto: r?.erro ?? "Salvo", erro: !!r?.erro });
      setTimeout(() => setMsg(null), 4000);
    });
  }

  const ordenadas = [...pessoas].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="th">Colaborador</th>
            <th className="th">Reporta-se a (gestor)</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ordenadas.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/60">
              <td className="td">
                <div className="flex items-center gap-2.5">
                  <Avatar nome={p.nome} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{p.nome}</p>
                    <p className="truncate text-xs text-slate-500">{p.cargo ?? "—"}</p>
                  </div>
                </div>
              </td>
              <td className="td">
                <select
                  defaultValue={p.gestorId ?? ""}
                  disabled={pending}
                  onChange={(e) => alterar(p.id, e.target.value)}
                  className="input w-full max-w-xs"
                >
                  <option value="">— Sem gestor (topo) —</option>
                  {ordenadas
                    .filter((g) => g.id !== p.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                </select>
              </td>
              <td className="td">
                {msg?.id === p.id && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${msg.erro ? "text-red-600" : "text-green-600"}`}
                  >
                    {msg.erro ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {msg.texto}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
