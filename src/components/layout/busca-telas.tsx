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
import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const listaId = useId();

  const achados = useMemo(() => buscarTelas(telas, termo), [telas, termo]);
  // As permissões recebidas também podem mudar com o diálogo aberto. Nunca
  // referencie uma opção que saiu da lista, inclusive quando ela está vazia.
  const indiceAtivo = Math.max(0, Math.min(i, achados.length - 1));
  const opcaoAtivaId = achados.length ? `${listaId}-opcao-${indiceAtivo}` : undefined;

  // Abrir de novo tem de começar limpo: manter o termo da vez passada faria a
  // lista abrir filtrada por algo que a pessoa já esqueceu que digitou.
  useEffect(() => { if (aberto) { setTermo(""); setI(0); } }, [aberto]);
  // Digitar reposiciona a escolha no primeiro: senão o Enter leva para um item
  // que saiu da lista e a pessoa vai parar numa tela que não pediu.
  useEffect(() => { setI(0); }, [termo]);

  const ir = (href: string) => { onFechar(); navigate(href); };

  const teclado = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(indiceAtivo + 1, Math.max(0, achados.length - 1))); }
    if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(indiceAtivo - 1, 0)); }
    if (e.key === "Enter" && achados[indiceAtivo]) { e.preventDefault(); ir(achados[indiceAtivo].href); }
  };

  // Mantém o escolhido à vista quando se anda pelas setas numa lista longa.
  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>('[data-ativo="sim"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [opcaoAtivaId, achados]);

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Ir para…" descricao="Digite o nome da tela. Use ↑ ↓ para escolher e Enter para ir." largura="max-w-lg">
      <div className="space-y-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={aberto}
            aria-controls={listaId}
            aria-activedescendant={opcaoAtivaId}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={teclado}
            placeholder="ponto, férias, ASO, folha…"
            aria-label="Buscar tela"
            className="input w-full pl-9"
          />
        </div>

        <p role="status" aria-live="polite" aria-atomic="true" className="px-1 text-xs text-slate-500">
          {achados.length === 0
            ? "Nenhuma tela com esse nome. Tente “ponto”, “exame”, “folha” ou “vaga”."
            : `${achados.length} ${achados.length === 1 ? "tela encontrada" : "telas encontradas"}.`}
        </p>
        <ul id={listaId} ref={listaRef} role="listbox" aria-label="Telas do RH" className="max-h-[45vh] space-y-0.5 overflow-y-auto">
          {achados.map((t, n) => (
            <li
              key={t.href}
              id={`${listaId}-opcao-${n}`}
              role="option"
              aria-selected={n === indiceAtivo}
              data-ativo={n === indiceAtivo ? "sim" : "nao"}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setI(n)}
              onClick={() => ir(t.href)}
              className={cn(
                "rh-busca-resultado flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                n === indiceAtivo ? "bg-brand/10 text-brand-ink" : "hover:bg-slate-50",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium">{t.label}</span>
                <span className="block break-words text-xs text-slate-500">{t.grupo}</span>
              </span>
              {n === indiceAtivo && <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
