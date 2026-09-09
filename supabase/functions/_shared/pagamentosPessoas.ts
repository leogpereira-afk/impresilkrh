/** A conta classifica a verba; não pode excluir um pagamento identificado de pessoa. */
export function normalizarPessoa(valor: unknown): string {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
}
export interface ReferenciasPessoas { cpfs: Set<string>; nomes: Set<string>; titulos: Set<string> }
export function prepararReferenciasPessoas(pessoas: {cpf?: unknown; nome?: unknown}[], titulos: string[] = []): ReferenciasPessoas {
  return { cpfs: new Set(pessoas.map(p=>String(p.cpf??'').replace(/\D/g,'')).filter(c=>/^\d{11}$/.test(c)&&! /^(\d)\1{10}$/.test(c))), nomes: new Set(pessoas.map(p=>normalizarPessoa(p.nome)).filter(n=>n.split(' ').length>=2)), titulos: new Set(titulos) };
}
export function pagamentoIdentificadoDePessoa(item: {id?: unknown; origem_tipo?: unknown; origem?: unknown; origem_cnpj?: unknown; descricao?: unknown; despesa?: unknown}, ref: ReferenciasPessoas): boolean {
  if (normalizarPessoa(item.origem_tipo)==='COLABORADOR') return true;
  if (ref.titulos.has(String(item.id??''))) return true;
  const cpf=String(item.origem_cnpj??'').replace(/\D/g,'');
  if (cpf && ref.cpfs.has(cpf)) return true;
  const origem=normalizarPessoa(item.origem);
  if (origem && ref.nomes.has(origem)) return true;
  const texto=` ${normalizarPessoa(`${item.descricao??''} ${item.despesa??''}`)} `;
  // Nome completo só traz o candidato à prévia. Vínculo continua sendo revisto pelo RH.
  return [...ref.nomes].some(nome=>texto.includes(` ${nome} `));
}

export function incluirPagamentoNaConferencia(item: Parameters<typeof pagamentoIdentificadoDePessoa>[0], ref: ReferenciasPessoas, contaAceita: boolean, confidencial: boolean): boolean {
  return !confidencial && (contaAceita || pagamentoIdentificadoDePessoa(item, ref));
}
