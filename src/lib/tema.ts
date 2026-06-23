// Tema claro/escuro. A classe `dark` no <html> liga os overrides do index.css.
// Preferência persiste no localStorage; sem escolha, segue o sistema operacional.
import { useEffect, useState } from "react";

export type Tema = "claro" | "escuro";
const KEY = "impresilk.rh.v1:tema";

export function temaInicial(): Tema {
  try {
    const salvo = localStorage.getItem(KEY);
    if (salvo === "claro" || salvo === "escuro") return salvo;
  } catch {
    /* localStorage indisponível — cai no padrão do sistema */
  }
  const prefereDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefereDark ? "escuro" : "claro";
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle("dark", tema === "escuro");
  try {
    localStorage.setItem(KEY, tema);
  } catch {
    /* sem persistência — ok */
  }
}

// Hook para o botão de alternância. O tema já é aplicado no boot (main.tsx),
// então aqui só sincronizamos o estado de UI e alternamos.
export function useTema() {
  const [tema, setTema] = useState<Tema>(temaInicial);
  const alternar = () =>
    setTema((atual) => {
      const novo: Tema = atual === "escuro" ? "claro" : "escuro";
      aplicarTema(novo);
      return novo;
    });
  return { tema, alternar };
}

// Para componentes que precisam reagir ao tema (ex.: gráficos com cores via JS,
// que o CSS não alcança). Observa a classe `dark` no <html> e re-renderiza.
export function useTemaEscuro(): boolean {
  const [escuro, setEscuro] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const root = document.documentElement;
    const sincronizar = () => setEscuro(root.classList.contains("dark"));
    sincronizar();
    const obs = new MutationObserver(sincronizar);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return escuro;
}
