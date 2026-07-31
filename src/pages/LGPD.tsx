import { useMemo, useRef } from "react";
import { Lock, ShieldCheck, Eye, FileSearch, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { PERFIL_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";

function dataHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
  return `${formatDate(d)} ${hora}`;
}

export default function LGPD() {
  const sessao = useSessao();
  const d = useDominio();
  const { items: acessos } = useColecao("acessos");
  const { items: consentimentos } = useColecao("consentimentos");

  // Cada card do topo é um filtro das tabelas abaixo — os hooks ficam antes do
  // early return de permissão para não quebrar a ordem dos hooks.
  // Referência da tabela de consentimentos: o card leva até ela (a trilha acima
  // tem centenas de linhas, e sem isso o clique parecia não fazer nada).
  const refConsent = useRef<HTMLDivElement>(null);

  const ordenados = useMemo(
    () => [...acessos].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()),
    [acessos],
  );

  // NÃO existe filtro aqui de propósito: hoje o sistema registra um único tipo
  // de acesso (visualização de dados sensíveis, em ColaboradorFicha) e grava
  // todo consentimento como "consentido". Um filtro por esses campos devolveria
  // sempre a lista inteira — botão que acende e não muda nada engana mais do
  // que ajuda. Volta a fazer sentido quando houver outras ações registradas.
  const trilha = ordenados;
  const consentVisiveis = consentimentos;

  if (!ehRH(sessao)) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Apenas o RH pode consultar a trilha de acessos a dados sensíveis."
        icon={<Lock className="h-8 w-8" />}
      />
    );
  }

  const totalSensiveis = acessos.filter((a) => a.acao.includes("SENSIVEIS")).length;
  const totalConsentidos = consentimentos.filter((c) => c.consentido).length;

  return (
    <div>
      <PageHeader
        title="Registros de Acesso (LGPD)"
        description="Trilha local de acessos a dados sensíveis."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de acessos" value={acessos.length} icon={<Eye className="h-5 w-5" />} accent="brand" hint="Registrados na trilha abaixo" />
        <StatCard label="Acessos a dados sensíveis" value={totalSensiveis} icon={<FileSearch className="h-5 w-5" />} accent={totalSensiveis ? "amber" : "green"} hint="Visualizações de CPF, salário e dados familiares" />
        <StatCard
          label="Consentimentos registrados"
          value={`${totalConsentidos} de ${consentimentos.length}`}
          icon={<ShieldCheck className="h-5 w-5" />}
          accent="green"
          onClick={() => refConsent.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          title="Ir para a tabela de consentimentos"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Trilha de acessos"
          subtitle="Quem acessou dados sensíveis, quando e de qual colaborador."
          icon={<Eye className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {trilha.length === 0 ? (
            <EmptyState
              title="Nenhum acesso registrado"
              description="Os registros são criados automaticamente quando o RH ou um gestor abre a ficha de um colaborador e visualiza dados sensíveis."
              icon={<ShieldCheck className="h-8 w-8" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                  <tr>
                    <th className="th">Data / hora</th>
                    <th className="th">Usuário</th>
                    <th className="th">Perfil</th>
                    <th className="th">Ação</th>
                    <th className="th">Recurso</th>
                    <th className="th">Alvo</th>
                  </tr>
                </thead>
                <tbody>
                  {trilha.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="td whitespace-nowrap text-slate-500">{dataHora(a.criadoEm)}</td>
                      <td className="td font-medium text-slate-700">{a.usuarioNome}</td>
                      <td className="td text-slate-500">{PERFIL_LABEL[a.perfil] ?? a.perfil}</td>
                      <td className="td">
                        <Badge variant={a.acao.includes("SENSIVEIS") ? "warning" : "neutral"}>{a.acao}</Badge>
                      </td>
                      <td className="td text-slate-500">{a.recurso}</td>
                      <td className="td text-slate-700">{a.colaboradorId ? d.nomeColab(a.colaboradorId) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* O card "Consentimentos" rola até aqui — a trilha acima tem centenas de
          linhas e esta tabela ficava fora da tela. */}
      <div ref={refConsent}>
      <Card className="mt-6">
        <CardHeader
          title="Consentimentos LGPD"
          subtitle="Consentimentos de tratamento de dados registrados na admissão."
          icon={<ShieldCheck className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {consentVisiveis.length === 0 ? (
            <EmptyState title="Nenhum consentimento registrado" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                  <tr>
                    <th className="th">Colaborador</th>
                    <th className="th">Finalidade</th>
                    <th className="th">Data</th>
                    <th className="th">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {consentVisiveis.map((co) => (
                    <tr key={co.id} className="border-t border-slate-100">
                      <td className="td font-medium text-slate-700">{d.nomeColab(co.colaboradorId)}</td>
                      <td className="td text-slate-500">{co.finalidade}</td>
                      <td className="td whitespace-nowrap text-slate-500">{formatDate(co.data)}</td>
                      <td className="td">
                        {co.consentido ? (
                          <Badge variant="success"><CheckCircle2 className="h-3.5 w-3.5" /> Consentido</Badge>
                        ) : (
                          <Badge variant="danger">Não consentido</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
