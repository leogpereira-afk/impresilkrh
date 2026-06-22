import { useMemo, useRef, useState } from "react";
import {
  Network,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Users,
  UserPlus,
  UserMinus,
  Camera,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Campo, Input, Select } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { idsDaEquipe, ehRH } from "@/lib/rbac";
import { useToast } from "@/components/ui/toast";
import { slug } from "@/data/_gen";
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
  const toast = useToast();
  const { criar, atualizar, remover } = useColecao("colaboradores");
  const podeEditar = ehRH(sessao);

  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [mostrarPainel, setMostrarPainel] = useState(false);
  const [adicionarEm, setAdicionarEm] = useState<Colaborador | null>(null);
  const [removerAlvo, setRemoverAlvo] = useState<Colaborador | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const fotoAlvoRef = useRef<string | null>(null);

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

  // Remove uma pessoa do organograma: os subordinados diretos são reposicionados
  // sob o gestor da pessoa removida (reparent) e, em seguida, o registro é excluído.
  const removerDoOrganograma = (c: Colaborador) => {
    const filhos = filhosPorGestor.get(c.id) ?? [];
    for (const f of filhos) atualizar(f.id, { gestorId: c.gestorId ?? null });
    remover(c.id);
    toast(
      filhos.length > 0
        ? `${c.nome} removido(a) do organograma. ${filhos.length} subordinado(s) reposicionado(s).`
        : `${c.nome} removido(a) do organograma.`,
    );
  };

  // Upload de foto (≤ 1 MB) → data URL → atualiza o colaborador.
  const abrirSeletorFoto = (id: string) => {
    fotoAlvoRef.current = id;
    fotoInputRef.current?.click();
  };

  const aoSelecionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = fotoAlvoRef.current;
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file || !id) return;
    if (!file.type.startsWith("image/")) {
      toast("Selecione um arquivo de imagem.", "erro");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast("Imagem acima de 1 MB. Escolha um arquivo menor.", "erro");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      atualizar(id, { fotoDataUrl: String(reader.result) });
      toast("Foto atualizada.");
    };
    reader.readAsDataURL(file);
  };

  const Node = ({ c }: { c: Colaborador }) => {
    const filhos = filhosPorGestor.get(c.id) ?? [];
    const ger = ehGerente(c);
    const cor = corNode(c, ger);
    const colapsado = colapsados.has(c.id);
    return (
      <li>
        <div className="org-node">
          <div className={cn("group relative mx-auto w-44 rounded-xl px-3 py-2 text-center shadow-card", cor.box)}>
            {podeEditar && (
              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setAdicionarEm(c)}
                  title="Adicionar subordinado"
                  aria-label={`Adicionar subordinado a ${c.nome}`}
                  className="rounded-full bg-black/10 p-1 hover:bg-black/20"
                >
                  <UserPlus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => abrirSeletorFoto(c.id)}
                  title="Enviar foto"
                  aria-label={`Enviar foto de ${c.nome}`}
                  className="rounded-full bg-black/10 p-1 hover:bg-black/20"
                >
                  <Camera className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoverAlvo(c)}
                  title="Remover do organograma"
                  aria-label={`Remover ${c.nome} do organograma`}
                  className="rounded-full bg-black/10 p-1 hover:bg-black/20"
                >
                  <UserMinus className="h-3 w-3" />
                </button>
              </div>
            )}
            {c.fotoDataUrl ? (
              <img
                src={c.fotoDataUrl}
                alt={c.nome}
                title={c.nome}
                className="mx-auto mb-1 h-8 w-8 rounded-full object-cover ring-2 ring-white/70"
              />
            ) : (
              <Avatar nome={c.nome} size="sm" className="mx-auto mb-1 ring-2 ring-white/70" />
            )}
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
        {podeEditar && (
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

      {mostrarPainel && podeEditar && <PainelHierarquia />}

      {podeEditar && (
        <>
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={aoSelecionarFoto}
          />
          {adicionarEm && (
            <ModalAdicionarSubordinado
              gestor={adicionarEm}
              onFechar={() => setAdicionarEm(null)}
              onCriar={(dados) => {
                const id = slug(dados.nome) || `colab_${Date.now().toString(36)}`;
                if (d.colabById.has(id)) {
                  toast("Já existe uma pessoa com esse nome. Ajuste o nome.", "erro");
                  return;
                }
                criar({
                  id,
                  nome: dados.nome,
                  areaId: dados.areaId || null,
                  cargoId: dados.cargoId || null,
                  nivelId: dados.nivelId || null,
                  gestorId: adicionarEm.id,
                  statusId: "ativo",
                  perfil: "COLABORADOR",
                });
                toast(`${dados.nome} adicionado(a) sob ${adicionarEm.nome}.`);
                setAdicionarEm(null);
              }}
            />
          )}
          {removerAlvo && (
            <ConfirmDialog
              aberto
              onFechar={() => setRemoverAlvo(null)}
              onConfirmar={() => removerDoOrganograma(removerAlvo)}
              titulo="Remover do organograma"
              textoConfirmar="Remover"
              mensagem={
                <>
                  Remover <strong>{removerAlvo.nome}</strong> do organograma?
                  {(filhosPorGestor.get(removerAlvo.id)?.length ?? 0) > 0 && (
                    <>
                      {" "}Os {filhosPorGestor.get(removerAlvo.id)!.length} subordinado(s) direto(s)
                      passarão a se reportar ao gestor atual desta pessoa.
                    </>
                  )}
                </>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function ModalAdicionarSubordinado({
  gestor,
  onFechar,
  onCriar,
}: {
  gestor: Colaborador;
  onFechar: () => void;
  onCriar: (dados: { nome: string; areaId: string; cargoId: string; nivelId: string }) => void;
}) {
  const d = useDominio();
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [areaId, setAreaId] = useState(gestor.areaId ?? "");
  const [cargoId, setCargoId] = useState("");
  const [nivelId, setNivelId] = useState("");

  const cargosDaArea = useMemo(
    () => d.cargos.filter((c) => !areaId || c.areaId === areaId),
    [d.cargos, areaId],
  );

  const salvar = () => {
    if (!nome.trim()) {
      toast("Informe o nome da pessoa.", "erro");
      return;
    }
    onCriar({ nome: nome.trim(), areaId, cargoId, nivelId });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Adicionar subordinado"
      descricao={`Nova pessoa reportando-se a ${gestor.nome}.`}
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={salvar}>
            <UserPlus className="h-4 w-4" /> Adicionar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label="Nome" obrigatorio>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
            autoFocus
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Área">
            <Select
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value);
                setCargoId("");
              }}
            >
              <option value="">— selecione —</option>
              {d.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Cargo">
            <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
              <option value="">— selecione —</option>
              {cargosDaArea.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <Campo label="Nível">
          <Select value={nivelId} onChange={(e) => setNivelId(e.target.value)}>
            <option value="">— selecione —</option>
            {d.niveis.map((n) => (
              <option key={n.id} value={n.id}>
                {n.codigo} — {n.nome}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
    </Modal>
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
