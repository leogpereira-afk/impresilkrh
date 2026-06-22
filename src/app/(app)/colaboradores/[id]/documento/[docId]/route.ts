import { lerSessao } from "@/lib/session";
import { podeVerColaborador } from "@/lib/rbac";
import { db } from "@/lib/db";
import { lerArquivo, tipoConteudo } from "@/lib/storage";
import { registrarAcesso } from "@/lib/lgpd";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const sessao = await lerSessao();
  if (!sessao) return new Response("Não autenticado", { status: 401 });
  if (!(await podeVerColaborador(sessao, params.id))) {
    return new Response("Sem permissão", { status: 403 });
  }

  const doc = await db.documento.findUnique({ where: { id: params.docId } });
  if (!doc || doc.colaboradorId !== params.id || !doc.arquivoPath) {
    return new Response("Documento não encontrado", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await lerArquivo(doc.arquivoPath);
  } catch {
    return new Response("Arquivo indisponível", { status: 404 });
  }

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "BAIXAR_DOCUMENTO",
    recurso: `Documento:${doc.categoria}`,
    colaboradorId: params.id,
    detalhe: doc.nome,
  });

  const nome = doc.arquivoNome ?? "documento";
  return new Response(new Uint8Array(bytes) as BodyInit, {
    headers: {
      "Content-Type": tipoConteudo(nome),
      "Content-Disposition": `inline; filename="${nome.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
