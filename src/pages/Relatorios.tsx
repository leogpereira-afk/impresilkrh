import { useMemo } from "react";
import {
  Users,
  Wallet,
  Coins,
  TrendingDown,
  BarChart3,
  Building2,
  CalendarRange,
  PieChart,
  Clock,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import {
  BarrasVerticais,
  BarrasDuplas,
  BarrasColoridas,
  Rosca,
} from "@/components/charts/charts";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { formatBRL, formatPercent, mesesDeCasa, MESES_PT } from "@/lib/format";
import { COR_POSICAO_FAIXA } from "@/lib/constants";
import { HOJE } from "@/data/_gen";
import type { Colaborador } from "@/data/types";

// Faixas de tempo de casa (em meses)
const FAIXAS_TEMPO: { nome: string; cor: string; teste: (m: number) => boolean }[] = [
  { nome: "< 1 ano", cor: "#94a3b8", teste: (m) => m < 12 },
  { nome: "1–3 anos", cor: "#60a5fa", teste: (m) => m >= 12 && m < 36 },
  { nome: "3–5 anos", cor: "#3b82f6", teste: (m) => m >= 36 && m < 60 },
  { nome: "5–10 anos", cor: "#c2a14d", teste: (m) => m >= 60 && m < 120 },
  { nome: "10+ anos", cor: "#16334f", teste: (m) => m >= 120 },
];

export default function Relatorios() {
  const sessao = useSessao();
  const d = useDominio();

  const ehRestrito = !ehRH(sessao);

  const ativos = d.ativos;
  const colaboradores = d.colaboradores;

  // -- Indicadores de cabeçalho --
  const indicadores = useMemo(() => {
    const comSalario = ativos.filter(
      (c): c is Colaborador & { salario: number } =>
        typeof c.salario === "number",
    );
    const folha = comSalario.reduce((acc, c) => acc + c.salario, 0);
    const custoMedio = comSalario.length > 0 ? folha / comSalario.length : 0;

    const limite12m = new Date(HOJE);
    limite12m.setMonth(limite12m.getMonth() - 12);

    const desligamentos12m = colaboradores.filter(
      (c) => c.dataDesligamento && new Date(c.dataDesligamento) >= limite12m,
    ).length;
    const admissoes12m = colaboradores.filter(
      (c) => c.dataAdmissao && new Date(c.dataAdmissao) >= limite12m,
    ).length;

    // Headcount médio aproximado: (atual + (atual + desligados)) / 2
    const headcountFim = ativos.length;
    const headcountInicio = ativos.length + desligamentos12m - admissoes12m;
    const headcountMedio = (headcountFim + Math.max(0, headcountInicio)) / 2;
    const turnover =
      headcountMedio > 0 ? desligamentos12m / headcountMedio : 0;

    return {
      headcount: ativos.length,
      folha,
      custoMedio,
      desligamentos12m,
      turnover,
    };
  }, [ativos, colaboradores]);

  // -- Folha e custo médio por área --
  const porArea = useMemo(() => {
    return d.areas
      .filter((a) => a.id !== "direcao")
      .map((a) => {
        const doArea = ativos.filter((c) => c.areaId === a.id);
        const folha = doArea.reduce(
          (acc, c) => acc + (typeof c.salario === "number" ? c.salario : 0),
          0,
        );
        return {
          id: a.id,
          nome: a.nome,
          nomeCurto: a.nome.split(" ")[0],
          headcount: doArea.length,
          folha,
          custoMedio: doArea.length > 0 ? folha / doArea.length : 0,
        };
      })
      .filter((x) => x.headcount > 0)
      .sort((a, b) => b.folha - a.folha);
  }, [d.areas, ativos]);

  const folhaPorAreaChart = useMemo(
    () => porArea.map((a) => ({ nome: a.nomeCurto, valor: a.folha })),
    [porArea],
  );

  // -- Movimentação 12 meses (admissões vs desligamentos) --
  const movimentacao = useMemo(() => {
    const meses: { ano: number; mes: number; nome: string; a: number; b: number }[] =
      [];
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(HOJE);
      ref.setMonth(ref.getMonth() - i);
      meses.push({
        ano: ref.getFullYear(),
        mes: ref.getMonth(),
        nome: MESES_PT[ref.getMonth()].slice(0, 3),
        a: 0,
        b: 0,
      });
    }
    const idx = new Map(meses.map((m, i) => [`${m.ano}-${m.mes}`, i]));
    for (const c of colaboradores) {
      if (c.dataAdmissao) {
        const dt = new Date(c.dataAdmissao);
        const i = idx.get(`${dt.getFullYear()}-${dt.getMonth()}`);
        if (i !== undefined) meses[i].a += 1;
      }
      if (c.dataDesligamento) {
        const dt = new Date(c.dataDesligamento);
        const i = idx.get(`${dt.getFullYear()}-${dt.getMonth()}`);
        if (i !== undefined) meses[i].b += 1;
      }
    }
    return meses.map((m) => ({ nome: m.nome, a: m.a, b: m.b }));
  }, [colaboradores]);

  // -- Enquadramento salarial --
  const enquadramento = useMemo(() => {
    const cont: Record<string, number> = {
      Crítico: 0,
      Abaixo: 0,
      Dentro: 0,
      Acima: 0,
    };
    for (const c of ativos) {
      const e = d.enquadrarColab(c);
      cont[e] = (cont[e] ?? 0) + 1;
    }
    return Object.entries(cont)
      .filter(([, v]) => v > 0)
      .map(([nome, valor]) => ({
        nome,
        valor,
        cor: COR_POSICAO_FAIXA[nome] ?? "#64748b",
      }));
  }, [ativos, d]);

  // -- Tempo de casa --
  const tempoDeCasa = useMemo(() => {
    return FAIXAS_TEMPO.map((f) => ({
      nome: f.nome,
      cor: f.cor,
      valor: ativos.filter((c) => f.teste(mesesDeCasa(c.dataAdmissao))).length,
    }));
  }, [ativos]);

  if (ehRestrito) {
    return (
      <div>
        <PageHeader
          title="Relatórios gerenciais"
          description="Indicadores executivos do quadro de colaboradores."
        />
        <EmptyState
          title="Acesso restrito"
          description="Os relatórios gerenciais estão disponíveis apenas para o RH."
          icon={<Lock className="h-8 w-8" />}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Relatórios gerenciais"
        description="Visão executiva da Impresilk — folha, movimentação e enquadramento."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Headcount ativo"
          value={indicadores.headcount}
          icon={<Users className="h-5 w-5" />}
          accent="brand"
          hint="Colaboradores que contam no quadro"
        />
        <StatCard
          label="Folha total"
          value={<span className="text-xl">{formatBRL(indicadores.folha)}</span>}
          icon={<Wallet className="h-5 w-5" />}
          accent="gold"
          hint="Soma dos salários ativos"
        />
        <StatCard
          label="Custo médio"
          value={
            <span className="text-xl">{formatBRL(indicadores.custoMedio)}</span>
          }
          icon={<Coins className="h-5 w-5" />}
          accent="blue"
          hint="Salário médio por colaborador"
        />
        <StatCard
          label="Turnover 12m"
          value={formatPercent(indicadores.turnover)}
          icon={<TrendingDown className="h-5 w-5" />}
          accent="amber"
          hint={`${indicadores.desligamentos12m} desligamento(s) em 12m`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Folha por área"
            subtitle="Custo mensal de pessoal por área (R$)"
            icon={<BarChart3 className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {folhaPorAreaChart.length ? (
              <BarrasVerticais data={folhaPorAreaChart} moeda cor="#c2a14d" />
            ) : (
              <EmptyState title="Sem dados de folha" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Custo médio por área"
            subtitle="Headcount, folha e custo médio"
            icon={<Building2 className="h-[18px] w-[18px]" />}
          />
          <CardBody className="p-0">
            {porArea.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>
                      <th className="th">Área</th>
                      <th className="th text-right">HC</th>
                      <th className="th text-right">Folha</th>
                      <th className="th text-right">Custo médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porArea.map((a) => (
                      <tr key={a.id} className="transition hover:bg-slate-50/60">
                        <td className="td font-medium text-slate-700">
                          {a.nome}
                        </td>
                        <td className="td text-right text-slate-600">
                          {a.headcount}
                        </td>
                        <td className="td text-right text-slate-600">
                          {formatBRL(a.folha)}
                        </td>
                        <td className="td text-right text-slate-600">
                          {formatBRL(a.custoMedio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50/60">
                    <tr>
                      <td className="td font-semibold text-slate-700">Total</td>
                      <td className="td text-right font-semibold text-slate-700">
                        {indicadores.headcount}
                      </td>
                      <td className="td text-right font-semibold text-slate-700">
                        {formatBRL(indicadores.folha)}
                      </td>
                      <td className="td text-right font-semibold text-slate-700">
                        {formatBRL(indicadores.custoMedio)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Sem dados por área" />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Movimentação — 12 meses"
            subtitle="Admissões e desligamentos por mês"
            icon={<CalendarRange className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            <BarrasDuplas
              data={movimentacao}
              serieA={{ nome: "Admissões", cor: "#16a34a" }}
              serieB={{ nome: "Desligamentos", cor: "#dc2626" }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Enquadramento salarial"
            subtitle="Posição frente à faixa do cargo"
            icon={<PieChart className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {enquadramento.length ? (
              <Rosca data={enquadramento} />
            ) : (
              <EmptyState title="Sem dados" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Tempo de casa"
            subtitle="Distribuição do quadro ativo por tempo de empresa"
            icon={<Clock className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            <BarrasColoridas data={tempoDeCasa} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
