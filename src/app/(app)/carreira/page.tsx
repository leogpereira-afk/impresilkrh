import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERFIS, MAPA_SENIORIDADE } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, EmptyState } from "@/components/ui/misc";
import { formatBRL } from "@/lib/format";
import { SimuladorProgressao } from "@/components/carreira/simulador";
import { GitBranch, Layers, TrendingUp, Award } from "lucide-react";

export default async function CarreiraPage() {
  const sessao = await exigirSessao();

  const [niveis, cargos] = await Promise.all([
    db.nivel.findMany({ orderBy: { ordem: "asc" } }),
    db.cargo.findMany({
      include: {
        area: true,
        faixas: { include: { nivel: true }, orderBy: { nivel: { ordem: "asc" } } },
      },
      orderBy: [{ area: { nome: "asc" } }, { nome: "asc" }],
    }),
  ]);

  // Dados do colaborador logado (para destaque e simulador)
  let meu: Awaited<ReturnType<typeof carregarMeuColaborador>> = null;
  if (sessao.colaboradorId) {
    meu = await carregarMeuColaborador(sessao.colaboradorId);
  }

  const cargosSim = cargos
    .filter((c) => c.faixas.length > 0)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      trilha: c.trilha,
      faixas: c.faixas.map((f) => ({
        codigo: f.nivel.codigo,
        senioridade: f.nivel.senioridade,
        ordem: f.nivel.ordem,
        valor: f.valor,
      })),
    }));

  // Agrupa cargos por área
  const porArea = new Map<string, typeof cargos>();
  for (const c of cargos) {
    const a = c.area.nome;
    if (!porArea.has(a)) porArea.set(a, []);
    porArea.get(a)!.push(c);
  }

  return (
    <>
      <PageHeader
        title="Carreira e Salários"
        description="Plano de cargos, régua de senioridade e faixas salariais"
      />

      {/* Régua de senioridade */}
      <Card className="mb-6">
        <CardHeader
          title="Régua de senioridade"
          subtitle="Trilha de evolução técnica e de carreira"
          icon={<Layers className="h-4 w-4" />}
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {niveis.map((n, i) => (
              <div
                key={n.id}
                className="relative rounded-xl border border-slate-200 p-4 text-center"
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {n.codigo}
                </div>
                <p className="text-sm font-semibold text-slate-800">{n.senioridade}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {MAPA_SENIORIDADE[n.codigo] ?? n.nome}
                </p>
                {i < niveis.length - 1 && (
                  <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-slate-300 lg:block">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Minha posição (se colaborador) */}
      {meu && (
        <Card className="mb-6 border-gold-200 bg-gold-50/40">
          <CardHeader
            title="Minha posição na carreira"
            icon={<Award className="h-4 w-4" />}
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Cargo" value={meu.cargo?.nome} />
              <Field
                label="Nível atual"
                value={meu.nivel ? `${meu.nivel.codigo} · ${meu.nivel.senioridade}` : "—"}
              />
              <Field label="Salário atual" value={formatBRL(meu.salario)} />
              <Field
                label="Próximo nível"
                value={
                  meu.proximoNivelSugerido ? (
                    <Badge variant="gold">{meu.proximoNivelSugerido}</Badge>
                  ) : "—"
                }
              />
            </dl>
            {meu.gapProximoNivel != null && meu.gapProximoNivel > 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <TrendingUp className="h-4 w-4 text-gold-600" />
                Faltam <strong className="text-brand-ink">{formatBRL(meu.gapProximoNivel)}</strong> para
                atingir o alvo do próximo nível ({formatBRL(meu.salarioAlvoProximo)}).
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Simulador */}
      {cargosSim.length > 0 && (
        <div className="mb-6">
          <SimuladorProgressao
            cargos={cargosSim}
            cargoInicialId={meu?.cargoId ?? undefined}
            nivelInicialCodigo={meu?.nivel?.codigo}
          />
        </div>
      )}

      {/* Tabela de faixas por área */}
      <PageHeader title="Tabela salarial por cargo" className="mb-4" />
      {[...porArea.entries()].map(([area, lista]) => (
        <Card key={area} className="mb-4">
          <CardHeader title={area} icon={<GitBranch className="h-4 w-4" />} />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="th">Cargo</th>
                  {niveis.map((n) => (
                    <th key={n.id} className="th text-right">{n.codigo}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((c) => {
                  const mapa = new Map(c.faixas.map((f) => [f.nivel.codigo, f.valor]));
                  const ehMeuCargo = meu?.cargoId === c.id;
                  return (
                    <tr key={c.id} className={ehMeuCargo ? "bg-gold-50/50" : "hover:bg-slate-50/60"}>
                      <td className="td font-medium text-slate-800">
                        {c.nome}
                        {ehMeuCargo && <Badge variant="gold" className="ml-2">Você</Badge>}
                      </td>
                      {niveis.map((n) => {
                        const v = mapa.get(n.codigo);
                        const ehMeuNivel = ehMeuCargo && meu?.nivel?.codigo === n.codigo;
                        return (
                          <td
                            key={n.id}
                            className={`td text-right tabular-nums ${ehMeuNivel ? "font-bold text-brand" : "text-slate-600"}`}
                          >
                            {v != null ? formatBRL(v) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}

      {cargos.length === 0 && <EmptyState title="Nenhum cargo cadastrado" />}
    </>
  );
}

async function carregarMeuColaborador(id: string) {
  return db.colaborador.findUnique({
    where: { id },
    include: { cargo: true, nivel: true },
  });
}
