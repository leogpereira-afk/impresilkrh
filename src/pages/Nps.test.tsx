import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CicloNps } from "@/lib/nps";
const estado = vi.hoisted(() => ({ perfil: "ADMIN_RH", api: vi.fn() }));
vi.mock("@/lib/session", () => ({ useSessao: () => ({ perfil: estado.perfil, colaboradorId: "pessoa-ficticia" }) }));
vi.mock("@/lib/nps", async original => ({ ...await original<typeof import("@/lib/nps")>(), chamarNps: estado.api }));
import Nps from "./Nps";
(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
let root: Root; let el: HTMLDivElement;
const ciclo: CicloNps={id:"ficticio",titulo:"Ciclo fictício",dias:14,versao:1,abertura:"2020-01-01",fim:"2099-01-01",convidado:true,respondeu:false,elegiveis:8,recebidas:0,resultados:null,acoes:[]};
const montar=async()=>act(async()=>root.render(<Nps/>));
beforeEach(()=>{estado.perfil="ADMIN_RH";estado.api.mockReset();estado.api.mockResolvedValue({ok:true,ciclos:[ciclo]}); el=document.createElement("div");document.body.appendChild(el);root=createRoot(el);});
afterEach(()=>{act(()=>root.unmount());el.remove();vi.restoreAllMocks();});
it("RH vê fluxo, perguntas e resultados protegidos durante coleta",async()=>{
 await montar(); expect(el.textContent).toContain("Resultados protegidos durante a coleta");
 expect(el.querySelectorAll('input[type="radio"]')).toHaveLength(11);
 expect(el.textContent).toContain("Nova pesquisa");
});
it("colaborador responde sem controles de gestão; envia apenas sua resposta",async()=>{
 estado.perfil="COLABORADOR";vi.spyOn(window,"confirm").mockReturnValue(true);await montar();
 expect(el.textContent).not.toContain("Nova pesquisa");expect(el.textContent).not.toContain("Resultados agrupados");
 await act(async()=> (el.querySelector('input[value="9"]') as HTMLInputElement).click());
 await act(async()=>el.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(estado.api).toHaveBeenCalledWith("responder",{id:"ficticio",nota:9,dimensoes:{},prioridade:""});
 expect(el.textContent).toContain("Participação confirmada");
});
it("indisponibilidade não aparece como pesquisa vazia",async()=>{
 estado.api.mockRejectedValue(new Error("Servidor indisponível"));await montar();
 expect(el.querySelector('[role="alert"]')?.textContent).toContain("Servidor indisponível");
 expect(el.textContent).not.toContain("Nenhuma pesquisa disponível");
});
it("participação confirmada não permite novo envio",async()=>{
 estado.api.mockResolvedValue({ok:true,ciclos:[{...ciclo,respondeu:true}]});await montar();
 expect(el.textContent).toContain("já foi confirmada"); expect(el.querySelector('input[type="radio"]')).toBeNull();
});
