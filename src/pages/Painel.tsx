import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users, TrendingDown, TrendingUp, FileWarning, ClipboardCheck, Palmtree, Cake,
  AlertTriangle, CalendarClock, Award, Target,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, DotBadge } from "@/components/ui/badge";
import { EmptyState, Progress } from "@/components/ui/misc";
import { BarrasColoridas, BarrasVerticais, Rosca } from "@/components/charts/charts";
import { useColecao } from "@/lib/store";
import { useDominio, contaHeadcount } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis } from "@/lib/rbac";
import { formatBRL, formatDate, MESES_PT } from "@/lib/format";
import { COR_POSICAO_FAIXA, COR_RISCO, JANELA_ALERTA_DIAS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";

const dias = (d?: string | null) => (d ? Math.round((new Date(d).getTime() - HOJE.getTime()) / 86400000) : NaN);
const mesesAtras = (d?: string | null) => (d ? (HOJE.getTime() - new Date(d).getTime()) / (86400000 * 30.44) : Infinity);

export default function Painel() {
  const sessao = useSessao();
  const d = useDominio();
  const { items: documentos } = useColecao("documentos");
  const { items: ferias } = useColecao("ferias");
  const { items: avaliacoes } = useColecao("avaliacoes");
  const { items: pdis } = useColecao("pdis");
  const { items: aceites } = useColecao("aceites");

  const escopo = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores),
    [sessao, d.colaboradores],
  );

  if (sessao?.perfil === "COLABORADOR") {
    return <PainelPessoal />;
  }

  const ids = new Set(escopo.map((c) => c.id));
  const ativos = escopo.filter((c) => contaHeadcount(c, d.statusById));

  const admissoes12m = escopo.filter((c) => mesesAtras(c.dataAdmissao) <= 12).length;
  const desligamentos12m = escopo.filter((c) => c.dataDesligamento && mesesAtras(c.dataDesligamento) <= 12).length;
  const turnover = ativos.length + desligamentos12m > 0 ? desligamentos12m / ((ativos.length + (ativos.length + desligamentos12m)) / 2) : 0;

  const docsAlerta = documentos.filter((doc) => ids.has(doc.colaboradorId) && doc.dataVencimento && dias(doc.dataVencimento) <= JANELA_ALERTA_DIAS);
  const docsVencidos = docsAlerta.filter((doc) => dias(doc.dataVencimento) < 0);

  const feriasAtivas = ferias.filter((f) => ids.has(f.colaboradorId) && f.status === "Em andamento");
  const proximosRetornos = ferias
    .filter((f) => ids.has(f.colaboradorId) && f.status === "Em andamento" && f.dataRetorno && dias(f.dataRetorno) >= 0)
    .sort((a, b) => dias(a.dataRetorno) - dias(b.dataRetorno));

  const cicloAvaliados = new Set(avaliacoes.filter((a) => a.tipo === "GESTOR").map((a) => a.colaboradorId));
  const avaliacoesPendentes = ativos.filter((c) => !cicloAvaliados.has(c.id));
  const elegiveis = avaliacoes.filter((a) => a.elegivelPromocao && ids.has(a.colaboradorId));

  const aniversariantes = ativos
    .filter((c) => c.dataNascimento && new Date(c.dataNascimento).getMonth() === HOJE.getMonth())
    .sort((a, b) => new Date(a.dataNascimento!).getDate() - new Date(b.dataNascimento!).getDate());

  const risco = { Alto: 0, Médio: 0, Baixo: 0 } as Record<string, number>;
  ativos.forEach((c) => (risco[c.riscoSaida ?? "Baixo"] = (risco[c.riscoSaida ?? "Baixo"] ?? 0) + 1));

  const porArea = d.areas
    .filter((a) => a.id !== "direcao")
    .map((a) => ({ nome: a.nome.split(" ")[0], valor: ativos.filter((c) => c.areaId === a.id).length }))
    .filter((x) => x.valor > 0);
  const porNivel = d.niveis.map((n) => ({ nome: n.codigo, valor: ativos.filter((c) => c.nivelId === n.id).length }));
  const enquadCont: Record<string, number> = { Crítico: 0, Abaixo: 0, Dentro: 0, Acima: 0 };
  ativos.forEach((c) => {
    const e = d.enquadrarColab(c);
    enquadCont[e] = (enquadCont[e] ?? 0) + 1;
  });
  const enquadData = Object.entries(enquadCont).filter(([, v]) => v > 0).map(([nome, valor]) => ({ nome, valor, cor: COR_POSICAO_FAIXA[nome] }));

  return (
    <div>
      <PageHeader
        title={`Painel de RH`}
        description={sessao?.perfil === "GESTOR" ? "Visão da sua equipe (hierarquia recursiva)." : "Visão geral do quadro de colaboradores da Impresilk."}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Headcount ativo" value={ativos.length} icon={<Users className="h-5 w-5" />} accent="brand" hint="Colaboradores que contam no quadro" />
        <StatCard label="Admissões 12m" value={admissoes12m} icon={<TrendingUp className="h-5 w-5" />} accent="green" />
        <StatCard label="Desligamentos 12m" value={desligamentos12m} icon={<TrendingDown className="h-5 w-5" />} accent="red" />
        <StatCard label="Turnover 12m" value={`${(turnover * 100).toFixed(1)}%`} icon={<TrendingDown className="h-5 w-5" />} accent="amber" />
        <StatCard label="Documentos a vencer" value={docsAlerta.length} hint={`${docsVencidos.length} vencido(s)`} icon={<FileWarning className="h-5 w-5" />} accent={docsVencidos.length ? "red" : "amber"} />
        <StatCard label="Avaliações pendentes" value={avaliacoesPendentes.length} icon={<ClipboardCheck className="h-5 w-5" />} accent="blue" />
        <StatCard label="De férias agora" value={feriasAtivas.length} icon={<Palmtree className="h-5 w-5" />} accent="green" />
        <StatCard label="Risco de saída alto" value={risco.Alto ?? 0} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Colaboradores por área" icon={<Users className="h-[18px] w-[18px]" />} />
          <CardBody><BarrasVerticais data={porArea} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Distribuição por nível" subtitle="Régua de senioridade N1–N5" />
          <CardBody><BarrasVerticais data={porNivel} cor="#c2a14d" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Enquadramento salarial" subtitle="Posição frente à faixa do cargo" />
          <CardBody>{enquadData.length ? <Rosca data={enquadData} /> : <EmptyState title="Sem dados" />}</CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Alertas e pendências" subtitle="Conformidade de documentos, férias e avaliações" icon={<AlertTriangle className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {docsAlerta.length === 0 && avaliacoesPendentes.length === 0 ? (
              <EmptyState title="Tudo em dia" description="Nenhuma pendência crítica no seu escopo." icon={<ClipboardCheck className="h-8 w-8" />} />
            ) : (
              <>
                {docsAlerta.slice(0, 6).map((doc) => {
                  const dd = dias(doc.dataVencimento);
                  const vencido = dd < 0;
                  return (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{doc.nome} · {d.nomeColab(doc.colaboradorId)}</p>
                        <p className="text-xs text-slate-400">{doc.categoria}</p>
                      </div>
                      <Badge variant={vencido ? "danger" : "warning"}>
                        {vencido ? `Vencido há ${Math.abs(dd)}d` : `Vence em ${dd}d`}
                      </Badge>
                    </div>
                  );
                })}
                {avaliacoesPendentes.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-medium text-slate-700">Avaliação pendente · {c.nome}</p>
                    <Badge variant="info">Ciclo 2026.1</Badge>
                  </div>
                ))}
              </>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Aniversariantes do mês" subtitle={MESES_PT[HOJE.getMonth()]} icon={<Cake className="h-[18px] w-[18px]" />} />
            <CardBody className="space-y-2">
              {aniversariantes.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum aniversariante este mês.</p>
              ) : (
                aniversariantes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{c.nome}</span>
                    <span className="text-slate-400">{new Date(c.dataNascimento!).getDate()}/{HOJE.getMonth() + 1}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Próximos retornos de férias" icon={<CalendarClock className="h-[18px] w-[18px]" />} />
            <CardBody className="space-y-2">
              {proximosRetornos.length === 0 ? (
                <p className="text-sm text-slate-400">Ninguém de férias no momento.</p>
              ) : (
                proximosRetornos.slice(0, 4).map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{d.nomeColab(f.colaboradorId)}</span>
                    <span className="text-slate-400">{formatDate(f.dataRetorno)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Risco de saída × potencial" subtitle="Atenção à retenção de talentos" icon={<AlertTriangle className="h-[18px] w-[18px]" />} action={<Link to="/desempenho" className="text-xs font-medium text-brand hover:underline">Ver 9-Box →</Link>} />
          <CardBody>
            <BarrasColoridas
              altura={200}
              data={[
                { nome: "Risco alto", valor: risco.Alto ?? 0, cor: COR_RISCO.Alto },
                { nome: "Risco médio", valor: risco.Médio ?? 0, cor: COR_RISCO.Médio },
                { nome: "Risco baixo", valor: risco.Baixo ?? 0, cor: COR_RISCO.Baixo },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Elegíveis a promoção" subtitle="Ciclo 2026.1" icon={<Award className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {elegiveis.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum elegível no momento.</p>
            ) : (
              elegiveis.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{d.nomeColab(a.colaboradorId)}</span>
                  <DotBadge label={`→ ${a.proximoNivel}`} cor="#16a34a" />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ---------- Visão do colaborador (autoatendimento) ----------
function PainelPessoal() {
  const sessao = useSessao();
  const d = useDominio();
  const { items: documentos } = useColecao("documentos");
  const { items: ferias } = useColecao("ferias");
  const { items: avaliacoes } = useColecao("avaliacoes");
  const { items: pdis } = useColecao("pdis");

  const c = d.colabById.get(sessao!.colaboradorId);
  if (!c) return null;

  const minhasFerias = ferias.filter((f) => f.colaboradorId === c.id);
  const feriasAtiva = minhasFerias.find((f) => f.status === "Em andamento" || f.status === "Agendada");
  const saldoFerias = minhasFerias.reduce((acc, f) => Math.max(acc, f.saldoDias), 0);
  const minhaAval = avaliacoes.find((a) => a.colaboradorId === c.id && a.tipo === "GESTOR");
  const meusPdis = pdis.filter((p) => p.colaboradorId === c.id);
  const meusDocsAlerta = documentos.filter((doc) => doc.colaboradorId === c.id && doc.dataVencimento && dias(doc.dataVencimento) <= JANELA_ALERTA_DIAS);

  return (
    <div>
      <PageHeader title={`Olá, ${c.nome.split(" ")[0]}`} description="Seu painel de autoatendimento na Impresilk." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cargo" value={<span className="text-base">{d.nomeCargo(c)}</span>} icon={<Users className="h-5 w-5" />} accent="brand" hint={`Nível ${d.nomeNivel(c.nivelId)}`} />
        <StatCard label="Saldo de férias" value={`${saldoFerias} dias`} icon={<Palmtree className="h-5 w-5" />} accent="green" hint={feriasAtiva ? feriasAtiva.status : "Em aberto"} />
        <StatCard label="Nota da avaliação" value={minhaAval?.notaFinal ?? "—"} icon={<Award className="h-5 w-5" />} accent="gold" hint={minhaAval?.statusDesempenho ?? "Sem avaliação"} />
        <StatCard label="Documentos a vencer" value={meusDocsAlerta.length} icon={<FileWarning className="h-5 w-5" />} accent={meusDocsAlerta.length ? "amber" : "green"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Meu desempenho" subtitle="Ciclo 2026.1" icon={<TrendingUp className="h-[18px] w-[18px]" />} />
          <CardBody>
            {minhaAval ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Nota final</span>
                  <Badge variant={minhaAval.statusDesempenho === "Apto" ? "success" : minhaAval.statusDesempenho === "Não apto" ? "danger" : "warning"}>
                    {minhaAval.notaFinal} · {minhaAval.statusDesempenho}
                  </Badge>
                </div>
                {minhaAval.elegivelPromocao && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Elegível para promoção → {minhaAval.proximoNivel}
                  </div>
                )}
                {minhaAval.planoAcao && <p className="text-sm text-slate-500">{minhaAval.planoAcao}</p>}
              </div>
            ) : (
              <EmptyState title="Sem avaliação registrada" />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Meu PDI" subtitle="Plano de Desenvolvimento Individual" icon={<Target className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-3">
            {meusPdis.length === 0 ? (
              <EmptyState title="Nenhum PDI ativo" />
            ) : (
              meusPdis.map((p) => (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{p.competencia}</span>
                    <span className="text-slate-400">{p.progresso}%</span>
                  </div>
                  <Progress value={p.progresso} />
                  <p className="mt-1 text-xs text-slate-500">{p.acao}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4">
        <Link to="/meu-perfil" className="btn-outline">Ver meu perfil completo</Link>
      </div>
    </div>
  );
}
