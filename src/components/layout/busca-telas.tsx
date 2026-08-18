/* IR PARA UMA TELA DIGITANDO O NOME.
 *
 * O menu do RH tem 25 itens em 6 grupos, 11 deles em "Pessoas". Sem busca, a
 * única forma de chegar era rolar a barra e reconhecer o rótulo — e vários
 * rótulos não são o nome que a casa usa ("Frequência e Advertências" é "o
 * ponto"; "Saúde e Segurança" é "o ASO").
 *
 * Abre com Ctrl+K (ou ⌘K) e pela lupa no topo. Setas escolhem, Enter vai,
 * Esc fecha.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { buscarTelas, type TelaBuscavel } from "@/lib/buscaTelas";
import { cn } from "@/lib/cn";

export function BuscaTelas({
  telas, aberto, onFechar,
}: {
  telas: TelaBuscavel[];
  aberto: boolean;
  onFechar: () => void;
}) {
  const navigate = useNavigate();
  const [termo, setTermo] = useState("");
  const [i, setI] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  const achados = useMemo(() => buscarTelas(telas, termo), [telas, termo]);

  // Abrir de novo tem de começar limpo: manter o termo da vez passada faria a
  // lista abrir filtrada por algo que a pessoa já esqueceu que digitou.
  useEffect(() => { if (aberto) { setTermo(""); setI(0); } }, [aberto]);
  // Digitar reposiciona a escolha no primeiro: senão o Enter leva para um item
  // que saiu da lista e a pessoa vai parar numa tela que não pediu.
  useEffect(() => { setI(0); }, [termo]);

  const ir = (href: string) => { onFechar(); navigate(href); };

  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(n + 1, achados.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
    if (e.key === "Enter" && achados[i]) { e.preventDefault(); ir(achados[i].href); }
  };

  // Mantém o escolhido à vista quando se anda pelas setas numa lista longa.
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>('[data-ativo="sim"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [i]);

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Ir para…" descricao="Digite o nome da tela. Use ↑ ↓ para escolher e Enter para ir." largura="max-w-lg">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={teclado}
            placeholder="ponto, férias, ASO, folha…"
            aria-label="Buscar tela"
            className="input w-full pl-9"
          />
        </div>

        {achados.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-slate-400">
            Nenhuma tela com esse nome. Tente “ponto”, “exame”, “folha” ou “vaga”.
          </p>
        ) : (
          <ul ref={listaRef} className="max-h-[45vh] space-y-0.5 overflow-y-auto">
            {achados.map((t, n) => (
              <li key={t.href}>
                <button
                  type="button"
                  data-ativo={n === i ? "sim" : "nao"}
                  onMouseEnter={() => setI(n)}
                  onClick={() => ir(t.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                    n === i ? "bg-brand/10 text-brand-ink" : "hover:bg-slate-50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.label}</span>
                    <span className="block truncate text-xs text-slate-400">{t.grupo}</span>
                  </span>
                  {n === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
