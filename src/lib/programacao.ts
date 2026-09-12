export * from '../../supabase/functions/_shared/programacao';
import { diasDaOrdem, pendenciasSaida, nomesDaEquipe, NOMES_REGRAS, type OrdemProgramacao } from '../../supabase/functions/_shared/programacao';
import { formatDate } from './format';
export function servicosDoDia(ordens:OrdemProgramacao[],dia:string,pessoa=''){return ordens.filter(o=>diasDaOrdem(o).includes(dia)&&(!pessoa||o.dados.participantes.some(p=>p.colaboradorId===pessoa))).sort((a,b)=>a.hora.localeCompare(b.hora)||a.numero.localeCompare(b.numero));}
const limpar=(s:string)=>s.replace(/[\r\n]+/g,' ').trim();
export const REGRA_SAIDA='Serviço só sai do Comercial com O.S. validada, prazo acordado, dossiê completo, exportação total e liberação do Diretor (na fase inicial). A saída para instalação exige confirmação com o cliente no dia, por telefone ou WhatsApp. Quem liberar a equipe sem essa confirmação responde pelos problemas causados: tempo, custo, retrabalho e desgaste.';
export const LEMBRETES=['✅ EPIs: usar os equipamentos necessários.','📸 Qualidade: fotografar o serviço finalizado e enviar no grupo da empresa.','🧹 Zelo: deixar a área limpa e organizada.','📝 Ficha de instalação: preencher e registrar observações.'];
export function mensagemProgramacao(ordens:OrdemProgramacao[],dia:string,hoje:string,pessoa=''):string {
 const lista=servicosDoDia(ordens,dia,pessoa);if(!lista.length)return '';
 const blocos=lista.map(o=>{const pendencias=pendenciasSaida(o,dia,hoje);const comerciais=[...Object.values(NOMES_REGRAS),"Referência da conferência comercial"];const p=[...(pendencias.some(x=>comerciais.includes(x))?["conferência comercial e liberação do diretor"]:[]),...pendencias.filter(x=>!comerciais.includes(x))];const motor=o.dados.participantes.find(x=>x.colaboradorId===o.dados.motoristaId);return [
  '━━━━━━━━━━━━━━━━━━━━',`⏰ *${o.hora||'Horário a definir'}${o.dados.fim?`–${o.dados.fim} (previsão)`:''}* | *O.S. ${limpar(o.numero)} — ${limpar(o.cliente)}*`,
  `🛠️ Serviço: ${limpar(o.servico)||'Conferir descrição'}`,
  `👥 Equipe: ${nomesDaEquipe(o).map(limpar).join(' e ')||'A definir'}`,
  `🚗 Veículo: ${limpar(o.veiculo)||'A definir'}${o.dados.lugares?` (${o.dados.lugares} lugares${o.dados.grade?'; possui grade':''})`:''}${motor?` | Motorista: ${limpar(motor.nome)}`:''}`,
  o.endereco&&`📍 Local: ${limpar(o.endereco)}`,
  o.finalizadaEm?'✅ Concluída no PCP.':p.length?`⚠️ *Saída pendente:* ${p.join('; ')}.`:`✅ Confirmação do dia registrada via ${o.dados.confirmado?.canal}. Conferir EPIs, materiais e liberação do veículo no PCP antes de sair.`,
  o.dados.gerenteNome&&`👤 Responsável: ${limpar(o.dados.gerenteNome)}`,
  o.dados.orientacoes&&`ℹ️ Orientações: ${limpar(o.dados.orientacoes)}`
 ].filter(Boolean).join('\n');});
 return [`🗓️ *PROGRAMAÇÃO DE INSTALAÇÃO — ${formatDate(dia)}* 🛠️`,pessoa?'Agenda selecionada para a equipe.':'Agenda do dia · Impresilk','',`⚠️ *FLUXO DE LIBERAÇÃO*\n${REGRA_SAIDA}`,'',...blocos,'━━━━━━━━━━━━━━━━━━━━','📌 *CONDUTA E SEGURANÇA*',...LEMBRETES,'','Programação sujeita à conferência de saída.'].join('\n');
}
export async function exportarProgramacao(mes:string,ordens:OrdemProgramacao[],hoje:string,dia=''){
 const {jsPDF}=await import('jspdf');const autoTable=(await import('jspdf-autotable')).default;const doc=new jsPDF({orientation:'landscape'});
 doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(22,51,79);doc.text('Impresilk | Programação de serviços',14,17);
 doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`${dia?formatDate(dia):`${mes.slice(5)}/${mes.slice(0,4)}`} | Emitido em ${new Date().toLocaleString('pt-BR')}`,14,24);
 const ocorrencias=ordens.flatMap(o=>diasDaOrdem(o).filter(d=>dia?d===dia:d.startsWith(mes)).map(d=>({o,d}))).sort((a,b)=>(a.d+a.o.hora).localeCompare(b.d+b.o.hora));
 autoTable(doc,{startY:31,margin:{left:14,right:14,bottom:22},head:[['Data / horário','O.S. / serviço','Equipe / veículo','Conferência','Orientações']],body:ocorrencias.length?ocorrencias.map(({o,d})=>[`${formatDate(d)}\n${o.hora}${o.dados.fim?`–${o.dados.fim}`:''}`,`${o.numero} | ${o.cliente}\n${o.servico}\n${o.endereco}`,`${nomesDaEquipe(o).join(', ')}\n${o.veiculo||'Veículo a definir'}${o.dados.lugares?` | ${o.dados.lugares} lugares`:''}\nMotorista: ${o.dados.participantes.find(x=>x.colaboradorId===o.dados.motoristaId)?.nome||'A definir'}`,o.finalizadaEm?'Concluída no PCP':pendenciasSaida(o,d,hoje).join('; ')||'Confirmação do dia registrada; conferir saída no PCP',`${o.dados.gerenteNome?`Responsável: ${o.dados.gerenteNome}\n`:''}${o.dados.orientacoes}`]):[['Nenhum serviço no período.','','','','']],columnStyles:{0:{cellWidth:25},1:{cellWidth:65},2:{cellWidth:70},3:{cellWidth:65},4:{cellWidth:44}},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[22,51,79]},alternateRowStyles:{fillColor:[245,248,250]}});
 doc.addPage();doc.setFontSize(16);doc.text('Liberação, conduta e segurança',14,18);autoTable(doc,{startY:26,head:[['Antes de sair']],body:[[REGRA_SAIDA],['EPIs adequados. Fotografar a entrega e enviar no grupo. Deixar a área limpa. Preencher a ficha de instalação e suas observações.']],styles:{fontSize:11,cellPadding:5},headStyles:{fillColor:[22,51,79]}});
 for(let n=1;n<=doc.getNumberOfPages();n++){doc.setPage(n);doc.setFontSize(8);doc.setTextColor(90);doc.text('Uso interno. O relatório não substitui a confirmação do dia nem a liberação da saída.',14,doc.internal.pageSize.getHeight()-11);doc.text(`${n}/${doc.getNumberOfPages()}`,275,doc.internal.pageSize.getHeight()-11);}
 doc.save(`Impresilk-Programacao-${dia||mes}.pdf`);
}
