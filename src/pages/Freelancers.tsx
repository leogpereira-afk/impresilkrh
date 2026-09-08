/* CONTRATOS DE FREELANCER — quem trabalha para a casa sem fazer parte do quadro.
 *
 * POR QUE ESTA TELA EXISTE
 * Essa gente estava num vão. O Osmane é o caso que a revelou: desligado da folha
 * em 22/06/2026, trabalhando por fora desde então, com 24 O.S. no PCP até agosto.
 * Ele entra nos sistemas todo dia — e não havia lugar nenhum que dissesse quem
 * ele é, até quando o combinado vale, nem a quem perguntar.
 *
 * O efeito disso é cruel dos DOIS lados, e os dois já aconteceram aqui:
 *   · quem olha a ficha vê "inativo" e corta o acesso numa limpeza — foi o que
 *     quase fizemos com ele, e o que quase fizemos com o Adriano Nunes;
 *   · ou ninguém corta nunca, porque não existe data, e o acesso de um contrato
 *     encerrado fica aberto para sempre.
 *
 * NÃO É COLABORADOR, e a tela existe para não virar um. Sem carteira, sem folha,
 * sem férias, sem ponto. Por isso coleção própria em vez de mais um status na
 * ficha: misturado, ele entraria no headcount, no organograma e nos números da
 * folha — e a resposta para "quantos somos" sairia errada.
 *
 * O QUE FECHA O ACESSO É A DATA DAQUI. `contratoFim` vira `valido_ate` na conta
 * da Central, e a porta fecha sozinha no dia, nos oito sistemas, sem depender de
 * alguém lembrar. É por isso que a data é obrigatória: quem é do quadro tem o RH
 * para encerrá-lo; o freelancer não tem nada além deste campo.
 */

import { useMemo, useState } from "react";
import { Search, HardHat, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { useDominio } from "@/lib/dominio";
import { formatBRL, formatDate, diaLocalISO, parseBRL } from "@/lib/format";
import type { Freelancer } from "@/data/types";

const HOJE = diaLocalISO(new Date());

/** Dias até o contrato acabar. Negativo = já venceu. */
function diasAte(fim?: string) {
  if (!fim) return null;
  const ms = new Date(`${fim}T12:00:00`).getTime() - new Date(`${HOJE}T12:00:00`).getTime();
  return Math.round(ms / 86400000);
}

/* O ESTADO DO CONTRATO EM UMA PALAVRA, e é ele que decide a cor.
   "Encerrado" é decisão de alguém; "vencido" é o relógio — e os dois precisam
   ser distinguíveis, porque um contrato que venceu sem ninguém encerrar é
   justamente o que fica esquecido com acesso aberto. */
function estado(f: Freelancer): { rotulo: string; variante: "success" | "warning" | "danger" | "neutral" } {
  if (f.situacao === "encerrado") return { rotulo: "encerrado", variante: "neutral" };
  const d = diasAte(f.contratoFim);
  if (d === null) return { rotulo: "sem prazo", variante: "danger" };
  if (d < 0) return { rotulo: `venceu há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`, variante: "danger" };
  if (d <= 15) return { rotulo: `vence em ${d} dia${d === 1 ? "" : "s"}`, variante: "warning" };
  return { rotulo: "ativo", variante: "success" };
}

const VAZIO: Partial<Freelancer> = {
  nome: "", apelido: "", cpf: "", cnpj: "", telefone: "", email: "",
  funcao: "", contratoInicio: HOJE, contratoFim: "", valor: undefined,
  formaPagamento: "", responsavelId: "", situacao: "ativo", observacoes: "",
};

export default function Freelancers() {
  const d = useDominio();
  const sessao = useSessao();
  const toast = useToast();
  const podeEditar = ehRH(sessao);
  /* `items` VEM DO PROPRIO HOOK, e nao de um atalho pelo dominio. A primeira
     versao lia `(d as unknown as {...}).freelancers ?? []` -- um cast para
     alcancar uma colecao que o `useDominio` nao expoe. Alem de feio, o `?? []`
     criava um ARRAY NOVO a cada render, e o `useMemo` da lista, que depende
     dele, nunca aproveitava o cache: refazia filtro e ordenacao a cada tecla
     digitada na busca. O lint pegou (react-hooks/exhaustive-deps) e a outra
     sessao avisou.
     `items` sai de `useSyncExternalStore`, entao a referencia so muda quando a
     colecao muda de verdade -- que e o que o memo precisa. */
  const { items: todos, criar, atualizar, remover } = useColecao("freelancers");

  const [busca, setBusca] = useState("");
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [form, setForm] = useState<Partial<Freelancer> | null>(null);
  const [apagando, setApagando] = useState<Freelancer | null>(null);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todos
      .filter((f) => (verEncerrados ? true : f.situacao !== "encerrado"))
      .filter((f) => (termo
        ? `${f.nome} ${f.apelido ?? ""} ${f.funcao ?? ""}`.toLowerCase().includes(termo)
        : true))
      /* Quem vence primeiro aparece primeiro: a tela existe para avisar antes,
         não para listar em ordem alfabética. Sem prazo vai para o topo — é o
         pior caso, não o mais neutro. */
      .sort((a, b) => (a.contratoFim || "0000-00-00").localeCompare(b.contratoFim || "0000-00-00"));
  }, [todos, busca, verEncerrados]);

  const vencendo = todos.filter((f) => {
    if (f.situacao === "encerrado") return false;
    const dd = diasAte(f.contratoFim);
    return dd === null || dd <= 15;
  }).length;

  const salvar = () => {
    if (!form) return;
    const nome = String(form.nome ?? "").trim();
    if (!nome) return toast("O freelancer precisa de um nome.", "erro");
    /* A DATA É OBRIGATÓRIA, e não é burocracia: é ela que fecha o acesso. Sem
       ela, o combinado dura para sempre por omissão — que é como acesso
       esquecido vira porta aberta. O banco recusa igual, do outro lado. */
    if (!form.contratoFim) return toast("Diga até quando o contrato vale — é essa data que fecha o acesso.", "erro");
    if (form.contratoInicio && form.contratoFim < form.contratoInicio) {
      return toast("O fim do contrato está antes do início.", "erro");
    }
    const apelido = String(form.apelido ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
    if (apelido) {
      /* Mesmo apelido que um colaborador é duas pessoas disputando a mesma
         porta — a entrada é única, e o login sai daqui igualzinho. */
      const outro = d.colaboradores.find((c) => (c.apelido ?? "") === apelido)
        ?? todos.find((f) => f.id !== form.id && (f.apelido ?? "") === apelido);
      if (outro) return toast(`O apelido "${apelido}" já é de ${outro.nome}. Use outro.`, "erro");
    }
    const dados = { ...form, nome, apelido, situacao: form.situacao ?? "ativo" };
    if (form.id) { atualizar(form.id, dados); toast("Contrato atualizado."); }
    else { criar(dados); toast("Freelancer cadastrado."); }
    setForm(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contratos de freelancer"
        description="Quem trabalha para a casa sem fazer parte do quadro — sem carteira, sem folha, sem ponto. A data de fim aqui é a que fecha o acesso nos sistemas."
      >
        {podeEditar && (
          <button className="btn-primary" onClick={() => setForm({ ...VAZIO })}>
            <Plus className="h-4 w-4" /> Novo contrato
          </button>
        )}
      </PageHeader>

      {/* O AVISO VEM ANTES DA LISTA. Contrato vencido sem ninguém encerrar é
          exatamente o caso que esta tela existe para impedir — e ele não pode
          depender de alguém rolar a página até achar. */}
      {vencendo > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>{vencendo} contrato{vencendo === 1 ? "" : "s"}</b> {vencendo === 1 ? "vence" : "vencem"} nos
            próximos 15 dias, já venceu ou está sem prazo. Vencido, o acesso fecha sozinho nos sistemas —
            renove aqui se a pessoa continua trabalhando.
          </span>
        </div>
      )}

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9" placeholder="Buscar por nome, apelido ou função"
                value={busca} onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={verEncerrados}
                onChange={(e) => setVerEncerrados(e.target.checked)} />
              Mostrar encerrados
            </label>
          </div>

          {lista.length === 0 ? (
            <EmptyState
              icon={<HardHat className="h-6 w-6" />}
              title="Nenhum contrato aqui"
              description="Quem presta serviço sem carteira entra por esta tela — e o acesso dele aos sistemas passa a ter data para acabar."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Função</th>
                    <th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2">Vale até</th>
                    <th className="px-3 py-2">Situação</th>
                    {podeEditar && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f) => {
                    const e = estado(f);
                    return (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{f.nome}</div>
                          {f.apelido && <div className="font-mono text-xs text-slate-400">{f.apelido}</div>}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{f.funcao || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {f.responsavelId ? d.nomeColab(f.responsavelId) : "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{formatDate(f.contratoFim) || "—"}</td>
                        <td className="px-3 py-2"><Badge variant={e.variante}>{e.rotulo}</Badge></td>
                        {podeEditar && (
                          <td className="px-3 py-2 text-right">
                            <button className="btn-ghost h-8 px-2" onClick={() => setForm({ ...f })}>
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </button>
                            <button className="btn-ghost h-8 px-2 text-red-600" onClick={() => setApagando(f)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        aberto={!!form}
        onFechar={() => setForm(null)}
        titulo={form?.id ? "Editar contrato" : "Novo freelancer"}
        descricao="Ele não entra no quadro, na folha nem no organograma. O que se registra aqui é o combinado — e a data em que ele acaba."
        largura="max-w-2xl"
        rodape={
          <>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Salvar</button>
          </>
        }
      >
        {form && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome" obrigatorio className="sm:col-span-2">
              <Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </Campo>
            <Campo label="Apelido (login nos sistemas)" hint="minúsculo, sem acento — é com ele que a pessoa entra">
              <Input value={form.apelido ?? ""} placeholder="ex.: osmane"
                onChange={(e) => setForm({ ...form, apelido: e.target.value })} />
            </Campo>
            <Campo label="Função" hint="o que ele faz: instalador, montador, designer">
              <Input value={form.funcao ?? ""} onChange={(e) => setForm({ ...form, funcao: e.target.value })} />
            </Campo>
            <Campo label="CPF"><Input value={form.cpf ?? ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></Campo>
            <Campo label="CNPJ" hint="quando presta como empresa">
              <Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </Campo>
            <Campo label="Telefone"><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Campo>
            <Campo label="E-mail"><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
            <Campo label="Início do contrato">
              <Input type="date" value={form.contratoInicio ?? ""}
                onChange={(e) => setForm({ ...form, contratoInicio: e.target.value })} />
            </Campo>
            <Campo label="Vale até" obrigatorio hint="vencido, o acesso fecha sozinho nos sistemas">
              <Input type="date" value={form.contratoFim ?? ""}
                onChange={(e) => setForm({ ...form, contratoFim: e.target.value })} />
            </Campo>
            <Campo label="Valor combinado">
              <Input value={form.valor != null ? formatBRL(form.valor) : ""}
                onChange={(e) => setForm({ ...form, valor: parseBRL(e.target.value) ?? undefined })} />
            </Campo>
            <Campo label="Forma de pagamento" hint="por serviço, por dia, mensal">
              <Input value={form.formaPagamento ?? ""}
                onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} />
            </Campo>
            <Campo label="Quem responde por ele aqui dentro" className="sm:col-span-2"
              hint="sem RH para encerrar o contrato, alguém tem de ter nome">
              <Select value={form.responsavelId ?? ""}
                onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}>
                <option value="">—</option>
                {d.colaboradores
                  .slice()
                  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                  .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Campo>
            <Campo label="Situação">
              <Select value={form.situacao ?? "ativo"}
                onChange={(e) => setForm({ ...form, situacao: e.target.value as Freelancer["situacao"] })}>
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
              </Select>
            </Campo>
            <Campo label="Observações" className="sm:col-span-2">
              <Textarea rows={2} value={form.observacoes ?? ""}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </Campo>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        aberto={!!apagando}
        onFechar={() => setApagando(null)}
        onConfirmar={() => {
          if (apagando) { remover(apagando.id); toast("Contrato apagado."); }
          setApagando(null);
        }}
        titulo="Apagar este contrato?"
        mensagem={`O registro de ${apagando?.nome ?? ""} some daqui, e com ele a data que fecha o acesso dele nos sistemas. Se ele só parou de trabalhar, prefira marcar como "encerrado": a porta fecha na hora e o histórico do combinado fica.`}
      />
    </div>
  );
}
