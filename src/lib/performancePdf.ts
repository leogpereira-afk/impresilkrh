import type { CicloPerformance, Plantao } from '@/data/performance';
import { apurarPessoa, dinheiro, horas, minutosTurno } from './performance';
import { formatDate } from './format';

async function documento(titulo: string, mes: string, head: string[], body: string[][]) {
  const {jsPDF}=await import('jspdf');
  const autoTable=(await import('jspdf-autotable')).default;
  const doc=new jsPDF({orientation:'landscape'});
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(22,51,79);doc.text(`Impresilk | ${titulo}`,14,17);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(80);doc.text(`Competência: ${mes.slice(5)}/${mes.slice(0,4)} | Emitido em ${new Date().toLocaleString('pt-BR')}`,14,24);
  autoTable(doc,{head:[head],body:body.length?body:[head.map((_,i)=>i===0?'Nenhum registro neste período.':'')],startY:32,margin:{top:15,bottom:20},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[22,51,79]},alternateRowStyles:{fillColor:[246,248,250]}});
  return {doc,autoTable};
}
function rodapes(doc: import('jspdf').jsPDF,texto: string) {
  for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(95);doc.text(texto,14,doc.internal.pageSize.getHeight()-11);doc.text(`${p}/${doc.getNumberOfPages()}`,doc.internal.pageSize.getWidth()-22,doc.internal.pageSize.getHeight()-11);}
}
export async function exportarPlantoes(mes: string, itens: Plantao[],nome:(id:string)=>string,pessoa='') {
  const body=itens.flatMap(p=>p.participantes.filter(x=>!pessoa||x.colaboradorId===pessoa).map(x=>[formatDate(p.data),`${p.titulo}\n${p.tipo}${p.osNumero?` | OS ${p.osNumero}`:''}\n${p.local}`,nome(x.colaboradorId),`${p.inicio}–${p.fim}\nIntervalo: ${p.intervaloMin} min`,p.cancelado?'Cancelado':x.situacao,horas(minutosTurno(p.inicio,p.fim,p.intervaloMin)??0),x.situacao==='Realizado'&&!p.cancelado?horas(x.realizadoMin??0):'—',x.situacao==='Realizado'&&!p.cancelado?horas(x.extrasMin??0):'—',p.observacao]));
  const {doc}=await documento('Escala de plantões',mes,['Data','Serviço / local','Pessoa','Horário','Situação','Previsto','Realizado','Extras','Observações'],body);
  rodapes(doc,'Uso interno. Escala operacional; conferir ponto e folha antes do pagamento.');doc.save(`Impresilk-Plantoes-${mes}.pdf`);
}
export async function exportarPerformance(c: CicloPerformance,nome:(id:string)=>string) {
  const numero=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:2});
  const qualidade={pendente:'A conferir',sem_retrabalho:'Sem retrabalho',execucao:'Retrabalho de execução',externo:'Ocorrência externa'};
  const prazo={pendente:'A conferir',no_prazo:'No prazo',atraso:'Atraso da equipe',externo:'Impedimento externo'};
  const body=c.pessoas.map(p=>{const a=apurarPessoa(c,p);return [nome(p.colaboradorId),`${a.aceitas.length} / ${a.linhas.length}`,numero(a.pontos),String(p.meta),a.nota===null?'Pendente':numero(a.nota),p.aprovacao?dinheiro(p.aprovacao.valor):dinheiro(a.sugestao),p.aprovacao?`Proposta aprovada\n${nome(p.aprovacao.por)}\n${formatDate(p.aprovacao.em)}`:'Em revisão',p.aprovacao?.justificativa||a.pendencias.join(' ')];});
  const {doc,autoTable}=await documento('Performance e bonificação',c.competencia,['Pessoa','OS aceitas / vinculadas','Pontos','Meta','Nota / 100','Proposta (R$)','Situação','Conferência'],body);
  doc.addPage();doc.setFontSize(16);doc.setTextColor(22,51,79);doc.text('Critérios do mês e memória de cálculo',14,18);doc.setFontSize(10);
  const r=c.regra;const texto=`Pesos: entregas ${r.pesos.entrega}%, qualidade ${r.pesos.qualidade}%, prazo ${r.pesos.prazo}%, colaboração ${r.pesos.colaboracao}%. Nota mínima: ${r.notaMinima}. Qualidade mínima: ${r.qualidadeMinima}. Teto por pessoa: ${dinheiro(r.tetoIndividual)}. Orçamento: ${dinheiro(r.orcamento)}.\nPontos = complexidade (1 a 5) × participação. Nota = soma ponderada dos critérios. Proposta = teto × nota / 100, somente quando atende aos critérios e supera a referência habitual. Horas extras são apuradas separadamente.\nReferência combinada: ${r.referencia||'Não informada.'}`;
  autoTable(doc,{startY:26,head:[['Política e referência']],body:[[texto]],styles:{fontSize:10,overflow:'linebreak',cellPadding:4},headStyles:{fillColor:[22,51,79]}});
  for(const p of c.pessoas){doc.addPage();const a=apurarPessoa(c,p);doc.setFontSize(14);doc.text(nome(p.colaboradorId),14,17);autoTable(doc,{startY:25,head:[['OS / cliente','Entrega','Participação / complexidade','Qualidade / prazo','Evidência']],body:a.linhas.map(e=>[`${e.os.numero}\n${e.os.cliente}`,formatDate(e.os.finalizadaEm),`${e.participacao}% / ${e.complexidade}`,`${qualidade[e.qualidade]} / ${prazo[e.prazo]}`,`${e.evidencia}\n${e.justificativa}`]),styles:{fontSize:9,overflow:'linebreak'},headStyles:{fillColor:[22,51,79]}});autoTable(doc,{head:[['Colaboração e contexto']],body:[[`${p.evidenciaColaboracao}\n${p.contexto}\nNotas: entrega ${a.notas.entrega===null?'A conferir':numero(a.notas.entrega)}, qualidade ${a.notas.qualidade===null?'A conferir':numero(a.notas.qualidade)}, prazo ${a.notas.prazo===null?'A conferir':numero(a.notas.prazo)}, colaboração ${a.notas.colaboracao===null?'A conferir':numero(a.notas.colaboracao)} (0 a 100).\nReferência habitual: ${p.habitual} pontos. Meta: ${p.meta} pontos.\n${p.aprovacao?.justificativa??'Proposta ainda não aprovada.'}`]],styles:{fontSize:9,overflow:'linebreak'},headStyles:{fillColor:[22,51,79]}});}
  rodapes(doc,'Confidencial RH. Proposta de bonificação; este relatório não comprova nem executa pagamento.');doc.save(`Impresilk-Performance-${c.competencia}.pdf`);
}
