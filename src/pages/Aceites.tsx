import { useMemo, useState } from "react";
import { FileSignature, ShieldCheck, CheckCircle2, Target, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Campo, Input } from "@/components/ui/form";
import { RichContent } from "@/components/ui/rich";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { formatDate, formatDateLong } from "@/lib/format";
import type { Aceite, Colaborador, DocumentoInstitucional } from "@/data/types";

const TIPO_ETICA = "Código de Ética";
const TIPO_PDI = "PDI";

export default function Aceites() {
  const sessao = useSessao();
  const d = useDominio();
  const c = sessao ? d.colabById.get(sessao.colaboradorId) : undefined;

  if (!c) {
    return (
      <EmptyState
        title="Aceites indisponíveis"
        description="Não foi possível localizar os dados do seu cadastro."
        icon={<FileSignature className="h-8 w-8" />}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Termos e Aceites"
        description="Aceite eletrônico do Código de Ética e ciência dos seus planos de desenvolvimento."
      />

      <MeusTermos c={c} />

      {ehRH(sessao) && <AcompanhamentoCard />}
    </div>
  );
}

// Cards de aceite do próprio colaborador (reusado na aba "Termos" de Meu Perfil).
export function MeusTermos({ c }: { c: Colaborador }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CodigoEticaCard c={c} />
      <CienciaPdiCard c={c} />
    </div>
  );
}

function CodigoEticaCard({ c }: { c: Colaborador }) {
  const toast = useToast();
  const { items: institucionais } = useColecao("institucionais");
  const { items: aceites, criar } = useColecao("aceites");
  const [nome, setNome] = useState("");
  const [concordo, setConcordo] = useState(false);

  const doc: DocumentoInstitucional | undefined = useMemo(
    () =>
      institucionais.find((x) => x.id === "codigo-etica") ??
      institucionais.find((x) => x.categoria === TIPO_ETICA),
    [institucionais],
  );

  const aceite = aceites.find((a) => a.colaboradorId === c.id && a.tipo === TIPO_ETICA);

  const registrar = () => {
    if (!doc) return;
    if (!concordo) return toast("Marque a opção “Li e concordo” para continuar.", "erro");
    if (!nome.trim()) return toast("Digite seu nome completo para confirmar o aceite.", "erro");
    criar({
      colaboradorId: c.id,
      tipo: TIPO_ETICA,
      versao: doc.versao,
      nomeConfirmado: nome.trim(),
      criadoEm: new Date().toISOString(),
    });
    toast("Aceite do Código de Ética registrado.");
    setNome("");
    setConcordo(false);
  };

  return (
    <Card>
      <CardHeader
        title={doc?.titulo ?? "Código de Ética e Conduta"}
        subtitle={doc?.versao ? `Versão ${doc.versao}` : "Documento institucional"}
        icon={<FileSignature className="h-[18px] w-[18px]" />}
        action={aceite ? <Badge variant="success"><CheckCircle2 className="h-3.5 w-3.5" /> Aceito</Badge> : undefined}
      />
      <CardBody className="space-y-4">
        {doc?.blocos && doc.blocos.length > 0 ? (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/40 p-4">
            <RichContent blocos={doc.blocos} />
          </div>
        ) : (
          <EmptyState title="Documento indisponível" description="O Código de Ética ainda não foi publicado." />
        )}

        {aceite ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <p className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Aceito em {formatDateLong(aceite.criadoEm)}
            </p>
            <p className="mt-1 text-xs text-green-700/80">
              Confirmado por {aceite.nomeConfirmado ?? c.nome}
              {aceite.versao ? ` · versão ${aceite.versao}` : ""}.
            </p>
          </div>
        ) : doc ? (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                checked={concordo}
                onChange={(e) => setConcordo(e.target.checked)}
              />
              <span>Li e concordo com o Código de Ética e Conduta da Impresilk.</span>
            </label>
            <Campo label="Nome completo (confirmação)" obrigatorio>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome completo" />
            </Campo>
            <button className="btn-primary w-full" onClick={registrar} disabled={!concordo || !nome.trim()}>
              <CheckCircle2 className="h-4 w-4" /> Registrar aceite
            </button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function CienciaPdiCard({ c }: { c: Colaborador }) {
  const toast = useToast();
  const { items: pdis } = useColecao("pdis");
  const { items: aceites, criar } = useColecao("aceites");
  const meusPdis = pdis.filter((p) => p.colaboradorId === c.id);

  const cienciaDe = (pdiId: string): Aceite | undefined =>
    aceites.find((a) => a.colaboradorId === c.id && a.tipo === TIPO_PDI && a.referencia === pdiId);

  const darCiencia = (pdiId: string) => {
    criar({
      colaboradorId: c.id,
      tipo: TIPO_PDI,
      referencia: pdiId,
      criadoEm: new Date().toISOString(),
    });
    toast("Ciência do PDI registrada.");
  };

  return (
    <Card>
      <CardHeader
        title="Ciência de PDI"
        subtitle="Confirme que tomou ciência de cada Plano de Desenvolvimento Individual."
        icon={<Target className="h-[18px] w-[18px]" />}
      />
      <CardBody>
        {meusPdis.length === 0 ? (
          <EmptyState title="Nenhum PDI atribuído" description="Você ainda não possui planos de desenvolvimento." icon={<Target className="h-8 w-8" />} />
        ) : (
          <div className="space-y-3">
            {meusPdis.map((p) => {
              const ciente = cienciaDe(p.id);
              return (
                <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{p.competencia}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{p.acao}{p.resultadoEsperado ? ` → ${p.resultadoEsperado}` : ""}</p>
                  </div>
                  {ciente ? (
                    <Badge variant="success" className="shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Ciente em {formatDate(ciente.criadoEm)}
                    </Badge>
                  ) : (
                    <button className="btn-outline shrink-0" onClick={() => darCiencia(p.id)}>
                      Dar ciência
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function AcompanhamentoCard() {
  const d = useDominio();
  const { items: aceites } = useColecao("aceites");

  const linhas = useMemo(() => {
    const colabs = d.colaboradores
      .filter((c) => !c.ehDirecao)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return colabs.map((c) => ({
      colab: c,
      aceite: aceites.find((a) => a.colaboradorId === c.id && a.tipo === TIPO_ETICA),
    }));
  }, [d.colaboradores, aceites]);

  const aceitos = linhas.filter((l) => l.aceite).length;

  return (
    <Card className="mt-6">
      <CardHeader
        title="Acompanhamento de aceites"
        subtitle={`${aceitos} de ${linhas.length} colaboradores aceitaram o Código de Ética.`}
        icon={<ShieldCheck className="h-[18px] w-[18px]" />}
        action={<Badge variant={aceitos === linhas.length ? "success" : "warning"}><ClipboardCheck className="h-3.5 w-3.5" /> {aceitos}/{linhas.length}</Badge>}
      />
      <CardBody>
        {linhas.length === 0 ? (
          <EmptyState title="Sem colaboradores" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th">Área</th>
                  <th className="th">Código de Ética</th>
                  <th className="th">Aceito em</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ colab, aceite }) => (
                  <tr key={colab.id} className="border-t border-slate-100">
                    <td className="td font-medium text-slate-700">{colab.nome}</td>
                    <td className="td text-slate-500">{d.nomeArea(colab.areaId)}</td>
                    <td className="td">
                      <Badge variant={aceite ? "success" : "warning"}>{aceite ? "Sim" : "Pendente"}</Badge>
                    </td>
                    <td className="td text-slate-500">{aceite ? formatDate(aceite.criadoEm) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
