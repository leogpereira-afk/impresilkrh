import { expect, it } from 'vitest';
import { erroContatosCadastro, erroDatasCadastro } from './edicaoCadastro';
const hoje = new Date(2026, 9, 24, 12);
it.each(['2026-02-30', '2026-13-01', 'data inválida'])('início no cargo recusa data inexistente %s', dataInicioCargo => {
  expect(erroDatasCadastro({ dataInicioCargo }, null, hoje)).toContain('dia não existe');
});
it.each([
  { dataInicioCargo: '2026-10-25' },
  { dataInicioCargo: '2020-01-01', dataAdmissao: '2021-01-01' },
  { dataInicioCargo: '2021-01-01', dataDesligamento: '2020-01-01' },
])('início no cargo respeita a sequência e o dia atual: %j', dados => expect(erroDatasCadastro(dados, null, hoje)).toBeTruthy());
it('data legada inconsistente não bloqueia uma correção de contato', () => {
  const antes = { dataInicioCargo: '2010-01-01', dataAdmissao: '2020-01-01' };
  expect(erroDatasCadastro({ ...antes, telefone: '(00) 90000-0000' }, antes, hoje)).toBeNull();
});
it.each(['(00) 90000-0000', '(00) 0000-0000', '+55 (00) 90000-0000', '+1 202 555 0100', '5500900000000', '', undefined])('aceita telefone completo ou opcional %s', telefone => expect(erroContatosCadastro({ telefone })).toBeNull());
it.each(['1', '00000-0000', 'telefone', 'abc00900000000', '+1', '++5500900000000'])('recusa telefone incompleto ou malformado %s', telefone => expect(erroContatosCadastro({ telefone })).toContain('DDD'));
it.each(['00000000', '00000-000', '', undefined])('CEP opcional ou válido %s', enderecoCep => expect(erroContatosCadastro({ enderecoCep })).toBeNull());
it.each(['123', '123456789', 'abcde-fgh'])('recusa CEP malformado %s', enderecoCep => expect(erroContatosCadastro({ enderecoCep })).toContain('CEP'));
it('contatos legados não impedem editar outra informação', () => {
  const antes = { telefone: 'antigo', enderecoCep: 'incompleto', conjugeTelefone: 'não cadastrado' };
  expect(erroContatosCadastro({ ...antes, conjugeNome: 'Nome Fictício' }, antes)).toBeNull();
});
