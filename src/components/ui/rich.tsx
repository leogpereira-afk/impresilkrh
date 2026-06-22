import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { Bloco, BlocoTipo } from "@/data/types";
import { Select, Textarea } from "./form";

// ---------- Renderização de conteúdo rico ----------
export function RichContent({ blocos }: { blocos: Bloco[] }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      {blocos.map((b, i) => (
        <BlocoView key={i} b={b} />
      ))}
    </div>
  );
}

function BlocoView({ b }: { b: Bloco }) {
  switch (b.tipo) {
    case "titulo":
      return <h3 className="text-lg font-semibold tracking-tight text-brand-ink">{b.texto}</h3>;
    case "subtitulo":
      return (
        <h4 className="flex items-center gap-2 pt-1 text-sm font-semibold uppercase tracking-wide text-brand">
          <span className="h-3 w-0.5 rounded-full bg-gold" />
          {b.texto}
        </h4>
      );
    case "paragrafo":
      return <p>{b.texto}</p>;
    case "lista":
      return (
        <ul className="space-y-1.5">
          {(b.itens ?? []).map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case "passos":
      return (
        <ol className="space-y-2">
          {(b.itens ?? []).map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">
                {i + 1}
              </span>
              <span className="pt-0.5">{it}</span>
            </li>
          ))}
        </ol>
      );
    case "destaque":
      return (
        <div className="rounded-lg border border-gold-200 bg-gold-50/60 px-4 py-3 text-sm font-medium text-gold-700">
          {b.texto}
        </div>
      );
    default:
      return null;
  }
}

// ---------- Editor de blocos (Painel de Controle) ----------
const TIPOS: { id: BlocoTipo; label: string }[] = [
  { id: "titulo", label: "Título" },
  { id: "subtitulo", label: "Subtítulo" },
  { id: "paragrafo", label: "Parágrafo" },
  { id: "lista", label: "Lista" },
  { id: "passos", label: "Passos" },
  { id: "destaque", label: "Destaque" },
];

const ehLista = (t: BlocoTipo) => t === "lista" || t === "passos";

export function BlockEditor({
  blocos,
  onChange,
}: {
  blocos: Bloco[];
  onChange: (b: Bloco[]) => void;
}) {
  const set = (i: number, patch: Partial<Bloco>) =>
    onChange(blocos.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocos.length) return;
    const novo = [...blocos];
    [novo[i], novo[j]] = [novo[j], novo[i]];
    onChange(novo);
  };
  const remover = (i: number) => onChange(blocos.filter((_, idx) => idx !== i));
  const adicionar = () => onChange([...blocos, { tipo: "paragrafo", texto: "" }]);

  return (
    <div className="space-y-3">
      {blocos.map((b, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Select
              value={b.tipo}
              onChange={(e) => {
                const tipo = e.target.value as BlocoTipo;
                set(i, {
                  tipo,
                  texto: ehLista(tipo) ? undefined : b.texto ?? "",
                  itens: ehLista(tipo) ? b.itens ?? [] : undefined,
                });
              }}
              className="w-40"
            >
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" className="btn-ghost p-1.5" onClick={() => mover(i, -1)} title="Mover para cima">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => mover(i, 1)} title="Mover para baixo">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost p-1.5 text-red-500" onClick={() => remover(i)} title="Remover">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {ehLista(b.tipo) ? (
            <Textarea
              value={(b.itens ?? []).join("\n")}
              onChange={(e) => set(i, { itens: e.target.value.split("\n").filter((l) => l.trim() !== "") })}
              placeholder="Um item por linha"
              rows={Math.max(3, (b.itens ?? []).length)}
            />
          ) : (
            <Textarea
              value={b.texto ?? ""}
              onChange={(e) => set(i, { texto: e.target.value })}
              placeholder="Texto do bloco"
              rows={2}
            />
          )}
        </div>
      ))}
      <button type="button" className="btn-outline w-full" onClick={adicionar}>
        <Plus className="h-4 w-4" /> Adicionar bloco
      </button>
    </div>
  );
}
