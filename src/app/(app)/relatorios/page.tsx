import { exigirPerfil } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/misc";
import { BarrasVerticais, BarrasDuplas, Rosca } from "@/components/charts/charts";
import { formatBRL, MESES_PT } from "@/lib/format";
import { Wallet, Users, TrendingDown, Coins, BarChart3, GitBranch, Clock } from "lucide-react";

export default async function RelatoriosPage() {
  await exigirPerfil(PERFIS.ADMIN_RH);

  const colaboradores = await db.colaborador.findMany({
    include: { area: true, status: true, nivel: true },
  });
  const ativos = colaboradores.filter((c) => c.status?.contaComoAtivo && !c.dataDesligamento);
  const hoje = new Date();

  // ---- Folha por área ----
  const folhaArea = new Map<string, number>();
  for (const c of ativos) {
    const a = c.area?.nome ?? "Sem área";
    folhaArea.set(a, (folhaArea.get(a) ?? 0) + (c.salario ?? 0));
  }
  const custoFolhaArea = [...folhaArea.entries()]
    .map(([nome, valor]) => ({ nome: encurtar(nome), valor: Math.round(valor) }))
    .sort((a, b) => b.valor - a.valor);
  const folhaTotal = ativos.reduce((s, c) => s + (c.salario ?? 0), 0);
  const custoMedio = ativos.length ? folhaTotal / ativos.length : 0;

  // ---- Movimentação 12 meses ----
  const meses: { nome: string; a: number; b: number; ano: number; mes: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({ nome: MESES_PT[d.getMonth()].slice(0, 3), a: 0, b: 0, ano: d.getFullYear(), mes: d.getMonth() });
  }
  for (const c of colaboradores) {
    if (c.dataAdmissao) {
      const m = meses.find((x) => x.ano === c.dataAdmissao!.getFullYear() && x.mes === c.dataAdmissao!.getMonth());
      if (m) m.a += 1;
    }
    if (c.dataDesligamento) {
      const m = meses.find((x) => x.ano === c.dataDesligamento!.getFullYear() && x.mes === c.dataDesligamento!.getMonth());
      if (m) m.b += 1;
    }
  }
  const movimentacao = meses.map((m) => ({ nome: m.nome, a: m.a, b: m.b }));
  const admissoes12 = meses.reduce((s, m) => s + m.a, 0);
  const deslig12 = meses.reduce((s, m) => s + m.b, 0);
  const turnover = ativos.length ? +(((deslig12) / (ativos.length + deslig12)) * 100).toFixed(1) : 0;

  // ---- Enquadramento salarial ----
  const corStatus: Record<string, string> = { Crítico: "#dc2626", Abaixo: "#d97706", Dentro: "#16a34a", Acima: "#2563eb" };
  const enqMap = new Map<string, number>();
  for (const c of ativos) enqMap.set(c.posicaoFaixa ?? "—", (enqMap.get(c.posicaoFaixa ?? "—") ?? 0) + 1);
  const enquadramento = ["Crítico", "Abaixo", "Dentro", "Acima"]
    .filter((s) => enqMap.has(s))
    .map((s) => ({ nome: s, valor: enqMap.get(s)!, cor: corStatus[s] }));

  // ---- Tempo de casa (faixas) ----
  const faixas = [
    { nome: "< 1 ano", cor: "#93c5fd" },
    { nome: "1–3 anos", cor: "#60a5fa" },
    { nome: "3–5 anos", cor: "#3b82f6" },
    { nome: "5–10 anos", cor: "#2563eb" },
    { nome: "10+ anos", cor: "#1e3a8a" },
  ];
  const contagem = [0, 0, 0, 0, 0];
  for (const c of ativos) {
    if (!c.dataAdmissao) continue;
    const anos = (hoje.getTime() - c.dataAdmissao.getTime()) / (365.25 * 86400000);
    if (anos < 1) contagem[0]++;
    else if (anos < 3) contagem[1]++;
    else if (anos < 5) contagem[2]++;
    else if (anos < 10) contagem[3]++;
    else contagem[4]++;
  }
  const tempoCasa = faixas.map((f, i) => ({ nome: f.nome, valor: contagem[i], cor: f.cor })).filter((x) => x.valor > 0);

  // ---- Headcount por área ----
  const hcArea = new Map<string, number>();
  for (const c of ativos) hcArea.set(c.area?.nome ?? "Sem área", (hcArea.get(c.area?.nome ?? "Sem área") ?? 0) + 1);
  const headcountArea = [...hcArea.entries()].map(([nome, valor]) => ({ nome: encurtar(nome), valor })).sort((a, b) => b.valor - a.valor);

  return (
    <>
      <PageHeader title="Relatórios Gerenciais" description="Indicadores de pessoas, folha e movimentação" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Folha mensal" value={formatBRL(folhaTotal)} icon={<Wallet className="h-5 w-5" />} accent="brand" />
        <StatCard label="Custo médio" value={formatBRL(custoMedio)} icon={<Coins className="h-5 w-5" />} accent="gold" hint="por colaborador" />
        <StatCard label="Headcount ativo" value={ativos.length} icon={<Users className="h-5 w-5" />} accent="blue" />
        <StatCard label="Turnover (12m)" value={`${turnover}%`} icon={<TrendingDown className="h-5 w-5" />} accent={turnover > 10 ? "red" : "green"} hint={`${admissoes12} adm. · ${deslig12} deslig.`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Custo de folha por área" subtitle="Salários dos colaboradores ativos" icon={<Wallet className="h-4 w-4" />} />
          <CardBody>
            {custoFolhaArea.length ? <BarrasVerticais data={custoFolhaArea} cor="#c2a14d" moeda altura={280} /> : <EmptyState title="Sem dados" />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Movimentação de pessoal (12 meses)" subtitle="Admissões x desligamentos" icon={<BarChart3 className="h-4 w-4" />} />
          <CardBody>
            <BarrasDuplas
              data={movimentacao}
              serieA={{ nome: "Admissões", cor: "#16a34a" }}
              serieB={{ nome: "Desligamentos", cor: "#dc2626" }}
              altura={280}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Headcount por área" icon={<Users className="h-4 w-4" />} />
          <CardBody>
            {headcountArea.length ? <BarrasVerticais data={headcountArea} altura={280} /> : <EmptyState title="Sem dados" />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Enquadramento salarial" subtitle="Posição vs. mercado" icon={<GitBranch className="h-4 w-4" />} />
          <CardBody>
            {enquadramento.length ? <Rosca data={enquadramento} altura={280} /> : <EmptyState title="Sem dados" />}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Tempo de casa" subtitle="Distribuição por faixa de antiguidade" icon={<Clock className="h-4 w-4" />} />
          <CardBody>
            {tempoCasa.length ? <Rosca data={tempoCasa} altura={280} /> : <EmptyState title="Sem dados" />}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function encurtar(nome: string): string {
  return nome
    .replace("Produção e Comunicação Visual", "Produção")
    .replace("Montagem e Instalação", "Montagem")
    .replace("Serralheria e Metalurgia", "Serralheria")
    .replace("Comercial e Atendimento", "Comercial")
    .replace("Administrativo e Gestão", "Administrativo");
}
