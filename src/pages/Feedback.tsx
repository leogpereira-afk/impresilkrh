/* FEEDBACK — a fila de quem está esperando.
 *
 * A coleção de feedbacks existia desde sempre e tinha QUATRO registros, para
 * três pessoas, num quadro de trinta. Não é que ninguém converse: é que a
 * conversa não fica registrada, e sem registro não há como saber de quem faz
 * meses que não se fala.
 *
 * Por isso esta tela não é um arquivo de feedbacks — é a lista das PESSOAS,
 * ordenada por quem está esperando há mais tempo. Quem nunca recebeu aparece
 * junto, porque a ausência é a informação.
 *
 * E ela puxa o que o sistema já sabe: o temperamento de cada um e a orientação
 * de COMO dar feedback àquele temperamento, que estava guardada em constants.ts
 * sem nunca chegar a uma tela de feedback.
 */
import { useMemo, useState } from "react";
import { MessageSquare, Search, Plus, Sparkles, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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
import { cadenciaDe, compararFila, CADENCIA_FEEDBACK_DIAS, type Cadencia, type SituacaoFeedback } from "@/lib/feedbackCadencia";
import { cn } from "@/lib/cn";
import type { Colaborador, Feedback as FeedbackReg } from "@/data/types";

const SELO: Record<SituacaoFeedback, { texto: string; variante: "danger" | "warning" | "success" | "neutral" }> = {
  atrasado: { texto: "Atrasado", variante: "danger" },
  nunca: { texto: "Nunca recebeu", variante: "neutral" },
  "a-vencer": { texto: "Chegando a hora", variante: "warning" },
  "em-dia": { texto: "Em dia", variante: "success" },
};

export default function Feedback() {
  const d = useDominio();
  const sessao = useSessao();
  const toast = useToast();
  const { items: feedbacks, criar } = useColecao("feedbacks");
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);
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
    const termo = busca.trim().toLowerCase();
    return pessoas
      .map((c) => ({ c, cad: cadenciaDe(agrupado.get(c.id) ?? [], c.dataAdmissao) }))
      .filter(({ c }) => (termo
        ? c.nome.toLowerCase().includes(termo) || d.nomeCargo(c).toLowerCase().includes(termo)
        : true))
      .filter(({ cad }) => (soPendentes ? cad.situacao !== "em-dia" : true))
      .sort((a, b) => compararFila(a.cad, b.cad) || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
  }, [pessoas, feedbacks, busca, soPendentes, d]);

  // Os números do topo saem SEMPRE do quadro inteiro, não da lista filtrada:
  // um contador que muda quando se digita na busca não é um panorama.
  const resumo = useMemo(() => {
    const agrupado = new Map<string, FeedbackReg[]>();
    for (const f of feedbacks as FeedbackReg[]) {
      const arr = agrupado.get(f.colaboradorId);
      if (arr) arr.push(f); else agrupado.set(f.colaboradorId, [f]);
    }
    const todos = pessoas.map((c) => cadenciaDe(agrupado.get(c.id) ?? [], c.dataAdmissao).situacao);
    return {
      atrasado: todos.filter((s) => s === "atrasado").length,
      nunca: todos.filter((s) => s === "nunca").length,
      aVencer: todos.filter((s) => s === "a-vencer").length,
      emDia: todos.filter((s) => s === "em-dia").length,
    };
  }, [pessoas, feedbacks]);

  return (
    <div>
      <PageHeader
        title="Feedback"
        description={`Quem está esperando conversa, há quanto tempo, e como falar com cada um. A cada ${CADENCIA_FEEDBACK_DIAS} dias.`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { rot: "Atrasados", v: resumo.atrasado, cor: "text-red-600", bg: "bg-red-50" },
          { rot: "Nunca receberam", v: resumo.nunca, cor: "text-slate-600", bg: "bg-slate-100" },
          { rot: "Chegando a hora", v: resumo.aVencer, cor: "text-amber-600", bg: "bg-amber-50" },
          { rot: "Em dia", v: resumo.emDia, cor: "text-emerald-600", bg: "bg-emerald-50" },
        ] as const).map((x) => (
          <Card key={x.rot} className="p-4">
            <p className={cn("text-2xl font-semibold tabular-nums", x.cor)}>{x.v}</p>
            <p className="mt-0.5 text-xs text-slate-500">{x.rot}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo" className="pl-9" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={soPendentes}
              onChange={(e) => setSoPendentes(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Só quem está pendente
          </label>
        </CardBody>
      </Card>

      {porPessoa.length === 0 ? (
        <EmptyState
          title={soPendentes ? "Ninguém pendente" : "Nenhuma pessoa encontrada"}
          description={soPendentes
            ? `Todo mundo recebeu feedback nos últimos ${CADENCIA_FEEDBACK_DIAS} dias.`
            : "Ajuste a busca."}
          icon={<MessageSquare className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-2">
          {porPessoa.map(({ c, cad }) => (
            <LinhaPessoa key={c.id} colab={c} cad={cad} cargo={d.nomeCargo(c)} onNovo={() => setNovoPara(c)} />
          ))}
        </div>
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

function LinhaPessoa({ colab, cad, cargo, onNovo }: {
  colab: Colaborador; cad: Cadencia; cargo: string; onNovo: () => void;
}) {
  const selo = SELO[cad.situacao];
  /* A orientação de COMO dar feedback àquele temperamento já existia em
     constants.ts (ARQUETIPOS[...].comoLidar.feedback) e nunca tinha chegado a
     uma tela de feedback. É a diferença entre "fale com o Fulano" e "fale com o
     Fulano assim". Sem perfil cadastrado, some — não inventa conselho. */
  const arq = colab.perfilComportamental ? ARQUETIPOS[colab.perfilComportamental] : undefined;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar nome={colab.nome} foto={colab.fotoDataUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LinkFicha id={colab.id} titulo="Abrir a ficha">
              <span className="font-medium text-slate-800">{colab.nome}</span>
            </LinkFicha>
            <Badge variant={selo.variante}>{selo.texto}</Badge>
            {colab.perfilComportamental && (
              <span className="text-xs text-slate-400">{colab.perfilComportamental}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{cargo}</p>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {cad.ultimo
              ? <>Último feedback em <strong className="font-medium text-slate-700">{formatDate(cad.ultimo.criadoEm)}</strong>
                  {cad.ultimo.tipo && <> · {cad.ultimo.tipo}</>}
                  {cad.diasDesde != null && <span className="text-slate-400"> ({cad.diasDesde} dias)</span>}</>
              : cad.diasDesde != null
                ? <>Nunca recebeu feedback — está na casa há <strong className="font-medium text-slate-700">{cad.diasDesde} dias</strong></>
                : <>Nunca recebeu feedback — sem data de admissão para contar o prazo</>}
          </p>

          {arq?.comoLidar?.feedback && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-brand/5 px-3 py-2 text-xs text-brand-ink">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              <span><strong className="font-semibold">Como dar feedback a um {colab.perfilComportamental}:</strong> {arq.comoLidar.feedback}</span>
            </p>
          )}
        </div>
        <button type="button" className="btn-outline shrink-0" onClick={onNovo}>
          <Plus className="h-4 w-4" /> Registrar
        </button>
      </div>
    </Card>
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
