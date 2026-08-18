/* TESTE DE DIAS ANTES DA CONTRATAÇÃO.
 *
 * A empresa traz a pessoa por alguns dias antes de decidir. Até agora isso não
 * ficava em lugar nenhum: se desse certo, a contratação começava do zero; se não
 * desse, não sobrava nada — nem o nome, nem o motivo, nem a prova de que a
 * pessoa esteve lá e foi paga.
 *
 * O registro mora no CANDIDATO, não no colaborador: quem faz teste ainda não é
 * funcionário, e criar cadastro de colaborador para ele inventaria gente que
 * nunca foi contratada — com reflexo no headcount, na folha e nos alertas.
 *
 * SOBRE OS "5 DIAS": a tela conta os dias e avisa quando passa do limite, mas
 * não afirma que o teste é permitido — isso um sistema não deve carimbar. O que
 * a lei traz (CLT art. 29) é o prazo de cinco dias ÚTEIS para anotar a carteira
 * depois da admissão, que é de onde o número vem. Por isso a contagem é em dias
 * úteis, e por isso o PAGAMENTO é campo de destaque: se um dia alguém
 * questionar, o que protege a empresa é o registro mostrando que a pessoa esteve
 * lá e recebeu.
 */
import { useMemo, useState } from "react";
import { UserCheck, Plus, Pencil, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea, Toggle } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio, noQuadro } from "@/lib/dominio";
import { formatDate, formatBRL, diaLocalISO } from "@/lib/format";
import { valorDigitado } from "@/lib/pontoFolha";
import {
  avisoDoTeste, pendenciasDoTeste, LIMITE_DIAS_TESTE, type ResultadoTeste,
} from "@/lib/selecao";
import { HOJE } from "@/data/_gen";
import type { Candidato } from "@/data/types";

/** Tem teste quem tem pelo menos o primeiro dia marcado. */
const temTeste = (c: Candidato) => !!c.testeInicio;

export function PainelTeste({ podeEditar }: { podeEditar: boolean }) {
  const { items: candidatos, criar, atualizar } = useColecao("candidatos");
  const d = useDominio();
  const toast = useToast();
  const [editando, setEditando] = useState<Candidato | "novo" | null>(null);

  const lista = useMemo(
    () => (candidatos as Candidato[])
      .filter(temTeste)
      .sort((a, b) => (b.testeInicio ?? "").localeCompare(a.testeInicio ?? "")),
    [candidatos],
  );

  const emAndamento = lista.filter((c) => !c.testeFim).length;
  const aprovados = lista.filter((c) => c.testeResultado === "Aprovado").length;
  const pendentes = lista.filter((c) => pendenciasDoTeste(c).length > 0).length;

  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Em teste agora" value={emAndamento} icon={<Clock className="h-5 w-5" />} accent="amber" hint="Sem último dia marcado" />
        <StatCard label="Aprovados" value={aprovados} icon={<CheckCircle2 className="h-5 w-5" />} accent="brand" hint="Seguiram para contratação" />
        <StatCard label="Registros incompletos" value={pendentes} icon={<AlertTriangle className="h-5 w-5" />} accent="gold" hint="Falta fechar ou confirmar pagamento" />
      </div>

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm text-slate-500">
            Quem passou pela empresa em teste antes da contratação — inclusive quem <b>não</b> foi contratado.
          </p>
          {podeEditar && (
            <button className="btn-primary" onClick={() => setEditando("novo")}>
              <Plus className="h-4 w-4" /> Registrar teste
            </button>
          )}
        </CardBody>
      </Card>

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum teste registrado"
          description="Registre aqui quem vem passar alguns dias antes da contratação. Fica o nome, os dias, o setor, quem acompanhou, o parecer e o pagamento."
          icon={<UserCheck className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-2">
          {lista.map((c) => {
            const aviso = avisoDoTeste(c);
            const faltando = pendenciasDoTeste(c);
            return (
              <Card key={c.id}>
                <CardBody className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{c.nome}</p>
                      <p className="truncate text-xs text-slate-400">
                        {c.testeInicio ? formatDate(c.testeInicio) : "—"}
                        {c.testeFim ? ` a ${formatDate(c.testeFim)}` : " · em andamento"}
                        {c.testeAreaId ? ` · ${d.nomeArea(c.testeAreaId)}` : ""}
                        {c.testeAvaliadorId ? ` · acompanhou: ${d.nomeColab(c.testeAvaliadorId)}` : ""}
                      </p>
                    </div>
                    {c.testeResultado === "Aprovado" && <Badge variant="success">Aprovado</Badge>}
                    {c.testeResultado === "Não aprovado" && <Badge variant="neutral">Não aprovado</Badge>}
                    {!c.testeResultado && <Badge variant="warning">Sem resultado</Badge>}
                    {c.testePago
                      ? <Badge variant="success">Pago{c.testeValorPago ? ` · ${formatBRL(c.testeValorPago)}` : ""}</Badge>
                      : <Badge variant="danger">Pagamento não confirmado</Badge>}
                    {podeEditar && (
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" title="Editar registro" onClick={() => setEditando(c)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {aviso.nivel === "aviso" && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{aviso.texto}</p>
                  )}
                  {faltando.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">Falta: {faltando.join(" · ")}.</p>
                  )}
                  {c.testeParecer && (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{c.testeParecer}</p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {editando && (
        <TesteModal
          cand={editando === "novo" ? null : editando}
          d={d}
          onFechar={() => setEditando(null)}
          onSalvar={(dados) => {
            if (editando === "novo") {
              criar({ ...dados, etapa: "Teste", criadoEm: new Date().toISOString() });
              toast(`Teste de ${String(dados.nome ?? "").split(" ")[0]} registrado.`);
            } else {
              atualizar(editando.id, dados);
              toast("Registro do teste atualizado.");
            }
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function TesteModal({
  cand, d, onFechar, onSalvar,
}: {
  cand: Candidato | null;
  d: ReturnType<typeof useDominio>;
  onFechar: () => void;
  onSalvar: (dados: Partial<Candidato>) => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(cand?.nome ?? "");
  const [telefone, setTelefone] = useState(cand?.telefone ?? "");
  const [inicio, setInicio] = useState(cand?.testeInicio ?? diaLocalISO(HOJE));
  const [fim, setFim] = useState(cand?.testeFim ?? "");
  const [areaId, setAreaId] = useState(cand?.testeAreaId ?? "");
  const [avaliadorId, setAvaliadorId] = useState(cand?.testeAvaliadorId ?? "");
  const [resultado, setResultado] = useState<ResultadoTeste | "">(cand?.testeResultado ?? "");
  const [parecer, setParecer] = useState(cand?.testeParecer ?? "");
  const [pago, setPago] = useState(!!cand?.testePago);
  const [valor, setValor] = useState(cand?.testeValorPago != null ? String(cand.testeValorPago) : "");

  const aviso = avisoDoTeste({ testeInicio: inicio, testeFim: fim || null });

  // Quem pode acompanhar: gente do quadro, fora a direção.
  const avaliadores = useMemo(
    () => d.colaboradores.filter((c) => !c.ehDirecao && noQuadro(c)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [d.colaboradores],
  );

  const salvar = () => {
    if (!nome.trim()) return toast("Informe o nome de quem fez o teste.", "erro");
    // Erro trava; aviso de limite não — ver avisoDoTeste.
    if (aviso.nivel === "erro") return toast(aviso.texto, "erro");
    onSalvar({
      nome: nome.trim(),
      telefone: telefone.trim() || undefined,
      testeInicio: inicio || null,
      testeFim: fim || null,
      testeAreaId: areaId || null,
      testeAvaliadorId: avaliadorId || null,
      testeResultado: resultado || null,
      testeParecer: parecer.trim() || null,
      testePago: pago,
      testeValorPago: pago && valor.trim() ? valorDigitado(valor) : null,
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={cand ? "Editar registro do teste" : "Registrar teste"}
      descricao={`Dias de teste antes da contratação. O limite adotado é de ${LIMITE_DIAS_TESTE} dias úteis.`}
      largura="max-w-lg"
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome" obrigatorio><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Campo>
          <Campo label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Campo>
          <Campo label="Primeiro dia" obrigatorio><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
          <Campo label="Último dia" hint="Em branco = ainda está em teste"><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
        </div>

        {aviso.texto && (
          <p className={
            aviso.nivel === "erro" ? "text-xs text-red-600"
              : aviso.nivel === "aviso" ? "rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800"
                : "text-xs text-slate-500"
          }>
            {aviso.texto}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Setor onde ficou">
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Não informado</option>
              {d.areas.filter((a) => a.id !== "direcao").map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Campo>
          <Campo label="Quem acompanhou">
            <Select value={avaliadorId} onChange={(e) => setAvaliadorId(e.target.value)}>
              <option value="">Não informado</option>
              {avaliadores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Campo>
        </div>

        <Campo label="Resultado">
          <Select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoTeste | "")}>
            <option value="">Ainda não decidido</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Não aprovado">Não aprovado</option>
          </Select>
        </Campo>

        <Campo
          label="Parecer de quem acompanhou"
          hint={resultado === "Não aprovado" ? "Obrigatório na prática: sem o motivo escrito, daqui a seis meses ninguém sabe o que houve." : "O que a pessoa mostrou nos dias de teste."}
        >
          <Textarea rows={3} value={parecer} onChange={(e) => setParecer(e.target.value)} placeholder="Ex.: pegou o corte no laser rápido, mas faltou no terceiro dia sem avisar." />
        </Campo>

        {/* O pagamento fica em destaque, com moldura própria: é o registro que
            protege a empresa se algum dia esses dias forem questionados. */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <Toggle checked={pago} onChange={setPago} label="Os dias de teste foram pagos" />
          {pago && (
            <div className="mt-2">
              <Campo label="Valor pago (R$)">
                <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </Campo>
            </div>
          )}
          {!pago && (
            <p className="mt-1.5 text-xs text-amber-700">
              Sem esta confirmação, o registro mostra alguém trabalhando sem receber — que é o pior dos dois mundos se for questionado depois.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
