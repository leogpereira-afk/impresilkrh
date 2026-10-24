import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CampoEditavel } from './campo-editavel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let el: HTMLDivElement, root: Root;
const salvar = vi.fn();
function render(valor = 'Original', editavel = true) {
  act(() => root.render(<dl><CampoEditavel label="Exemplo" valor={valor} exibicao={valor} editavel={editavel} onSalvar={salvar} /></dl>));
}
function abrir() { act(() => el.querySelector<HTMLButtonElement>('[title="Clique para editar: Exemplo"]')!.click()); }
function digitar(valor: string) {
  const campo = el.querySelector('input')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return campo;
}
beforeEach(() => { salvar.mockReset(); el = document.createElement('div'); document.body.append(el); root = createRoot(el); render(); });
afterEach(() => { act(() => root.unmount()); el.remove(); });

it('Tab para Cancelar não salva antes de o usuário cancelar', () => {
  abrir(); digitar('Rascunho');
  const cancelar = el.querySelector<HTMLButtonElement>('[aria-label="Cancelar edição"]')!;
  act(() => cancelar.focus());
  expect(salvar).not.toHaveBeenCalled();
  act(() => cancelar.click());
  expect(salvar).not.toHaveBeenCalled();
  expect(el.textContent).toContain('Original');
});

it('perder permissão fecha o editor e descarta o rascunho sem gravar', () => {
  abrir(); digitar('Dado privado'); render('•••', false);
  expect(el.querySelector('input')).toBeNull();
  expect(el.textContent).not.toContain('Dado privado');
  expect(salvar).not.toHaveBeenCalled();
});

it('mudança remota durante a digitação não é sobrescrita ao sair nem ao salvar', () => {
  abrir(); const campo = digitar('Rascunho'); render('Atualizado na nuvem');
  act(() => campo.blur());
  expect(salvar).not.toHaveBeenCalled();
  act(() => el.querySelector<HTMLButtonElement>('[aria-label="Salvar alteração"]')!.click());
  expect(salvar).not.toHaveBeenCalled();
  expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/atualizad|alterad/i);
  expect(campo.value).toBe('Rascunho');
});

it('mudança remota sem digitação acompanha o dado novo sem gravar', () => {
  abrir(); render('Novo');
  expect(el.querySelector('input')?.value).toBe('Novo');
  act(() => el.querySelector('input')!.blur());
  expect(salvar).not.toHaveBeenCalled();
});

it('esvaziar e sair não apaga; confirmar explicitamente pode limpar', () => {
  abrir(); const campo = digitar(''); act(() => campo.blur());
  expect(salvar).not.toHaveBeenCalled();
  act(() => el.querySelector<HTMLButtonElement>('[aria-label="Salvar alteração"]')!.click());
  expect(salvar).toHaveBeenCalledTimes(1); expect(salvar).toHaveBeenCalledWith('');
});

it('falha de gravação mantém o texto e mostra erro sem confirmar salvo', () => {
  salvar.mockImplementation(() => { throw new Error('Falha fictícia'); });
  abrir(); digitar('Rascunho');
  act(() => el.querySelector<HTMLButtonElement>('[aria-label="Salvar alteração"]')!.click());
  expect(el.querySelector('input')?.value).toBe('Rascunho');
  expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/salvar|gravar/i);
  expect(el.textContent).not.toContain('salvo');
});

it('chips preservam opção legada e só gravam depois de confirmar', () => {
  act(() => root.render(<dl><CampoEditavel label="Empresa" valor="Empresa antiga" exibicao="Empresa antiga" tipo="chips" opcoes={[{ valor: 'nova', rotulo: 'Nova' }]} onSalvar={salvar} /></dl>));
  act(() => el.querySelector<HTMLButtonElement>('[title="Clique para editar: Empresa"]')!.click());
  expect(el.querySelector('[aria-pressed="true"]')?.textContent).toContain('Empresa antiga');
  act(() => el.querySelector<HTMLButtonElement>('[aria-pressed="false"]')!.click());
  expect(salvar).not.toHaveBeenCalled();
  act(() => el.querySelector<HTMLButtonElement>('[aria-label="Salvar alteração"]')!.click());
  expect(salvar).toHaveBeenCalledWith('nova'); expect(salvar).toHaveBeenCalledTimes(1);
});
it('seleção desconhecida não vira a primeira opção ao abrir', () => {
  act(() => root.render(<dl><CampoEditavel label="Lista" valor="Legado" exibicao="Legado" tipo="select" opcoes={[{ valor: 'primeiro', rotulo: 'Primeiro' }]} onSalvar={salvar} /></dl>));
  act(() => el.querySelector<HTMLButtonElement>('[title="Clique para editar: Lista"]')!.click());
  expect(el.querySelector('select')?.value).toBe('Legado');
  act(() => el.querySelector('select')!.blur()); expect(salvar).not.toHaveBeenCalled();
});
it('um blur tardio não duplica a gravação', () => {
  abrir(); const campo = digitar('Novo');
  act(() => el.querySelector<HTMLButtonElement>('[aria-label="Salvar alteração"]')!.click());
  act(() => campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  expect(salvar).toHaveBeenCalledTimes(1);
});
