import { FN_PERFORMANCE, ANON_PUBLICA } from './supabase';
import { tokenAtual } from './auth';
import type { OrdemPerformance } from '@/data/performance';
export async function buscarOrdensPerformance(competencia: string): Promise<{ordens:OrdemPerformance[];consultadoEm:string}> {
  const token=tokenAtual();
  if(!token||!FN_PERFORMANCE)throw new Error('Entre com sua conta de RH para consultar as entregas do PCP.');
  const r=await fetch(FN_PERFORMANCE,{method:'POST',headers:{'content-type':'application/json',apikey:ANON_PUBLICA,authorization:`Bearer ${token}`},body:JSON.stringify({action:'performanceOS',competencia}),signal:AbortSignal.timeout(45000)});
  const j=await r.json();
  if(!r.ok||!Array.isArray(j.ordens))throw new Error(j.erro||'Não foi possível consultar o PCP. Tente novamente.');
  return j;
}
