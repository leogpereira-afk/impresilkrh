/* DESCRIÇÃO DOS CARGOS.
 *
 * Os 21 cargos da Impresilk já estavam cadastrados COM descrição, competências
 * técnicas e comportamentais, indicadores e trilha — tudo preenchido, e sem
 * nenhuma tela que mostrasse isso junto. Quem precisava saber o que um cargo
 * faz abria Configurações do RH, que é tela de configuração: entrava para
 * consultar e saía com risco de editar.
 *
 * Esta tela serve para MONTAR PROPOSTA DE CONTRATAÇÃO. Por isso o número que
 * manda é o SALÁRIO PRATICADO — informado à mão pelo RH — e não a faixa do plano
 * de carreira. São respostas a perguntas diferentes (o que se paga hoje × o que
 * o plano prevê) e aparecem lado a lado, rotuladas, sem uma depender da outra.
 *
 * POR QUE MANUAL. Cheguei a construir a derivação a partir do ERP e descartei:
 * ela carregava três armadilhas que só apareceram medindo a base real — o
 * salário vem partido em adiantamento e saldo; o mês corrente entra pela metade
 * (em 10/08/2026 julho tinha 29 adiantamentos e ZERO salários, ou seja, ~40% do
 * valor); e quem foi admitido no meio do mês aparece proporcional, o que
 * produzia "menor R$ 474" num cargo de 7 pessoas. Número de contratação é o que
 * o RH sabe e digita, com a data em que conferiu.
 *
 * UM VALOR SÓ. A faixa por nível N1–N5 pertence ao plano de carreira e continua
 * em Configurações do RH: aqui ela criaria dois números concorrentes para a mesma
 * pergunta ("quanto pago neste cargo?"), e a proposta sairia do errado.
 *
 * O RH cria, edita e apaga cargo nesta tela — antes era preciso sair para o
 * Configurações do RH e achar o cargo de novo. Apagar é barrado quando há gente
 * no cargo: as pessoas ficariam apontando para um cargo inexistente e perderiam
 * nome na lista, enquadramento e faixa de uma vez.
 */
import { dependentesCargo } from "@/lib/dependenciasEstrutura";
import { useMemo, useState } from "react";
import { Search, Briefcase, ChevronDown, ChevronRight, Users, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { LinkFicha } from "@/components/ui/link-ficha";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { useDominio, noQuadro } from "@/lib/dominio";
import { posicaoNaFaixa } from "@/lib/posicaoNaFaixa";
import { formatBRL, formatDate, diaLocalISO, parseBRL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Cargo, Colaborador } from "@/data/types";
import { patchDoQueMudou } from "@/lib/patchDoQueMudou";

const COR_ENQ: Record<string, string> = {
  Crítico: "bg-red-500", Abaixo: "bg-amber-500", Dentro: "bg-emerald-500", Acima: "bg-sky-500",
  "Sem dados": "bg-slate-300",
};

/** Campos de texto do cargo, na ordem em que fazem sentido para quem lê. */
const BLOCOS: { chave: keyof Cargo; titulo: string }[] = [
  { chave: "descricao", titulo: "O que faz" },
  { chave: "requisitos", titulo: "Requisitos" },
  { chave: "competenciasTecnicas", titulo: "Competências técnicas" },
  { chave: "competenciasComportamentais", titulo: "Competências comportamentais" },
  { chave: "indicadores", titulo: "Como é medido" },
];

export default function Cargos() {
  const d = useDominio();
  const sessao = useSessao();
  const toast = useToast();
  const podeEditar = ehRH(sessao);
  const { criar, atualizar, remover } = useColecao("cargos");
  const { items: vagas } = useColecao("vagas");
  const usos = (id: string) => dependentesCargo(id, d.colaboradores, vagas);
  const [editando, setEditando] = useState<Cargo | null>(null);
  const [criando, setCriando] = useState(false);
  const [apagando, setApagando] = useState<Cargo | null>(null);
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());

  /* Quantas pessoas ocupam cada cargo HOJE. `noQuadro` e não `d.ativos`: quem
     está afastado continua ocupando a vaga, e a descrição do cargo não muda
     porque a pessoa está de licença. */
  const ocupacao = useMemo(() => {
    const m = new Map<string, Colaborador[]>();
    for (const c of d.colaboradores) {
      if (c.ehDirecao || !noQuadro(c) || !c.cargoId) continue;
      const arr = m.get(c.cargoId);
      if (arr) arr.push(c); else m.set(c.cargoId, [c]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return m;
  }, [d.colaboradores]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return d.cargos
      .filter((c) => (area ? c.areaId === area : true))
      .filter((c) => (termo
        ? c.nome.toLowerCase().includes(termo)
          || (c.descricao ?? "").toLowerCase().includes(termo)
          || d.nomeArea(c.areaId).toLowerCase().includes(termo)
        : true))
      // localeCompare pt-BR: sem isso "Ângela" cairia depois de "Zuleica".
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [d, busca, area]);

  const alternar = (id: string) =>
    setAbertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div>
      <PageHeader
        title="Cargos e responsabilidades"
        description="O que cada cargo faz, quem o ocupa hoje e o que se paga — para montar proposta."
      >
        {podeEditar && (
          <button className="btn-primary" onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" /> Novo cargo
          </button>
        )}
      </PageHeader>

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cargo, área ou pelo texto da descrição"
              className="pl-9"
            />
          </div>
          <Select value={area} onChange={(e) => setArea(e.target.value)} className="w-auto min-w-[12rem]">
            <option value="">Todas as áreas</option>
            {d.areas.filter((a) => a.id !== "direcao").map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </Select>
          <span className="text-sm text-slate-500">
            {lista.length} {lista.length === 1 ? "cargo" : "cargos"}
          </span>
        </CardBody>
      </Card>

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum cargo encontrado"
          description="Ajuste a busca ou o filtro de área. Os cargos são cadastrados em Configurações do RH."
          icon={<Briefcase className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-3">
          {lista.map((c, i) => {
            const aberto = abertos.has(c.id);
            const ocupantes = ocupacao.get(c.id) ?? [];
            const quantos = ocupantes.length;
            /* O que a empresa PAGA neste cargo é informado à mão pelo RH — não
               sai do ERP. Ver o comentário em types.ts: a derivação automática
               foi construída e descartada por carregar três armadilhas
               (salário partido, mês corrente pela metade, admissão no meio do
               mês). Número de contratação é o que o RH sabe e digita. */
            const praticado = c.salarioPraticado;
            const preenchidos = BLOCOS.filter((b) => String(c[b.chave] ?? "").trim());
            return (
              <Card key={c.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => alternar(c.id)}
                  aria-expanded={aberto}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50/60"
                >
                  <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                  {aberto
                    ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{c.nome}</span>
                      <Badge variant="neutral">{d.nomeArea(c.areaId)}</Badge>
                      {c.trilha && <span className="text-xs text-slate-400">{c.trilha}</span>}
                    </span>
                    {/* O piso é o N1 da MESMA faixa da tabela salarial. Repetir o
                        número aqui de outra fonte criaria duas réguas para o
                        mesmo cargo, e um dia elas discordariam. */}
                    {/* O que a CONTABILIDADE pagou é o número grande — é ele que
                        serve para montar proposta. A faixa do plano fica ao lado,
                        menor e rotulada, para comparar sem se confundir: uma diz
                        o que se paga, a outra o que o plano previu. */}
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {/* UM valor só. A faixa por nível N1–N5 vive no plano de
                          carreira, noutra tela — aqui ela só criaria dois números
                          concorrentes para a mesma pergunta ("quanto pago neste
                          cargo?") e a proposta sairia do número errado. */}
                      {praticado != null && praticado > 0
                        ? <>Salário <strong className="font-semibold text-slate-700">{formatBRL(praticado)}</strong>
                            {c.salarioPraticadoEm && <span className="text-slate-400"> · conferido em {formatDate(c.salarioPraticadoEm)}</span>}</>
                        : <span className="text-slate-400">Salário não informado</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500" title={`${quantos} pessoa(s) neste cargo hoje`}>
                    <Users className="h-3.5 w-3.5" />
                    {quantos}
                  </span>
                </button>
                {/* FORA do <button> da sanfona: botão dentro de botão é HTML
                    inválido — o navegador desmonta a marcação e o clique passa a
                    cair em lugar imprevisível. */}
                {podeEditar && (
                  <div className="flex justify-end border-t border-slate-100 px-4 py-1.5">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => setEditando(c)}
                      title={`Editar ${c.nome}`}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs text-red-500"
                      onClick={() => setApagando(c)}
                      title={`Apagar ${c.nome}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Apagar
                    </button>
                  </div>
                )}

                {aberto && (
                  <CardBody className="border-t border-slate-100 pt-4">
                    {preenchidos.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Este cargo ainda não tem descrição cadastrada. Preencha em Configurações do RH → Cargos e faixas salariais.
                      </p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {preenchidos.map((b) => (
                          <div key={String(b.chave)}>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{b.titulo}</p>
                            {/* `whitespace-pre-line`: o texto foi digitado com
                                quebras de linha e listas; sem isto tudo vira um
                                parágrafo só e a leitura se perde. */}
                            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                              {String(c[b.chave] ?? "")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* QUEM OCUPA O CARGO HOJE, com o salário e onde ele cai na
                        faixa. Antes o enquadramento dizia só "Dentro", que cobre
                        piso e teto igual: quem está no N1 e quem está no N5
                        recebiam o mesmo rótulo, e não dava para ver quem tem
                        espaço para crescer sem mudar de cargo. */}
                    {ocupantes.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Quem ocupa hoje ({ocupantes.length})
                        </p>
                        <div className="space-y-2">
                          {ocupantes.map((p) => (
                            <OcupanteLinha key={p.id} colab={p} nivel={d.nomeNivel(p.nivelId)} faixas={c.faixas} />
                          ))}
                        </div>
                      </div>
                    )}

                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {(editando || criando) && (
        <ModalEditarCargo
          cargo={editando}
          areas={d.areas.filter((a) => a.id !== "direcao")}
          onFechar={() => { setEditando(null); setCriando(false); }}
          onSalvar={(patch) => {
            if (editando) atualizar(editando.id, patch);
            else criar(patch as Cargo);
            setEditando(null); setCriando(false);
          }}
        />
      )}

      {/* Apagar cargo OCUPADO deixaria as pessoas apontando para um cargo que
          não existe — some o nome na lista, o enquadramento e a faixa. */}
      <ConfirmDialog
        aberto={!!apagando}
        onFechar={() => setApagando(null)}
        onConfirmar={() => {
          if (!apagando) return;
          const usados = usos(apagando.id);
          if (usados > 0) {
            toast(`Não dá para apagar: ${usados} cadastro(s) ou vaga(s) usam este cargo. Reatribua os vínculos antes.`, "erro");
            setApagando(null);
            return;
          }
          remover(apagando.id);
          toast(`Cargo “${apagando.nome}” apagado.`);
          setApagando(null);
        }}
        titulo="Apagar cargo?"
        mensagem={apagando
          ? usos(apagando.id) > 0
            ? `“${apagando.nome}” está em uso por ${usos(apagando.id)} cadastro(s) ou vaga(s) e não pode ser apagado.`
            : `“${apagando.nome}” será removido. Nenhum cadastro ou vaga está vinculado a este cargo.`
          : ""}
      />

      <Card className="mt-4">
        <CardHeader title="De onde vem esta tela" icon={<Briefcase className="h-[18px] w-[18px]" />} />
        <CardBody>
          <p className="text-sm text-slate-600">
            Tudo aqui é leitura do cadastro de cargos — a mesma fonte da tabela salarial e do
            enquadramento de cada colaborador. Para alterar uma descrição ou uma faixa, use o
            <strong className="font-medium text-slate-700"> Configurações do RH → Cargos e faixas salariais</strong>;
            a mudança aparece nesta tela e no cálculo de enquadramento ao mesmo tempo.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/* Uma pessoa do cargo: nome, nível, salário e a BOLINHA na régua do piso ao
   teto. A cor sai do enquadramento (a regra do plano de carreira); a posição
   mostra o quanto falta para o topo do próprio cargo. */
function OcupanteLinha({ colab, nivel, faixas }: {
  colab: Colaborador; nivel: string; faixas?: number[];
}) {
  /* O salário de cada pessoa é o do CADASTRO dela — informado à mão, como o do
     cargo. A régua é a faixa do plano, e a cor sai do enquadramento. */
  const pos = posicaoNaFaixa(colab.salario, faixas);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
      <Avatar nome={colab.nome} foto={colab.fotoDataUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <LinkFicha id={colab.id} titulo="Abrir a ficha">
          <span className="text-sm font-medium text-slate-800">{colab.nome}</span>
        </LinkFicha>
        <p className="text-[11px] text-slate-400">{nivel}</p>
      </div>

      {pos ? (
        <div className="flex min-w-[11rem] flex-1 items-center gap-2">
          {/* As pontas rotuladas: sem elas a bolinha não diria nada — 60% de quê? */}
          <span className="text-[10px] tabular-nums text-slate-400">{formatBRL(faixas![0])}</span>
          <span className="relative h-1.5 flex-1 rounded-full bg-slate-100">
            <span
              className={cn("absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white",
                COR_ENQ[pos.enquadramento] ?? "bg-slate-300")}
              style={{ left: `${pos.pct}%` }}
              title={`${pos.enquadramento}${pos.foraDaFaixa ? " — fora da faixa do cargo" : ""}`}
            />
          </span>
          <span className="text-[10px] tabular-nums text-slate-400">{formatBRL(faixas![faixas!.length - 1])}</span>
        </div>
      ) : (
        <span className="flex-1 text-xs text-slate-400">Sem salário cadastrado</span>
      )}

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-slate-700">
          {colab.salario != null ? formatBRL(colab.salario) : "—"}
        </p>
        {pos && <p className="text-[11px] text-slate-400">{pos.enquadramento} no plano</p>}
      </div>
    </div>
  );
}

/* Edição do cargo aqui mesmo. Antes era só em Configurações do RH: quem estava
   lendo a descrição e via um erro tinha de sair, achar o cargo de novo noutra
   tela e voltar. As FAIXAS entram junto porque descrição e faixa são o mesmo
   assunto — mudar o que o cargo faz sem poder ajustar o que ele paga deixaria a
   metade cara do problema fora do alcance. */
function ModalEditarCargo({ cargo, areas, onSalvar, onFechar }: {
  /** null = criando um cargo novo. */
  cargo: Cargo | null;
  areas: { id: string; nome: string }[];
  onSalvar: (patch: Partial<Cargo>) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Cargo>>(
    () => cargo ? { ...cargo } : { nome: "", areaId: areas[0]?.id ?? "", faixas: [0, 0, 0, 0, 0] },
  );
  const set = (p: Partial<Cargo>) => setForm((f) => ({ ...f, ...p }));
  const [salarioTexto, setSalarioTexto] = useState(cargo?.salarioPraticado != null ? String(cargo.salarioPraticado).replace(".", ",") : "");

  const salvar = () => {
    if (!String(form.nome ?? "").trim()) return toast("O cargo precisa de um nome.", "erro");
    if (!String(form.areaId ?? "").trim()) return toast("Escolha a área do cargo.", "erro");
    /* Cargo novo nasce com a faixa zerada: ela pertence ao PLANO DE CARREIRA e
       se ajusta em Configurações do RH. Aqui só existe um salário — dois números
       para a mesma pergunta fariam a proposta sair do errado. */
    if (cargo) {
      // Só o que mudou em relação ao retrato de abertura — e nunca as faixas
      // (elas são de Configurações do RH). Gravar a cópia inteira devolvia a
      // faixa zerada e a descrição velha por cima do que chegou pelo sync.
      const patch = patchDoQueMudou(cargo, form, { nunca: ["faixas", "id"] });
      if (Object.keys(patch).length === 0) { toast("Nada mudou."); onFechar(); return; }
      onSalvar(patch);
      toast("Cargo atualizado.");
      return;
    }
    onSalvar({ ...form, faixas: (form.faixas ?? [0, 0, 0, 0, 0]) as Cargo["faixas"] });
    toast("Cargo criado.");
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={cargo ? `Editar ${cargo.nome}` : "Novo cargo"}
      descricao="A descrição e o salário valem para esta tela. A faixa por nível do plano de carreira fica em Configurações do RH."
      largura="max-w-2xl"
      rodape={<>
        <button className="btn-outline" onClick={onFechar}>Cancelar</button>
        <button className="btn-primary" onClick={salvar}>Salvar</button>
      </>}
    >
      <div className="space-y-3">
        <Campo label="Nome do cargo" obrigatorio>
          <Input value={form.nome ?? ""} onChange={(e) => set({ nome: e.target.value })} />
        </Campo>
        <Campo label="Área" obrigatorio>
          <Select value={form.areaId ?? ""} onChange={(e) => set({ areaId: e.target.value })}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Campo>
        <Campo label="Trilha" hint="Opcional — ex.: Técnica, Liderança">
          <Input value={form.trilha ?? ""} onChange={(e) => set({ trilha: e.target.value })} />
        </Campo>
        {BLOCOS.map((b) => (
          <Campo key={String(b.chave)} label={b.titulo}>
            <Textarea
              value={String(form[b.chave] ?? "")}
              onChange={(e) => set({ [b.chave]: e.target.value } as Partial<Cargo>)}
            />
          </Campo>
        ))}
        {/* O número que serve para montar proposta, digitado por quem sabe. Fica
            ANTES da faixa do plano no formulário porque é o que se consulta. */}
        <Campo label="Salário praticado hoje" hint="O que a empresa realmente paga neste cargo — é este o número da proposta">
          <Input
            inputMode="decimal"
            // O TEXTO digitado fica num estado próprio: com o input reescrito a
            // partir do número a cada tecla, a vírgula sumia e "1518,50" virava
            // 151850 (auditoria de 07/09/2026).
            value={salarioTexto}
            onChange={(e) => {
              setSalarioTexto(e.target.value);
              // parseBRL: o parse ingênuo transformava "2.500,00" em NaN (salário
              // sumia) e "2.500" em 2,5. Ver lib/format.
              const novo = parseBRL(e.target.value);
              set({
                salarioPraticado: novo,
                /* Só carimba a conferência se o VALOR mudou. Carimbar a cada
                   tecla — ou ao salvar sem mexer no salário — poria data de hoje
                   num número que ninguém conferiu, e "conferido em" mentiria. */
                ...(novo !== (form.salarioPraticado ?? null)
                  ? { salarioPraticadoEm: diaLocalISO(new Date()) }
                  : {}),
              });
            }}
          />
        </Campo>

      </div>
    </Modal>
  );
}
