import { useState } from "react";
export function usePreferenciaVisual<T>(chave: string, inicial: T) {
  const [valor, definir] = useState<T>(() => {
    try { const salvo = localStorage.getItem(`rh:visual:${chave}`); return salvo ? JSON.parse(salvo) as T : inicial; } catch { return inicial; }
  });
  const salvar = (novo: T) => {
    definir(novo);
    try { localStorage.setItem(`rh:visual:${chave}`, JSON.stringify(novo)); } catch { /* preferência não impede o uso */ }
  };
  return [valor, salvar] as const;
}
