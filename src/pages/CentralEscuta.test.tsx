import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mock=vi.hoisted(()=>({perfil:"ADMIN_RH",api:vi.fn()}));
vi.mock("@/lib/session",()=>({useSessao:()=>({perfil:mock.perfil})}));
vi.mock("@/lib/entrevistas",async original=>({...await original<typeof import("@/lib/entrevistas")>(),chamarEntrevistas:mock.api}));
vi.mock("@/components/pesquisas/ClimaPesquisa",()=>({default:()=> <div>Pesquisa coletiva confidencial</div>}));
import Nps from "./Nps";
(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
let el:HTMLDivElement;let root:Root;
const button=(s:string)=>Array.from(el.querySelectorAll("button")).find(b=>b.textContent?.includes(s))!;
const click=async(s:string)=>act(async()=>button(s).click());
const montar=()=>act(async()=>root.render(<Nps/>));
beforeEach(()=>{mock.perfil="ADMIN_RH";mock.api.mockReset();mock.api.mockResolvedValue({ok:true,pessoas:[],entrevistas:[]});el=document.createElement("div");document.body.appendChild(el);root=createRoot(el);});
afterEach(()=>{act(()=>root.unmount());el.remove();vi.restoreAllMocks();});
it("agrupa roteiros por categoria e leva clima para coleta confidencial",async()=>{
 await montar();expect(el.querySelectorAll("article")).toHaveLength(10);
 await click("Entrada e integração");expect(el.querySelectorAll("article")).toHaveLength(4);
 expect(el.textContent).toContain("Integração · 90 dias");expect(el.textContent).not.toContain("Entrevista de saída");
 await click("Clima e eNPS");expect(el.textContent).toContain("Pesquisa coletiva confidencial");
});
it("colaborador e gestor não consultam entrevistas ou cadastros",async()=>{
 for(const perfil of ["COLABORADOR","GESTOR"]){mock.perfil=perfil;await montar();expect(el.textContent).toBe("Pesquisa coletiva confidencial");}
 expect(mock.api).not.toHaveBeenCalled();
});
it("falha de conexão mantém modelos e não finge lista vazia",async()=>{
 mock.api.mockRejectedValue(new Error("Servidor indisponível"));await montar();expect(el.querySelector('[role="alert"]')?.textContent).toContain("Servidor indisponível");
 await click("Entrevistas e histórico");expect(el.textContent).not.toContain("Nenhuma entrevista neste filtro");
});
it("histórico filtra concluídas sem perder as pendentes",async()=>{
 mock.api.mockResolvedValue({ok:true,pessoas:[{id:"ficticia",colecao:"colaboradores",nome:"Pessoa fictícia",idPessoa:"000001"}],entrevistas:[{id:"a",modelo:"entrada",pessoa_id:"ficticia",pessoa_colecao:"colaboradores",agendada:"2026-01-01",estado:"Agendada"},{id:"b",modelo:"saida",pessoa_id:"ficticia",pessoa_colecao:"colaboradores",agendada:"2026-01-02",estado:"Concluída"}]});
 await montar();await click("Entrevistas e histórico");expect(el.querySelectorAll("article")).toHaveLength(1);expect(el.textContent).toContain("ID 000001");
 await act(async()=>{const s=el.querySelector("select")!;s.value="Concluída";s.dispatchEvent(new Event("change",{bubbles:true}));});
 expect(el.querySelectorAll("article")).toHaveLength(1);expect(el.textContent).toContain("Ver registro");expect(el.textContent).not.toContain("Registrar conversa");
});
