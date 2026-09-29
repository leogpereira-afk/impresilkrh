/** Projeção mínima para conferência do RH. Não envia CPF, contato, GPS ou fotos. */
/** `porId`: pessoa do RH pelo ID (6 primeiros dígitos do CPF), para a equipe que o PCP grava por ID. */
export function projetarOrdem(r: Record<string, unknown>, atualizadoEm: string, porId?: Map<string, {colaboradorId: string; nome: string}>) {
  const texto=(v: unknown)=>typeof v==='string'||typeof v==='number'?String(v):'';
  const final=texto(r.finalizadaEm);
  let dia=final.slice(0,10);
  if(final.includes('T') && Number.isFinite(Date.parse(final))) {
    const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(final));
    dia=`${d.find(x=>x.type==='year')?.value}-${d.find(x=>x.type==='month')?.value}-${d.find(x=>x.type==='day')?.value}`;
  }
  const inst=r.instalacao&&typeof r.instalacao==='object'?r.instalacao as Record<string,unknown>:{};
  const meta=r.programacaoRH&&typeof r.programacaoRH==='object'?r.programacaoRH as Record<string,unknown>:{};
  const participantes=Array.isArray(meta.participantes)?meta.participantes.filter(p=>p&&typeof p==='object'&&Array.isArray(r.equipe)&&r.equipe.includes(p.nomePCP)&&typeof p.colaboradorId==='string').map(p=>p.colaboradorId as string):[];
  // Equipe gravada por ID no PCP: a pessoa já é a do RH, sem vínculo manual.
  const eqBruta=Array.isArray(r.equipe)?r.equipe.filter((v):v is string=>typeof v==='string'):[];
  if(porId)for(const n of eqBruta){const f=/^\d{6}$/.test(n)?porId.get(n):undefined;if(f)participantes.push(f.colaboradorId);}
  return {...(participantes.length?{participantesRH:[...new Set(participantes)]}:{}),id:texto(r.id),numero:texto(r.numero),cliente:texto(r.cliente),servico:texto(r.servico),finalizadaEm:final?dia:'',prazo:texto(inst.data)||texto(r.previsaoEntrega),equipe:eqBruta.map(n=>(/^\d{6}$/.test(n)&&porId?.get(n)?.nome)||n),retrabalho:r.retrabalho===true,baixaAutomatica:!!r.baixaAutoERP,atualizadoEm};
}
