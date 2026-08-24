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
import { MessageSquare, Search, Plus, Sparkles, ArrowDownAZ, ChevronDown, ChevronRight, ThumbsUp, Wrench, ClipboardList, CalendarPlus, Check } from "lucide-react";
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
import { formatDate, diaLocalISO, diasDeCalendario } from "@/lib/format";
import {
  ARQUETIPOS, EFEITOS_AJUSTE, EFEITOS_ELOGIO, COMBINADOS_SUGERIDOS,
  AVISO_NAO_E_PUNICAO, tipoFeedbackLegado,
} from "@/lib/constants";
import {
  cadenciaDe, jaFoiDado, cadenciaDaPessoa, compararFila, PESO_SITUACAO, CADENCIA_FEEDBACK_DIAS,
  bloqueio, combinadoEmAberto, combinadoVencido, ehRotaSeguranca, montarConteudo,
  type Cadencia, type SituacaoFeedback, type MotivoBloqueio,
} from "@/lib/feedbackCadencia";
import { situacaoExperiencia } from "@/lib/clt";
import { dossieDoColaborador, type Dossie } from "@/lib/dossieFeedback";
import { DossieDaConversa } from "@/components/feedback/dossie";
import { cn } from "@/lib/cn";
import type { Colaborador, Feedback as FeedbackReg } from "@/data/types";

const SELO: Record<SituacaoFeedback, { texto: string; variante: "danger" | "warning" | "success" | "neutral" }> = {
  atrasado: { texto: "Atrasado", variante: "danger" },
  nunca: { texto: "Nunca recebeu", variante: "neutral" },
  "a-vencer": { texto: "Chegando a hora", variante: "warning" },
  "em-dia": { texto: "Em dia", variante: "success" },
};

/** Em que ponto do ciclo a pessoa está: preparar → marcar o dia → registrar. */
export type Etapa = "preparar" | "agendar" | "registrar";

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
  const { items: feedbacks, criar, atualizar } = useColecao("feedbacks");
  /* As fontes do dossiê. Lidas UMA vez aqui, e não dentro do modal: são
     coleções inteiras, e reler a cada abertura pesaria à toa. */
  const { items: pontos } = useColecao("pontos");
  const { items: pagamentos } = useColecao("pagamentos");
  const { items: treinamentos } = useColecao("treinamentos");
  const { items: avaliacoes } = useColecao("avaliacoes");
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState<SituacaoFeedback | null>(null);
  const [ordem, setOrdem] = useState<Ordem>({ campo: "fila", asc: true });
  const [aberta, setAberta] = useState<string | null>(null);
  const [novoPara, setNovoPara] = useState<Colaborador | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("preparar");

  /* O feedback PREPARADO e ainda não conversado de cada pessoa. Um por pessoa:
     preparar duas vezes seguidas seria dois roteiros para a mesma conversa, e
     a linha não saberia qual mostrar — então o segundo clique reabre o
     primeiro. */
  const preparoDe = useMemo(() => {
    const m = new Map<string, FeedbackReg>();
    for (const f of feedbacks as FeedbackReg[]) {
      if (jaFoiDado(f)) continue;
      const atual = m.get(f.colaboradorId);
      if (!atual || String(f.criadoEm) > String(atual.criadoEm)) m.set(f.colaboradorId, f);
    }
    return m;
  }, [feedbacks]);
  const dossie = useMemo(
    () => (novoPara
      ? dossieDoColaborador(novoPara, { pontos, pagamentos, treinamentos, avaliacoes })
      : null),
    [novoPara, pontos, pagamentos, treinamentos, avaliacoes],
  );

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
    return pessoas.map((c) => {
      /* Ritmo por pessoa: 30 dias em experiência (a conversa precede a decisão
         de efetivar), 45 com plano de ação aberto, 90 no padrão. */
      const dias = cadenciaDaPessoa({
        emExperiencia: !!situacaoExperiencia(c),
        comPlanoAberto: false, // PDI ainda não é lido aqui; entra quando houver a fonte
      });
      return { c, cad: cadenciaDe(agrupado.get(c.id) ?? [], c.dataAdmissao, undefined, dias) };
    });
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
                    emPreparo={preparoDe.get(c.id) ?? null}
                    onNovo={(etapa) => { setEtapa(etapa); setNovoPara(c); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {novoPara && (
        <ModalNovoFeedback
          dossie={dossie}
          etapa={etapa}
          preparo={preparoDe.get(novoPara.id) ?? null}
          colab={novoPara}
          setor={novoPara.areaId ?? undefined}
          aberto={combinadoEmAberto(
            (feedbacks as FeedbackReg[]).filter((f) => f.colaboradorId === novoPara.id),
          )}
          onFechar={() => setNovoPara(null)}
          onDesfecho={(id, desfecho) => {
            atualizar(id, { desfecho, desfechoEm: new Date().toISOString() });
            toast("Combinado anterior atualizado.");
          }}
          onSalvar={(dados) => {
            /* Com `id`, ATUALIZA o registro que já foi preparado. Sem, cria.
               As três etapas escrevem no MESMO registro: preparar cria, marcar
               o dia e registrar completam. Criar um novo a cada etapa deixaria
               roteiro órfão e conversa solta — e a fila contaria errado. */
            const { id, ...resto } = dados as { id?: string } & Record<string, unknown>;
            if (id) {
              atualizar(id, { ...resto, registradoEm: new Date().toISOString() });
            } else {
              criar({
                ...resto,
                colaboradorId: novoPara.id,
                autorId: sessao?.colaboradorId ?? null,
                // Carimbo do momento da gravação — diferente de quando a conversa foi.
                registradoEm: new Date().toISOString(),
                criadoEm: new Date().toISOString(),
              });
            }
            toast(
              etapa === "preparar" ? `Preparação salva. Agora marque o dia com ${novoPara.nome.split(" ")[0]}.`
              : etapa === "agendar" ? `Conversa marcada com ${novoPara.nome.split(" ")[0]}.`
              : `Conversa registrada para ${novoPara.nome}.`,
            );
            setNovoPara(null);
          }}
        />
      )}
    </div>
  );
}

function LinhaPessoa({ n, colab, cad, cargo, aberta, emPreparo, onAlternar, onNovo }: {
  n: number; colab: Colaborador; cad: Cadencia; cargo: string;
  aberta: boolean; onAlternar: () => void;
  /* O feedback desta pessoa que já foi preparado e ainda não aconteceu. É ele
     que decide qual dos três botões a linha mostra. */
  emPreparo: FeedbackReg | null;
  onNovo: (etapa: Etapa) => void;
}) {
  // Passou do dia combinado e a conversa não foi registrada.
  const venceuAgenda = !!emPreparo?.agendadaPara
    && diasDeCalendario(emPreparo.agendadaPara, new Date()) < 0;
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
            ? <span className="tabular-nums">
                {formatDate(cad.ultimo.criadoEm)}
                {cad.ultimo.tipo && <span className="text-slate-400"> · {tipoFeedbackLegado(cad.ultimo.tipo)}</span>}
                {/* Conversa com a EQUIPE precisa se identificar: sem o selo, a
                    ficha leria como se tivesse sido individual — e não foi. Ela
                    também não zera o relógio da cadência (ver feedbackCadencia). */}
                {/* Feedback de TREINAMENTO fala do curso, não do serviço do dia
                    a dia — e não conta no relógio da cadência (ver
                    feedbackCadencia). Precisa se identificar, senão a ficha diz
                    "conversou há 5 dias" quando o que houve foi outra coisa. */}
                {(cad.ultimo as FeedbackReg).origem === "treinamento" ? (
                  <span className="ml-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200"
                    title={(cad.ultimo as FeedbackReg).origemTitulo ?? "Feedback de treinamento"}>
                    treinamento
                  </span>
                ) : (cad.ultimo as FeedbackReg).grupoId ? (
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    turma
                  </span>
                ) : null}
              </span>
            : <span className="text-slate-300">—</span>}
        </td>
        <td className="td hidden lg:table-cell tabular-nums text-slate-500">
          {cad.diasDesde != null ? `${cad.diasDesde} dias` : "—"}
        </td>
        <td className="td text-right">
          {/* AS TRÊS ETAPAS. A tela só tinha "Registrar", que assume a conversa
              já feita — e na prática o líder prepara antes, combina o dia e só
              depois conversa. Cada linha mostra UM botão: o da etapa em que
              aquela pessoa está, e não um menu de três para escolher. */}
          {!emPreparo ? (
            <button type="button" className="btn-outline" onClick={() => onNovo("preparar")}>
              <ClipboardList className="h-4 w-4" /> Preparar feedback
            </button>
          ) : !emPreparo.agendadaPara ? (
            <button type="button" className="btn-outline" onClick={() => onNovo("agendar")}>
              <CalendarPlus className="h-4 w-4" /> Marcar o dia
            </button>
          ) : (
            <span className="flex items-center justify-end gap-2">
              {/* O dia combinado fica visível: sem ele, "Registrar" some do
                  contexto e o líder não lembra para quando marcou. */}
              <span className={cn("text-xs", venceuAgenda ? "font-medium text-red-600" : "text-slate-500")}>
                {venceuAgenda ? "era " : ""}{formatDate(emPreparo.agendadaPara)}
              </span>
              <button type="button" className="btn-primary" onClick={() => onNovo("registrar")}>
                <Check className="h-4 w-4" /> Registrar
              </button>
            </span>
          )}
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {(cad.ultimo as FeedbackReg).origem === "treinamento"
                      ? `Último registro — treinamento${(cad.ultimo as FeedbackReg).origemTitulo ? `: ${(cad.ultimo as FeedbackReg).origemTitulo}` : ""}`
                      : "Último feedback"}
                  </p>
                  <p className="whitespace-pre-line text-sm text-slate-600">{cad.ultimo.conteudo}</p>
                  {(cad.ultimo as FeedbackReg).origem === "treinamento" && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Fala do treinamento — não substitui a conversa sobre o trabalho, e por isso
                      não conta na cadência.
                    </p>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* O PORTÃO. Antes de qualquer campo, três saídas — e uma delas não abre
   formulário nenhum.
   Stone & Heen (Thanks for the Feedback): existem três coisas chamadas de
   "feedback" — apreciação, coaching e avaliação — e a falha mais comum é quem
   fala mandar uma e quem ouve escutar outra. Misturar avaliação num elogio
   destrói os dois. Aqui a avaliação nem entra: tem módulo próprio. */
function ModalNovoFeedback({ colab, setor, dossie, etapa, preparo, aberto: emAberto, onSalvar, onDesfecho, onFechar }: {
  colab: Colaborador;
  setor?: string;
  /* O que o sistema já sabe da pessoa. Montado no pai porque as fontes
     (ponto, pagamentos, treinamento, avaliação) são coleções inteiras: puxar
     aqui dentro faria cada abertura do modal reler tudo. */
  dossie: Dossie | null;
  /* Em que ponto do ciclo este clique entrou. A janela é a mesma nas três
     etapas — muda o que ela pede e o que grava. Três janelas separadas
     repetiriam o dossiê e o roteiro em todas. */
  etapa: Etapa;
  /** O roteiro já escrito, quando a etapa é marcar o dia ou registrar. */
  preparo: FeedbackReg | null;
  aberto: FeedbackReg | null;
  onSalvar: (d: Partial<FeedbackReg>) => void;
  onDesfecho: (id: string, desfecho: string) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<"Reconhecimento" | "Ajuste" | null>(null);
  const [ocorridoEm, setOcorridoEm] = useState(() => diaLocalISO(new Date()));
  const [oQue, setOQue] = useState("");
  const [roteiro, setRoteiro] = useState(() => preparo?.roteiro ?? "");
  const [efeito, setEfeito] = useState("");
  const [os, setOs] = useState("");
  const [combinado, setCombinado] = useState("");
  const [prazo, setPrazo] = useState<{ data: string | null; gatilho: string | null }>(
    { data: null, gatilho: null },
  );
  const [barrado, setBarrado] = useState<MotivoBloqueio>(null);

  const ajuste = tipo === "Ajuste";
  const efeitos = ajuste ? EFEITOS_AJUSTE : EFEITOS_ELOGIO;
  const fichas = [...(COMBINADOS_SUGERIDOS[setor ?? ""] ?? []), ...COMBINADOS_SUGERIDOS._todos];

  const emDias = (n: number) => diaLocalISO(new Date(Date.now() + n * 86_400_000));

  /* MARCAR O DIA é a etapa mais curta: só a data, e nada mais. Exigir o
     formulário inteiro aqui faria o líder reescrever o que já preparou. */
  const [dia, setDia] = useState(() => preparo?.agendadaPara ?? "");
  const marcarDia = () => {
    if (!dia) return toast("Escolha o dia da conversa.", "erro");
    onSalvar({ id: preparo?.id, agendadaPara: dia } as Partial<FeedbackReg>);
    onFechar();
  };

  const salvar = () => {
    /* PREPARAR grava o roteiro e mais nada: a conversa ainda não aconteceu,
       então não há "o que aconteceu" para contar nem efeito para marcar. Pedir
       isso agora obrigaria o líder a inventar o passado. */
    if (etapa === "preparar") {
      if (roteiro.trim().length < 15) return toast("Escreva o que pretende dizer — uma frase basta.", "erro");
      const b = bloqueio(roteiro);
      if (b) { setBarrado(b); return; }
      if (!tipo) return;
      onSalvar({
        id: preparo?.id,
        tipo,
        roteiro: roteiro.trim(),
        preparadoEm: new Date().toISOString(),
        /* `conteudo` fica vazio de propósito: ele é o que a PESSOA vê na ficha
           dela, e roteiro é anotação de quem vai falar. Só vira conteúdo
           quando a conversa acontece. */
        conteudo: "",
      } as Partial<FeedbackReg>);
      onFechar();
      return;
    }

    if (oQue.trim().length < 15) return toast("Conte o que aconteceu — uma frase basta.", "erro");
    /* Bloqueio ANTES de gravar, e sem guardar o texto: avisar, permitir e
       guardar seria a pior das três opções. */
    const b = bloqueio(`${oQue} ${combinado}`);
    if (b) { setBarrado(b); return; }
    if (ehRotaSeguranca(efeito)) { setBarrado("grave"); return; }
    if (!efeito) return toast("Marque no que deu.", "erro");
    if (ajuste && !combinado.trim()) return toast("Escreva o que ficou combinado.", "erro");
    if (ajuste && !prazo.data && !prazo.gatilho) return toast("Diga até quando.", "erro");

    if (!tipo) return; // o portão garante isto, mas o tipo precisa saber
    const base = {
      tipo, ocorridoEm, oQueAconteceu: oQue.trim(), efeito,
      os: os.trim() || undefined,
      ...(ajuste ? { combinado: combinado.trim(), combinadoPrazo: prazo.data, combinadoGatilho: prazo.gatilho } : {}),
    };
    onSalvar({
      // Fecha o MESMO registro que foi preparado, em vez de criar outro: senão
      // a pessoa ficaria com um roteiro órfão e um feedback solto.
      id: preparo?.id,
      ...base,
      conteudo: montarConteudo(base),
    } as Partial<FeedbackReg>);
  };

  if (barrado) {
    return (
      <Modal aberto onFechar={() => setBarrado(null)} titulo="Isso não entra aqui" largura="max-w-md"
        rodape={<button className="btn-outline" onClick={() => setBarrado(null)}>Voltar e escrever de outro jeito</button>}>
        <p className="text-sm text-slate-600">
          {barrado === "sensivel"
            ? "Saúde, atestado, sindicato, religião e afins são dado pessoal sensível (art. 11 da LGPD) e não podem ficar num registro de conversa sobre trabalho."
            : "Assédio, agressão, EPI, furto, bebida e acidente têm caminho próprio, com sigilo. Registro assim, colado no histórico de desempenho, prejudica todo mundo."}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-700">Fala direto com o RH — o texto não foi guardado.</p>
      </Modal>
    );
  }

  // O portão: enquanto não escolher, não há formulário.
  if (!tipo) {
    return (
      <Modal aberto onFechar={onFechar} titulo={`Conversa com ${colab.nome}`} largura="max-w-md"
        descricao="O que você quer registrar?">
        <div className="space-y-2">
          <button type="button" onClick={() => setTipo("Reconhecimento")}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:border-emerald-300">
            <ThumbsUp className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>
              <span className="block font-semibold text-slate-800">Elogiar</span>
              <span className="block text-xs text-slate-500">Ele fez algo que deu certo e você quer que fique registrado.</span>
            </span>
          </button>
          <button type="button" onClick={() => setTipo("Ajuste")}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 text-left transition hover:border-amber-300">
            <Wrench className="h-5 w-5 shrink-0 text-amber-600" />
            <span>
              <span className="block font-semibold text-slate-800">Ajustar</span>
              <span className="block text-xs text-slate-500">Algo precisa mudar daqui pra frente. Vocês combinam o quê.</span>
            </span>
          </button>
          {/* Não abre nada de propósito. */}
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            <strong className="font-medium text-slate-700">É coisa grave?</strong> Briga, assédio, EPI, furto, bebida,
            acidente — <strong className="font-medium text-slate-700">fala com o RH</strong>. Isso não se registra aqui.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={
        etapa === "preparar" ? `Preparar — ${colab.nome}`
        : etapa === "agendar" ? `Marcar o dia — ${colab.nome}`
        : `${ajuste ? "Ajustar" : "Elogiar"} — ${colab.nome}`
      }
      largura="max-w-lg"
      rodape={<>
        <button className="btn-outline" onClick={() => (etapa === "agendar" ? onFechar() : setTipo(null))}>
          {etapa === "agendar" ? "Cancelar" : "Voltar"}
        </button>
        <button className="btn-primary" onClick={etapa === "agendar" ? marcarDia : salvar}>
          {etapa === "preparar" ? "Salvar preparação"
            : etapa === "agendar" ? "Marcar o dia"
            : "Registrar a conversa"}
        </button>
      </>}
    >
      <div className="space-y-4">
        {/* O DOSSIÊ: o que o sistema já sabe da pessoa. Vem ANTES do formulário
            porque é o que informa o que escrever — e depois do combinado, que
            é a única coisa mais urgente que ele. */}
        {dossie && <DossieDaConversa d={dossie} ajuste={ajuste} />}

        {/* PREPARAR: só o roteiro. A conversa ainda não aconteceu, então não
            há "o que aconteceu" nem efeito para marcar — pedir isso agora
            obrigaria o líder a inventar o passado. */}
        {etapa === "preparar" && (
          <Campo
            label="O que você pretende dizer"
            obrigatorio
            hint="Só você vê isto. Na hora de registrar, ele fica à mão."
          >
            <Textarea
              rows={5}
              value={roteiro}
              onChange={(e) => setRoteiro(e.target.value)}
              placeholder={ajuste
                ? "Ex.: falar da peça que voltou do laser fora do esquadro na terça, e combinar conferir o gabarito antes de cortar."
                : "Ex.: reconhecer que ele assumiu a frente quando faltou gente na semana passada, e que a entrega saiu no prazo."}
            />
          </Campo>
        )}

        {/* MARCAR O DIA: só a data, com o roteiro à vista para lembrar do que
            se trata. */}
        {etapa === "agendar" && (
          <div className="space-y-3">
            {preparo?.roteiro && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">O que você preparou</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{preparo.roteiro}</p>
              </div>
            )}
            <Campo label="Dia da conversa" obrigatorio hint="A tela cobra se o dia passar sem o registro.">
              <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
            </Campo>
          </div>
        )}

        {/* REGISTRAR: o roteiro aparece no topo, para o líder conferir se
            falou o que planejou. */}
        {etapa === "registrar" && preparo?.roteiro && (
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
            <p className="text-xs text-brand-ink/70">Você tinha preparado</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-brand-ink">{preparo.roteiro}</p>
          </div>
        )}

        {/* O COMBINADO ANTERIOR vem antes de tudo — é o único lugar que o
            encarregado disse que vale. Responder é sempre OPCIONAL: a trava que
            exigia desfecho produzia clique em "Feito" sem conferir nada, ou
            seja, histórico falso, que é pior que histórico faltando. */}
        {emAberto?.combinado && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">
              Combinado de {formatDate(emAberto.ocorridoEm ?? emAberto.criadoEm)}
              {combinadoVencido(emAberto) && <span className="ml-1 font-medium text-red-600">· venceu</span>}
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-700">“{emAberto.combinado}”</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[["resolveu", "Resolveu"], ["ainda-nao", "Ainda não"], ["mudou", "Mudou"], ["nao-era-isso", "Não era isso"]].map(([v, r]) => (
                <button key={v} type="button" onClick={() => onDesfecho(emAberto.id, v)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand hover:text-brand">
                  {r}
                </button>
              ))}
              <span className="px-1 py-1 text-xs text-slate-400">ou deixa pra depois</span>
            </div>
          </div>
        )}

        {/* DAQUI PARA BAIXO é o registro do que ACONTECEU. Some nas outras
            duas etapas: na preparação a conversa ainda não houve, e ao marcar
            o dia o líder só escolhe a data. */}
        {etapa === "registrar" && <>
        <Campo label="Quando foi a conversa">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {[["Hoje", 0], ["Ontem", -1]].map(([r, n]) => (
              <button key={String(r)} type="button" onClick={() => setOcorridoEm(emDias(Number(n)))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand hover:text-brand">
                {r}
              </button>
            ))}
          </div>
          <Input type="date" value={ocorridoEm} max={diaLocalISO(new Date())}
            onChange={(e) => setOcorridoEm(e.target.value)} />
        </Campo>

        <Campo label="O que aconteceu" obrigatorio
          hint={ajuste
            ? "O que ele fez e no que deu. Uma frase, do jeito que você contaria."
            : "O que exatamente ele fez. “Conferiu o esquadro antes de soldar” vale mais que “é caprichoso”."}>
          <Textarea autoFocus value={oQue} onChange={(e) => setOQue(e.target.value)} rows={3} />
        </Campo>

        {/* Lista FECHADA, um toque. É o único campo que precisa somar em
            relatório, e é o que mantém a conversa na TAREFA em vez de na pessoa. */}
        <Campo label="No que deu" obrigatorio>
          <div className="flex flex-wrap gap-1.5">
            {efeitos.map((e) => (
              <button key={e} type="button" onClick={() => setEfeito(e)}
                className={cn("rounded-lg border px-2.5 py-1 text-xs transition",
                  efeito === e ? "border-brand bg-brand/5 font-medium text-brand-ink" : "border-slate-200 text-slate-600 hover:border-brand")}>
                {e}
              </button>
            ))}
          </div>
        </Campo>

        {ajuste && (
          <>
            <Campo label="O que ficou combinado" obrigatorio
              hint="Uma coisa que dá pra ver acontecer na próxima peça.">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {fichas.map((f) => (
                  <button key={f} type="button" onClick={() => setCombinado(f)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand hover:text-brand">
                    {f}
                  </button>
                ))}
              </div>
              <Input value={combinado} onChange={(e) => setCombinado(e.target.value)} />
            </Campo>

            <Campo label="Até quando" obrigatorio>
              <div className="flex flex-wrap gap-1.5">
                {[["Semana que vem", 7], ["15 dias", 15], ["30 dias", 30]].map(([r, n]) => (
                  <button key={String(r)} type="button"
                    onClick={() => setPrazo({ data: emDias(Number(n)), gatilho: null })}
                    className={cn("rounded-lg border px-2.5 py-1 text-xs transition",
                      prazo.data === emDias(Number(n)) ? "border-brand bg-brand/5 font-medium text-brand-ink" : "border-slate-200 text-slate-600 hover:border-brand")}>
                    {r}
                  </button>
                ))}
                {/* Pedido do encarregado: é o prazo real da serralheria. Não
                    vence por calendário — reaparece no próximo encontro. */}
                <button type="button" onClick={() => setPrazo({ data: null, gatilho: "proxima-peca" })}
                  className={cn("rounded-lg border px-2.5 py-1 text-xs transition",
                    prazo.gatilho === "proxima-peca" ? "border-brand bg-brand/5 font-medium text-brand-ink" : "border-slate-200 text-slate-600 hover:border-brand")}>
                  Na próxima peça
                </button>
              </div>
            </Campo>
          </>
        )}

        <Campo label="O.S." hint="Opcional — só se você souber de cabeça">
          <Input inputMode="numeric" value={os} onChange={(e) => setOs(e.target.value)} />
        </Campo>

        {/* Carimbo obrigatório, em todo registro. Sem ele, o acervo vira algo
            que a empresa terá de sustentar como se fosse disciplinar. */}
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          Quem vê: você, o RH, a direção — e a própria pessoa, na ficha dela.<br />
          {AVISO_NAO_E_PUNICAO}
        </p>
        </>}

        {/* Na PREPARAÇÃO o aviso é outro: o roteiro é anotação de quem vai
            falar, e a pessoa não o vê. Dizer isso evita que o líder escreva
            com medo — ou, pior, que escreva achando que ela lerá. */}
        {etapa === "preparar" && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            A preparação é sua: a pessoa não vê este texto. Ela só verá o que
            você registrar depois da conversa.
          </p>
        )}
      </div>
    </Modal>
  );
}
