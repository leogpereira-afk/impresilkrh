// Só o que mudou. Formulário que grava o retrato inteiro de quando abriu apaga
// o que chegou pelo sync no meio (o pull roda a cada 20 s): o RH muda o nível
// e, sem querer, devolve o telefone velho e a faixa zerada — e o servidor
// aceita, porque a versão enviada é a do registro já atualizado pelo pull.
// Auditoria de 07/09/2026: Cargos, cadastro de colaborador, modelos de
// checklist. A regra: comparar campo a campo com o retrato de abertura e
// mandar só a diferença.
export function patchDoQueMudou<T extends object>(
  antes: T,
  depois: Partial<T>,
  opcoes: { sempre?: (keyof T)[]; nunca?: (keyof T)[] } = {},
): Partial<T> {
  const out: Partial<T> = {};
  const nunca = new Set<keyof T>(opcoes.nunca ?? []);
  const a = antes as Record<string, unknown>;
  for (const [k, v] of Object.entries(depois)) {
    if (nunca.has(k as keyof T)) continue;
    if (JSON.stringify(v ?? null) !== JSON.stringify(a[k] ?? null)) (out as Record<string, unknown>)[k] = v;
  }
  for (const k of opcoes.sempre ?? []) {
    if (nunca.has(k)) continue;
    if (k in depois) (out as Record<string, unknown>)[k as string] = (depois as Record<string, unknown>)[k as string];
  }
  return out;
}
