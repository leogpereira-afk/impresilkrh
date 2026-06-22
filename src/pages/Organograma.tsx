import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Network,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
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

// Mantém a lógica de papéis do organograma, agora aplicada como um indicador
// colorido (ponto/faixa lateral) por se tratar de uma linha e não mais de um card.
function corNode(c: Colaborador, ehGer: boolean): { dot: string; rotulo: string } {
  if (!c.gestorId && c.ehDirecao) return { dot: "bg-green-600", rotulo: "Fundador(a)" };
  if (c.cargoLivre === "Diretor Geral") return { dot: "bg-brand", rotulo: "Diretoria" };
  if (c.statusId === "externo") return { dot: "bg-slate-300", rotulo: "Assessoria externa" };
  if (ehGer) return { dot: "bg-teal-500", rotulo: "Gestor(a) / Líder" };
  return { dot: "bg-slate-300", rotulo: "Equipe" };
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

  const expandirTudo = () => setColapsados(new Set());
  // Recolher tudo: colapsa todos os nós que possuem subordinados.
  const recolherTudo = () => setColapsados(new Set(filhosPorGestor.keys()));

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

  // Cada nó é uma linha (estilo explorador de arquivos): a indentação por nível
  // vem do aninhamento dos <ul>, cada um com uma guia vertical à esquerda
  // conectando pais e filhos. Expandir/recolher por ramo. Nunca há sobreposição:
  // a árvore cresce apenas verticalmente.
  const Node = ({ c }: { c: Colaborador }) => {
    const filhos = filhosPorGestor.get(c.id) ?? [];
    const temFilhos = filhos.length > 0;
    const ger = ehGerente(c);
    const cor = corNode(c, ger);
    const colapsado = colapsados.has(c.id);

    return (
      <li>
        <div className="group flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 transition hover:bg-slate-50">
          {/* Chevron de expandir/recolher (ocupa espaço fixo mesmo sem filhos) */}
          {temFilhos ? (
            <button
              type="button"
              onClick={() => toggle(c.id)}
              title={colapsado ? "Expandir" : "Recolher"}
              aria-label={colapsado ? `Expandir equipe de ${c.nome}` : `Recolher equipe de ${c.nome}`}
              aria-expanded={!colapsado}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              {colapsado ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" aria-hidden />
          )}

          {/* Indicador colorido de papel (faixa lateral) */}
          <span
            className={cn("h-7 w-1 shrink-0 rounded-full", cor.dot)}
            title={cor.rotulo}
            aria-hidden
          />

          {/* Foto / avatar */}
          {c.fotoDataUrl ? (
            <img
              src={c.fotoDataUrl}
              alt={c.nome}
              title={c.nome}
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <Avatar nome={c.nome} size="sm" className="ring-1 ring-slate-200" />
          )}

          {/* Nome + cargo (clicar navega para a ficha) */}
          <Link
            to={`/colaboradores/${c.id}`}
            className="min-w-0 flex-1"
            title={`Abrir ficha de ${c.nome}`}
          >
            <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand">
              {c.nome}
            </p>
            <p className="truncate text-[11px] text-slate-400">{d.nomeCargo(c)}</p>
          </Link>

          {/* Badge de subordinados diretos */}
          {temFilhos && (
            <Badge variant="neutral" className="shrink-0">
              {filhos.length} {filhos.length === 1 ? "direto" : "diretos"}
            </Badge>
          )}

          {/* Ações de RH (aparecem no hover quando podeEditar) */}
          {podeEditar && (
            <div className="flex shrink-0 gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setAdicionarEm(c)}
                title="Adicionar subordinado"
                aria-label={`Adicionar subordinado a ${c.nome}`}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-brand"
              >
                <UserPlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => abrirSeletorFoto(c.id)}
                title="Enviar foto"
                aria-label={`Enviar foto de ${c.nome}`}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-brand"
              >
                <Camera className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setRemoverAlvo(c)}
                title="Remover do organograma"
                aria-label={`Remover ${c.nome} do organograma`}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
              >
                <UserMinus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Filhos: container indentado com guia vertical (a indentação se acumula
            pelo aninhamento dos <ul>) */}
        {temFilhos && !colapsado && (
          <ul className="ml-4 border-l border-slate-200 pl-1.5">
            {filhos.map((f) => (
              <Node key={f.id} c={f} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div>
      <PageHeader title="Organograma" description="Estrutura hierárquica da Impresilk. Navegue expandindo e recolhendo as equipes.">
        <button className="btn-outline" onClick={expandirTudo}>
          <ChevronsUpDown className="h-4 w-4" /> Expandir tudo
        </button>
        <button className="btn-outline" onClick={recolherTudo}>
          <ChevronsDownUp className="h-4 w-4" /> Recolher tudo
        </button>
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

      <Card>
        <CardBody>
          {/* overflow-x-auto só atua como rede de segurança em telas muito estreitas */}
          <div className="overflow-x-auto">
            <ul className="min-w-[280px]">
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
