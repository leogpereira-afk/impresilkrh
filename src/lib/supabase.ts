// Cliente do Supabase (Auth + chamada das Edge Functions). A anon key é
// pública por design (protegida por RLS no banco) — pode ir no bundle do app,
// diferente da service_role key, que NUNCA sai do servidor (Edge Functions).
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_CONFIGURADO = !!(URL && ANON_KEY);

export const supabase = SUPABASE_CONFIGURADO
  ? createClient(URL, ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// URL das Edge Functions (mesma base do projeto Supabase, path fixo do Functions).
export const FN_SYNC = URL ? `${URL}/functions/v1/sync` : "";
export const FN_ADMIN_USERS = URL ? `${URL}/functions/v1/admin-users` : "";
