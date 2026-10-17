import { tokenAtual } from './auth';
import { FN_SYNC, ANON_PUBLICA } from './supabase';
import type { ModeloEntrevista, PessoaEntrevista } from './entrevistas';
export type Individual = {id:string;pessoa_id:string;modelo:string;roteiro:ModeloEntrevista;prazo:string;estado:'Rascunho'|'Disponível'|'Respondida'|'Concluída';respostas:Record<string,string>;sintese:string;revisao:string|null;versao:number;atualizado_em:string;respondido_em:string|null;historico:Individual[]};
export type AcaoEscuta = {id:string;origem_tipo:string;origem_id:string;pessoa_id:string;responsavel_id:string;titulo:string;prazo:string;estado:'Pendente'|'Em andamento'|'Concluída';resultado:string;revisao:string|null;versao:number;atualizado_em:string;concluido_em:string|null;revisao_nota?:string;revisado_em?:string|null;historico:AcaoEscuta[]};
export type OrigemEscuta = {id:string;tipo:string;pessoa_id:string;titulo:string};
export type ListaEscuta = {ok:boolean;pessoas:PessoaEntrevista[];individuais:Individual[];acoes:AcaoEscuta[];origens:OrigemEscuta[]};
export async function chamarEscuta(op:string,dados:Record<string,unknown>={}):Promise<ListaEscuta>{
 const token=tokenAtual();if(!token||!FN_SYNC)throw new Error('Conecte-se ao RH para acessar a central.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch(FN_SYNC,{method:'POST',signal:controller.signal,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,apikey:ANON_PUBLICA},body:JSON.stringify({action:'escuta',op,dados})});const r=await response.json();if(tokenAtual()!==token)throw new Error('Sua sessão mudou. Abra a central novamente.');if(!response.ok||!r.ok||r.erro)throw new Error(r.erro||'Central indisponível. Tente atualizar com conexão.');return r;}finally{clearTimeout(timer);}
}
export function pendenteAcao(a:AcaoEscuta,hoje:string){return a.estado==='Concluída' ? !!a.revisao && a.revisao<=hoje : a.prazo<=hoje;}
export function buscaPessoa(p:PessoaEntrevista|undefined,termo:string){return `${p?.nome??''} ${p?.idPessoa??''} ${JSON.stringify(p?.anteriores??[])}`.toLocaleLowerCase('pt-BR').includes(termo.toLocaleLowerCase('pt-BR'));}
