import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Pencil, Trash2, Building2, Layers, Tag, Briefcase, SlidersHorizontal,
  ClipboardList, Palette, Database, Award, UserCog, ShieldCheck, Lock, Eye, EyeOff,
  KeyRound, ChevronDown, History, CalendarDays, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge, DotBadge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Toggle } from "@/components/ui/form";
import { ConteudoManager } from "@/components/painel/conteudo-manager";
import { CadastrosSecao } from "@/components/colaboradores/cadastros";
import { HistoricoSecao } from "@/components/painel/historico-secao";
import { DadosControls } from "@/components/layout/dados-controls";
import { useColecao, useConfig, salvarConfig } from "@/lib/store";
import { enviarConfigNuvem } from "@/lib/sync";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { MODO_JWT, definirSenhaUsuario, removerSenhaUsuario, atualizarPerfilServidor } from "@/lib/auth";
import { criarHash, podeHashear } from "@/lib/senha";
import { ehMaster } from "@/lib/rbac";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/misc";
import { formatBRL } from "@/lib/format";
import { slug } from "@/data/_gen";
import { statusPadraoFaltando } from "@/lib/statusPadrao";
import { ausenciasDe } from "@/lib/quadroPorSituacao";
import { MODULOS, PERFIL_LABEL } from "@/lib/constants";
import { LinkFicha } from "@/components/ui/link-ficha";
import { competenciasPlano, compLabelLongo, confidencialDoMes } from "@/lib/custos";
import { CARDS_CONFIDENCIAIS } from "@/data/classificacaoContas";
import {
  validarNovoTipo, normalizarNomeTipo, NOMES_RESERVADOS, type TipoPersonalizado,
} from "@/lib/tiposEvento";
import type { Area, Cargo, CicloAvaliacao, ModeloChecklist, Nivel, Perfil, StatusColaborador, Usuario } from "@/data/types";

/* PESO DO CICLO — decimal digitável.
 *
 * Era `<Input type="number" step="0.05" value={peso} onChange={... Number(...)}>`,
 * e com isso NÃO DAVA para digitar 0,4. O <input type="number"> devolve
 * value="" para todo conteúdo que ele ainda não entende — e "0." é um deles.
 * Number("") vira 0, o 0 voltava para a tela e apagava o ponto recém-digitado;
 * quem continuasse e teclasse o 4 terminava com peso 4. Só as setinhas do campo
 * chegavam ao valor certo.
 *
 * Peso 4 no lugar de 0,4 não dá erro nenhum: Desempenho.tsx multiplica a nota
 * por ele, então a avaliação inteira do ciclo sai dez vezes maior naquele
 * componente, calada. Este é o mesmo remédio já documentado em
 * campo-editavel.tsx: campo de TEXTO com teclado numérico, guardando o que foi
 * digitado enquanto se digita e convertendo só ao sair do campo.
 *
 * Fica no escopo do módulo, e não dentro do componente que o usa, justamente
 * para não repetir o defeito de remontagem que esta varredura encontrou.
 */
function PesoInput({ valor, onGravar }: { valor: number; onGravar: (n: number) => void }) {
  // null = "não estou digitando", então a tela mostra o valor guardado.
  const [rascunho, setRascunho] = useState<string | null>(null);
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={rascunho ?? String(valor).replace(".", ",")}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        if (rascunho === null) return;
        const n = Number(rascunho.trim().replace(",", "."));
        /* Rascunho impossível (vazio, "abc", negativo) NÃO vira zero: zerar o
           peso calado é pior que recusar, porque some com um componente inteiro
           da nota sem ninguém ver. Nesse caso o valor volta a ser o que era. */
        if (rascunho.trim() !== "" && Number.isFinite(n) && n >= 0) onGravar(n);
        setRascunho(null);
      }}
    />
  );
}


/**
 * O texto dos modelos de checklist, CONTROLADO. Era um textarea sem estado
 * que gravava em todo blur: clicar no campo para ler e clicar fora devolvia a
 * lista velha por cima do que outro aparelho tinha acabado de salvar. Agora o
 * texto acompanha o registro (o pull de 20 s repõe), e só grava se mudou.
 */
const serializarItens = (itens: { titulo: string; responsavel: string }[]) => itens.map((i) => `${i.titulo} | ${i.responsavel}`).join("\n");
function ModeloChecklistTextarea({ modelo, onGravar }: { modelo: ModeloChecklist; onGravar: (itens: { titulo: string; responsavel: string }[]) => void }) {
  const gravado = serializarItens(modelo.itens);
  const [texto, setTexto] = useState(gravado);
  const [tocado, setTocado] = useState(false);
  // Enquanto não há digitação, o campo segue o registro (que pode ter mudado
  // pelo sync). Depois de digitar, o rascunho manda até o blur.
  useEffect(() => { if (!tocado) setTexto(gravado); }, [gravado, tocado]);
  return (
    <textarea
      className="input min-h-[180px] font-mono text-xs"
      value={texto}
      onChange={(e) => { setTexto(e.target.value); setTocado(true); }}
      onBlur={() => {
        setTocado(false);
        const itens = texto.split("\n").filter((l) => l.trim()).map((l) => {
          const [titulo, responsavel] = l.split("|").map((x) => x.trim());
          return { titulo, responsavel: responsavel ?? "RH" };
        }).filter((it) => it.titulo); // descarta linhas sem título (ex.: "| RH")
        if (serializarItens(itens) === gravado) return; // nada mudou: não grava, não sobe, não avisa
        onGravar(itens);
      }}
    />
  );
}

export default function PainelControle() {
  const sessao = useSessao();
  const master = ehMaster(sessao);
  const navegar = useNavigate();
  return (
    <div>
      <PageHeader title="Painel de Controle" description="Gerencie todo o conteúdo do sistema sem mexer no código. Tudo é salvo no navegador." />
      <Tabs
        abas={[
          { id: "estrutura", label: "Estrutura", icon: <Building2 className="h-4 w-4" />, conteudo: <Estrutura /> },
          /* Todos os cadastros, com as fichas repetidas em cima (pedido do Léo
             em 07/09/2026: "ter algum local onde vê todos, onde pode ser
             possível apagar o que deseja"). Mora aqui, e não em Colaboradores,
             porque apagar cadastro é ato de administração — a mesma aba onde se
             mexe em estrutura, usuários e permissões. */
          {
            id: "cadastros",
            label: "Cadastros",
            icon: <Users className="h-4 w-4" />,
            conteudo: <CadastrosSecao onAbrirFicha={(id) => navegar(`/colaboradores/${id}`)} />,
          },
          { id: "cargos", label: "Cargos & Faixas", icon: <Briefcase className="h-4 w-4" />, conteudo: <CargosSecao /> },
          { id: "conteudo", label: "Conteúdo (RH)", icon: <ClipboardList className="h-4 w-4" />, conteudo: <ConteudoSecao /> },
          { id: "aval", label: "Avaliação & Checklists", icon: <Award className="h-4 w-4" />, conteudo: <AvaliacaoSecao /> },
          { id: "usuarios", label: "Usuários e Permissões", icon: <UserCog className="h-4 w-4" />, conteudo: <UsuariosSecao /> },
          ...(master ? [{ id: "confidencial", label: "Confidencial", icon: <Lock className="h-4 w-4" />, conteudo: <ConfidencialSecao /> }] : []),
          { id: "historico", label: "Histórico", icon: <History className="h-4 w-4" />, conteudo: <HistoricoSecao /> },
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
            else { try { criar({ id: slug(v.nome || "area"), nome: v.nome, descricao: v.descricao, ordem: items.length }); } catch (e) { toast(e instanceof Error ? e.message : "Já existe um registro com este nome.", "erro"); return; } }
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

  /* Status que o sistema traz de fábrica e ESTE cadastro não tem.
     `src/data/status.ts` só semeia quem abre o RH sem nada gravado: quem já usa
     tem a coleção no disco e na nuvem, e o merge do sync nunca sobrescreve. Sem
     este botão, acrescentar um status ao código não muda nada na tela de quem
     já usa — e o "Freelancer" pedido em 07/09/2026 simplesmente não existiria
     aqui. Continua sendo escrita pela tela, no clique. */
  const faltando = useMemo(() => statusPadraoFaltando(items), [items]);
  // A resposta efetiva de "está trabalhando?" por status — campo quando há,
  // lista de fábrica quando não há. É o que a tela de Colaboradores usa.
  const ausencias = useMemo(() => ausenciasDe(items), [items]);
  const repor = () => {
    const falhou: string[] = [];
    let feitos = 0;
    for (const f of faltando) {
      // O que não entrou tem de aparecer: repor "com sucesso" um status que não
      // foi criado deixaria a tela dizendo que dá para usar algo que não existe.
      try { criar(f); feitos++; } catch { falhou.push(f.nome); }
    }
    if (falhou.length) toast(`${feitos} reposto(s); não deu para criar: ${falhou.join(", ")}.`, "erro");
    else toast(`${feitos} status reposto(s).`, "sucesso");
  };

  return (
    <Card>
      <CardHeader title="Status do quadro" subtitle="Cada status tem cor e define o headcount" icon={<Tag className="h-[18px] w-[18px]" />}
        action={<button className="btn-outline" onClick={() => abrir(null)}><Plus className="h-4 w-4" /> Novo status</button>} />
      <CardBody className="space-y-2">
        {faltando.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-900">
              <strong className="font-semibold">
                {faltando.length === 1 ? "Um status de fábrica não existe" : `${faltando.length} status de fábrica não existem`} neste cadastro
              </strong>
              {": "}{faltando.map((f) => f.nome).join(", ")}. Enquanto faltar, nenhuma pessoa pode ser marcada assim.
            </p>
            <button type="button" className="btn-outline ml-auto h-7 px-2 py-0 text-xs" onClick={repor}>
              <Plus className="h-3.5 w-3.5" /> Repor
            </button>
          </div>
        )}
        {[...items].sort((a, b) => a.ordem - b.ordem).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div className="flex items-center gap-3">
              <DotBadge label={s.nome} cor={s.cor} />
              {s.contaComoAtivo ? <Badge variant="success">Conta no headcount</Badge> : <Badge variant="neutral">Fora do headcount</Badge>}
              {ausencias.has(s.id) && <Badge variant="warning">Ausência</Badge>}
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
              if (edit) atualizar(edit.id, form); else { try { criar({ id: slug(form.nome || "status"), ...form } as StatusColaborador); } catch (e) { toast(e instanceof Error ? e.message : "Já existe um registro com este nome.", "erro"); return; } }
              toast("Status salvo."); setNovo(false); setEdit(null);
            }}>Salvar</button></>}>
          <div className="space-y-3">
            <Campo label="Nome"><Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></Campo>
            <Campo label="Cor"><input type="color" className="h-10 w-20 rounded border border-slate-300" value={form.cor ?? "#64748b"} onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))} /></Campo>
            <Toggle checked={form.contaComoAtivo ?? true} onChange={(v) => setForm((f) => ({ ...f, contaComoAtivo: v }))} label="Conta como ativo (headcount)" />
            {/* A outra metade da pergunta. "Conta como ativo" diz se a pessoa é
                da casa; isto diz se ela está TRABALHANDO hoje. Licença,
                atestado e afastamento são da casa mas não estão — e sem este
                botão um status novo desses nascia como presença, com card
                próprio na tela de Colaboradores, sem como corrigir pela tela. */}
            <Toggle
              checked={form.ausenteHoje ?? ausencias.has(form.id ?? "")}
              onChange={(v) => setForm((f) => ({ ...f, ausenteHoje: v }))}
              label="É ausência: quem está assim não está trabalhando hoje"
            />
            <p className="text-[11px] text-slate-500">
              Ausência ainda conta como gente da casa (se “conta como ativo” estiver ligado); só sai do card de quem está presente hoje.
            </p>
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
              if (edit) atualizar(edit.id, form); else { try { criar({ id: slug(form.nome), ...form } as Cargo); } catch (e) { toast(e instanceof Error ? e.message : "Já existe um registro com este nome.", "erro"); return; } }
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
      <TiposEventoSecao />
      <ConteudoManager colecao="pops" titulo="POPs e Procedimentos" subtitulo="Procedimentos operacionais padrão (Apêndice E)" comSla />
      <ConteudoManager colecao="comunicacao" titulo="Guias de Comunicação" subtitulo="Comunicação interna (Apêndice D)" />
      <ConteudoManager colecao="institucionais" titulo="Documentos Institucionais & SST" subtitulo="Código de Ética, PGR, PCMSO, treinamentos" comCategoria />
    </div>
  );
}

/* ---------------- Tipos de aviso do calendário ----------------
   Estavam sendo criados dentro do modal "Novo evento", no meio do cadastro:
   misturava dois trabalhos (lançar um aviso × definir as categorias da casa) e
   não havia lugar nenhum para VER, renomear ou trocar a cor do que já existia.
   Aqui ficam junto das outras listas do sistema — áreas, cargos, status —, que
   é onde alguém procura quando quer configurar. */
function TiposEventoSecao() {
  const toast = useToast();
  const config = useConfig();
  const { items: eventos } = useColecao("eventos");
  const personalizados = useMemo(
    () => config.tiposEventoPersonalizados ?? [],
    [config.tiposEventoPersonalizados],
  );
  const [edit, setEdit] = useState<TipoPersonalizado | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<TipoPersonalizado | null>(null);
  const [form, setForm] = useState<{ nome: string; cor: string }>({ nome: "", cor: "#7c3aed" });

  // Quantos eventos usam este tipo — apagar não apaga os eventos, só a cor.
  const delEmUso = del ? eventos.filter((e) => e.tipo === del.nome).length : 0;

  /* salvarConfig só escreve no navegador; quem leva para a nuvem é
     enviarConfigNuvem. Sem o par, o tipo ficava preso num aparelho só. */
  const gravar = (lista: TipoPersonalizado[]) => {
    salvarConfig({ tiposEventoPersonalizados: lista });
    void enviarConfigNuvem();
  };

  const abrir = (t: TipoPersonalizado | null) => {
    setForm(t ? { nome: t.nome, cor: t.cor } : { nome: "", cor: "#7c3aed" });
    if (t) setEdit(t); else setNovo(true);
  };

  const salvar = () => {
    const nome = normalizarNomeTipo(form.nome);
    /* Ao EDITAR, o próprio tipo não conta como conflito consigo mesmo — senão
       trocar só a cor seria recusado por "já existe". */
    const outros = personalizados.filter((t) => t.nome !== edit?.nome);
    const check = validarNovoTipo(nome, outros, NOMES_RESERVADOS);
    if (!check.ok) return toast(check.motivo, "erro");
    if (edit) {
      gravar(personalizados.map((t) => (t.nome === edit.nome ? { nome, cor: form.cor } : t)));
      /* Renomear muda a chave que os eventos guardam. Trocar o nome nos eventos
         é outra história (mexe em coleção sincronizada); por ora o aviso diz o
         que aconteceu, em vez de deixar a pessoa descobrir sozinha. */
      const presos = eventos.filter((e) => e.tipo === edit.nome).length;
      toast(nome !== edit.nome && presos > 0
        ? `Tipo renomeado. ${presos} evento(s) ainda usam “${edit.nome}” e ficarão sem cor até serem reeditados.`
        : "Tipo salvo.");
    } else {
      gravar([...personalizados, { nome, cor: form.cor }]);
      toast("Tipo criado.");
    }
    setNovo(false); setEdit(null);
  };

  return (
    <Card>
      <CardHeader
        title="Tipos de aviso do calendário"
        subtitle="As categorias que a empresa cria, com cor própria no quadro do mês"
        icon={<CalendarDays className="h-[18px] w-[18px]" />}
        action={<button className="btn-outline" onClick={() => abrir(null)}><Plus className="h-4 w-4" /> Novo tipo</button>}
      />
      <CardBody className="space-y-3">
        {personalizados.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
            Nenhum tipo próprio ainda. Crie um para marcar no calendário o que só a Impresilk acompanha — vistoria de extintor, alvará vencendo, reunião de segurança.
          </p>
        ) : (
          <div className="space-y-2">
            {personalizados.map((t) => {
              const usos = eventos.filter((e) => e.tipo === t.nome).length;
              return (
                <div key={t.nome} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <DotBadge label={t.nome} cor={t.cor} />
                    <span className="text-xs text-slate-500">
                      {usos === 0 ? "nenhum evento" : usos === 1 ? "1 evento" : `${usos} eventos`}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-ghost p-1.5" onClick={() => abrir(t)} aria-label={`Editar ${t.nome}`}><Pencil className="h-4 w-4" /></button>
                    <button className="btn-ghost p-1.5 text-red-500" onClick={() => setDel(t)} aria-label={`Excluir ${t.nome}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Dizer o que NÃO se mexe aqui evita a pergunta "e por que Aniversário
            não aparece nesta lista?". */}
        <p className="text-xs text-slate-500">
          Aniversário, tempo de casa, vencimentos, experiência, férias e pagamento são calculados pelo sistema: aparecem no calendário sozinhos e não entram nesta lista.
        </p>
      </CardBody>

      {(novo || edit) && (
        <Modal
          aberto
          onFechar={() => { setNovo(false); setEdit(null); }}
          titulo={edit ? "Editar tipo de aviso" : "Novo tipo de aviso"}
          largura="max-w-md"
          rodape={<>
            <button className="btn-outline" onClick={() => { setNovo(false); setEdit(null); }}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Salvar</button>
          </>}
        >
          <div className="space-y-3">
            <Campo label="Nome" obrigatorio>
              <Input
                autoFocus
                maxLength={40}
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Vistoria de extintor"
              />
            </Campo>
            <Campo label="Cor" hint="É o que diferencia o aviso no quadro do mês">
              <input
                type="color"
                className="h-10 w-20 rounded border border-slate-300"
                value={form.cor}
                onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
              />
            </Campo>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        aberto={!!del}
        onFechar={() => setDel(null)}
        onConfirmar={() => {
          if (!del) return;
          gravar(personalizados.filter((t) => t.nome !== del.nome));
          toast(`Tipo “${del.nome}” excluído.`);
          setDel(null);
        }}
        titulo="Excluir tipo de aviso?"
        mensagem={delEmUso > 0
          ? `“${del?.nome}” está em ${delEmUso} evento(s). Eles CONTINUAM no calendário — só perdem a cor e o filtro próprio.`
          : `“${del?.nome}” será removido. Nenhum evento usa este tipo.`}
      />
    </Card>
  );
}

// ---------------- Avaliação & Checklists ----------------
function AvaliacaoSecao() {
  const toast = useToast();
  const { items: ciclos, criar: criarCiclo, atualizar } = useColecao("ciclos");
  const toastPC = useToast();
  // Criar e abrir/fechar ciclo. Só dava para mexer nos PESOS: virou o semestre,
  // não havia como encerrar o ciclo e abrir o próximo — e Desempenho escolhe o
  // ciclo por status === "Aberto", então o módulo inteiro ficava preso no
  // ciclo anterior (ou vazio, já que a base nasce sem ciclo nenhum).
  const novoCiclo = () => {
    const ano = new Date().getFullYear();
    const semestre = new Date().getMonth() < 6 ? 1 : 2;
    criarCiclo({
      nome: `Ciclo ${ano}.${semestre}`, status: "Aberto",
      pesoTecnico: 0.4, pesoComportamental: 0.3, pesoResultado: 0.3,
      // As notas do app vão de 0 a 100 (statusDesempenhoDe: >=80 apto, >=60 em
      // desenvolvimento) e o ciclo semeado usa 80. Nascer com 7 fazia TODO
      // mundo com nota acima de 7 virar "elegível a promoção" no ciclo novo.
      notaMinPromocao: 80, mesesMinNivel: 12,
    });
    toastPC(`Ciclo ${ano}.${semestre} criado e aberto.`);
  };
  const alternarCiclo = (c: CicloAvaliacao) => {
    const novo = c.status === "Aberto" ? "Fechado" : "Aberto";
    atualizar(c.id, { status: novo });
    toastPC(`${c.nome} agora está ${novo.toLowerCase()}.`);
  };
  const { items: modelos, atualizar: atualizarModelo } = useColecao("modelosChecklist");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Ciclos de avaliação"
          subtitle="Pesos, regras de elegibilidade e qual ciclo está valendo"
          icon={<Award className="h-[18px] w-[18px]" />}
          action={<button className="btn-outline h-8 px-3 py-0 text-xs" onClick={novoCiclo}><Plus className="h-4 w-4" /> Novo ciclo</button>}
        />
        <CardBody className="space-y-4">
          {ciclos.length === 0 && (
            <EmptyState title="Nenhum ciclo de avaliação" description="Sem ciclo aberto, o módulo Desempenho não tem onde lançar as notas." icon={<Award className="h-8 w-8" />} acao={<button className="btn-primary" onClick={novoCiclo}>Criar o primeiro ciclo</button>} />
          )}
          {(ciclos as CicloAvaliacao[]).map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium text-slate-700">{c.nome}</p>
                <button type="button" onClick={() => alternarCiclo(c)} title={c.status === "Aberto" ? "Encerrar este ciclo" : "Reabrir este ciclo"}>
                  <Badge variant={c.status === "Aberto" ? "success" : "neutral"}>{c.status} · clique para {c.status === "Aberto" ? "fechar" : "abrir"}</Badge>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Campo label="Peso técnico"><PesoInput valor={c.pesoTecnico} onGravar={(n) => atualizar(c.id, { pesoTecnico: n })} /></Campo>
                <Campo label="Peso comp."><PesoInput valor={c.pesoComportamental} onGravar={(n) => atualizar(c.id, { pesoComportamental: n })} /></Campo>
                <Campo label="Peso result."><PesoInput valor={c.pesoResultado} onGravar={(n) => atualizar(c.id, { pesoResultado: n })} /></Campo>
                <Campo label="Nota mín. promo" hint="0 a 100"><Input type="number" min={0} max={100} value={c.notaMinPromocao} onChange={(e) => atualizar(c.id, { notaMinPromocao: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></Campo>
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
              <ModeloChecklistTextarea
                modelo={m}
                onGravar={(itens) => { atualizarModelo(m.id, { itens }); toast(`Modelo ${m.tipo} atualizado.`); }}
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
  // Salva local e sobe para a nuvem (com debounce) — assim os outros computadores
  // recebem o nome/cores da empresa ao abrir o app.
  const salvarCfg = (patch: Parameters<typeof salvarConfig>[0]) => { salvarConfig(patch); enviarConfigNuvem(); };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Identidade e empresa" icon={<Palette className="h-[18px] w-[18px]" />} />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome da empresa"><Input defaultValue={config.empresaNome} onBlur={(e) => { salvarCfg({ empresaNome: e.target.value }); toast("Salvo."); }} /></Campo>
          <Campo label="Cidade"><Input defaultValue={config.empresaCidade} onBlur={(e) => salvarCfg({ empresaCidade: e.target.value })} /></Campo>
          <Campo label="Cor primária"><input type="color" className="h-10 w-20 rounded border border-slate-300" value={config.corPrimaria} onChange={(e) => salvarCfg({ corPrimaria: e.target.value })} /></Campo>
          <Campo label="Cor de acento"><input type="color" className="h-10 w-20 rounded border border-slate-300" value={config.corAcento} onChange={(e) => salvarCfg({ corAcento: e.target.value })} /></Campo>
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

// Passo a passo do login real (Supabase), na própria tela (recolhível). O
// conteúdo muda conforme o Supabase esteja configurado neste build ou não.
// Detalhes completos em LOGIN.md.
function GuiaLoginReal() {
  return (
    <details className="group border-b border-slate-100 bg-slate-50/40 px-5 py-2.5">
      <summary className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-800">
        <KeyRound className="h-4 w-4 shrink-0 text-brand" />
        {MODO_JWT
          ? "Login real (Supabase): passo a passo para provisionar contas"
          : "Falta configurar o Supabase para o login real funcionar (passo a passo)"}
        <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      {MODO_JWT ? (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
          <li>Para cada pessoa, defina a <strong>Senha de acesso</strong> no formulário e salve — a conta é criada/atualizada no Supabase Auth na hora.</li>
          <li>Ou clique em <strong>“Migrar senhas”</strong> (acima) para enviar de uma vez as senhas ainda em texto (cadastro antigo). Depois que viram hash, defina uma a uma no formulário.</li>
          <li>O login continua por <strong>nome</strong> (não e-mail) — por trás, cada conta usa um e-mail interno só para o Supabase Auth reconhecer.</li>
          <li className="text-slate-400">Detalhes e comandos de verificação no arquivo <code className="rounded bg-slate-100 px-1">LOGIN.md</code>.</li>
        </ol>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
          <li>No <strong>GitHub</strong> → Settings do repositório → <strong>Secrets and variables › Actions › Variables</strong>, crie:
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li><code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> — a Project URL do projeto Supabase.</li>
              <li><code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> — a anon key (pública) do mesmo projeto.</li>
            </ul>
          </li>
          <li>Rode o deploy novamente (aba <strong>Actions</strong> ou um push) para publicar o site já com o Supabase embutido.</li>
          <li>Volte aqui e <strong>entre como master</strong>: vai aparecer a faixa verde “Login real ativo”.</li>
          <li>Defina a senha de cada pessoa no formulário.</li>
          <li className="text-slate-400">Passo a passo completo (schema SQL, Edge Functions, primeira conta) em <code className="rounded bg-slate-100 px-1">LOGIN.md</code>.</li>
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
  // Ativar/desativar vale NO SERVIDOR primeiro (login e sync conferem `perfis`).
  // Mudar só a tabela local deixava o desativado entrando — e, pior, sem
  // restrição de módulos (auditoria de 07/09/2026). Sem servidor, não muda.
  const alternarAtivo = async (u: Usuario, v: boolean) => {
    if (u.colaboradorId) {
      try {
        const r = await atualizarPerfilServidor({ colaboradorId: u.colaboradorId, ativo: v });
        if (!r.atualizado) toast("Não há conta no servidor para este usuário; só a tabela local mudou.", "info");
      } catch {
        toast("Não deu para mudar no servidor agora (sem internet?). O usuário continua como estava.", "erro");
        return;
      }
    }
    atualizar(u.id, { ativo: v });
    toast(v ? "Usuário ativado." : "Usuário desativado.");
  };

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
    // Só dá para reenviar senha que ainda esteja em texto (formato antigo). Depois
    // que o app converteu tudo para hash, ninguém — nem o RH — consegue lê-las de
    // volta; aí a senha de cada pessoa é definida uma a uma, no formulário.
    const alvos = usuarios.filter((u) => u.ativo && u.colaboradorId && u.senha?.trim());
    if (alvos.length === 0) { toast("Nada a migrar: as senhas já estão protegidas. Defina a senha de cada pessoa no formulário do usuário.", "erro"); return; }
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
                <td className="td text-slate-500">{u.colaboradorId ? <LinkFicha id={u.colaboradorId} titulo="Abrir a ficha da pessoa por trás deste login">{d.nomeColab(u.colaboradorId)}</LinkFicha> : "—"}</td>
                <td className="td">
                  {acessoTotal(u)
                    ? <Badge variant="success">Tudo</Badge>
                    : <span className="text-sm tabular-nums text-slate-600">{qtdLiberados(u)} de {totalModulos}</span>}
                </td>
                <td className="td">
                  <div className="flex justify-center">
                    <Toggle checked={u.ativo} onChange={(v) => void alternarAtivo(u, v)} />
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
            void (async () => {
              // A senha digitada NUNCA é gravada como texto: vira hash aqui e o
              // texto só existe nesta função (para provisionar no servidor).
              const { senha: digitada, ...resto } = dados;
              const campos: Partial<Usuario> = { ...resto };
              if (digitada) {
                if (!podeHashear()) { toast("Este navegador não consegue proteger a senha. Use o app pelo endereço https.", "erro"); return; }
                campos.senhaHash = await criarHash(digitada);
                campos.senha = undefined; // apaga qualquer texto puro que restasse
              }
              // Perfil e Ativo valem no SERVIDOR: mudar só a tabela local deixava
              // a tela dizendo "Colaborador" enquanto o servidor seguia
              // entregando dados de gestor (auditoria de 07/09/2026).
              if (edit?.colaboradorId) {
                const mudaPerfil = campos.perfil !== undefined && campos.perfil !== edit.perfil;
                const mudaAtivo = campos.ativo !== undefined && campos.ativo !== edit.ativo;
                if (mudaPerfil || mudaAtivo) {
                  try {
                    await atualizarPerfilServidor({ colaboradorId: edit.colaboradorId, ...(mudaPerfil ? { perfil: campos.perfil } : {}), ...(mudaAtivo ? { ativo: campos.ativo } : {}) });
                  } catch {
                    toast("Não deu para mudar perfil/ativo no servidor agora (sem internet?). Nada foi alterado.", "erro");
                    return;
                  }
                }
              }
              if (edit) atualizar(edit.id, campos);
              else { try { criar({ id: slug(`user ${dados.email || dados.nome}`), criadoEm: new Date().toISOString(), ...campos }); } catch (e) { toast(e instanceof Error ? e.message : "Já existe um registro com este nome.", "erro"); return; } }
              if (digitada) await provisionarNoServidor({ ...resto, senha: digitada }); // login real: ativa a senha no servidor
              toast("Usuário salvo."); setNovo(false); setEdit(null);
            })();
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
  // Começa VAZIO de propósito: a senha guardada é um hash, não dá para exibi-la.
  // Em branco = mantém a que já existe.
  const [senha, setSenha] = useState("");
  const jaTemSenha = !!(usuario?.senhaHash || usuario?.senha?.trim());
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
          <Campo
            label="Senha de acesso"
            hint={jaTemSenha
              ? "Esta pessoa já tem senha. Digite algo aqui só para TROCAR — em branco, mantém a atual. (A senha é guardada protegida; nem o RH consegue vê-la.)"
              : "Senha individual de login. Em branco = usa a senha padrão do sistema."}
            className="sm:col-span-2"
          >
            <div className="relative">
              <Input type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={jaTemSenha ? "Deixe em branco para manter a senha atual" : "Defina uma senha para este usuário"} className="pr-10" />
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
