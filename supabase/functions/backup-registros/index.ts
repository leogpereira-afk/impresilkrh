// ============================================================================
// Porta de BACKUP: entrega os registros do RH para o Hub (painel) guardar no
// repositório de backups.
//
// Por que uma função separada da "sync": o sync exige uma PESSOA logada (JWT do
// Supabase Auth), e o backup roda sozinho, de madrugada, sem ninguém. Aqui a
// entrada é um token de serviço próprio (BACKUP_TOKEN) — que só lê, nunca
// escreve, e vive apenas no servidor dos dois lados.
//
// Mantém o MESMO contrato que o Hub já usa com os outros sistemas:
//   POST { action: "list", after? }  -> { registros: [...], nextAfter }
//   POST { action: "getCfg" }        -> { cfg }
// Assim o painel não precisa aprender um formato novo para o RH.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BACKUP_TOKEN = Deno.env.get("BACKUP_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PAGINA = 500;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (!BACKUP_TOKEN) return json({ erro: "Backup não configurado no servidor." }, 503);
  // Comparação simples de token: é um segredo de serviço, não senha de gente.
  const enviado = req.headers.get("x-token") || "";
  if (enviado !== BACKUP_TOKEN) return json({ erro: "Não autorizado." }, 401);

  try {
    const corpo = await req.json().catch(() => ({}));
    const action = String(corpo.action || "list");

    if (action === "getCfg") {
      const { data } = await admin.from("config_global").select("dados").eq("id", "config").maybeSingle();
      return json({ cfg: data?.dados ?? null });
    }

    if (action === "list") {
      // Paginação por chave (colecao,id), igual à do sync: o Hub manda de volta
      // o "nextAfter" até acabar. Sem OFFSET, que fica lento e pode pular linha
      // se algo mudar no meio da varredura.
      const after = corpo.after as { colecao: string; id: string } | null | undefined;
      let q = admin
        .from("registros")
        .select("colecao, id, registro, atualizado_em, apagado")
        .order("colecao", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGINA);
      if (after?.colecao && after?.id) {
        // "depois deste par": mesma coleção com id maior, ou coleção seguinte.
        q = q.or(`and(colecao.eq.${after.colecao},id.gt.${after.id}),colecao.gt.${after.colecao}`);
      }
      const { data, error } = await q;
      if (error) throw error;

      const linhas = data ?? [];
      const registros = linhas.map((l) => ({
        colecao: l.colecao,
        id: l.id,
        registro: l.registro,
        atualizadoEm: l.atualizado_em,
        apagado: l.apagado,
      }));
      const ultimo = linhas[linhas.length - 1];
      // Só oferece próxima página quando encheu a atual — página incompleta
      // significa que acabou.
      const nextAfter = linhas.length === PAGINA && ultimo ? { colecao: ultimo.colecao, id: ultimo.id } : null;
      return json({ registros, nextAfter });
    }

    return json({ erro: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha ao ler os registros." }, 500);
  }
});
