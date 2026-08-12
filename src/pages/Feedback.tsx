/* FEEDBACK — a fila de quem está esperando.
 *
 * A coleção de feedbacks existia desde sempre e tinha QUATRO registros, para
 * três pessoas, num quadro de trinta. Não é que ninguém converse: é que a
 * conversa não fica registrada, e sem registro não há como saber de quem faz
 * meses que não se fala.
 *
 * Por isso esta tela não é um arquivo de feedbacks — é a lista das PESSOAS.
 * Quem nunca recebeu aparece junto, porque a ausência é a informação.
 *
 * E ela puxa o que o sistema já sabe: o temperamento de cada um e a orientação
 * de COMO dar feedback àquele temperamento, que estava guardada em constants.ts
 * sem nunca chegar a uma tela de feedback.
 */
import { useMemo, useState } from "react";
import { MessageSquare, Search, Plus, Sparkles, ArrowDownAZ, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { LinkFicha } from "@/components/ui/link-ficha";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio, noQuadro } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { TIPOS_FEEDBACK, ARQUETIPOS } from "@/lib/constants";
import {
  cadenciaDe, compararFila, PESO_SITUACAO, CADENCIA_FEEDBACK_DIAS,
  type Cadencia, type SituacaoFeedback,
} from "@/lib/feedbackCadencia";
import { cn } from "@/lib/cn";
import type { Colaborador, Feedback as FeedbackReg } from "@/data/types";

const SELO: Record<SituacaoFeedback, { texto: string; variante: "danger" | "warning" | "success" | "neutral" }> = {
  atrasado: { texto: "Atrasado", variante: "danger" },
  nunca: { texto: "Nunca recebeu", variante: "neutral" },
  "a-vencer": { texto: "Chegando a hora", variante: "warning" },
  "em-dia": { texto: "Em dia", variante: "success" },
};

type CampoOrdem = "fila" | "nome" | "ultimo" | "situacao";
interface Ordem { campo: CampoOrdem; asc: boolean }

function ThOrdenavel({ campo, ordem, setOrdem, className, children }: {
  campo: CampoOrdem; ordem: Ordem; setOrdem: (o: Ordem) => void;
  className?: string; children: React.ReactNode;
}) {
  const ativo = ordem.campo === campo;
  return (
    <th className={cn("th", className)}>
      <button
        type="button"
        // Clicar de novo na mesma coluna inverte; em outra, começa crescente.
        onClick={() => setOrdem(ativo ? { campo, asc: !ordem.asc } : { campo, asc: true })}
        className={cn("inline-flex items-center gap-1 transition hover:text-brand", ativo && "text-brand")}
        title={`Ordenar por ${String(children)}`}
      >
        {children}
        <ArrowDownAZ className={cn("h-3.5 w-3.5", ativo ? (!ordem.asc && "rotate-180") : "opacity-0")} />
      </button>
    </th>
  );
}

export default function Feedback() {
  const d = useDominio();
  const sessao = useSessao();
  const toast = useToast();
  const { items: feedbacks, criar } = useColecao("feedbacks");
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState<SituacaoFeedback | null>(null);
  const [ordem, setOrdem] = useState<Ordem>({ campo: "fila", asc: true });
  const [aberta, setAberta] = useState<string | null>(null);
  const [novoPara, setNovoPara] = useState<Colaborador | null>(null);

  /* Só quem está no quadro. Feedback é conversa com quem trabalha aqui — listar
     desligado seria fila de trabalho que ninguém pode executar. */
  const pessoas = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores).filter((c) => !c.ehDirecao && noQuadro(c)),
    [sessao, d.colaboradores],
  );

  const porPessoa = useMemo(() => {
    const agrupado = new Map<string, FeedbackReg[]>();
    for (const f of feedbacks as FeedbackReg[]) {
      const arr = agrupado.get(f.colaboradorId);
      if (arr) arr.push(f); else agrupado.set(f.colaboradorId, [f]);
    }
    return pessoas.map((c) => ({ c, cad: cadenciaDe(agrupado.get(c.id) ?? [], c.dataAdmissao) }));
  }, [pessoas, feedbacks]);

  /* Os quatro números saem SEMPRE do quadro inteiro, nunca da lista filtrada:
     contador que muda quando se digita na busca não é panorama. */
  const resumo = useMemo(() => {
    const conta = (s: SituacaoFeedback) => porPessoa.filter((x) => x.cad.situacao === s).length;
    return { atrasado: conta("atrasado"), nunca: conta("nunca"), "a-vencer": conta("a-vencer"), "em-dia": conta("em-dia") };
  }, [porPessoa]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrada = porPessoa
      .filter(({ cad }) => (foco ? cad.situacao === foco : true))
      .filter(({ c }) => (termo
        ? c.nome.toLowerCase().includes(termo) || d.nomeCargo(c).toLowerCase().includes(termo)
        : true));
    const dir = ordem.asc ? 1 : -1;
    return [...filtrada].sort((a, b) => {
      switch (ordem.campo) {
        case "nome":
          return dir * a.c.nome.localeCompare(b.c.nome, "pt-BR");
        case "ultimo": {
          /* Quem NUNCA recebeu não tem data. Jogá-lo para o fim com uma data
             falsa esconderia justamente quem mais precisa aparecer, então ele
             vai para o TOPO no crescente: "há mais tempo sem feedback" inclui
             "desde sempre". */
          const va = a.cad.ultimo?.criadoEm ?? "";
          const vb = b.cad.ultimo?.criadoEm ?? "";
          if (va === vb) return a.c.nome.localeCompare(b.c.nome, "pt-BR");
          return dir * va.localeCompare(vb);
        }
        case "situacao": {
          const p = PESO_SITUACAO[a.cad.situacao] - PESO_SITUACAO[b.cad.situacao];
          return dir * (p || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
        }
        default:
          // "Fila" é a ordem de trabalho: quem espera há mais tempo primeiro.
          return dir * (compararFila(a.cad, b.cad) || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
      }
    });
  }, [porPessoa, busca, foco, ordem, d]);

  const CARDS = [
    { chave: "atrasado", rot: "Atrasados", cor: "text-red-600" },
    { chave: "nunca", rot: "Nunca receberam", cor: "text-slate-600" },
    { chave: "a-vencer", rot: "Chegando a hora", cor: "text-amber-600" },
    { chave: "em-dia", rot: "Em dia", cor: "text-emerald-600" },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Feedback"
        description={`Quem está esperando conversa, há quanto tempo, e como falar com cada um. A cada ${CADENCIA_FEEDBACK_DIAS} dias.`}
      />

      {/* Cards CLICÁVEIS: filtram a lista abaixo, em vez de serem só enfeite. */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map(({ chave, rot, cor }) => {
          const valor = resumo[chave];
          const ativo = foco === chave;
          const vazio = valor === 0;
          return (
            <button
              key={chave}
              type="button"
              disabled={vazio}
              aria-pressed={ativo}
              onClick={() => setFoco(ativo ? null : chave)}
              title={vazio ? "Ninguém nesta situação" : ativo ? "Clique para limpar o filtro" : `Ver só: ${rot.toLowerCase()}`}
              className={cn(
                "rounded-2xl border bg-white p-4 text-left transition",
                ativo ? "border-brand ring-2 ring-brand/20" : "border-slate-200",
                vazio ? "cursor-default opacity-50" : "hover:shadow-md",
              )}
            >
              <p className={cn("text-2xl font-semibold tabular-nums", cor)}>{valor}</p>
              <p className="mt-0.5 text-xs text-slate-500">{rot}</p>
            </button>
          );
        })}
      </div>

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo" className="pl-9" />
          </div>
          <Select
            value={ordem.campo}
            onChange={(e) => setOrdem({ campo: e.target.value as CampoOrdem, asc: true })}
            className="w-auto min-w-[14rem]"
          >
            <option value="fila">Ordenar: fila (quem espera mais)</option>
            <option value="nome">Ordenar: nome (A–Z)</option>
            <option value="ultimo">Ordenar: último feedback</option>
            <option value="situacao">Ordenar: situação</option>
          </Select>
          <span className="text-sm text-slate-500">
            {lista.length} de {porPessoa.length}
          </span>
          {foco && (
            <button type="button" onClick={() => setFoco(null)} className="text-sm font-medium text-brand hover:underline">
              Limpar filtro
            </button>
          )}
        </CardBody>
      </Card>

      {lista.length === 0 ? (
        <EmptyState
          title="Ninguém nesta lista"
          description={foco ? "Nenhuma pessoa nesta situação com a busca atual." : "Ajuste a busca."}
          icon={<MessageSquare className="h-8 w-8" />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <ThOrdenavel campo="nome" ordem={ordem} setOrdem={setOrdem}>Colaborador</ThOrdenavel>
                  <th className="th hidden md:table-cell">Cargo</th>
                  <ThOrdenavel campo="situacao" ordem={ordem} setOrdem={setOrdem}>Situação</ThOrdenavel>
                  <ThOrdenavel campo="ultimo" ordem={ordem} setOrdem={setOrdem} className="hidden sm:table-cell">Último feedback</ThOrdenavel>
                  <th className="th hidden lg:table-cell">Espera</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map(({ c, cad }, i) => (
                  <LinhaPessoa
                    key={c.id}
                    n={i + 1}
                    colab={c}
                    cad={cad}
                    cargo={d.nomeCargo(c)}
                    aberta={aberta === c.id}
                    onAlternar={() => setAberta((x) => (x === c.id ? null : c.id))}
                    onNovo={() => setNovoPara(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {novoPara && (
        <ModalNovoFeedback
          colab={novoPara}
          onFechar={() => setNovoPara(null)}
          onSalvar={(dados) => {
            criar({ ...dados, colaboradorId: novoPara.id, autorId: sessao?.colaboradorId ?? null });
            toast(`Feedback registrado para ${novoPara.nome}.`);
            setNovoPara(null);
          }}
        />
      )}
    </div>
  );
}

function LinhaPessoa({ n, colab, cad, cargo, aberta, onAlternar, onNovo }: {
  n: number; colab: Colaborador; cad: Cadencia; cargo: string;
  aberta: boolean; onAlternar: () => void; onNovo: () => void;
}) {
  const selo = SELO[cad.situacao];
  /* A orientação de COMO dar feedback àquele temperamento já existia em
     constants.ts e nunca tinha chegado a uma tela de feedback. É a diferença
     entre "fale com o Fulano" e "fale com o Fulano assim". Sem perfil
     cadastrado, some — não inventa conselho. */
  const arq = colab.perfilComportamental ? ARQUETIPOS[colab.perfilComportamental] : undefined;
  const dica = arq?.comoLidar?.feedback;

  return (
    <>
      <tr className="group transition hover:bg-slate-50/60">
        <td className="td">
          <span className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">{n}</span>
            {/* Botão separado do link: link dentro de botão é HTML inválido e o
                clique cairia em lugar imprevisível. */}
            <button
              type="button"
              onClick={onAlternar}
              aria-expanded={aberta}
              title={aberta ? "Recolher" : "Ver o temperamento e o último feedback"}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
            >
              {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <Avatar nome={colab.nome} foto={colab.fotoDataUrl} size="sm" />
            <LinkFicha id={colab.id} titulo="Abrir a ficha">
              <span className="font-medium text-slate-800">{colab.nome}</span>
            </LinkFicha>
          </span>
        </td>
        <td className="td hidden md:table-cell text-slate-500">{cargo}</td>
        <td className="td"><Badge variant={selo.variante}>{selo.texto}</Badge></td>
        <td className="td hidden sm:table-cell text-slate-600">
          {cad.ultimo
            ? <span className="tabular-nums">{formatDate(cad.ultimo.criadoEm)}{cad.ultimo.tipo && <span className="text-slate-400"> · {cad.ultimo.tipo}</span>}</span>
            : <span className="text-slate-300">—</span>}
        </td>
        <td className="td hidden lg:table-cell tabular-nums text-slate-500">
          {cad.diasDesde != null ? `${cad.diasDesde} dias` : "—"}
        </td>
        <td className="td text-right">
          <button type="button" className="btn-outline" onClick={onNovo}>
            <Plus className="h-4 w-4" /> Registrar
          </button>
        </td>
      </tr>
      {aberta && (
        <tr className="bg-slate-50/40">
          <td className="td" colSpan={6}>
            <div className="space-y-2 pl-8">
              {dica ? (
                <p className="flex items-start gap-2 rounded-lg bg-brand/5 px-3 py-2 text-xs text-brand-ink">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <span><strong className="font-semibold">Como dar feedback a um {colab.perfilComportamental}:</strong> {dica}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Perfil comportamental não cadastrado — sem ele o sistema não sugere como conduzir a conversa.
                </p>
              )}
              {cad.ultimo?.conteudo && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Último feedback</p>
                  <p className="whitespace-pre-line text-sm text-slate-600">{cad.ultimo.conteudo}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ModalNovoFeedback({ colab, onSalvar, onFechar }: {
  colab: Colaborador;
  onSalvar: (d: { tipo: string; conteudo: string; contexto?: string; criadoEm: string }) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<string>(TIPOS_FEEDBACK[0]);
  const [conteudo, setConteudo] = useState("");
  const [contexto, setContexto] = useState("");
  const arq = colab.perfilComportamental ? ARQUETIPOS[colab.perfilComportamental] : undefined;

  const salvar = () => {
    if (!conteudo.trim()) return toast("Escreva o que foi conversado.", "erro");
    onSalvar({
      tipo,
      conteudo: conteudo.trim(),
      contexto: contexto.trim() || undefined,
      // Carimbo do momento do registro — é o que a cadência usa para contar.
      criadoEm: new Date().toISOString(),
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Feedback para ${colab.nome}`}
      descricao="Fica no histórico da pessoa e zera a contagem da cadência."
      largura="max-w-lg"
      rodape={<>
        <button className="btn-outline" onClick={onFechar}>Cancelar</button>
        <button className="btn-primary" onClick={salvar}>Registrar</button>
      </>}
    >
      <div className="space-y-3">
        {arq?.comoLidar?.feedback && (
          <p className="rounded-lg bg-brand/5 px-3 py-2 text-xs text-brand-ink">
            <strong className="font-semibold">{colab.perfilComportamental}:</strong> {arq.comoLidar.feedback}
          </p>
        )}
        <Campo label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_FEEDBACK.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Campo>
        <Campo label="O que foi conversado" obrigatorio>
          <Textarea
            autoFocus
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Fato observado, impacto e o combinado daqui para frente."
          />
        </Campo>
        <Campo label="Contexto" hint="Opcional — situação, projeto ou período a que se refere">
          <Input value={contexto} onChange={(e) => setContexto(e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}
