import modelos from "@/data/modelosEntrevista.json";
import { tokenAtual } from "./auth";
import { FN_SYNC, ANON_PUBLICA } from "./supabase";
export const MODELOS_ENTREVISTA = modelos;
export type ModeloEntrevista = typeof modelos[number];
export type PessoaEntrevista = {id:string;colecao:"colaboradores"|"candidatos";nome:string;idPessoa:string|null};
export type Entrevista = {id:string;modelo:string;pessoa_colecao:string;pessoa_id:string;agendada:string;estado:"Agendada"|"Em andamento"|"Concluída";respostas:Record<string,string>;sintese:string;combinados:string;revisao:string|null;versao:number;atualizado_em:string;concluido_em:string|null;historico:Omit<Entrevista,"historico">[]};
export type ListaEntrevistas = {ok:boolean;entrevistas:Entrevista[];pessoas:PessoaEntrevista[];id?:string};
export async function chamarEntrevistas(op:string,dados:Record<string,unknown>={}):Promise<ListaEntrevistas> {
 const token=tokenAtual();
 if(!token || !FN_SYNC) throw new Error("Conecte-se ao RH para acessar as entrevistas.");
 const controle=new AbortController(); const timer=setTimeout(()=>controle.abort(),20000);
 try {
  const resposta=await fetch(FN_SYNC,{method:"POST",signal:controle.signal,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,apikey:ANON_PUBLICA},body:JSON.stringify({action:"entrevistas",op,dados}),cache:"no-store"});
  const r=await resposta.json();
  if(tokenAtual()!==token) throw new Error("Sua sessão mudou. Abra a central novamente.");
  if(!resposta.ok || r.erro || !r.ok) throw new Error(r.erro || "Entrevistas indisponíveis. Tente novamente.");
  return r;
 } finally { clearTimeout(timer); }
}
export function nomePessoaEntrevista(p:PessoaEntrevista|undefined) {
 if(!p) return "Cadastro indisponível";
 return `${p.nome} · ${p.colecao === "candidatos" ? "Candidato" : p.idPessoa ? `ID ${p.idPessoa}` : "ID pendente"}`;
}
