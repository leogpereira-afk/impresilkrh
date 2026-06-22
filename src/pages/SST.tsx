import { useMemo } from "react";
import { HardHat, ShieldCheck, FileText, Stethoscope, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { RichContent } from "@/components/ui/rich";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { CATEGORIAS_SST, JANELA_ALERTA_DIAS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";

const dias = (d?: string | null) => (d ? Math.round((new Date(d).getTime() - HOJE.getTime()) / 86400000) : NaN);

type Situacao = "Vencido" | "A vencer" | "Válido";

function situacaoDoc(dataVencimento?: string | null): Situacao {
  const dd = dias(dataVencimento);
  if (isNaN(dd)) return "Válido";
  if (dd < 0) return "Vencido";
  if (dd <= JANELA_ALERTA_DIAS) return "A vencer";
  return "Válido";
}

const VARIANTE_SITUACAO: Record<Situacao, "danger" | "warning" | "success"> = {
  Vencido: "danger",
  "A vencer": "warning",
  Válido: "success",
};

export default function SST() {
  const sessao = useSessao();
  const d = useDominio();
  const { items: institucionais } = useColecao("institucionais");
  const { items: documentos } = useColecao("documentos");

  const programas = useMemo(
    () => institucionais.filter((doc) => doc.categoria === "SST"),
    [institucionais],
  );

  const exames = useMemo(() => {
    const idsVisiveis = new Set(colaboradoresVisiveis(sessao, d.colaboradores).map((c) => c.id));
    const cats = new Set<string>(CATEGORIAS_SST);
    return documentos
      .filter((doc) => cats.has(doc.categoria) && idsVisiveis.has(doc.colaboradorId))
      .sort((a, b) => {
        const da = dias(a.dataVencimento);
        const db = dias(b.dataVencimento);
        if (isNaN(da)) return 1;
        if (isNaN(db)) return -1;
        return da - db;
      });
  }, [documentos, sessao, d.colaboradores]);

  const total = exames.length;
  const vencidos = exames.filter((doc) => situacaoDoc(doc.dataVencimento) === "Vencido").length;
  const aVencer = exames.filter((doc) => situacaoDoc(doc.dataVencimento) === "A vencer").length;
  const validos = total - vencidos - aVencer;

  const abaProgramas = (
    <div className="space-y-6">
      {programas.length === 0 ? (
        <EmptyState
          title="Nenhum programa cadastrado"
          description="PGR, PCMSO e demais programas de NR aparecerão aqui."
          icon={<ShieldCheck className="h-8 w-8" />}
        />
      ) : (
        programas.map((doc) => (
          <Card key={doc.id}>
            <CardHeader
              title={doc.titulo}
              subtitle={doc.descricao}
              icon={<ShieldCheck className="h-[18px] w-[18px]" />}
              action={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {doc.versao && <Badge variant="neutral">v{doc.versao}</Badge>}
                  <span className="text-xs text-slate-400">
                    Atualizado em {formatDate(doc.atualizadoEm)}
                  </span>
                </div>
              }
            />
            <CardBody>
              {doc.blocos?.length ? (
                <RichContent blocos={doc.blocos} />
              ) : (
                <p className="text-sm text-slate-600 whitespace-pre-line">{doc.conteudo}</p>
              )}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );

  const abaExames = (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de exames" value={total} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Válidos" value={validos} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="A vencer" value={aVencer} hint={`em até ${JANELA_ALERTA_DIAS} dias`} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="Vencidos" value={vencidos} icon={<AlertTriangle className="h-5 w-5" />} accent={vencidos ? "red" : "green"} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Exames ocupacionais"
          subtitle="ASO e exames periódicos por colaborador"
          icon={<Stethoscope className="h-[18px] w-[18px]" />}
        />
        {exames.length === 0 ? (
          <CardBody>
            <EmptyState
              title="Nenhum exame ocupacional encontrado"
              description="ASO e exames periódicos dos colaboradores aparecerão aqui."
              icon={<Stethoscope className="h-8 w-8" />}
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th">Tipo</th>
                  <th className="th">Emissão</th>
                  <th className="th">Vencimento</th>
                  <th className="th text-right">Situação</th>
                </tr>
              </thead>
              <tbody>
                {exames.map((doc) => {
                  const situacao = situacaoDoc(doc.dataVencimento);
                  return (
                    <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="td font-medium text-slate-700">{d.nomeColab(doc.colaboradorId)}</td>
                      <td className="td text-slate-600">{doc.categoria}</td>
                      <td className="td tabular-nums text-slate-600">{formatDate(doc.dataEmissao)}</td>
                      <td className="td tabular-nums text-slate-600">{formatDate(doc.dataVencimento)}</td>
                      <td className="td text-right">
                        <Badge variant={VARIANTE_SITUACAO[situacao]}>{situacao}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Saúde e Segurança (SST)"
        description="ASO, exames ocupacionais, PGR e PCMSO."
      />

      <Tabs
        abas={[
          { id: "programas", label: "Programas (NR)", icon: <ShieldCheck className="h-4 w-4" />, conteudo: abaProgramas },
          { id: "exames", label: "Exames ocupacionais", icon: <HardHat className="h-4 w-4" />, conteudo: abaExames },
        ]}
      />
    </div>
  );
}
