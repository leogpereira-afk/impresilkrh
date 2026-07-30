// CORS: o app roda num domínio próprio (GitHub Pages), diferente do domínio da
// Edge Function (*.supabase.co) — sem estes cabeçalhos o navegador bloqueia a
// chamada antes mesmo dela chegar aqui. "*" é seguro neste caso porque a
// autorização de verdade é o JWT no header Authorization, não a origem.
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
} as const;

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", ...CORS } });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { status: 204, headers: CORS }) : null;
}
