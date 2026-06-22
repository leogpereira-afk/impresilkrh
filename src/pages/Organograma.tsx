import { useMemo, useState } from "react";
import { Network, SlidersHorizontal, ChevronDown, ChevronRight, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { idsDaEquipe, ehRH } from "@/lib/rbac";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { Colaborador } from "@/data/types";

function corNode(c: Colaborador, ehGer: boolean): { box: string; sub: string } {
  if (!c.gestorId && c.ehDirecao) return { box: "bg-green-600 text-white", sub: "text-green-100" };
  if (c.cargoLivre === "Diretor Geral") return { box: "bg-brand text-white", sub: "text-brand-100" };
  if (c.statusId === "externo") return { box: "bg-slate-100 text-slate-600 border border-dashed border-slate-300", sub: "text-slate-400" };
  if (ehGer) return { box: "bg-teal-500 text-white", sub: "text-teal-50" };
  return { box: "bg-white text-slate-700 border border-slate-200", sub: "text-slate-400" };
}

export default function Organograma() {
  const sessao = useSessao();
  const d = useDominio();
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [mostrarPainel, setMostrarPainel] = useState(false);

  const filhosPorGestor = useMemo(() => {
    const m = new Map<string, Colaborador[]>();
    for (const c of d.colaboradores) {
      if (c.gestorId) {
        const arr = m.get(c.gestorId) ?? [];
        arr.push(c);
        m.set(c.gestorId, arr);
      }
    }
    return m;
  }, [d.colaboradores]);

  const raizes = useMemo(
    () => d.colaboradores.filter((c) => !c.gestorId || !d.colabById.has(c.gestorId)),
    [d.colaboradores, d.colabById],
  );

  const ehGerente = (c: Colaborador) => (filhosPorGestor.get(c.id)?.length ?? 0) > 0 && !c.ehDirecao;

  const toggle = (id: string) =>
    setColapsados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const Node = ({ c }: { c: Colaborador }) => {
    const filhos = filhosPorGestor.get(c.id) ?? [];
    const ger = ehGerente(c);
    const cor = corNode(c, ger);
    const colapsado = colapsados.has(c.id);
    return (
      <li>
        <div className="org-node">
          <div className={cn("mx-auto w-44 rounded-xl px-3 py-2 text-center shadow-card", cor.box)}>
            <p className="truncate text-sm font-semibold">{c.nome}</p>
            <p className={cn("truncate text-[11px]", cor.sub)}>{d.nomeCargo(c)}</p>
            {filhos.length > 0 && (
              <button onClick={() => toggle(c.id)} className="mx-auto mt-1 flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium">
                {colapsado ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {filhos.length}
              </button>
            )}
          </div>
        </div>
        {filhos.length > 0 && !colapsado && (
          <ul>
            {filhos.map((f) => <Node key={f.id} c={f} />)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div>
      <PageHeader title="Organograma" description="Estrutura hierárquica da Impresilk — navegue expandindo e recolhendo as equipes.">
        {ehRH(sessao) && (
          <button className="btn-outline" onClick={() => setMostrarPainel((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" /> {mostrarPainel ? "Ocultar" : "Editar hierarquia"}
          </button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <Legenda cor="bg-green-600" label="Fundadores" />
        <Legenda cor="bg-brand" label="Diretoria" />
        <Legenda cor="bg-teal-500" label="Gestores / Líderes" />
        <Legenda cor="bg-slate-300" label="Assessorias (externas)" />
        <Legenda cor="bg-white border border-slate-300" label="Equipe" />
      </div>

      <Card className="overflow-x-auto">
        <CardBody>
          <div className="min-w-[720px] pb-4">
            <ul className="org-tree">
              {raizes.map((c) => <Node key={c.id} c={c} />)}
            </ul>
          </div>
        </CardBody>
      </Card>

      {mostrarPainel && ehRH(sessao) && <PainelHierarquia />}
    </div>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", cor)} /> {label}
    </span>
  );
}

function PainelHierarquia() {
  const toast = useToast();
  const d = useDominio();
  const { atualizar } = useColecao("colaboradores");

  const alterarGestor = (c: Colaborador, novoGestor: string) => {
    // Proteção a ciclos: o novo gestor não pode ser o próprio nem um subordinado.
    if (novoGestor) {
      const subordinados = idsDaEquipe(c.id, d.colaboradores);
      if (subordinados.includes(novoGestor)) {
        toast("Operação inválida: criaria um ciclo na hierarquia.", "erro");
        return;
      }
    }
    atualizar(c.id, { gestorId: novoGestor || null });
    toast(`Gestor de ${c.nome} atualizado.`);
  };

  const ordenados = [...d.colaboradores].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <Card className="mt-6">
      <CardHeader title="Painel de hierarquia" subtitle="Redefina a quem cada pessoa se reporta (com proteção a ciclos)." icon={<Network className="h-[18px] w-[18px]" />} />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordenados.map((c) => {
            const subordinados = new Set(idsDaEquipe(c.id, d.colaboradores));
            return (
              <div key={c.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <p className="truncate text-sm font-medium text-slate-700">{c.nome}</p>
                  {c.ehDirecao && <Badge variant="neutral">Direção</Badge>}
                </div>
                <Select value={c.gestorId ?? ""} onChange={(e) => alterarGestor(c, e.target.value)}>
                  <option value="">— topo (sem gestor) —</option>
                  {d.colaboradores
                    .filter((g) => g.id !== c.id && !subordinados.has(g.id))
                    .map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </Select>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
