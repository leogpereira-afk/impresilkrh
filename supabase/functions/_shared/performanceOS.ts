/** Projeção mínima para conferência do RH. Não envia CPF, contato, GPS ou fotos. */
export function projetarOrdem(r: Record<string, unknown>, atualizadoEm: string) {
  const texto=(v: unknown)=>typeof v==='string'||typeof v==='number'?String(v):'';
  const final=texto(r.finalizadaEm);
  let dia=final.slice(0,10);
  if(final.includes('T') && Number.isFinite(Date.parse(final))) {
    const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(final));
    dia=`${d.find(x=>x.type==='year')?.value}-${d.find(x=>x.type==='month')?.value}-${d.find(x=>x.type==='day')?.value}`;
  }
  const inst=r.instalacao&&typeof r.instalacao==='object'?r.instalacao as Record<string,unknown>:{};
  return {id:texto(r.id),numero:texto(r.numero),cliente:texto(r.cliente),servico:texto(r.servico),finalizadaEm:final?dia:'',prazo:texto(inst.data)||texto(r.previsaoEntrega),equipe:Array.isArray(r.equipe)?r.equipe.filter((v):v is string=>typeof v==='string'):[],retrabalho:r.retrabalho===true,baixaAutomatica:!!r.baixaAutoERP,atualizadoEm};
}
