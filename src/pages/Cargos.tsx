/* DESCRIÇÃO DOS CARGOS.
 *
 * Os 21 cargos da Impresilk já estavam cadastrados COM descrição, competências
 * técnicas e comportamentais, indicadores e trilha — tudo preenchido, e sem
 * nenhuma tela que mostrasse isso junto. Quem precisava saber o que um cargo
 * faz abria o Painel de Controle, que é tela de configuração: entrava para
 * consultar e saía com risco de editar.
 *
 * Aqui é só leitura. O piso de cada cargo é o N1 da faixa já cadastrada — o
 * mesmo número que a tabela salarial usa, não uma segunda régua que pudesse
 * divergir dela.
 */
import { useMemo, useState } from "react";
import { Search, Briefcase, ChevronDown, ChevronRight, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { useDominio, noQuadro } from "@/lib/dominio";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Cargo } from "@/data/types";

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
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());

  /* Quantas pessoas ocupam cada cargo HOJE. `noQuadro` e não `d.ativos`: quem
     está afastado continua ocupando a vaga, e a descrição do cargo não muda
     porque a pessoa está de licença. */
  const ocupacao = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of d.colaboradores) {
      if (c.ehDirecao || !noQuadro(c) || !c.cargoId) continue;
      m.set(c.cargoId, (m.get(c.cargoId) ?? 0) + 1);
    }
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
        description="O que cada cargo faz, o que se espera dele e o piso da faixa — como está cadastrado no plano de carreira."
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
            const quantos = ocupacao.get(c.id) ?? 0;
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
