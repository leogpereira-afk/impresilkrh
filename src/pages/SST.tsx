import { useMemo, useState } from "react";
import { HardHat, ShieldCheck, FileText, Stethoscope, CheckCircle2, Clock, AlertTriangle, Award, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { RichContent } from "@/components/ui/rich";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, parseData } from "@/lib/format";
import { CATEGORIAS_SST, JANELA_ALERTA_DIAS } from "@/lib/constants";
import { CATALOGO_NR, nomeNR, calcularValidadeNR } from "@/data/nrs";
import { HOJE } from "@/data/_gen";

const dias = (d?: string | null) => { const dt = parseData(d); return dt ? Math.round((dt.getTime() - HOJE.getTime()) / 86400000) : NaN; };

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
          { id: "certificacoes", label: "Certificações NR", icon: <Award className="h-4 w-4" />, conteudo: <AbaCertificacoesNR /> },
          { id: "programas", label: "Programas (NR)", icon: <ShieldCheck className="h-4 w-4" />, conteudo: abaProgramas },
          { id: "exames", label: "Exames ocupacionais", icon: <HardHat className="h-4 w-4" />, conteudo: abaExames },
        ]}
      />
    </div>
  );
}

// ---------- Certificações de NR por colaborador (quem tem o quê + validade) ----------
function AbaCertificacoesNR() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items, criar, remover } = useColecao("certificacoesNr");
  const gere = podeGerir(sessao);
  const FORM_VAZIO = { colaboradorId: "", nr: CATALOGO_NR[0].codigo, dataTreinamento: "", cargaHoraria: "", instituicao: "" };
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);

  const escopo = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores).filter((c) => c.statusId !== "inativo"),
    [sessao, d.colaboradores],
  );
  const idsVisiveis = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);
  const certs = useMemo(() => items.filter((c) => idsVisiveis.has(c.colaboradorId)), [items, idsVisiveis]);

  const total = certs.length;
  const vencidas = certs.filter((c) => situacaoDoc(c.dataValidade) === "Vencido").length;
  const aVencer = certs.filter((c) => situacaoDoc(c.dataValidade) === "A vencer").length;
  const validas = total - vencidas - aVencer;

  // Agrupa por NR (na ordem do catálogo), do vencimento mais próximo ao mais distante.
  const porNR = useMemo(() => {
    const m = new Map<string, typeof certs>();
    for (const c of certs) { const arr = m.get(c.nr) ?? []; arr.push(c); m.set(c.nr, arr); }
    const ord = (s?: string | null) => { const dd = dias(s); return isNaN(dd) ? Number.POSITIVE_INFINITY : dd; };
    return CATALOGO_NR.filter((nr) => m.has(nr.codigo)).map((nr) => ({
      nr,
      itens: (m.get(nr.codigo) ?? []).slice().sort((a, b) => ord(a.dataValidade) - ord(b.dataValidade)),
    }));
  }, [certs]);

  const salvar = () => {
    if (!form.colaboradorId || !form.dataTreinamento) { toast("Selecione o colaborador e a data do treinamento.", "erro"); return; }
    criar({
      colaboradorId: form.colaboradorId,
      nr: form.nr,
      dataTreinamento: form.dataTreinamento,
      dataValidade: calcularValidadeNR(form.dataTreinamento, form.nr),
      cargaHoraria: form.cargaHoraria ? Number(form.cargaHoraria) : undefined,
      instituicao: form.instituicao.trim() || undefined,
    });
    toast(`Certificação ${form.nr} registrada para ${d.nomeColab(form.colaboradorId)}.`);
    setForm(FORM_VAZIO);
    setNovo(false);
  };

  const validadePrevista = form.dataTreinamento ? calcularValidadeNR(form.dataTreinamento, form.nr) : null;

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Certificações" value={total} icon={<Award className="h-5 w-5" />} accent="brand" />
        <StatCard label="Válidas" value={validas} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="A vencer" value={aVencer} hint={`em até ${JANELA_ALERTA_DIAS} dias`} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <StatCard label="Vencidas" value={vencidas} icon={<AlertTriangle className="h-5 w-5" />} accent={vencidas ? "red" : "green"} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="NRs por colaborador"
          subtitle="Quem está apto a cada Norma Regulamentadora e o vencimento do treinamento"
          icon={<Award className="h-[18px] w-[18px]" />}
          action={gere ? <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Registrar NR</button> : undefined}
        />
        <CardBody className="space-y-5">
          {porNR.length === 0 ? (
            <EmptyState title="Nenhuma certificação registrada" description="Cadastre quais colaboradores fizeram cada NR e a validade." icon={<Award className="h-8 w-8" />} />
          ) : (
            porNR.map(({ nr, itens }) => (
              <div key={nr.codigo} className="rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-brand-ink">{nr.codigo}</span>
                    <span className="ml-2 text-xs text-slate-500">{nr.nome}</span>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {itens.length} apto(s){nr.validadeMeses ? ` · validade ${nr.validadeMeses} meses` : " · sem validade fixa"}
                  </span>
                </div>
                <ul className="divide-y divide-slate-50">
                  {itens.map((c) => {
                    const sit = situacaoDoc(c.dataValidade);
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar nome={d.nomeColab(c.colaboradorId)} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-700">{d.nomeColab(c.colaboradorId)}</p>
                            <p className="text-xs text-slate-400">
                              Treinado em {formatDate(c.dataTreinamento)}
                              {c.dataValidade ? ` · vence ${formatDate(c.dataValidade)}` : " · sem validade fixa"}
                              {c.instituicao ? ` · ${c.instituicao}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={VARIANTE_SITUACAO[sit]}>{sit}</Badge>
                          {gere && (
                            <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => { remover(c.id); toast("Certificação removida."); }} aria-label="Remover">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {gere && (
        <Modal
          aberto={novo}
          onFechar={() => { setNovo(false); setForm(FORM_VAZIO); }}
          titulo="Registrar certificação de NR"
          descricao="Vincula uma NR a um colaborador; a validade é calculada automaticamente."
          rodape={
            <>
              <button className="btn-outline" onClick={() => { setNovo(false); setForm(FORM_VAZIO); }}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}><Plus className="h-4 w-4" /> Salvar</button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Colaborador" obrigatorio className="sm:col-span-2">
              <Select value={form.colaboradorId} onChange={(e) => setForm((f) => ({ ...f, colaboradorId: e.target.value }))}>
                <option value="">Selecione…</option>
                {escopo.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} · {d.nomeCargo(c)}</option>
                ))}
              </Select>
            </Campo>
            <Campo label="Norma (NR)" obrigatorio>
              <Select value={form.nr} onChange={(e) => setForm((f) => ({ ...f, nr: e.target.value }))}>
                {CATALOGO_NR.map((nr) => <option key={nr.codigo} value={nr.codigo}>{nr.codigo} — {nr.nome}</option>)}
              </Select>
            </Campo>
            <Campo label="Data do treinamento" obrigatorio>
              <Input type="date" value={form.dataTreinamento} onChange={(e) => setForm((f) => ({ ...f, dataTreinamento: e.target.value }))} />
            </Campo>
            <Campo label="Carga horária (h)">
              <Input type="number" min={0} value={form.cargaHoraria} onChange={(e) => setForm((f) => ({ ...f, cargaHoraria: e.target.value }))} placeholder="Ex.: 8" />
            </Campo>
            <Campo label="Instituição">
              <Input value={form.instituicao} onChange={(e) => setForm((f) => ({ ...f, instituicao: e.target.value }))} placeholder="Ex.: SENAI" />
            </Campo>
            <p className="text-xs text-slate-500 sm:col-span-2">
              {validadePrevista ? <>Validade prevista: <span className="font-medium text-slate-700">{formatDate(validadePrevista)}</span> ({nomeNR(form.nr)}).</> : "Esta NR não tem validade fixa (reciclagem conforme necessidade)."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
