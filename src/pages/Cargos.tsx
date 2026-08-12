/* DESCRIÇÃO DOS CARGOS.
 *
 * Os 21 cargos da Impresilk já estavam cadastrados COM descrição, competências
 * técnicas e comportamentais, indicadores e trilha — tudo preenchido, e sem
 * nenhuma tela que mostrasse isso junto. Quem precisava saber o que um cargo
 * faz abria o Painel de Controle, que é tela de configuração: entrava para
 * consultar e saía com risco de editar.
 *
 * O piso de cada cargo é o N1 da faixa já cadastrada — o mesmo número que a
 * tabela salarial usa, não uma segunda régua que pudesse divergir dela.
 *
 * Além de ler, a tela mostra QUEM ocupa cada cargo hoje, quanto cada um ganha e
 * onde esse salário cai na faixa (a bolinha), e deixa o RH editar ali mesmo —
 * antes era preciso sair para o Painel de Controle e achar o cargo de novo.
 */
import { useMemo, useState } from "react";
import { Search, Briefcase, ChevronDown, ChevronRight, Users, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { LinkFicha } from "@/components/ui/link-ficha";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { useDominio, noQuadro } from "@/lib/dominio";
import { posicaoNaFaixa } from "@/lib/posicaoNaFaixa";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Cargo, Colaborador } from "@/data/types";

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
  const podeEditar = ehRH(sessao);
  const { atualizar } = useColecao("cargos");
  const [editando, setEditando] = useState<Cargo | null>(null);
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
        title="Descrição dos Cargos"
        description="O que cada cargo faz, quem o ocupa hoje e onde cada salário cai na faixa."
      />

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
          description="Ajuste a busca ou o filtro de área. Os cargos são cadastrados no Painel de Controle."
          icon={<Briefcase className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-3">
          {lista.map((c, i) => {
            const aberto = abertos.has(c.id);
            const ocupantes = ocupacao.get(c.id) ?? [];
            const quantos = ocupantes.length;
            const piso = c.faixas?.[0];
            const teto = c.faixas?.[c.faixas.length - 1];
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
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {piso != null
                        ? <>Piso (N1) <strong className="font-semibold text-slate-700">{formatBRL(piso)}</strong>
                            {teto != null && teto !== piso && <> · até {formatBRL(teto)} no N5</>}</>
                        : "Faixa salarial não cadastrada"}
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
                      title={`Editar a descrição e a faixa de ${c.nome}`}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  </div>
                )}

                {aberto && (
                  <CardBody className="border-t border-slate-100 pt-4">
                    {preenchidos.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Este cargo ainda não tem descrição cadastrada. Preencha no Painel de Controle → Cargos &amp; Faixas.
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
                            <OcupanteLinha key={p.id} colab={p} faixas={c.faixas} nivel={d.nomeNivel(p.nivelId)} />
                          ))}
                        </div>
                      </div>
                    )}

                    {c.faixas?.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Faixa por nível</p>
                        <div className="flex flex-wrap gap-2">
                          {c.faixas.map((v, n) => (
                            <span
                              key={n}
                              className={cn(
                                "rounded-lg px-2.5 py-1 text-xs ring-1",
                                n === 0
                                  ? "bg-brand/5 font-semibold text-brand-ink ring-brand/20"
                                  : "bg-slate-50 text-slate-600 ring-slate-200",
                              )}
                            >
                              N{n + 1} · {formatBRL(v)}
                            </span>
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

      {editando && (
        <ModalEditarCargo
          cargo={editando}
          onFechar={() => setEditando(null)}
          onSalvar={(patch) => { atualizar(editando.id, patch); setEditando(null); }}
        />
      )}

      <Card className="mt-4">
        <CardHeader title="De onde vem esta tela" icon={<Briefcase className="h-[18px] w-[18px]" />} />
        <CardBody>
          <p className="text-sm text-slate-600">
            Tudo aqui é leitura do cadastro de cargos — a mesma fonte da tabela salarial e do
            enquadramento de cada colaborador. Para alterar uma descrição ou uma faixa, use o
            <strong className="font-medium text-slate-700"> Painel de Controle → Cargos &amp; Faixas</strong>;
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
function OcupanteLinha({ colab, faixas, nivel }: {
  colab: Colaborador; faixas?: number[]; nivel: string;
}) {
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
          {/* A régua vai do PISO ao TETO da faixa deste cargo. Sem as pontas
              rotuladas a bolinha não diria nada — 60% de quê? */}
          <span className="text-[10px] tabular-nums text-slate-400">{formatBRL(faixas![0])}</span>
          <span className="relative h-1.5 flex-1 rounded-full bg-slate-100">
            <span
              className={cn("absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white", COR_ENQ[pos.enquadramento] ?? "bg-slate-300")}
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
        {pos && (
          <p className={cn("text-[11px]", pos.foraDaFaixa ? "font-medium text-amber-700" : "text-slate-400")}>
            {pos.enquadramento}
          </p>
        )}
      </div>
    </div>
  );
}

/* Edição do cargo aqui mesmo. Antes era só no Painel de Controle: quem estava
   lendo a descrição e via um erro tinha de sair, achar o cargo de novo noutra
   tela e voltar. As FAIXAS entram junto porque descrição e faixa são o mesmo
   assunto — mudar o que o cargo faz sem poder ajustar o que ele paga deixaria a
   metade cara do problema fora do alcance. */
function ModalEditarCargo({ cargo, onSalvar, onFechar }: {
  cargo: Cargo;
  onSalvar: (patch: Partial<Cargo>) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Cargo>>({ ...cargo });
  const set = (p: Partial<Cargo>) => setForm((f) => ({ ...f, ...p }));

  const setFaixa = (i: number, v: string) => {
    const n = Number(v.replace(/[^\d.,]/g, "").replace(",", "."));
    const atual = [...(form.faixas ?? cargo.faixas ?? [0, 0, 0, 0, 0])] as Cargo["faixas"];
    atual[i] = Number.isFinite(n) ? n : 0;
    set({ faixas: atual });
  };

  const salvar = () => {
    if (!String(form.nome ?? "").trim()) return toast("O cargo precisa de um nome.", "erro");
    const f = form.faixas ?? cargo.faixas;
    /* Faixa que desce no meio do caminho é quase sempre dedo trocado, e o
       enquadramento de todo mundo do cargo passaria a sair errado em silêncio. */
    if (f && f.some((v, i) => i > 0 && v < f[i - 1])) {
      return toast("Cada nível precisa ser maior ou igual ao anterior (N1 → N5).", "erro");
    }
    onSalvar(form);
    toast("Cargo atualizado.");
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Editar ${cargo.nome}`}
      descricao="Vale para esta tela, para a tabela salarial e para o enquadramento de quem ocupa o cargo."
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
        <Campo label="Faixa salarial por nível" hint="N1 é o piso do cargo; N5, o teto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(form.faixas ?? cargo.faixas ?? []).map((v, i) => (
              <label key={i} className="text-xs text-slate-500">
                N{i + 1}
                <Input
                  inputMode="decimal"
                  value={String(v ?? "")}
                  onChange={(e) => setFaixa(i, e.target.value)}
                />
              </label>
            ))}
          </div>
        </Campo>
      </div>
    </Modal>
  );
}
