import { useState } from "react";
import {
  Plus, Pencil, Trash2, Building2, Layers, Tag, Briefcase, SlidersHorizontal,
  ClipboardList, Palette, Database, Award, UserCog, ShieldCheck, Lock, Eye, EyeOff,
  KeyRound, ChevronDown,
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
import { useSessao } from "@/lib/session";
import { MODO_JWT, definirSenhaUsuario, removerSenhaUsuario } from "@/lib/auth";
import { ehMaster } from "@/lib/rbac";
import { useToast } from "@/components/ui/toast";
import { formatBRL } from "@/lib/format";
import { slug } from "@/data/_gen";
import { MODULOS, PERFIL_LABEL } from "@/lib/constants";
import { competenciasPlano, compLabelLongo, confidencialDoMes } from "@/lib/custos";
import { CARDS_CONFIDENCIAIS } from "@/data/classificacaoContas";
import type { Area, Cargo, CicloAvaliacao, ModeloChecklist, Nivel, Perfil, StatusColaborador, Usuario } from "@/data/types";

export default function PainelControle() {
  const sessao = useSessao();
  const master = ehMaster(sessao);
  return (
    <div>
      <PageHeader title="Painel de Controle" description="Gerencie todo o conteúdo do sistema sem mexer no código. Tudo é salvo no navegador." />
      <Tabs
        abas={[
          { id: "estrutura", label: "Estrutura", icon: <Building2 className="h-4 w-4" />, conteudo: <Estrutura /> },
          { id: "cargos", label: "Cargos & Faixas", icon: <Briefcase className="h-4 w-4" />, conteudo: <CargosSecao /> },
          { id: "conteudo", label: "Conteúdo (RH)", icon: <ClipboardList className="h-4 w-4" />, conteudo: <ConteudoSecao /> },
          { id: "aval", label: "Avaliação & Checklists", icon: <Award className="h-4 w-4" />, conteudo: <AvaliacaoSecao /> },
          { id: "usuarios", label: "Usuários e Permissões", icon: <UserCog className="h-4 w-4" />, conteudo: <UsuariosSecao /> },
          ...(master ? [{ id: "confidencial", label: "Confidencial", icon: <Lock className="h-4 w-4" />, conteudo: <ConfidencialSecao /> }] : []),
          { id: "marca", label: "Marca & Backup", icon: <Palette className="h-4 w-4" />, conteudo: <MarcaSecao /> },
        ]}
      />
    </div>
  );
}

// ---------------- Confidencial (Diretoria — só o gestor master) ----------------
function ConfidencialSecao() {
  const { items: plano } = useColecao("planoContas");
  const comps = competenciasPlano(plano);
  const [comp, setComp] = useState<string>("");
  const compSel = comp || comps[comps.length - 1] || "";
  const cards = confidencialDoMes(plano, compSel, CARDS_CONFIDENCIAIS);
  const totalGeral = cards.reduce((s, c) => s + c.total, 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Lock className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-brand-ink">Despesas societárias — confidencial</p>
              <p className="text-xs text-slate-500">Visível apenas para a diretoria (você). Fora de todas as outras telas e do rateio.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Competência</span>
            <Select value={compSel} onChange={(e) => setComp(e.target.value)} className="w-44">
              {comps.map((k) => <option key={k} value={k}>{compLabelLongo(k)}</option>)}
            </Select>
          </label>
        </CardBody>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <div key={card.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white">
            <p className="text-sm font-semibold">{card.titulo}</p>
            <p className="mt-0.5 text-xs text-slate-400">{compLabelLongo(compSel)}</p>
            <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-700/70">
                {card.itens.length === 0 ? (
                  <tr><td className="py-2 text-slate-400">Sem lançamentos neste mês.</td></tr>
                ) : card.itens.map((it) => (
                  <tr key={it.codigo}>
                    <td className="py-2 text-slate-300">{it.nome}</td>
                    <td className="py-2 text-right tabular-nums text-slate-100">{formatBRL(it.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-slate-600"><td className="pt-2 font-semibold">Total</td><td className="pt-2 text-right text-base font-semibold text-gold-300 tabular-nums">{formatBRL(card.total)}</td></tr></tfoot>
            </table>
            </div>
          </div>
        ))}
      </div>
      <Card><CardBody className="flex items-center justify-between"><span className="text-sm font-medium text-slate-600">Total confidencial · {compLabelLongo(compSel)}</span><span className="text-xl font-semibold text-brand-ink">{formatBRL(totalGeral)}</span></CardBody></Card>
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
  const { items: colaboradores } = useColecao("colaboradores");
  const { items: cargos } = useColecao("cargos");
  const [edit, setEdit] = useState<Area | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<Area | null>(null);

  // Dependentes: colaboradores e cargos vinculados a esta área. Excluir a área
  // deixaria esses registros apontando para um id inexistente (área "—").
  const dependentesArea = (id: string) =>
    colaboradores.filter((c) => c.areaId === id).length + cargos.filter((c) => c.areaId === id).length;
  const delEmUso = del ? dependentesArea(del.id) : 0;

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
      <ConfirmDialog
        aberto={!!del}
        onFechar={() => setDel(null)}
        onConfirmar={() => {
          if (!del) return;
          if (delEmUso > 0) { toast(`Não dá para excluir: ${delEmUso} registro(s) usam esta área. Reatribua-os antes.`, "erro"); setDel(null); return; }
          remover(del.id); toast("Área excluída.");
        }}
        titulo="Excluir área?"
        mensagem={delEmUso > 0 ? `"${del?.nome}" está em uso por ${delEmUso} registro(s) (colaboradores/cargos) e não pode ser excluída.` : `"${del?.nome}" será removida.`}
      />
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
  const { items: colaboradores } = useColecao("colaboradores");
  const [edit, setEdit] = useState<StatusColaborador | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<StatusColaborador | null>(null);
  const [form, setForm] = useState<Partial<StatusColaborador>>({});

  // Colaboradores que estão neste status — excluí-lo os deixaria sem status válido.
  const delEmUso = del ? colaboradores.filter((c) => c.statusId === del.id).length : 0;

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
      <ConfirmDialog
        aberto={!!del}
        onFechar={() => setDel(null)}
        onConfirmar={() => {
          if (!del) return;
          if (delEmUso > 0) { toast(`Não dá para excluir: ${delEmUso} colaborador(es) estão neste status. Mude-os antes.`, "erro"); setDel(null); return; }
          remover(del.id); toast("Status excluído.");
        }}
        titulo="Excluir status?"
        mensagem={delEmUso > 0 ? `"${del?.nome}" está em uso por ${delEmUso} colaborador(es) e não pode ser excluído.` : `"${del?.nome}" será removido.`}
      />
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

  // Colaboradores neste cargo — excluí-lo os deixaria sem cargo válido.
  const delEmUso = del ? d.colaboradores.filter((c) => c.cargoId === del.id).length : 0;

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
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nome do cargo"><Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></Campo>
              <Campo label="Área"><Select value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></Campo>
            </div>
            <div>
              <span className="label">Faixa salarial (R$)</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
      <ConfirmDialog
        aberto={!!del}
        onFechar={() => setDel(null)}
        onConfirmar={() => {
          if (!del) return;
          if (delEmUso > 0) { toast(`Não dá para excluir: ${delEmUso} colaborador(es) têm este cargo. Reatribua-os antes.`, "erro"); setDel(null); return; }
          remover(del.id); toast("Cargo excluído.");
        }}
        titulo="Excluir cargo?"
        mensagem={delEmUso > 0 ? `"${del?.nome}" está em uso por ${delEmUso} colaborador(es) e não pode ser excluído.` : `"${del?.nome}" será removido.`}
      />
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
                  }).filter((it) => it.titulo); // descarta linhas sem título (ex.: "| RH")
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

// Passo a passo do login real, na própria tela (recolhível). O conteúdo muda
// conforme o login real esteja DESLIGADO (como ativar) ou LIGADO (como migrar
// as senhas e fechar a brecha antiga). Detalhes completos em LOGIN.md.
function GuiaLoginReal() {
  return (
    <details className="group border-b border-slate-100 bg-slate-50/40 px-5 py-2.5">
      <summary className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-800">
        <KeyRound className="h-4 w-4 shrink-0 text-brand" />
        {MODO_JWT
          ? "Login real: passo a passo (migrar senhas e fechar a brecha antiga)"
          : "Quer mais segurança? Ative o login com senha verificada no servidor (passo a passo)"}
        <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      {MODO_JWT ? (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
          <li>Para cada pessoa, defina a <strong>Senha de acesso</strong> no formulário e salve — a senha é ativada no servidor na hora.</li>
          <li>Ou clique em <strong>“Migrar senhas”</strong> (acima) para enviar de uma vez as senhas já cadastradas dos usuários ativos.</li>
          <li>Quando <strong>todos</strong> já tiverem senha, remova a variável <code className="rounded bg-slate-100 px-1">SYNC_TOKEN</code> no Netlify e republique — aí a nuvem passa a aceitar <strong>só</strong> o login real (some a chave que ficava visível no DevTools).</li>
          <li>O diretor master entra sempre pela variável <code className="rounded bg-slate-100 px-1">AUTH_MASTER_SENHA</code>.</li>
          <li className="text-slate-400">Detalhes e comandos de verificação no arquivo <code className="rounded bg-slate-100 px-1">LOGIN.md</code>.</li>
        </ol>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
          <li>No <strong>Netlify</strong> → Configurações do site → <strong>Variáveis de ambiente</strong>, crie:
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li><code className="rounded bg-slate-100 px-1">JWT_SECRET</code> — um segredo forte e aleatório (40+ caracteres). Fica <strong>só no servidor</strong>.</li>
              <li><code className="rounded bg-slate-100 px-1">AUTH_MASTER_SENHA</code> — a senha do diretor master (Leonardo).</li>
              <li><span className="text-slate-400">(opcional)</span> <code className="rounded bg-slate-100 px-1">AUTH_MASTER_USUARIO</code> — padrão <code className="rounded bg-slate-100 px-1">leonardo</code>.</li>
            </ul>
          </li>
          <li><strong>Republique</strong> o site (Trigger deploy).</li>
          <li>Volte aqui e <strong>entre como master</strong>: vai aparecer a faixa verde “Login real ativo”.</li>
          <li>Defina a senha de cada pessoa (ou use <strong>“Migrar senhas”</strong>) e, ao final, remova o <code className="rounded bg-slate-100 px-1">SYNC_TOKEN</code> e republique.</li>
          <li className="text-slate-400">Enquanto não fizer isso, <strong>nada muda</strong> — o login e a sincronização atuais seguem normais. Passo a passo completo em <code className="rounded bg-slate-100 px-1">LOGIN.md</code>.</li>
        </ol>
      )}
    </details>
  );
}

// ---------------- Usuários e Permissões ----------------
const PERFIS_OPCOES: Perfil[] = ["ADMIN_RH", "GESTOR", "COLABORADOR"];

const PERFIL_VARIANTE: Record<Perfil, "gold" | "info" | "neutral"> = {
  ADMIN_RH: "gold",
  GESTOR: "info",
  COLABORADOR: "neutral",
};

function UsuariosSecao() {
  const toast = useToast();
  const d = useDominio();
  const { items, criar, atualizar, remover } = useColecao("usuarios");
  const [edit, setEdit] = useState<Usuario | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<Usuario | null>(null);

  const usuarios = [...(items as Usuario[])].sort((a, b) => a.nome.localeCompare(b.nome));
  const totalModulos = MODULOS.length;
  const acessoTotal = (u: Usuario) => u.permissoes?.includes("*");
  const qtdLiberados = (u: Usuario) =>
    acessoTotal(u) ? totalModulos : MODULOS.filter((m) => u.permissoes?.includes(m.chave)).length;

  // No login real (MODO_JWT), a senha precisa ir para o SERVIDOR (hash). Aqui
  // provisionamos a senha de um usuário usando o nome do colaborador como login
  // (o servidor normaliza). Sem colaborador vinculado ou sem senha, ignora.
  const provisionarNoServidor = async (u: { colaboradorId?: string | null; perfil: Perfil; senha?: string }) => {
    if (!MODO_JWT || !u.senha || !u.colaboradorId) return;
    const nomeColab = d.nomeColab(u.colaboradorId);
    if (!nomeColab) return;
    try {
      await definirSenhaUsuario({ usuario: nomeColab, colaboradorId: u.colaboradorId, perfil: u.perfil, nome: nomeColab, senha: u.senha });
      toast(`Senha de ${nomeColab} ativada no servidor.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao ativar senha no servidor.", "erro");
    }
  };

  // Migração: empurra para o servidor todas as senhas já cadastradas (ativos com
  // colaborador vinculado). Use uma vez ao ligar o login real.
  const [migrando, setMigrando] = useState(false);
  const migrarSenhas = async () => {
    const alvos = usuarios.filter((u) => u.ativo && u.colaboradorId && u.senha?.trim());
    if (alvos.length === 0) { toast("Nenhum usuário com senha cadastrada para migrar.", "erro"); return; }
    setMigrando(true);
    let ok = 0;
    for (const u of alvos) {
      try { await definirSenhaUsuario({ usuario: d.nomeColab(u.colaboradorId!), colaboradorId: u.colaboradorId!, perfil: u.perfil, nome: d.nomeColab(u.colaboradorId!), senha: u.senha!.trim() }); ok++; } catch { /* segue */ }
    }
    setMigrando(false);
    toast(`Senhas enviadas ao servidor: ${ok}/${alvos.length}.`, ok === alvos.length ? "sucesso" : "erro");
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Usuários e permissões"
        subtitle="Cadastre acessos e defina o que cada pessoa pode ver no sistema"
        icon={<UserCog className="h-[18px] w-[18px]" />}
        action={<button className="btn-outline" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo usuário</button>}
      />

      <div className="border-y border-slate-100 bg-gold-50/40 px-5 py-2.5">
        <p className="flex items-start gap-2 text-xs text-slate-600">
          <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-gold-600" />
          As permissões definem exatamente quais módulos ficam visíveis para cada usuário. Use <strong>Acesso total</strong> para liberar tudo (recomendado para o nível Administrador de RH).
        </p>
      </div>

      {MODO_JWT && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-green-50/50 px-5 py-2.5">
          <p className="flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-green-600" />
            <span><strong>Login real ativo.</strong> A senha de cada usuário é guardada com segurança no servidor. Ao salvar um usuário com senha, ela já é ativada lá. Para enviar de uma vez as senhas já cadastradas, use “Migrar senhas”.</span>
          </p>
          <button className="btn-outline shrink-0" onClick={migrarSenhas} disabled={migrando}>
            {migrando ? "Enviando…" : "Migrar senhas"}
          </button>
        </div>
      )}

      <GuiaLoginReal />

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50/50">
            <tr>
              <th className="th">Usuário</th>
              <th className="th">Perfil</th>
              <th className="th">Vinculado a</th>
              <th className="th">Módulos liberados</th>
              <th className="th text-center">Ativo</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {usuarios.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-sm text-slate-400">Nenhum usuário cadastrado ainda.</td></tr>
            )}
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="td">
                  <p className="font-medium text-slate-700">{u.nome}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </td>
                <td className="td"><Badge variant={PERFIL_VARIANTE[u.perfil] ?? "neutral"}>{PERFIL_LABEL[u.perfil] ?? u.perfil}</Badge></td>
                <td className="td text-slate-500">{u.colaboradorId ? d.nomeColab(u.colaboradorId) : "—"}</td>
                <td className="td">
                  {acessoTotal(u)
                    ? <Badge variant="success">Tudo</Badge>
                    : <span className="text-sm tabular-nums text-slate-600">{qtdLiberados(u)} de {totalModulos}</span>}
                </td>
                <td className="td">
                  <div className="flex justify-center">
                    <Toggle checked={u.ativo} onChange={(v) => { atualizar(u.id, { ativo: v }); toast(v ? "Usuário ativado." : "Usuário desativado."); }} />
                  </div>
                </td>
                <td className="td text-right">
                  <button className="btn-ghost p-1.5" onClick={() => setEdit(u)}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDel(u)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(novo || edit) && (
        <UsuarioEditor
          usuario={edit}
          colaboradores={d.colaboradores}
          onFechar={() => { setNovo(false); setEdit(null); }}
          onSalvar={(dados) => {
            if (edit) atualizar(edit.id, dados);
            else criar({ id: slug(`user ${dados.email || dados.nome}`), criadoEm: new Date().toISOString(), ...dados });
            void provisionarNoServidor(dados); // login real: ativa a senha no servidor
            toast("Usuário salvo."); setNovo(false); setEdit(null);
          }}
        />
      )}
      <ConfirmDialog
        aberto={!!del}
        onFechar={() => setDel(null)}
        onConfirmar={() => {
          if (del) {
            if (MODO_JWT && del.colaboradorId) removerSenhaUsuario(d.nomeColab(del.colaboradorId)).catch(() => {});
            remover(del.id); toast("Usuário excluído.");
          }
        }}
        titulo="Excluir usuário?"
        mensagem={`O acesso de "${del?.nome}" será removido.`}
      />
    </Card>
  );
}

function UsuarioEditor({
  usuario,
  colaboradores,
  onFechar,
  onSalvar,
}: {
  usuario: Usuario | null;
  colaboradores: { id: string; nome: string }[];
  onFechar: () => void;
  onSalvar: (dados: Pick<Usuario, "nome" | "email" | "perfil" | "colaboradorId" | "permissoes" | "ativo" | "senha">) => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "COLABORADOR");
  const [colaboradorId, setColaboradorId] = useState<string>(usuario?.colaboradorId ?? "");
  const [ativo, setAtivo] = useState<boolean>(usuario?.ativo ?? true);
  const [permissoes, setPermissoes] = useState<string[]>(usuario?.permissoes ?? []);
  const [senha, setSenha] = useState(usuario?.senha ?? "");
  const [verSenha, setVerSenha] = useState(false);

  const acessoTotal = permissoes.includes("*");
  const colabsOrdenados = [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome));

  const setAcessoTotal = (v: boolean) => setPermissoes(v ? ["*"] : []);
  const togglePerm = (chave: string) =>
    setPermissoes((p) => {
      const base = p.filter((c) => c !== "*");
      return base.includes(chave) ? base.filter((c) => c !== chave) : [...base, chave];
    });

  const trocarPerfil = (p: Perfil) => {
    setPerfil(p);
    // Sugere acesso total ao Administrador de RH (nível máximo).
    if (p === "ADMIN_RH" && permissoes.length === 0) setPermissoes(["*"]);
  };

  const salvar = () => {
    if (!nome.trim()) return toast("Informe o nome do usuário.", "erro");
    if (!email.trim()) return toast("Informe o e-mail do usuário.", "erro");
    onSalvar({
      nome: nome.trim(),
      email: email.trim(),
      perfil,
      colaboradorId: colaboradorId || null,
      permissoes,
      ativo,
      senha: senha.trim() || undefined,
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={usuario ? "Editar usuário" : "Novo usuário"}
      descricao="Defina os dados de acesso e os módulos visíveis."
      largura="max-w-2xl"
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome" obrigatorio><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" /></Campo>
          <Campo label="E-mail" obrigatorio><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@impresilk.com.br" /></Campo>
          <Campo label="Senha de acesso" hint="Senha individual de login. Em branco = usa a senha padrão do sistema." className="sm:col-span-2">
            <div className="relative">
              <Input type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Defina uma senha para este usuário" className="pr-10" />
              <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Campo>
          <Campo label="Perfil de acesso">
            <Select value={perfil} onChange={(e) => trocarPerfil(e.target.value as Perfil)}>
              {PERFIS_OPCOES.map((p) => <option key={p} value={p}>{PERFIL_LABEL[p] ?? p}</option>)}
            </Select>
          </Campo>
          <Campo label="Vincular a colaborador" hint="Opcional — relaciona o login a uma pessoa do quadro.">
            <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
              <option value="">Sem vínculo</option>
              {colabsOrdenados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Campo>
        </div>

        <div className="rounded-lg border border-slate-100 px-3 py-2.5">
          <Toggle checked={ativo} onChange={setAtivo} label="Usuário ativo (pode acessar o sistema)" />
        </div>

        <div className="rounded-lg border border-slate-100 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Permissões por módulo</p>
              <p className="text-xs text-slate-400">Marque os módulos que este usuário pode ver.</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 rounded-lg bg-gold-50 px-3 py-1.5 ring-1 ring-inset ring-gold-200">
              <ShieldCheck className="h-4 w-4 text-gold-600" />
              <Toggle checked={acessoTotal} onChange={setAcessoTotal} label="Acesso total (*)" />
            </label>
          </div>

          <div className={acessoTotal ? "pointer-events-none opacity-40" : ""}>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {MODULOS.map((m) => (
                <Toggle
                  key={m.chave}
                  checked={acessoTotal || permissoes.includes(m.chave)}
                  onChange={() => togglePerm(m.chave)}
                  label={m.label}
                />
              ))}
            </div>
          </div>
          {acessoTotal && <p className="mt-3 text-xs text-gold-700">Acesso total ativo: este usuário vê todos os módulos do sistema.</p>}
        </div>
      </div>
    </Modal>
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
