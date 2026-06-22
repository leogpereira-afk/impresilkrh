import { useMemo, useState } from "react";
import {
  Send, Users, FileText, Clock, Info, Plus, Pencil, Trash2, CheckCircle2,
  Search, Ban, RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { podeGerir } from "@/lib/rbac";
import { formatDate, formatDateLong } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import type { Agendamento, Contato, TemplateMensagem } from "@/data/types";

const SEM_GRUPO = "Sem grupo";

const varianteStatus: Record<string, "info" | "success" | "neutral"> = {
  Agendada: "info",
  Enviada: "success",
  Cancelada: "neutral",
};

// Aplica os placeholders de um template ({{nome}}) a um destinatário fictício.
function aplicarPlaceholders(corpo: string, nome: string): string {
  return corpo.replace(/\{\{\s*nome\s*\}\}/gi, nome);
}

export default function Mensagens() {
  const sessao = useSessao();
  const podeEditar = podeGerir(sessao);

  return (
    <div>
      <PageHeader
        title="Disparador de Mensagens em Massa"
        description="Gerencie contatos e modelos e organize a fila de envios da comunicação interna."
      >
        <Badge variant="gold">
          <Send className="h-3.5 w-3.5" /> Módulo G
        </Badge>
      </PageHeader>

      <Card className="mb-6 border-blue-200/70 bg-blue-50/40">
        <div className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Info className="h-[18px] w-[18px]" />
          </span>
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-800">Aplicação sem servidor (demonstração)</p>
            <p className="mt-1 leading-relaxed">
              Este é um app estático, sem backend. A página <strong>gerencia contatos e
              modelos</strong> e <strong>agenda os envios numa fila local</strong> (no seu
              navegador). O <strong>envio real</strong> por WhatsApp ou SMS exigiria a integração
              com um serviço externo de mensageria — aqui o disparo é apenas simulado.
            </p>
          </div>
        </div>
      </Card>

      <Tabs
        abas={[
          { id: "contatos", label: "Contatos", icon: <Users className="h-4 w-4" />, conteudo: <AbaContatos podeEditar={podeEditar} /> },
          { id: "templates", label: "Templates", icon: <FileText className="h-4 w-4" />, conteudo: <AbaTemplates podeEditar={podeEditar} /> },
          { id: "agendamentos", label: "Agendamentos", icon: <Clock className="h-4 w-4" />, conteudo: <AbaAgendamentos podeEditar={podeEditar} /> },
        ]}
      />
    </div>
  );
}

/* ============================ Aba: Contatos ============================ */

interface FormContato {
  nome: string;
  telefone: string;
  grupo: string;
}
const CONTATO_VAZIO: FormContato = { nome: "", telefone: "", grupo: "" };

function AbaContatos({ podeEditar }: { podeEditar: boolean }) {
  const toast = useToast();
  const d = useDominio();
  const { items: contatos, criar, atualizar, remover } = useColecao("contatos");

  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Contato | null>(null);
  const [form, setForm] = useState<FormContato>(CONTATO_VAZIO);
  const [excluir, setExcluir] = useState<Contato | null>(null);

  const setCampo = (campo: keyof FormContato, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const lista = useMemo(
    () =>
      contatos
        .filter((c) => {
          if (!busca) return true;
          const q = busca.toLowerCase();
          return (
            c.nome.toLowerCase().includes(q) ||
            c.telefone.toLowerCase().includes(q) ||
            (c.grupo ?? "").toLowerCase().includes(q)
          );
        })
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [contatos, busca],
  );

  // Resumo por grupo (todos os contatos, independente da busca).
  const resumoGrupos = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of contatos) {
      const g = c.grupo?.trim() || SEM_GRUPO;
      mapa.set(g, (mapa.get(g) ?? 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [contatos]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(CONTATO_VAZIO);
    setModal(true);
  };
  const abrirEdicao = (c: Contato) => {
    setEditando(c);
    setForm({ nome: c.nome, telefone: c.telefone, grupo: c.grupo ?? "" });
    setModal(true);
  };
  const fechar = () => {
    setModal(false);
    setEditando(null);
    setForm(CONTATO_VAZIO);
  };

  const salvar = () => {
    const nome = form.nome.trim();
    const telefone = form.telefone.trim();
    if (!nome || !telefone) {
      toast("Informe nome e telefone do contato.", "erro");
      return;
    }
    const dados = { nome, telefone, grupo: form.grupo.trim() || undefined };
    if (editando) {
      atualizar(editando.id, dados);
      toast(`Contato "${nome}" atualizado.`);
    } else {
      criar(dados);
      toast(`Contato "${nome}" adicionado.`);
    }
    fechar();
  };

  // "Sincronizar do quadro": cria contatos a partir do quadro ativo (telefone),
  // sem duplicar por colaboradorId. Tudo local — não há envio.
  const sincronizarDoQuadro = () => {
    const jaTem = new Set(contatos.map((c) => c.colaboradorId).filter(Boolean));
    let adicionados = 0;
    for (const colab of d.colaboradores) {
      if (colab.ehDirecao || colab.statusId === "inativo" || !colab.telefone) continue;
      if (jaTem.has(colab.id)) continue;
      criar({
        nome: colab.nome,
        telefone: colab.telefone,
        colaboradorId: colab.id,
        grupo: d.nomeArea(colab.areaId),
      });
      adicionados++;
    }
    if (adicionados === 0) {
      toast("Nenhum contato novo encontrado no quadro.", "info");
    } else {
      toast(`${adicionados} contato(s) sincronizado(s) do quadro.`);
    }
  };

  const confirmarExclusao = () => {
    if (!excluir) return;
    remover(excluir.id);
    toast(`Contato "${excluir.nome}" removido.`);
    setExcluir(null);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, telefone ou grupo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-outline" onClick={sincronizarDoQuadro}>
              <RefreshCw className="h-4 w-4" /> Sincronizar do quadro
            </button>
            <button className="btn-primary" onClick={abrirNovo}>
              <Plus className="h-4 w-4" /> Novo contato
            </button>
          </div>
        )}
      </div>

      {resumoGrupos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {contatos.length} contato(s) ·
          </span>
          {resumoGrupos.map(([grupo, qtd]) => (
            <Badge key={grupo} variant="neutral">
              {grupo} · {qtd}
            </Badge>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum contato encontrado"
          description={busca ? "Ajuste a busca." : "Adicione contatos ou sincronize do quadro."}
          icon={<Users className="h-8 w-8" />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Nome</th>
                  <th className="th hidden sm:table-cell">Telefone</th>
                  <th className="th">Grupo</th>
                  {podeEditar && <th className="th text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/60">
                    <td className="td">
                      <p className="font-medium text-slate-800">{c.nome}</p>
                      <p className="text-xs text-slate-400 sm:hidden">{c.telefone}</p>
                    </td>
                    <td className="td hidden sm:table-cell text-slate-500">{c.telefone}</td>
                    <td className="td">
                      {c.grupo ? <Badge variant="neutral">{c.grupo}</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    {podeEditar && (
                      <td className="td text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            className="btn-ghost p-1.5"
                            onClick={() => abrirEdicao(c)}
                            aria-label={`Editar contato ${c.nome}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn-ghost p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => setExcluir(c)}
                            aria-label={`Remover contato ${c.nome}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {podeEditar && (
        <Modal
          aberto={modal}
          onFechar={fechar}
          titulo={editando ? "Editar contato" : "Novo contato"}
          descricao="Contatos compõem a base do disparador de mensagens."
          rodape={
            <>
              <button className="btn-outline" onClick={fechar}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}>
                <CheckCircle2 className="h-4 w-4" /> Salvar
              </button>
            </>
          }
        >
          <div className="grid gap-4">
            <Campo label="Nome" obrigatorio>
              <Input value={form.nome} onChange={(e) => setCampo("nome", e.target.value)} placeholder="Nome do contato" />
            </Campo>
            <Campo label="Telefone" obrigatorio>
              <Input value={form.telefone} onChange={(e) => setCampo("telefone", e.target.value)} placeholder="(38) 99999-0000" />
            </Campo>
            <Campo label="Grupo" hint="Ex.: Produção, Comercial, Liderança. Usado para segmentar os envios.">
              <Input value={form.grupo} onChange={(e) => setCampo("grupo", e.target.value)} placeholder="Opcional" />
            </Campo>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={confirmarExclusao}
        titulo="Remover contato"
        mensagem={<>Tem certeza que deseja remover <strong>{excluir?.nome}</strong> da base de contatos?</>}
        textoConfirmar="Remover"
      />
    </div>
  );
}

/* ============================ Aba: Templates ============================ */

interface FormTemplate {
  titulo: string;
  corpo: string;
}
const TEMPLATE_VAZIO: FormTemplate = { titulo: "", corpo: "" };

function AbaTemplates({ podeEditar }: { podeEditar: boolean }) {
  const toast = useToast();
  const { items: templates, criar, atualizar, remover } = useColecao("templatesMensagem");

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<TemplateMensagem | null>(null);
  const [form, setForm] = useState<FormTemplate>(TEMPLATE_VAZIO);
  const [excluir, setExcluir] = useState<TemplateMensagem | null>(null);

  const setCampo = (campo: keyof FormTemplate, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const lista = useMemo(
    () => templates.slice().sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [templates],
  );

  const abrirNovo = () => {
    setEditando(null);
    setForm(TEMPLATE_VAZIO);
    setModal(true);
  };
  const abrirEdicao = (t: TemplateMensagem) => {
    setEditando(t);
    setForm({ titulo: t.titulo, corpo: t.corpo });
    setModal(true);
  };
  const fechar = () => {
    setModal(false);
    setEditando(null);
    setForm(TEMPLATE_VAZIO);
  };

  const salvar = () => {
    const titulo = form.titulo.trim();
    const corpo = form.corpo.trim();
    if (!titulo || !corpo) {
      toast("Informe título e corpo do template.", "erro");
      return;
    }
    if (editando) {
      atualizar(editando.id, { titulo, corpo });
      toast(`Template "${titulo}" atualizado.`);
    } else {
      criar({ titulo, corpo, criadoEm: new Date().toISOString() });
      toast(`Template "${titulo}" criado.`);
    }
    fechar();
  };

  const confirmarExclusao = () => {
    if (!excluir) return;
    remover(excluir.id);
    toast(`Template "${excluir.titulo}" removido.`);
    setExcluir(null);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {templates.length} modelo(s) de mensagem. Use <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-brand">{"{{nome}}"}</code> como placeholder.
        </p>
        {podeEditar && (
          <button className="btn-primary" onClick={abrirNovo}>
            <Plus className="h-4 w-4" /> Novo template
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum template cadastrado"
          description="Crie modelos reutilizáveis para agilizar os envios."
          icon={<FileText className="h-8 w-8" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader
                title={t.titulo}
                subtitle={`Criado em ${formatDate(t.criadoEm)}`}
                icon={<FileText className="h-[18px] w-[18px]" />}
                action={
                  podeEditar ? (
                    <div className="inline-flex items-center gap-1">
                      <button className="btn-ghost p-1.5" onClick={() => abrirEdicao(t)} aria-label={`Editar template ${t.titulo}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setExcluir(t)}
                        aria-label={`Remover template ${t.titulo}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : undefined
                }
              />
              <CardBody className="flex-1">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{t.corpo}</p>
                {/\{\{\s*nome\s*\}\}/i.test(t.corpo) && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Prévia: <span className="text-slate-700">{aplicarPlaceholders(t.corpo, "Maria")}</span>
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {podeEditar && (
        <Modal
          aberto={modal}
          onFechar={fechar}
          titulo={editando ? "Editar template" : "Novo template"}
          descricao="Modelos reutilizáveis para os disparos."
          rodape={
            <>
              <button className="btn-outline" onClick={fechar}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}>
                <CheckCircle2 className="h-4 w-4" /> Salvar
              </button>
            </>
          }
        >
          <div className="grid gap-4">
            <Campo label="Título" obrigatorio>
              <Input value={form.titulo} onChange={(e) => setCampo("titulo", e.target.value)} placeholder="Ex.: Comunicado geral" />
            </Campo>
            <Campo
              label="Corpo da mensagem"
              obrigatorio
              hint="Use {{nome}} para inserir o nome do destinatário automaticamente no envio."
            >
              <Textarea
                value={form.corpo}
                onChange={(e) => setCampo("corpo", e.target.value)}
                rows={5}
                placeholder="Olá {{nome}}, ..."
              />
            </Campo>
            {/\{\{\s*nome\s*\}\}/i.test(form.corpo) && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Exemplo: <span className="text-slate-700">{aplicarPlaceholders(form.corpo, "Maria")}</span>
              </p>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={confirmarExclusao}
        titulo="Remover template"
        mensagem={<>Tem certeza que deseja remover o template <strong>{excluir?.titulo}</strong>?</>}
        textoConfirmar="Remover"
      />
    </div>
  );
}

/* ============================ Aba: Agendamentos ============================ */

interface FormAgendamento {
  templateId: string;
  titulo: string;
  mensagem: string;
  grupoAlvo: string;
  quando: string;
}
const TODOS = "Todos";
const AGENDAMENTO_VAZIO: FormAgendamento = {
  templateId: "",
  titulo: "",
  mensagem: "",
  grupoAlvo: TODOS,
  quando: "",
};

function AbaAgendamentos({ podeEditar }: { podeEditar: boolean }) {
  const toast = useToast();
  const { items: contatos } = useColecao("contatos");
  const { items: templates } = useColecao("templatesMensagem");
  const { items: agendamentos, criar, atualizar, remover } = useColecao("agendamentos");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormAgendamento>(AGENDAMENTO_VAZIO);
  const [excluir, setExcluir] = useState<Agendamento | null>(null);

  const setCampo = (campo: keyof FormAgendamento, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  // Grupos distintos a partir dos contatos (para o seletor de alvo).
  const grupos = useMemo(() => {
    const set = new Set<string>();
    for (const c of contatos) {
      const g = c.grupo?.trim();
      if (g) set.add(g);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [contatos]);

  // Quantos contatos correspondem a um grupo-alvo (ou "Todos").
  const contar = (grupoAlvo?: string) => {
    if (!grupoAlvo || grupoAlvo === TODOS) return contatos.length;
    return contatos.filter((c) => (c.grupo?.trim() || "") === grupoAlvo).length;
  };

  const lista = useMemo(
    () =>
      agendamentos
        .slice()
        .sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime()),
    [agendamentos],
  );

  const agendadas = useMemo(() => agendamentos.filter((a) => a.status === "Agendada").length, [agendamentos]);
  const enviadas = useMemo(() => agendamentos.filter((a) => a.status === "Enviada").length, [agendamentos]);

  const abrirNovo = () => {
    setForm({ ...AGENDAMENTO_VAZIO, quando: HOJE.toISOString().slice(0, 16) });
    setModal(true);
  };
  const fechar = () => {
    setModal(false);
    setForm(AGENDAMENTO_VAZIO);
  };

  // Ao escolher um template, pré-preenche título e mensagem (se ainda vazios).
  const aoEscolherTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    setForm((f) => ({
      ...f,
      templateId: id,
      titulo: tpl && !f.titulo.trim() ? tpl.titulo : f.titulo,
      mensagem: tpl ? tpl.corpo : f.mensagem,
    }));
  };

  const salvar = () => {
    const titulo = form.titulo.trim();
    const mensagem = form.mensagem.trim();
    if (!titulo || !mensagem) {
      toast("Informe o título e a mensagem do envio.", "erro");
      return;
    }
    if (!form.quando) {
      toast("Defina a data/hora do envio.", "erro");
      return;
    }
    criar({
      templateId: form.templateId || undefined,
      titulo,
      mensagem,
      grupoAlvo: form.grupoAlvo,
      quando: new Date(form.quando).toISOString(),
      status: "Agendada",
      criadoEm: new Date().toISOString(),
    });
    toast(`Envio "${titulo}" agendado para ${contar(form.grupoAlvo)} contato(s).`);
    fechar();
  };

  // Simula o disparo: marca como enviada e avisa quantos contatos receberiam.
  const marcarEnviada = (a: Agendamento) => {
    const n = contar(a.grupoAlvo);
    atualizar(a.id, { status: "Enviada" });
    toast(`Envio simulado para ${n} contato(s).`, "info");
  };
  const cancelar = (a: Agendamento) => {
    atualizar(a.id, { status: "Cancelada" });
    toast(`Envio "${a.titulo}" cancelado.`);
  };
  const confirmarExclusao = () => {
    if (!excluir) return;
    remover(excluir.id);
    toast(`Agendamento "${excluir.titulo}" removido.`);
    setExcluir(null);
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Agendadas" value={agendadas} icon={<Clock className="h-5 w-5" />} accent="blue" hint="Na fila de envio" />
        <StatCard label="Enviadas" value={enviadas} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" hint="Disparos simulados" />
        <StatCard label="Total de contatos" value={contatos.length} icon={<Users className="h-5 w-5" />} accent="gold" hint="Base disponível" />
      </div>

      <div className="mb-4 flex items-center justify-end">
        {podeEditar && (
          <button className="btn-primary" onClick={abrirNovo}>
            <Send className="h-4 w-4" /> Agendar envio
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum envio agendado"
          description="A fila de envios está vazia. Agende um disparo para começar."
          icon={<Clock className="h-8 w-8" />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Envio</th>
                  <th className="th hidden sm:table-cell">Alvo</th>
                  <th className="th hidden md:table-cell">Destinatários</th>
                  <th className="th">Quando</th>
                  <th className="th">Status</th>
                  {podeEditar && <th className="th text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((a) => {
                  const n = contar(a.grupoAlvo);
                  return (
                    <tr key={a.id} className="transition hover:bg-slate-50/60">
                      <td className="td">
                        <p className="font-medium text-slate-800">{a.titulo}</p>
                        <p className="line-clamp-1 max-w-xs text-xs text-slate-400">{a.mensagem}</p>
                      </td>
                      <td className="td hidden sm:table-cell">
                        <Badge variant="neutral">{a.grupoAlvo || TODOS}</Badge>
                      </td>
                      <td className="td hidden md:table-cell text-slate-500">{n} contato(s)</td>
                      <td className="td text-slate-500" title={formatDateLong(a.quando)}>{formatDate(a.quando)}</td>
                      <td className="td">
                        <Badge variant={varianteStatus[a.status] ?? "neutral"}>{a.status}</Badge>
                      </td>
                      {podeEditar && (
                        <td className="td text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {a.status === "Agendada" && (
                              <>
                                <button
                                  className="btn-ghost p-1.5 text-green-600 hover:bg-green-50"
                                  onClick={() => marcarEnviada(a)}
                                  title="Marcar como enviada (simular disparo)"
                                  aria-label={`Marcar ${a.titulo} como enviada`}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button
                                  className="btn-ghost p-1.5 text-slate-500 hover:bg-slate-100"
                                  onClick={() => cancelar(a)}
                                  title="Cancelar envio"
                                  aria-label={`Cancelar ${a.titulo}`}
                                >
                                  <Ban className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              className="btn-ghost p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => setExcluir(a)}
                              title="Remover agendamento"
                              aria-label={`Remover ${a.titulo}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {podeEditar && (
        <Modal
          aberto={modal}
          onFechar={fechar}
          titulo="Agendar envio"
          descricao="Adicione um disparo à fila local. O envio real é apenas simulado."
          rodape={
            <>
              <button className="btn-outline" onClick={fechar}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}>
                <Send className="h-4 w-4" /> Agendar
              </button>
            </>
          }
        >
          <div className="grid gap-4">
            <Campo label="Template" hint="Opcional — preenche a mensagem automaticamente.">
              <Select value={form.templateId} onChange={(e) => aoEscolherTemplate(e.target.value)}>
                <option value="">Sem template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.titulo}</option>
                ))}
              </Select>
            </Campo>
            <Campo label="Título" obrigatorio>
              <Input value={form.titulo} onChange={(e) => setCampo("titulo", e.target.value)} placeholder="Ex.: Comunicado da semana" />
            </Campo>
            <Campo label="Mensagem" obrigatorio hint="Use {{nome}} para personalizar com o nome do contato.">
              <Textarea value={form.mensagem} onChange={(e) => setCampo("mensagem", e.target.value)} rows={4} placeholder="Olá {{nome}}, ..." />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Grupo-alvo">
                <Select value={form.grupoAlvo} onChange={(e) => setCampo("grupoAlvo", e.target.value)}>
                  <option value={TODOS}>Todos os contatos</option>
                  {grupos.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Quando" obrigatorio>
                <Input type="datetime-local" value={form.quando} onChange={(e) => setCampo("quando", e.target.value)} />
              </Campo>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Este envio alcançaria <span className="font-medium text-slate-700">{contar(form.grupoAlvo)} contato(s)</span> do grupo selecionado.
            </p>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={confirmarExclusao}
        titulo="Remover agendamento"
        mensagem={<>Tem certeza que deseja remover o agendamento <strong>{excluir?.titulo}</strong> da fila?</>}
        textoConfirmar="Remover"
      />
    </div>
  );
}
