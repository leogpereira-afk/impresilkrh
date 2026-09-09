import { describe, expect, it } from 'vitest';
import { incluirPagamentoNaConferencia, pagamentoIdentificadoDePessoa, prepararReferenciasPessoas } from '../../supabase/functions/_shared/pagamentosPessoas';
const ref=prepararReferenciasPessoas([{nome:'Ana Maria Santos',cpf:'123.456.789-09'}],['17']);
describe('pagamento de pessoa independe da conta',()=>{
 it('aceita colaborador do ERP, CPF cadastrado, nome completo e vínculo decidido',()=>{
  expect(pagamentoIdentificadoDePessoa({origem_tipo:'Colaborador'},ref)).toBe(true);
  expect(pagamentoIdentificadoDePessoa({origem_tipo:'Fornecedor',origem_cnpj:'12345678909'},ref)).toBe(true);
  expect(pagamentoIdentificadoDePessoa({origem:'ANA MARIA SANTOS'},ref)).toBe(true);
  expect(pagamentoIdentificadoDePessoa({despesa:'Curso Ana Maria Santos'},ref)).toBe(true);
  expect(pagamentoIdentificadoDePessoa({id:17},ref)).toBe(true);
 });
 it('a conta não exclui pagamento de pessoa e a autorização continua prevalecendo',()=>{
  expect(incluirPagamentoNaConferencia({origem_tipo:'Colaborador'},ref,false,false)).toBe(true);
  expect(incluirPagamentoNaConferencia({origem_tipo:'Colaborador'},ref,true,true)).toBe(false);
  expect(incluirPagamentoNaConferencia({origem_tipo:'Fornecedor',origem:'Loja de Materiais'},ref,false,false)).toBe(false);
 });
 it('rubrica freelancer e nomes parciais não identificam nem classificam uma pessoa',()=>{
  expect(pagamentoIdentificadoDePessoa({descricao:'Freelancer Empreita'},ref)).toBe(false);
  expect(pagamentoIdentificadoDePessoa({origem:'Ana'},ref)).toBe(false);
  expect(pagamentoIdentificadoDePessoa({origem_cnpj:'11111111111'},prepararReferenciasPessoas([{cpf:'11111111111'}]))).toBe(false);
 });
});
