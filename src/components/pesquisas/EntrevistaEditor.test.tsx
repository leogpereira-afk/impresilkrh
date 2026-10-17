import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach,afterEach,it,expect,vi } from "vitest";
import type { Entrevista } from "@/lib/entrevistas";
const mock=vi.hoisted(()=>({api:vi.fn()}));
vi.mock("@/lib/entrevistas",async original=>({...await original<typeof import("@/lib/entrevistas")>(),chamarEntrevistas:mock.api}));
import Editor from "./EntrevistaEditor";
(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
let el:HTMLDivElement;let root:Root;
const e:Entrevista={id:"ficticio",modelo:"entrada",pessoa_colecao:"colaboradores",pessoa_id:"pessoa-ficticia",agendada:"2020-01-01",estado:"Agendada",respostas:{},sintese:"",combinados:"",revisao:null,versao:1,atualizado_em:"2020-01-01T12:00:00Z",concluido_em:null,historico:[]};
const atualizar=vi.fn().mockResolvedValue(undefined);
const montar=(x=e)=>act(async()=>root.render(<Editor entrevista={x} pessoa={{id:"pessoa-ficticia",colecao:"colaboradores",nome:"Pessoa fictícia",idPessoa:"000001"}} onVoltar={()=>{}} onSalvo={atualizar}/>));
const preencher=async(idx:number,valor:string)=>act(async()=>{const t=el.querySelectorAll("textarea")[idx];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(t,valor);t.dispatchEvent(new Event("input",{bubbles:true}));});
beforeEach(()=>{mock.api.mockReset();mock.api.mockResolvedValue({ok:true});atualizar.mockClear();el=document.createElement("div");document.body.appendChild(el);root=createRoot(el);});
afterEach(()=>{act(()=>root.unmount());el.remove();vi.restoreAllMocks();});
it("salva versão, vínculo permanece fixo e erro conserva anotações",async()=>{
 await montar();await preencher(0,"Resposta fictícia");mock.api.mockRejectedValue(new Error("Sem conexão"));
 await act(async()=>el.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(mock.api).toHaveBeenCalledWith("salvar",expect.objectContaining({id:"ficticio",versao:1,respostas:{q1:"Resposta fictícia"}}));
 expect(el.querySelector("textarea")!.value).toBe("Resposta fictícia");expect(el.querySelector('[role="alert"]')?.textContent).toContain("Sem conexão");expect(atualizar).not.toHaveBeenCalled();
});
it("exige síntese na conclusão e bloqueia edição de registro concluído",async()=>{
 await montar();let concluir=Array.from(el.querySelectorAll("button")).find(b=>b.textContent?.includes("Concluir entrevista"))!;expect(concluir.disabled).toBe(true);
 await preencher(6,"Síntese fictícia");expect(concluir.disabled).toBe(false);vi.spyOn(window,"confirm").mockReturnValue(true);
 await act(async()=>concluir.click());expect(mock.api).toHaveBeenCalledWith("concluir",expect.objectContaining({sintese:"Síntese fictícia"}));expect(atualizar).toHaveBeenCalledOnce();
 await montar({...e,estado:"Concluída",versao:2,sintese:"Síntese fictícia"});expect(el.querySelector("fieldset")!.disabled).toBe(true);expect(el.textContent).not.toContain("Salvar registro");
});
