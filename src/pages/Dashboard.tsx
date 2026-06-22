import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth, escopo } from "@/lib/auth";
import { PageHeader, StatCard, Card, CardHeader, CardBody } from "@/components/ui";
import { Barras, Rosca } from "@/components/Charts";
import { formatBRL, enquadrar, COR_ENQUADRAMENTO, primeiroNome } from "@/lib/format";
import { Users, UserCheck, GitBranch, Gauge, Wallet, Layers } from "lucide-react";

const encurta = (n: string) => n.replace("Produção e Comunicação Visual", "Produção").replace("Montagem e Instalação", "Montagem").replace("Serralheria e Metalurgia", "Serralheria").replace("Comercial e Atendimento", "Comercial").replace("Administrativo e Gestão", "Administrativo");

export function Dashboard() {
  const { db } = useStore();
  const { sessao } = useAuth();
  const ehRH = sessao!.perfil === "ADMIN_RH";

  const dados = useMemo(() => {
    const meus = escopo(sessao!, db.colaboradores);
    const statusAtivo = new Map(db.statuses.map((s) => [s.nome, s.ativo]));
    const ativos = meus.filter((c) => statusAtivo.get(c.status));
    const cargoMap = new Map(db.cargos.map((c) => [c.id, c]));
    const areaMap = new Map(db.areas.map((a) => [a.id, a.nome]));

    const porArea = new Map<string, number>();
    const porNivel = new Map<string, number>();
    const enq = new Map<string, number>();
    let somaSal = 0, nSal = 0;
    for (const c of ativos) {
      const a = encurta(areaMap.get(c.areaId ?? "") ?? "Sem área");
      porArea.set(a, (porArea.get(a) ?? 0) + 1);
      if (c.nivel) porNivel.set(c.nivel, (porNivel.get(c.nivel) ?? 0) + 1);
      const cargo = cargoMap.get(c.cargoId ?? "");
      const e = enquadrar(c.salario, cargo?.faixas ?? {});
      if (e !== "—") enq.set(e, (enq.get(e) ?? 0) + 1);
      if (c.salario) { somaSal += c.salario; nSal++; }
    }
    return {
      headcount: ativos.length,
      gestores: meus.filter((c) => meus.some((x) => x.gestorId === c.id)).length,
      porArea: [...porArea.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor),
      porNivel: ["N1", "N2", "N3", "N4", "N5"].map((n) => ({ nome: n, valor: porNivel.get(n) ?? 0 })),
      enquadramento: ["Crítico", "Abaixo", "Dentro", "Acima"].filter((s) => enq.has(s)).map((s) => ({ nome: s, valor: enq.get(s)!, cor: COR_ENQUADRAMENTO[s] })),
      media: nSal ? somaSal / nSal : 0,
      criticos: enq.get("Crítico") ?? 0,
    };
  }, [db, sessao]);

  return (
    <>
      <PageHeader title={`Olá, ${primeiroNome(sessao!.nome)}`} description={ehRH ? "Visão geral da empresa" : "Sua equipe"} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Colaboradores ativos" value={dados.headcount} icon={<Users className="h-5 w-5" />} accent="brand" hint="Headcount atual" />
        <StatCard label="Gestores" value={dados.gestores} icon={<UserCheck className="h-5 w-5" />} accent="blue" />
        <StatCard label="Enquadr. crítico" value={dados.criticos} icon={<Gauge className="h-5 w-5" />} accent={dados.criticos ? "red" : "green"} hint="Salário abaixo da faixa" />
        {ehRH
          ? <StatCard label="Folha média" value={formatBRL(dados.media)} icon={<Wallet className="h-5 w-5" />} accent="gold" hint="por colaborador" />
          : <StatCard label="Níveis N1–N5" value={dados.porNivel.reduce((s, n) => s + n.valor, 0)} icon={<Layers className="h-5 w-5" />} accent="gold" />}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Colaboradores por área" icon={<Users className="h-4 w-4" />} />
          <CardBody><Barras data={dados.porArea} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Enquadramento salarial" subtitle="Posição vs. faixa" icon={<Gauge className="h-4 w-4" />} />
          <CardBody>{dados.enquadramento.length ? <Rosca data={dados.enquadramento} /> : <p className="py-10 text-center text-sm text-slate-400">Sem dados</p>}</CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Distribuição por nível" subtitle="Régua N1–N5" icon={<GitBranch className="h-4 w-4" />} />
          <CardBody><Barras data={dados.porNivel} cor="#c2a14d" altura={220} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Resumo" icon={<Layers className="h-4 w-4" />} />
          <CardBody className="space-y-2 text-sm text-slate-600">
            <p>Headcount ativo: <strong className="text-brand-ink">{dados.headcount}</strong></p>
            <p>Áreas com pessoas: <strong className="text-brand-ink">{dados.porArea.length}</strong></p>
            {ehRH && <p>Folha média: <strong className="text-brand-ink">{formatBRL(dados.media)}</strong></p>}
            <p className="pt-2 text-xs text-slate-400">Dados locais (sem servidor de banco). Edite no Painel de Controle.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
