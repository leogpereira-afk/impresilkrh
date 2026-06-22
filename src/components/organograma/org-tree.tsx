import Link from "next/link";
import { Avatar } from "@/components/ui/misc";

export interface NoOrg {
  id: string;
  nome: string;
  cargo: string | null;
  area: string | null;
  gestorId: string | null;
}

export function OrgTree({ no, todos }: { no: NoOrg; todos: NoOrg[] }) {
  const filhos = todos.filter((n) => n.gestorId === no.id);

  return (
    <div className="flex flex-col items-start">
      <Link
        href={`/colaboradores/${no.id}`}
        className="group flex w-60 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:border-brand hover:shadow-md"
      >
        <Avatar nome={no.nome} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand">
            {no.nome}
          </p>
          <p className="truncate text-xs text-slate-500">{no.cargo ?? "—"}</p>
        </div>
      </Link>

      {filhos.length > 0 && (
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-slate-200 pl-6">
          {filhos.map((f) => (
            <div key={f.id} className="relative">
              <span className="absolute -left-6 top-6 h-px w-6 bg-slate-200" />
              <OrgTree no={f} todos={todos} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
