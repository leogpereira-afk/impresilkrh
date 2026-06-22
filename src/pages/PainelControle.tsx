import { useState } from "react";
import {
  Plus, Pencil, Trash2, Building2, Layers, Tag, Briefcase, SlidersHorizontal,
  ClipboardList, Palette, Database, Award,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge, DotBadge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Toggle } from "@/components/ui/form";
import { ConteudoManager } from "@/components/painel/conteudo-manager";
import { DadosControls } from "@/components/layout/dados-controls";
import { useColecao, useConfig, salvarConfig } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useToast } from "@/components/ui/toast";
import { formatBRL } from "@/lib/format";
import { slug } from "@/data/_gen";
import type { Area, Cargo, CicloAvaliacao, ModeloChecklist, Nivel, StatusColaborador } from "@/data/types";

export default function PainelControle() {
  return (
    <div>
      <PageHeader title="Painel de Controle" description="Gerencie todo o conteúdo do sistema sem mexer no código. Tudo é salvo no navegador." />
      <Tabs
        abas={[
          { id: "estrutura", label: "Estrutura", icon: <Building2 className="h-4 w-4" />, conteudo: <Estrutura /> },
          { id: "cargos", label: "Cargos & Faixas", icon: <Briefcase className="h-4 w-4" />, conteudo: <CargosSecao /> },
          { id: "conteudo", label: "Conteúdo (RH)", icon: <ClipboardList className="h-4 w-4" />, conteudo: <ConteudoSecao /> },
          { id: "aval", label: "Avaliação & Checklists", icon: <Award className="h-4 w-4" />, conteudo: <AvaliacaoSecao /> },
          { id: "marca", label: "Marca & Backup", icon: <Palette className="h-4 w-4" />, conteudo: <MarcaSecao /> },
        ]}
      />
    </div>
  );
}

// ---------------- Estrutura: Áreas, Níveis, Status ----------------
function Estrutura() {
  return (
    <div className="space-y-6">
      <AreasManager />
      <NiveisManager />
      <StatusManager />
    </div>
  );
}

function AreasManager() {
  const toast = useToast();
  const { items, criar, atualizar, remover } = useColecao("areas");
  const [edit, setEdit] = useState<Area | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<Area | null>(null);

  return (
    <Card>
      <CardHeader title="Áreas" subtitle="Departamentos da empresa" icon={<Building2 className="h-[18px] w-[18px]" />}
        action={<button className="btn-outline" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Nova área</button>} />
      <CardBody className="space-y-2">
        {[...items].sort((a, b) => a.ordem - b.ordem).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div><p className="text-sm font-medium text-slate-700">{a.nome}</p><p className="text-xs text-slate-400">{a.descricao}</p></div>
            <div className="flex gap-1">
              <button className="btn-ghost p-1.5" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></button>
              <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDel(a)}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </CardBody>
      {(novo || edit) && (
        <EditorSimples
          titulo={edit ? "Editar área" : "Nova área"}
          campos={[
            { k: "nome", label: "Nome", valor: edit?.nome ?? "" },
            { k: "descricao", label: "Descrição", valor: edit?.descricao ?? "" },
          ]}
          onFechar={() => { setNovo(false); setEdit(null); }}
          onSalvar={(v) => {
            if (edit) atualizar(edit.id, { nome: v.nome, descricao: v.descricao });
            else criar({ id: slug(v.nome || "area"), nome: v.nome, descricao: v.descricao, ordem: items.length });
            toast("Área salva."); setNovo(false); setEdit(null);
          }}
        />
      )}
      <ConfirmDialog aberto={!!del} onFechar={() => setDel(null)} onConfirmar={() => { if (del) { remover(del.id); toast("Área excluída."); } }} titulo="Excluir área?" mensagem={`"${del?.nome}" será removida.`} />
    </Card>
  );
}

function NiveisManager() {
  const toast = useToast();
  const { items, atualizar } = useColecao("niveis");
  const [edit, setEdit] = useState<Nivel | null>(null);
  return (
    <Card>
      <CardHeader title="Níveis (régua de senioridade)" subtitle="N1 a N5" icon={<Layers className="h-[18px] w-[18px]" />} />
      <CardBody className="space-y-2">
        {[...items].sort((a, b) => a.ordem - b.ordem).map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div className="flex items-center gap-3">
              <Badge variant="gold">{n.codigo}</Badge>
              <div><p className="text-sm font-medium text-slate-700">{n.senioridade}</p><p className="text-xs text-slate-400 line-clamp-1 max-w-md">{n.descricao}</p></div>
            </div>
            <button className="btn-ghost p-1.5" onClick={() => setEdit(n)}><Pencil className="h-4 w-4" /></button>
          </div>
        ))}
      </CardBody>
      {edit && (
        <EditorSimples
          titulo={`Editar ${edit.codigo}`}
          campos={[
            { k: "senioridade", label: "Senioridade", valor: edit.senioridade },
            { k: "descricao", label: "Descrição", valor: edit.descricao ?? "", textarea: true },
          ]}
          onFechar={() => setEdit(null)}
          onSalvar={(v) => { atualizar(edit.id, { senioridade: v.senioridade, nome: v.senioridade, descricao: v.descricao }); toast("Nível salvo."); setEdit(null); }}
        />
      )}
    </Card>
  );
}

function StatusManager() {
  const toast = useToast();
  const { items, criar, atualizar, remover } = useColecao("status");
  const [edit, setEdit] = useState<StatusColaborador | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<StatusColaborador | null>(null);
  const [form, setForm] = useState<Partial<StatusColaborador>>({});

  const abrir = (s: StatusColaborador | null) => { setForm(s ?? { nome: "", cor: "#64748b", contaComoAtivo: true, ordem: items.length }); s ? setEdit(s) : setNovo(true); };

  return (
    <Card>
      <CardHeader title="Status do quadro" subtitle="Cada status tem cor e define o headcount" icon={<Tag className="h-[18px] w-[18px]" />}
        action={<button className="btn-outline" onClick={() => abrir(null)}><Plus className="h-4 w-4" /> Novo status</button>} />
      <CardBody className="space-y-2">
        {[...items].sort((a, b) => a.ordem - b.ordem).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div className="flex items-center gap-3">
              <DotBadge label={s.nome} cor={s.cor} />
              {s.contaComoAtivo ? <Badge variant="success">Conta no headcount</Badge> : <Badge variant="neutral">Fora do headcount</Badge>}
            </div>
            <div className="flex gap-1">
              <button className="btn-ghost p-1.5" onClick={() => abrir(s)}><Pencil className="h-4 w-4" /></button>
              <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDel(s)}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </CardBody>
      {(novo || edit) && (
        <Modal aberto onFechar={() => { setNovo(false); setEdit(null); }} titulo={edit ? "Editar status" : "Novo status"} largura="max-w-md"
          rodape={<><button className="btn-outline" onClick={() => { setNovo(false); setEdit(null); }}>Cancelar</button>
            <button className="btn-primary" onClick={() => {
              if (edit) atualizar(edit.id, form); else criar({ id: slug(form.nome || "status"), ...form } as StatusColaborador);
              toast("Status salvo."); setNovo(false); setEdit(null);
            }}>Salvar</button></>}>
          <div className="space-y-3">
            <Campo label="Nome"><Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></Campo>
            <Campo label="Cor"><input type="color" className="h-10 w-20 rounded border border-slate-300" value={form.cor ?? "#64748b"} onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))} /></Campo>
            <Toggle checked={form.contaComoAtivo ?? true} onChange={(v) => setForm((f) => ({ ...f, contaComoAtivo: v }))} label="Conta como ativo (headcount)" />
          </div>
        </Modal>
      )}
      <ConfirmDialog aberto={!!del} onFechar={() => setDel(null)} onConfirmar={() => { if (del) { remover(del.id); toast("Status excluído."); } }} titulo="Excluir status?" mensagem={`"${del?.nome}" será removido.`} />
    </Card>
  );
}

// ---------------- Cargos & Faixas ----------------
function CargosSecao() {
  const toast = useToast();
  const d = useDominio();
  const { items, criar, atualizar, remover } = useColecao("cargos");
  const [edit, setEdit] = useState<Cargo | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<Cargo | null>(null);
  const [form, setForm] = useState<Partial<Cargo>>({});

  const abrir = (c: Cargo | null) => {
    setForm(c ?? { nome: "", areaId: "producao", faixas: [1621, 1700, 1800, 1900, 2000], trilha: "" });
    c ? setEdit(c) : setNovo(true);
  };
  const setFaixa = (i: number, v: number) => setForm((f) => { const fx = [...(f.faixas ?? [0, 0, 0, 0, 0])] as Cargo["faixas"]; fx[i] = v; return { ...f, faixas: fx }; });

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Cargos e faixas salariais" subtitle="Tabela salarial por cargo (N1 → N5)" icon={<Briefcase className="h-[18px] w-[18px]" />}
        action={<button className="btn-outline" onClick={() => abrir(null)}><Plus className="h-4 w-4" /> Novo cargo</button>} />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-y border-slate-100 bg-slate-50/50">
            <tr><th className="th">Cargo</th><th className="th">Área</th>{["N1", "N2", "N3", "N4", "N5"].map((n) => <th key={n} className="th text-right">{n}</th>)}<th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[...items].sort((a, b) => d.nomeArea(a.areaId).localeCompare(d.nomeArea(b.areaId)) || a.nome.localeCompare(b.nome)).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="td font-medium text-slate-700">{c.nome}</td>
                <td className="td text-slate-500">{d.nomeArea(c.areaId)}</td>
                {c.faixas.map((v, i) => <td key={i} className="td text-right tabular-nums text-slate-600">{formatBRL(v)}</td>)}
                <td className="td text-right">
                  <button className="btn-ghost p-1.5" onClick={() => abrir(c)}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(novo || edit) && (
        <Modal aberto onFechar={() => { setNovo(false); setEdit(null); }} titulo={edit ? "Editar cargo" : "Novo cargo"} largura="max-w-2xl"
          rodape={<><button className="btn-outline" onClick={() => { setNovo(false); setEdit(null); }}>Cancelar</button>
            <button className="btn-primary" onClick={() => {
              if (!form.nome?.trim()) return toast("Informe o nome do cargo.", "erro");
              if (edit) atualizar(edit.id, form); else criar({ id: slug(form.nome), ...form } as Cargo);
              toast("Cargo salvo."); setNovo(false); setEdit(null);
            }}>Salvar</button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nome do cargo"><Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></Campo>
              <Campo label="Área"><Select value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></Campo>
            </div>
            <div>
              <span className="label">Faixa salarial (R$)</span>
              <div className="grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <span className="mb-1 block text-center text-[10px] text-slate-400">N{i + 1}</span>
                    <Input type="number" value={form.faixas?.[i] ?? 0} onChange={(e) => setFaixa(i, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>
            <Campo label="Descrição"><Input value={form.descricao ?? ""} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} /></Campo>
          </div>
        </Modal>
      )}
      <ConfirmDialog aberto={!!del} onFechar={() => setDel(null)} onConfirmar={() => { if (del) { remover(del.id); toast("Cargo excluído."); } }} titulo="Excluir cargo?" mensagem={`"${del?.nome}" será removido.`} />
    </Card>
  );
}

// ---------------- Conteúdo (RH) ----------------
function ConteudoSecao() {
  return (
    <div className="space-y-6">
      <ConteudoManager colecao="pops" titulo="POPs e Procedimentos" subtitulo="Procedimentos operacionais padrão (Apêndice E)" comSla />
      <ConteudoManager colecao="comunicacao" titulo="Guias de Comunicação" subtitulo="Comunicação interna (Apêndice D)" />
      <ConteudoManager colecao="institucionais" titulo="Documentos Institucionais & SST" subtitulo="Código de Ética, PGR, PCMSO, treinamentos" comCategoria />
    </div>
  );
}

// ---------------- Avaliação & Checklists ----------------
function AvaliacaoSecao() {
  const toast = useToast();
  const { items: ciclos, atualizar } = useColecao("ciclos");
  const { items: modelos, atualizar: atualizarModelo } = useColecao("modelosChecklist");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Ciclos de avaliação" subtitle="Pesos e regras de elegibilidade" icon={<Award className="h-[18px] w-[18px]" />} />
        <CardBody className="space-y-4">
          {(ciclos as CicloAvaliacao[]).map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium text-slate-700">{c.nome}</p>
                <Badge variant={c.status === "Aberto" ? "success" : "neutral"}>{c.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Campo label="Peso técnico"><Input type="number" step="0.05" value={c.pesoTecnico} onChange={(e) => atualizar(c.id, { pesoTecnico: Number(e.target.value) })} /></Campo>
                <Campo label="Peso comp."><Input type="number" step="0.05" value={c.pesoComportamental} onChange={(e) => atualizar(c.id, { pesoComportamental: Number(e.target.value) })} /></Campo>
                <Campo label="Peso result."><Input type="number" step="0.05" value={c.pesoResultado} onChange={(e) => atualizar(c.id, { pesoResultado: Number(e.target.value) })} /></Campo>
                <Campo label="Nota mín. promo"><Input type="number" value={c.notaMinPromocao} onChange={(e) => atualizar(c.id, { notaMinPromocao: Number(e.target.value) })} /></Campo>
                <Campo label="Meses mín."><Input type="number" value={c.mesesMinNivel} onChange={(e) => atualizar(c.id, { mesesMinNivel: Number(e.target.value) })} /></Campo>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Modelos de checklist" subtitle="Onboarding e offboarding" icon={<ClipboardList className="h-[18px] w-[18px]" />} />
        <CardBody className="grid gap-4 lg:grid-cols-2">
          {(modelos as ModeloChecklist[]).map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-100 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">{m.tipo}</p>
              <textarea
                className="input min-h-[180px] font-mono text-xs"
                defaultValue={m.itens.map((i) => `${i.titulo} | ${i.responsavel}`).join("\n")}
                onBlur={(e) => {
                  const itens = e.target.value.split("\n").filter((l) => l.trim()).map((l) => {
                    const [titulo, responsavel] = l.split("|").map((x) => x.trim());
                    return { titulo, responsavel: responsavel ?? "RH" };
                  });
                  atualizarModelo(m.id, { itens });
                  toast(`Modelo ${m.tipo} atualizado.`);
                }}
              />
              <p className="mt-1 text-[11px] text-slate-400">Um item por linha: <code>Título | Responsável</code></p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------- Marca & Backup ----------------
function MarcaSecao() {
  const toast = useToast();
  const config = useConfig();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Identidade e empresa" icon={<Palette className="h-[18px] w-[18px]" />} />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome da empresa"><Input defaultValue={config.empresaNome} onBlur={(e) => { salvarConfig({ empresaNome: e.target.value }); toast("Salvo."); }} /></Campo>
          <Campo label="Cidade"><Input defaultValue={config.empresaCidade} onBlur={(e) => salvarConfig({ empresaCidade: e.target.value })} /></Campo>
          <Campo label="Cor primária"><input type="color" className="h-10 w-20 rounded border border-slate-300" value={config.corPrimaria} onChange={(e) => salvarConfig({ corPrimaria: e.target.value })} /></Campo>
          <Campo label="Cor de acento"><input type="color" className="h-10 w-20 rounded border border-slate-300" value={config.corAcento} onChange={(e) => salvarConfig({ corAcento: e.target.value })} /></Campo>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Backup e portabilidade" subtitle="As edições ficam no navegador. Exporte para salvar ou transferir." icon={<Database className="h-[18px] w-[18px]" />} />
        <CardBody>
          <DadosControls />
          <p className="mt-3 text-xs text-slate-400">
            <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />
            Exportar gera um arquivo .json com todos os dados. Importar substitui os dados atuais deste navegador.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------- Editor simples reutilizável ----------------
function EditorSimples({
  titulo,
  campos,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  campos: { k: string; label: string; valor: string; textarea?: boolean }[];
  onFechar: () => void;
  onSalvar: (valores: Record<string, string>) => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(campos.map((c) => [c.k, c.valor])));
  return (
    <Modal aberto onFechar={onFechar} titulo={titulo} largura="max-w-md"
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={() => onSalvar(vals)}>Salvar</button></>}>
      <div className="space-y-3">
        {campos.map((c) => (
          <Campo key={c.k} label={c.label}>
            {c.textarea
              ? <textarea className="input min-h-[80px]" value={vals[c.k]} onChange={(e) => setVals((v) => ({ ...v, [c.k]: e.target.value }))} />
              : <Input value={vals[c.k]} onChange={(e) => setVals((v) => ({ ...v, [c.k]: e.target.value }))} />}
          </Campo>
        ))}
      </div>
    </Modal>
  );
}
