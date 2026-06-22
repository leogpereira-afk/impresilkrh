import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { slug, type Documento, type Colaborador, type Cargo } from "@/data/seed";
import { formatBRL } from "@/lib/format";
import { FileText, Users, GitBranch, Database, Plus, Trash2, Save, Download, Upload, RotateCcw } from "lucide-react";

type Aba = "conteudo" | "colaboradores" | "cargos" | "dados";

export function PainelControle() {
  const [aba, setAba] = useState<Aba>("conteudo");
  const abas: { id: Aba; label: string; icon: any }[] = [
    { id: "conteudo", label: "Conteúdo (POPs/Comunicação)", icon: FileText },
    { id: "colaboradores", label: "Colaboradores", icon: Users },
    { id: "cargos", label: "Cargos e Faixas", icon: GitBranch },
    { id: "dados", label: "Dados", icon: Database },
  ];
  return (
    <>
      <PageHeader title="Painel de Controle" description="Gerencie todo o conteúdo e os dados do sistema" />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {abas.map((a) => <button key={a.id} onClick={() => setAba(a.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${aba === a.id ? "border-b-2 border-brand text-brand" : "text-slate-500 hover:text-slate-800"}`}><a.icon className="h-4 w-4" /> {a.label}</button>)}
      </div>
      {aba === "conteudo" && <EditorConteudo />}
      {aba === "colaboradores" && <EditorColaboradores />}
      {aba === "cargos" && <EditorCargos />}
      {aba === "dados" && <AbaDados />}
    </>
  );
}

const CATEGORIAS = ["POP", "Comunicação", "Código de Ética", "SST", "Treinamento"];

function EditorConteudo() {
  const { db, setColecao } = useStore();
  const [edit, setEdit] = useState<Documento | null>(null);

  function novo() {
    setEdit({ id: "", titulo: "", categoria: "POP", descricao: "", conteudo: "", versao: "1.0", atualizadoEm: new Date().toISOString().slice(0, 10) });
  }
  function salvar() {
    if (!edit || !edit.titulo.trim()) { alert("Informe o título."); return; }
    const id = edit.id || slug(edit.titulo) + "-" + Math.random().toString(36).slice(2, 6);
    const doc = { ...edit, id, atualizadoEm: new Date().toISOString().slice(0, 10) };
    const existe = db.documentos.some((d) => d.id === id);
    setColecao("documentos", existe ? db.documentos.map((d) => d.id === id ? doc : d) : [...db.documentos, doc]);
    setEdit(null);
  }
  function excluir(id: string) {
    if (confirm("Excluir este documento?")) setColecao("documentos", db.documentos.filter((d) => d.id !== id));
  }

  if (edit) {
    return (
      <Card><CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className="label">Título *</label><input className="input" value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
          <div><label className="label">Categoria</label><select className="input" value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className="label">Descrição</label><input className="input" value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
          <div><label className="label">Versão</label><input className="input" value={edit.versao} onChange={(e) => setEdit({ ...edit, versao: e.target.value })} /></div>
        </div>
        <div><label className="label">Conteúdo (texto completo — use quebras de linha)</label><textarea className="input min-h-[280px] font-mono text-xs" value={edit.conteudo} onChange={(e) => setEdit({ ...edit, conteudo: e.target.value })} /></div>
        <div className="flex gap-2"><button onClick={salvar} className="btn-primary"><Save className="h-4 w-4" /> Salvar</button><button onClick={() => setEdit(null)} className="btn-outline">Cancelar</button></div>
      </CardBody></Card>
    );
  }

  return (
    <Card><CardBody className="space-y-2">
      <div className="mb-2 flex justify-end"><button onClick={novo} className="btn-primary"><Plus className="h-4 w-4" /> Novo documento</button></div>
      {db.documentos.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-2.5">
          <div className="min-w-0"><p className="truncate font-medium text-slate-800">{d.titulo}</p><p className="truncate text-xs text-slate-500">{d.descricao}</p></div>
          <div className="flex items-center gap-2"><Badge variant="neutral">{d.categoria}</Badge>
            <button onClick={() => setEdit(d)} className="btn-outline px-2.5 py-1 text-xs">Editar</button>
            <button onClick={() => excluir(d.id)} className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
        </div>
      ))}
    </CardBody></Card>
  );
}

function EditorColaboradores() {
  const { db, setColecao } = useStore();
  const [edit, setEdit] = useState<Colaborador | null>(null);
  const cargoArea = (cargoId: string | null) => db.cargos.find((c) => c.id === cargoId)?.areaId ?? null;

  function novo() {
    setEdit({ id: "", nome: "", email: "", cargoId: db.cargos[6]?.id ?? null, areaId: null, nivel: "N1", salario: null, gestorId: null, status: "Ativo", riscoSaida: "Baixo", potencial: "Médio" });
  }
  function salvar() {
    if (!edit || !edit.nome.trim()) { alert("Informe o nome."); return; }
    const id = edit.id || slug(edit.nome);
    const c = { ...edit, id, areaId: cargoArea(edit.cargoId) ?? edit.areaId };
    const existe = db.colaboradores.some((x) => x.id === id);
    setColecao("colaboradores", existe ? db.colaboradores.map((x) => x.id === id ? c : x) : [...db.colaboradores, c]);
    if (!existe && !db.usuarios.some((u) => u.colaboradorId === id)) setColecao("usuarios", [...db.usuarios, { colaboradorId: id, perfil: "COLABORADOR" }]);
    setEdit(null);
  }
  function excluir(id: string) {
    if (confirm("Excluir colaborador?")) setColecao("colaboradores", db.colaboradores.filter((x) => x.id !== id));
  }

  if (edit) {
    return (
      <Card><CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="label">Nome *</label><input className="input" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
          <div><label className="label">E-mail</label><input className="input" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
          <div><label className="label">Cargo</label><select className="input" value={edit.cargoId ?? ""} onChange={(e) => setEdit({ ...edit, cargoId: e.target.value || null })}><option value="">—</option>{db.cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          <div><label className="label">Nível</label><select className="input" value={edit.nivel ?? ""} onChange={(e) => setEdit({ ...edit, nivel: e.target.value || null })}><option value="">—</option>{db.niveis.map((n) => <option key={n.codigo} value={n.codigo}>{n.codigo}</option>)}</select></div>
          <div><label className="label">Salário</label><input className="input" type="number" value={edit.salario ?? ""} onChange={(e) => setEdit({ ...edit, salario: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><label className="label">Status</label><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{db.statuses.map((s) => <option key={s.nome}>{s.nome}</option>)}</select></div>
          <div><label className="label">Gestor</label><select className="input" value={edit.gestorId ?? ""} onChange={(e) => setEdit({ ...edit, gestorId: e.target.value || null })}><option value="">— Sem gestor —</option>{db.colaboradores.filter((c) => c.id !== edit.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          <div><label className="label">Risco / Potencial</label><div className="flex gap-2">
            <select className="input" value={edit.riscoSaida} onChange={(e) => setEdit({ ...edit, riscoSaida: e.target.value as any })}>{["Baixo", "Médio", "Alto"].map((r) => <option key={r}>{r}</option>)}</select>
            <select className="input" value={edit.potencial} onChange={(e) => setEdit({ ...edit, potencial: e.target.value as any })}>{["Baixo", "Médio", "Alto"].map((r) => <option key={r}>{r}</option>)}</select></div></div>
        </div>
        <div className="flex gap-2"><button onClick={salvar} className="btn-primary"><Save className="h-4 w-4" /> Salvar</button><button onClick={() => setEdit(null)} className="btn-outline">Cancelar</button></div>
      </CardBody></Card>
    );
  }

  return (
    <Card><CardBody className="space-y-2">
      <div className="mb-2 flex justify-end"><button onClick={novo} className="btn-primary"><Plus className="h-4 w-4" /> Novo colaborador</button></div>
      {[...db.colaboradores].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-2.5">
          <div className="min-w-0"><p className="truncate font-medium text-slate-800">{c.nome}</p><p className="truncate text-xs text-slate-500">{db.cargos.find((x) => x.id === c.cargoId)?.nome ?? "—"} · {c.nivel ?? "—"} · {formatBRL(c.salario)}</p></div>
          <div className="flex items-center gap-2"><button onClick={() => setEdit(c)} className="btn-outline px-2.5 py-1 text-xs">Editar</button>
            <button onClick={() => excluir(c.id)} className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
        </div>
      ))}
    </CardBody></Card>
  );
}

function EditorCargos() {
  const { db, setColecao } = useStore();
  function setFaixa(cargo: Cargo, nivel: string, valor: number) {
    setColecao("cargos", db.cargos.map((c) => c.id === cargo.id ? { ...c, faixas: { ...c.faixas, [nivel]: valor } } : c));
  }
  return (
    <Card><CardBody className="overflow-x-auto p-0">
      <table className="w-full text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50"><th className="th">Cargo</th>{db.niveis.map((n) => <th key={n.codigo} className="th">{n.codigo}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {db.cargos.filter((c) => c.areaId !== "direcao").map((c) => (
            <tr key={c.id}><td className="td font-medium text-slate-800">{c.nome}</td>
              {db.niveis.map((n) => <td key={n.codigo} className="td"><input type="number" className="input w-24 text-xs" value={c.faixas[n.codigo] ?? ""} onChange={(e) => setFaixa(c, n.codigo, Number(e.target.value))} /></td>)}
            </tr>
          ))}
        </tbody></table>
    </CardBody></Card>
  );
}

function AbaDados() {
  const { exportar, importar, resetar } = useStore();
  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    file.text().then((t) => { if (importar(t)) { alert("Importado."); location.reload(); } else alert("Arquivo inválido."); });
  }
  return (
    <Card><CardBody className="space-y-4">
      <p className="text-sm text-slate-600">As edições ficam salvas no seu navegador (localStorage). Use os botões abaixo para backup, transferência entre navegadores ou restaurar o padrão.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={exportar} className="btn-primary"><Download className="h-4 w-4" /> Exportar dados (.json)</button>
        <label className="btn-outline cursor-pointer"><Upload className="h-4 w-4" /> Importar dados<input type="file" accept="application/json" className="hidden" onChange={onImport} /></label>
        <button onClick={() => { if (confirm("Restaurar os dados padrão? Suas edições locais serão perdidas.")) { resetar(); location.reload(); } }} className="btn-ghost text-red-600"><RotateCcw className="h-4 w-4" /> Restaurar padrão</button>
      </div>
    </CardBody></Card>
  );
}
