import * as XLSX from "xlsx";
import { lerSessao } from "@/lib/session";
import { escopoColaboradores, podeEditarColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { registrarAcesso } from "@/lib/lgpd";
import { formatCPF } from "@/lib/format";
import { PERFIS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao || sessao.perfil === PERFIS.COLABORADOR) {
    return new Response("Não autorizado", { status: 403 });
  }
  const escopo = await escopoColaboradores(sessao);
  const ehRH = sessao.perfil === PERFIS.ADMIN_RH;

  const colaboradores = await db.colaborador.findMany({
    where: escopo,
    include: { cargo: true, area: true, nivel: true, status: true, gestor: { select: { nome: true } } },
    orderBy: { nome: "asc" },
  });

  const linhas = colaboradores.map((c) => {
    const base: Record<string, string | number> = {
      Nome: c.nome,
      "E-mail": c.email ?? "",
      Telefone: c.telefone ?? "",
      Cargo: c.cargo?.nome ?? "",
      Área: c.area?.nome ?? "",
      Nível: c.nivel ? `${c.nivel.codigo} · ${c.nivel.senioridade}` : "",
      Status: c.status?.nome ?? "",
      Gestor: c.gestor?.nome ?? "",
      Admissão: c.dataAdmissao ? c.dataAdmissao.toLocaleDateString("pt-BR") : "",
      Enquadramento: c.posicaoFaixa ?? "",
      "Risco de saída": c.riscoSaida ?? "",
      Potencial: c.potencial ?? "",
    };
    // Dados sensíveis: somente RH
    if (ehRH) {
      base.CPF = formatCPF(c.cpf);
      base.Salário = c.salario ?? "";
      base["Nascimento"] = c.dataNascimento ? c.dataNascimento.toLocaleDateString("pt-BR") : "";
    }
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "EXPORTAR_COLABORADORES",
    recurso: ehRH ? "Colaborador:Exportacao(completa)" : "Colaborador:Exportacao(restrita)",
    detalhe: `${linhas.length} registros`,
  });

  const data = new Date().toISOString().slice(0, 10);
  return new Response(buf as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="colaboradores-impresilk-${data}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
