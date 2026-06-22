import * as XLSX from "xlsx";
import { lerSessao } from "@/lib/session";
import { escopoColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { registrarAcesso } from "@/lib/lgpd";
import { PERFIS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao || sessao.perfil === PERFIS.COLABORADOR) {
    return new Response("Não autorizado", { status: 403 });
  }
  const escopo = await escopoColaboradores(sessao);
  const ciclo = await db.cicloAvaliacao.findFirst({
    where: { status: "Aberto" },
    orderBy: { dataInicio: "desc" },
  });
  if (!ciclo) return new Response("Nenhum ciclo aberto", { status: 404 });

  const avaliacoes = await db.avaliacao.findMany({
    where: { cicloId: ciclo.id, tipo: "GESTOR", colaborador: escopo },
    include: { colaborador: { include: { cargo: true, area: true } } },
    orderBy: { notaFinal: "desc" },
  });

  const linhas = avaliacoes.map((a) => ({
    Colaborador: a.colaborador.nome,
    Cargo: a.colaborador.cargo?.nome ?? "",
    Área: a.colaborador.area?.nome ?? "",
    Técnico: a.notaTecnico ?? "",
    Comportamental: a.notaComportamental ?? "",
    Resultados: a.notaResultado ?? "",
    "Nota final": a.notaFinal ?? "",
    Situação: a.statusDesempenho ?? "",
    "Tempo no nível (meses)": a.tempoNoNivelMeses ?? "",
    "Elegível a promoção": a.elegivelPromocao ? "Sim" : "Não",
    "Próximo nível": a.proximoNivel ?? "",
    Comentários: a.comentarios ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, ciclo.nome);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "EXPORTAR_AVALIACOES",
    recurso: "Avaliacao:Exportacao",
    detalhe: `${ciclo.nome} · ${linhas.length} registros`,
  });

  const data = new Date().toISOString().slice(0, 10);
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="avaliacoes-${ciclo.nome}-${data}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
