import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

export function servidorRh({ perfil = "COLABORADOR", pessoa = "ana", rows = [], erroConsulta = false }: { perfil?: string; pessoa?: string; rows?: any[]; erroConsulta?: boolean } = {}) {
  let handler: (req: Request) => Promise<Response>;
  const escritas: any[] = [];
  const arquivos: any[] = [];
  const rpcs: any[] = [];
  const admin = {
    rpc: async (nome: string, args: any) => { rpcs.push({ nome, args }); return { data: { ok: true, versao: 2 }, error: null }; },
    auth: { getUser: async () => ({ data: { user: { id: "auth-ficticio" } }, error: null }) },
    storage: { from: () => ({
      upload: async (...args: any[]) => { arquivos.push({ acao: "upload", args }); return { error: null }; },
      remove: async (...args: any[]) => { arquivos.push({ acao: "remove", args }); return { error: null }; },
      download: async () => ({ data: { text: async () => "data:application/pdf;base64,ZmFrZQ==" }, error: null }),
    }) },
    from(table: string) {
      const filtros: ((r: any) => boolean)[] = [];
      let single = false, inicio = 0, fim = Infinity, limit = Infinity, mutation = false;
      const chain: any = {
        select() { return chain; },
        eq(k: string, v: any) { filtros.push(r => r[k] === v); return chain; },
        in(k: string, v: any[]) { filtros.push(r => v.includes(r[k])); return chain; },
        order() { return chain; },
        limit(n: number) { limit = n; return chain; },
        range(a: number, b: number) { inicio = a; fim = b + 1; return chain; },
        maybeSingle() { single = true; return chain; },
        upsert(value: any) { mutation = true; escritas.push({ table, value }); return chain; },
        delete() { mutation = true; escritas.push({ table, apagar: true }); return chain; },
        then(resolve: any, reject: any) {
          const data = table === "perfis" ? [{ user_id: "auth-ficticio", colaborador_id: pessoa, perfil, ativo: true }]
            : table === "meta" ? [{ chave: "rev", valor: { rev: 1, porColecao: {} } }] : rows;
          const filtrados = data.filter(r => filtros.every(f => f(r))).slice(inicio, fim).slice(0, limit);
          return Promise.resolve(erroConsulta && table !== "perfis" && !mutation
            ? { data: null, error: { message: "Falha fictícia de consulta" } }
            : { data: single ? filtrados[0] ?? null : filtrados, count: filtrados.length, error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  const source = fs.readFileSync("supabase/functions/sync/index.ts", "utf8")
    .replace(/^import .*$/mg, "");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.runInNewContext(code, {
    createClient: () => admin,
    Deno: { env: { get: () => "ficticio" }, serve: (fn: any) => { handler = fn; } },
    json: (data: any, status = 200) => new Response(JSON.stringify(data), { status }), preflight: () => null,
    Response, Request, Blob, console, Date, crypto,
  });
  return { escritas, arquivos, rpcs, async call(body: any) {
    const r = await handler(new Request("http://rh-teste.local", { method: "POST", headers: { authorization: "Bearer ficticio" }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  } };
}
