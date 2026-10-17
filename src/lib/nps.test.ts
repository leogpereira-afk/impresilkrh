import { describe, it, expect } from "vitest";
import { pontuacaoNps, DIMENSOES_NPS } from "./nps";

describe("NPS",()=>{
 it("calcula índice com passivos na base e protege base pequena",()=>{
  expect(pontuacaoNps({n:5,promotores:2,detratores:1,passivos:2,dimensoes:{},prioridades:{}})).toBe(20);
  expect(pontuacaoNps({n:4,promotores:2,detratores:1,passivos:1,dimensoes:{},prioridades:{}})).toBeNull();
  expect(new Set(DIMENSOES_NPS.map(d=>d.id)).size).toBe(9);
 });
});

import { servidorRh } from "@/test/servidorRh";
it("sync usa identidade autenticada, nunca a enviada no corpo",async()=>{
 const s=servidorRh({rpcResposta:nome=>nome==='rh_nps_operar'?{ok:true,ciclos:[]}:undefined});
 const r=await s.call({action:"nps",op:"listar",dados:{p_user:"forjado"},p_user:"forjado"});
 expect(r.status).toBe(200);
 expect(s.rpcs[0].args.p_user).toBe("auth-ficticio");
 expect(s.escritas).toHaveLength(0);
});
it("entrevistas usam identidade real da sessão, sem escrita na coleção geral",async()=>{
 const s=servidorRh({rpcResposta:nome=>nome==='rh_entrevistas_operar'?{ok:true,entrevistas:[],pessoas:[]}:undefined});
 const r=await s.call({action:"entrevistas",op:"listar",dados:{p_user:"forjado"},p_user:"forjado"});
 expect(r.status).toBe(200);expect(s.rpcs[0].args.p_user).toBe("auth-ficticio");expect(s.escritas).toHaveLength(0);
});

import { cicloComparavel, type CicloNps } from './nps';
it('compara somente bases compatíveis, sem inferir tendência em grupos insuficientes',()=>{
 const ciclo={id:'a',instrumento:'enps',publico:['a','b','c','d','e'],versao:1,abertura:'2026-01-01',resultados:{n:5,promotores:3,detratores:1,passivos:1,dimensoes:{},prioridades:{}}} as CicloNps;
 const atual={...ciclo,id:'b',abertura:'2026-04-01'};
 expect(cicloComparavel(atual,ciclo)).toBe(true);
 expect(cicloComparavel(atual,{...ciclo,instrumento:'clima'})).toBe(false);
 expect(cicloComparavel(atual,{...ciclo,versao:2})).toBe(false);
 expect(cicloComparavel(atual,{...ciclo,publico:['a','b','c','d','f']})).toBe(false);
 expect(cicloComparavel(atual,{...ciclo,resultados:null})).toBe(false);
});
it('ações e individuais usam identidade autenticada, nunca uma identidade forjada',async()=>{
 const s=servidorRh({rpcResposta:nome=>nome==='rh_escuta_operar'?{ok:true,pessoas:[],individuais:[],acoes:[]}:undefined});
 const r=await s.call({action:'escuta',op:'listar',p_user:'forjado',dados:{p_user:'forjado'}});
 expect(r.status).toBe(200);expect(s.rpcs[0].args.p_user).toBe('auth-ficticio');expect(s.escritas).toHaveLength(0);
});
