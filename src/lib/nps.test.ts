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
