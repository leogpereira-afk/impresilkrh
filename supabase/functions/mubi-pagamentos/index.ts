// ============================================================================
// Busca os pagamentos de pessoal no ERP Mubisys (contas a pagar) — Edge Function.
//
// Por que no servidor e não no navegador: o token do Mubisys não pode ir para
// o bundle (qualquer pessoa leria o código da página e teria acesso ao ERP
// inteiro). Aqui ele fica como secret do Supabase e nunca sai daqui.
//
// O que devolve: só o que é FOLHA (plano de contas 2.1.x), já normalizado no
// formato que o RH usa. Quem chama decide o que gravar — esta função não grava
// nada, só lê.
//
// Armadilhas do Mubisys (custaram um dia de trabalho em 2026-07-27):
//  - o header é "Access-Token", não "Authorization: Bearer";
//  - filtrodata/status em MAIÚSCULAS, e datainicial/datafinal são obrigatórios;
//  - SUCESSO vem como HTTP 201 (não 200);
//  - é lento: 25-40s por requisição.
// ============================================================================
import { json, preflight } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MUBI_BASE = Deno.env.get("MUBI_BASE_URL") ?? "https://api.mubisys.com/api";
const MUBI_KEY = Deno.env.get("MUBI_PUBLIC_KEY") ?? "";
const MUBI_TOKEN = Deno.env.get("MUBI_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Só o RH/gestão pode puxar a folha — são valores de salário.
async function ehGestao(req: Request): Promise<boolean> {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const { data, error } = await admin.auth.getUser(m[1]);
  if (error || !data?.user) return false;
  const { data: perfil } = await admin.from("perfis").select("perfil").eq("user_id", data.user.id).maybeSingle();
  return perfil?.perfil === "ADMIN_RH" || perfil?.perfil === "GESTOR";
}

// Plano de contas do Mubisys → tipo de pagamento do RH.
//
// CONFERIDO CONTRA O PLANO DE CONTAS REAL da Impresilk (arquivo do contador,
// 31/07/2026). A versão anterior foi escrita por dedução e tinha três rótulos
// TROCADOS — 2.1.21 como "Férias" (é Divulgação de vagas), 2.1.17 como
// "Empreita" (é Treinamentos), 2.1.18 como "Limpeza" (é Minas Brasil, a
// drogaria) — e deixava Férias, 13º, FGTS, INSS, Empreita e Limpeza caindo
// todos em "Outros".
//
// A ordem importa: a comparação é por PREFIXO e para no primeiro que casar,
// então o código mais específico (2.1.11.2) vem antes do genérico (2.1.11).
const DE_PARA: [string, string][] = [
  ["2.1.1-", "Salário"],
  ["2.1.2-", "Adiantamento"],
  ["2.1.3-", "Férias"],
  ["2.1.4-", "13º Salário"],
  ["2.1.5-", "Vale Transporte"],
  ["2.1.6-", "Rescisão"],
  ["2.1.7-", "Estágio/Bolsa"],
  ["2.1.8-", "Uniforme"],
  ["2.1.9-", "FGTS"],                 // e 2.1.9.1/.2/.3 (regular, empréstimo, rescisão)
  ["2.1.10-", "INSS"],
  ["2.1.11.1-", "Diária"],
  ["2.1.11.2-", "Freelancer (Empreita)"],
  ["2.1.11.3-", "Limpeza/Faxina"],
  ["2.1.11.4-", "Horas Extras"],
  ["2.1.11-", "Horas Extras"],
  ["2.1.12.1-", "Comissão"],          // Comercial
  ["2.1.12.2-", "Bônus"],
  ["2.1.12-", "Comissão"],            // Comissão Interna
  ["2.1.13-", "Incentivo de Produtividade"],
  ["2.1.14-", "Alimentação"],
  ["2.1.15-", "Confraternização"],    // e as subcontas (festa junina, aniversário…)
  ["2.1.16.1-", "Limpeza/Faxina"],
  ["2.1.16-", "Prestação de Serviços"],
  ["2.1.17-", "Treinamentos"],
  ["2.1.18-", "Farmácia"],            // "Minas Brasil" = drogaria conveniada
  ["2.1.19-", "Incentivo de Viagens"],
  ["2.1.20-", "Plano de Saúde"],      // e 2.1.20.1 Pró Vida
  // 2.1.21 (Divulgação de vagas) e 2.1.22 (Advocatícios) são despesas de RH,
  // não pagamento a colaborador — ficam em "Outros" de propósito.
];

/**
 * Traduz o plano de contas do ERP no tipo de pagamento do RH.
 *
 * SUBCONTA HERDA DO PAI: "2.1.9.1-Regular" é FGTS porque 2.1.9 é FGTS; a
 * comparação sobe a hierarquia até achar (2.1.9.1 → 2.1.9 → 2.1 → 2). Sem isso
 * toda subconta caía em "Outros" — eram 13 delas, incluindo as três de FGTS e
 * o Pró Vida do plano de saúde.
 */
function tipoDoPlano(plano: string): string {
  const codigo = String(plano || "").trim().split("-")[0].trim();
  if (!codigo) return "Outros";
  const partes = codigo.split(".");
  for (let n = partes.length; n >= 1; n--) {
    const alvo = partes.slice(0, n).join(".") + "-";
    const achou = DE_PARA.find(([prefixo]) => prefixo === alvo);
    if (achou) return achou[1];
  }
  return "Outros";
}

const ehFolha = (plano: string) => String(plano || "").startsWith("2.1.");

// "Colab: Fulano de Tal" → "Fulano de Tal"
const limpaNome = (s: string) => String(s || "").replace(/^\s*colab\s*:\s*/i, "").trim();

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

async function buscaPagina(competencia: string, page: number, perPage: number) {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  const q = new URLSearchParams({
    filtrodata: "VENCIMENTO",
    datainicial: `${competencia}-01`,
    datafinal: `${competencia}-${String(ultimo).padStart(2, "0")}`,
    status: "TODOS",
    page: String(page),
    per_page: String(perPage),
  });
  const url = `${MUBI_BASE}/${MUBI_KEY}/contas-pagar?${q}`;
  const r = await fetch(url, { headers: { Accept: "application/json", "Access-Token": MUBI_TOKEN } });
  // O Mubisys responde 201 no sucesso; 200 também é aceito por segurança.
  if (r.status !== 201 && r.status !== 200) {
    const corpo = await r.text().catch(() => "");
    throw new Error(`Mubisys respondeu ${r.status}: ${corpo.slice(0, 200)}`);
  }
  return await r.json();
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (!MUBI_KEY || !MUBI_TOKEN) {
    return json({ erro: "Integração com o Mubisys não configurada (faltam as credenciais no servidor)." }, 503);
  }
  if (!(await ehGestao(req))) return json({ erro: "Não autorizado." }, 401);

  try {
    const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const competencia = String(corpo.competencia || "");
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      return json({ erro: "Informe a competência no formato AAAA-MM." }, 400);
    }

    // per_page alto para fazer o mínimo de chamadas: cada uma leva 25-40s.
    const PER_PAGE = 500;
    const primeira = await buscaPagina(competencia, 1, PER_PAGE);
    let itens: Record<string, unknown>[] = primeira?.data ?? [];
    const totalPaginas = Number(primeira?.pagination?.last_page ?? 1);

    // Teto de 4 páginas (2000 títulos/mês): protege o tempo limite da função.
    for (let p = 2; p <= Math.min(totalPaginas, 4); p++) {
      const prox = await buscaPagina(competencia, p, PER_PAGE);
      itens = itens.concat(prox?.data ?? []);
    }

    const folha = itens.filter((i) => ehFolha(String(i.plano_contas)));
    const linhas = folha.map((i) => {
      const nome = limpaNome(String(i.origem ?? ""));
      return {
        // id estável: o mesmo título do ERP não pode virar dois pagamentos.
        idMubi: String(i.id ?? ""),
        nome,
        ehColaborador: String(i.origem_tipo ?? "") === "Colaborador",
        cpfCnpj: String(i.origem_cnpj ?? "").trim() || null,
        planoContas: String(i.plano_contas ?? ""),
        tipo: tipoDoPlano(String(i.plano_contas ?? "")),
        descricao: String(i.descricao ?? i.despesa ?? "").trim(),
        valor: num(i.valor_pagamento) || num(i.valor_titulo),
        dataVencimento: String(i.data_vencimento ?? "").slice(0, 10),
        dataPagamento: String(i.data_pagamento ?? "").slice(0, 10) || null,
        status: String(i.status ?? ""),
        formaPagamento: String(i.forma_pagamento ?? ""),
        centroCusto: String(i.centro_custo ?? ""),
      };
    });

    return json({
      competencia,
      buscadoEm: new Date().toISOString(),
      totalTitulosNoMes: itens.length,
      paginas: totalPaginas,
      truncado: totalPaginas > 4, // avisa se o mês tinha mais do que coubemos ler
      linhas,
    });
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha ao consultar o Mubisys." }, 502);
  }
});
