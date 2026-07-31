import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { HardHat, ShieldCheck, FileText, Stethoscope, CheckCircle2, Clock, AlertTriangle, Award, Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
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
  const toast = useToast();
  const gere = podeGerir(sessao);
  const { items: institucionais } = useColecao("institucionais");
  const { items: documentos, atualizar: atualizarDoc, remover: removerDoc } = useColecao("documentos");
  // Corrigir/apagar exame: um ASO com data errada ficava para sempre na lista.
  const [editarExame, setEditarExame] = useState<(typeof documentos)[number] | null>(null);
  const [apagarExame, setApagarExame] = useState<(typeof documentos)[number] | null>(null);

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

  // Os 4 números saem da mesma tabela abaixo, então clicar filtra em vez de abrir outra tela.
  const [focoExame, setFocoExame] = useState<Situacao | null>(null);
  const alternarFoco = (s: Situacao) => setFocoExame((atual) => (atual === s ? null : s));
  const examesVisiveis = useMemo(
    () => (focoExame ? exames.filter((doc) => situacaoDoc(doc.dataVencimento) === focoExame) : exames),
    [exames, focoExame],
  );

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
        <StatCard label="Total de exames" value={total} icon={<FileText className="h-5 w-5" />} accent="brand" onClick={() => setFocoExame(null)} ativo={focoExame === null} title="Mostrar todos os exames" />
        <StatCard label="Válidos" value={validos} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" onClick={() => alternarFoco("Válido")} ativo={focoExame === "Válido"} title="Ver só os exames válidos" />
        <StatCard label="A vencer" value={aVencer} hint={`em até ${JANELA_ALERTA_DIAS} dias`} icon={<Clock className="h-5 w-5" />} accent="amber" onClick={() => alternarFoco("A vencer")} ativo={focoExame === "A vencer"} title="Ver só os exames a vencer" />
        <StatCard label="Vencidos" value={vencidos} icon={<AlertTriangle className="h-5 w-5" />} accent={vencidos ? "red" : "green"} onClick={() => alternarFoco("Vencido")} ativo={focoExame === "Vencido"} title="Ver só os exames vencidos" />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Exames ocupacionais"
          subtitle="ASO e exames periódicos por colaborador"
          icon={<Stethoscope className="h-[18px] w-[18px]" />}
        />
        {examesVisiveis.length === 0 ? (
          <CardBody>
            {/* Card de valor zero também é clicável: sem avisar que o vazio é do filtro,
                a tela afirmaria que não há exame nenhum com a tabela cheia por trás. */}
            <EmptyState
              title={focoExame ? "Nenhum exame neste filtro" : "Nenhum exame ocupacional encontrado"}
              description={focoExame ? "Clique de novo no cartão para ver todos os exames." : "ASO e exames periódicos dos colaboradores aparecerão aqui."}
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
                  {gere && <th className="th" />}
                </tr>
              </thead>
              <tbody>
                {examesVisiveis.map((doc) => {
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
                      {/* Antes só dava para ADICIONAR exame (pela ficha do
                          colaborador): um ASO lançado com data errada ficava para
                          sempre na tela, e vencido ainda por cima. */}
                      {gere && (
                        <td className="td text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="btn-ghost p-1.5 text-slate-400 hover:text-brand"
                              title="Corrigir datas deste exame"
                              onClick={() => setEditarExame(doc)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
                              title="Apagar este exame"
                              onClick={() => setApagarExame(doc)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
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

      {editarExame && (
        <ModalEditarExame
          doc={editarExame}
          nome={d.nomeColab(editarExame.colaboradorId)}
          onFechar={() => setEditarExame(null)}
          onSalvar={(patch) => {
            atualizarDoc(editarExame.id, patch);
            toast("Exame atualizado.");
          }}
        />
      )}

      {/* Apagar exame pede confirmação: some da ficha do colaborador também. */}
      <ConfirmDialog
        aberto={!!apagarExame}
        onFechar={() => setApagarExame(null)}
        onConfirmar={() => {
          if (apagarExame) {
            removerDoc(apagarExame.id);
            toast("Exame apagado.");
          }
          setApagarExame(null);
        }}
        titulo="Apagar exame?"
        mensagem={
          apagarExame
            ? `${apagarExame.categoria} de ${d.nomeColab(apagarExame.colaboradorId)}${apagarExame.dataVencimento ? ` (vence ${formatDate(apagarExame.dataVencimento)})` : ""} será removido daqui e da ficha do colaborador. Não dá para desfazer.`
            : ""
        }
      />
    </div>
  );
}

// Corrigir um exame já lançado: tipo e datas. O anexo (quando existe) não é
// tocado aqui — para trocar o arquivo, use a ficha do colaborador.
function ModalEditarExame({
  doc, nome, onSalvar, onFechar,
}: {
  doc: { id: string; categoria: string; dataEmissao?: string | null; dataVencimento?: string | null };
  nome: string;
  onSalvar: (patch: { categoria: string; dataEmissao: string | null; dataVencimento: string | null }) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [categoria, setCategoria] = useState(doc.categoria);
  const [emissao, setEmissao] = useState((doc.dataEmissao ?? "").slice(0, 10));
  const [vencimento, setVencimento] = useState((doc.dataVencimento ?? "").slice(0, 10));

  const salvar = () => {
    // Vencimento antes da emissão quase sempre é dedo trocado — e deixaria o
    // exame nascer "vencido" na lista.
    if (emissao && vencimento && vencimento < emissao) {
      toast("O vencimento não pode ser antes da emissão.", "erro");
      return;
    }
    onSalvar({ categoria, dataEmissao: emissao || null, dataVencimento: vencimento || null });
    onFechar();
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Corrigir exame"
      descricao={nome}
      largura="max-w-md"
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}><CheckCircle2 className="h-4 w-4" /> Salvar</button></>}
    >
      <div className="space-y-3">
        <Campo label="Tipo">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS_SST.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Emissão"><Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} /></Campo>
          <Campo label="Vencimento"><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Campo>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Certificações de NR por colaborador (quem tem o quê + validade) ----------
function AbaCertificacoesNR() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items, criar, atualizar, remover } = useColecao("certificacoesNr");
  const gere = podeGerir(sessao);
  const FORM_VAZIO = { colaboradorId: "", nr: CATALOGO_NR[0].codigo, dataTreinamento: "", cargaHoraria: "", instituicao: "" };
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
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

  // Os números vêm da mesma listagem de NRs logo abaixo, então clicar filtra a listagem.
  const [foco, setFoco] = useState<Situacao | null>(null);
  const alternarFoco = (s: Situacao) => setFoco((atual) => (atual === s ? null : s));
  const certsVisiveis = useMemo(
    () => (foco ? certs.filter((c) => situacaoDoc(c.dataValidade) === foco) : certs),
    [certs, foco],
  );

  // Agrupa por NR (na ordem do catálogo), do vencimento mais próximo ao mais distante.
  const porNR = useMemo(() => {
    const m = new Map<string, typeof certs>();
    for (const c of certsVisiveis) { const arr = m.get(c.nr) ?? []; arr.push(c); m.set(c.nr, arr); }
    const ord = (s?: string | null) => { const dd = dias(s); return isNaN(dd) ? Number.POSITIVE_INFINITY : dd; };
    return CATALOGO_NR.filter((nr) => m.has(nr.codigo)).map((nr) => ({
      nr,
      itens: (m.get(nr.codigo) ?? []).slice().sort((a, b) => ord(a.dataValidade) - ord(b.dataValidade)),
    }));
  }, [certsVisiveis]);

  const abrirNovo = () => {
    setEditId(null);
    setForm(FORM_VAZIO);
    setNovo(true);
  };

  const abrirEdicao = (c: (typeof items)[number]) => {
    setEditId(c.id);
    setForm({
      colaboradorId: c.colaboradorId,
      nr: c.nr,
      dataTreinamento: c.dataTreinamento ?? "",
      cargaHoraria: c.cargaHoraria != null ? String(c.cargaHoraria) : "",
      instituicao: c.instituicao ?? "",
    });
    setNovo(true);
  };

  const fecharModal = () => {
    setNovo(false);
    setEditId(null);
    setForm(FORM_VAZIO);
  };

  const salvar = () => {
    if (!form.colaboradorId || !form.dataTreinamento) { toast("Selecione o colaborador e a data do treinamento.", "erro"); return; }
    const payload = {
      colaboradorId: form.colaboradorId,
      nr: form.nr,
      dataTreinamento: form.dataTreinamento,
      dataValidade: calcularValidadeNR(form.dataTreinamento, form.nr),
      cargaHoraria: form.cargaHoraria ? Number(form.cargaHoraria) : undefined,
      instituicao: form.instituicao.trim() || undefined,
    };
    if (editId) {
      atualizar(editId, payload);
      toast(`Certificação ${form.nr} atualizada para ${d.nomeColab(form.colaboradorId)}.`);
    } else {
      criar(payload);
      toast(`Certificação ${form.nr} registrada para ${d.nomeColab(form.colaboradorId)}.`);
    }
    fecharModal();
  };

  const validadePrevista = form.dataTreinamento ? calcularValidadeNR(form.dataTreinamento, form.nr) : null;

  // Veio do aviso "NR vencida" na ficha do colaborador (navigate com state):
  // abre direto a renovação daquela certificação em vez de largar o usuário na
  // lista para procurar a linha.
  const { state } = useLocation() as { state?: { renovarNr?: string } };
  const pedidoNr = state?.renovarNr;
  useEffect(() => {
    if (!pedidoNr || !gere) return;
    const alvo = items.find((x) => x.id === pedidoNr);
    if (alvo) abrirEdicao(alvo);
    // Limpa o state para um F5 não reabrir o modal.
    window.history.replaceState({}, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoNr]);

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Certificações" value={total} icon={<Award className="h-5 w-5" />} accent="brand" onClick={() => setFoco(null)} ativo={foco === null} title="Mostrar todas as certificações" />
        <StatCard label="Válidas" value={validas} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" onClick={() => alternarFoco("Válido")} ativo={foco === "Válido"} title="Ver só as certificações válidas" />
        <StatCard label="A vencer" value={aVencer} hint={`em até ${JANELA_ALERTA_DIAS} dias`} icon={<Clock className="h-5 w-5" />} accent="amber" onClick={() => alternarFoco("A vencer")} ativo={foco === "A vencer"} title="Ver só as certificações a vencer" />
        <StatCard label="Vencidas" value={vencidas} icon={<AlertTriangle className="h-5 w-5" />} accent={vencidas ? "red" : "green"} onClick={() => alternarFoco("Vencido")} ativo={foco === "Vencido"} title="Ver só as certificações vencidas" />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="NRs por colaborador"
          subtitle="Quem está apto a cada Norma Regulamentadora e o vencimento do treinamento"
          icon={<Award className="h-[18px] w-[18px]" />}
          action={gere ? <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={abrirNovo}><Plus className="h-4 w-4" /> Registrar NR</button> : undefined}
        />
        <CardBody className="space-y-5">
          {porNR.length === 0 ? (
            /* Clicar no card "A vencer" com 0 esvazia a listagem: sem este aviso a tela
               dizia que não havia NR cadastrada e escondia as certificações vencidas. */
            <EmptyState
              title={foco ? "Nenhuma certificação neste filtro" : "Nenhuma certificação registrada"}
              description={foco ? "Clique de novo no cartão para ver todas as certificações." : "Cadastre quais colaboradores fizeram cada NR e a validade."}
              icon={<Award className="h-8 w-8" />}
            />
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
                          <Avatar nome={d.nomeColab(c.colaboradorId)} foto={d.fotoColab(c.colaboradorId)} size="sm" />
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
                            <>
                              <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" onClick={() => abrirEdicao(c)} aria-label="Editar">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => { remover(c.id); toast("Certificação removida."); }} aria-label="Remover">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
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
          onFechar={fecharModal}
          titulo={editId ? "Editar certificação de NR" : "Registrar certificação de NR"}
          descricao="Vincula uma NR a um colaborador; a validade é calculada automaticamente."
          rodape={
            <>
              <button className="btn-outline" onClick={fecharModal}>Cancelar</button>
              <button className="btn-primary" onClick={salvar}>{editId ? <><Pencil className="h-4 w-4" /> Salvar</> : <><Plus className="h-4 w-4" /> Salvar</>}</button>
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
