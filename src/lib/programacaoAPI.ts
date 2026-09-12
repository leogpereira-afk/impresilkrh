import { FN_PROGRAMACAO, ANON_PUBLICA } from './supabase';
import { tokenAtual } from './auth';
import type { OrdemProgramacao, EdicaoProgramacao } from './programacao';
export interface ConsultaProgramacao {ordens:OrdemProgramacao[];instaladores:string[];veiculos:string[];consultadoEm:string}
async function chamar(body:unknown){
 const token=tokenAtual();if(!token||!FN_PROGRAMACAO)throw new Error('Entre no RH para consultar a programação do PCP.');
 const r=await fetch(FN_PROGRAMACAO,{method:'POST',headers:{'content-type':'application/json',apikey:ANON_PUBLICA,authorization:`Bearer ${token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const j=await r.json();if(!r.ok)throw new Error(j.erro||'Não foi possível concluir. Atualize a lista para conferir.');return j;
}
export async function consultarProgramacao(mes:string):Promise<ConsultaProgramacao>{const j=await chamar({action:'listar',mes});if(!Array.isArray(j.ordens))throw new Error('Resposta incompleta. Atualize o PCP.');return j;}
export async function salvarProgramacao(edicao:EdicaoProgramacao):Promise<{ordem:OrdemProgramacao;consultadoEm:string}>{const j=await chamar({action:'salvar',edicao});if(!j.ordem?.id)throw new Error('A gravação não foi confirmada. Atualize a lista antes de repetir.');return j;}
