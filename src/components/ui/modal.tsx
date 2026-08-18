import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* PILHA DOS MODAIS ABERTOS.
 *
 * O sistema empilha modal sobre modal — a prévia da sincronização, que é a
 * tela mais destrutiva que existe aqui, abre POR CIMA do painel de
 * Sincronização. Sem esta pilha, todos os modais abertos ouviam a mesma tecla:
 *
 *  - um Escape para desistir da prévia fechava também o painel de trás, sem
 *    aviso;
 *  - o Tab era disputado por dois donos ao mesmo tempo, cada um devolvendo o
 *    cursor para o começo do SEU modal — na prática o cursor ficava preso e
 *    "Cancelar" e "Sobrescrever" só davam para alcançar com o mouse.
 *
 * É a pilha também que decide quando devolver a rolagem ao fundo: quem fecha
 * por cima não pode destravar a página enquanto ainda houver modal aberto.
 */
const pilha: HTMLElement[] = [];

export function Modal({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  /* `onFechar` quase sempre é escrito na hora — `onFechar={() => setNovo(false)}`,
     em 90 das 132 chamadas de <Modal> no sistema. Uma função escrita assim nasce
     diferente a cada desenho, então tê-la na lista de dependências abaixo fazia
     o efeito rodar OUTRA VEZ a cada letra digitada, e a cada vez ele devolvia o
     foco ao começo do modal (o "X" de fechar). Quem preenchia digitava uma letra
     e o cursor sumia do campo; com o foco no "X", um espaço fechava o modal e
     levava o preenchimento junto.

     O ref guarda sempre a versão mais nova da função sem que a identidade dela
     mande no efeito — o efeito passa a rodar só quando o modal abre ou fecha,
     que é quando o foco de fato precisa mudar. Provado em modal.test.tsx. */
  const fecharRef = useRef(onFechar);
  useEffect(() => { fecharRef.current = onFechar; }, [onFechar]);

  useEffect(() => {
    if (!aberto) return;
    const anteriorFoco = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    pilha.push(dialog);
    document.body.style.overflow = "hidden";

    const visiveis = (raiz: HTMLElement) =>
      Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
        (el) => el.offsetParent !== null,
      );
    const focaveis = () => visiveis(dialog);

    /* FOCO INICIAL: o corpo, nunca o cabeçalho.
       O primeiro focável do diálogo inteiro é o "X" de fechar, porque ele vem
       antes de tudo no HTML. Mandar o foco para lá quer dizer que abrir um
       modal e começar a digitar não escreve nada — e que a primeira tecla, se
       for espaço ou Enter, FECHA o modal e leva o preenchimento junto.

       Se o conteúdo já pegou o foco sozinho (autoFocus, como no campo Título de
       "Nova vaga"), não se mexe: quem escreveu o autoFocus sabia onde queria o
       cursor, e roubá-lo de volta desfaz a intenção.

       Sem nada focável no corpo — o caso do ConfirmDialog, que é só um texto —
       o foco vai para o próprio diálogo, e não para o botão de confirmar: num
       diálogo de exclusão, deixar "Excluir" focado transforma um Enter distraído
       em registro apagado. */
    if (!dialog.contains(document.activeElement)) {
      const corpo = dialog.querySelector<HTMLElement>("[data-modal-corpo]");
      (((corpo && visiveis(corpo)[0]) || dialog)).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      // Só o modal do topo responde: ver o comentário da pilha, acima.
      if (pilha[pilha.length - 1] !== dialog) return;
      if (e.key === "Escape") {
        fecharRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focaveis();
      if (els.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const primeiro = els[0];
      const ultimo = els[els.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !dialog.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || !dialog.contains(ativo))) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = pilha.indexOf(dialog);
      if (i >= 0) pilha.splice(i, 1);
      // Só devolve a rolagem quando o ÚLTIMO modal sai de cena.
      if (pilha.length === 0) document.body.style.overflow = "";
      anteriorFoco?.focus?.(); // devolve o foco a quem abriu o modal
    };
    // Só `aberto`: ver o comentário do fecharRef acima.
  }, [aberto]);

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm" onClick={onFechar} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative my-8 w-full animate-fade-in rounded-2xl bg-white shadow-xl outline-none",
          largura,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id={tituloId} className="text-base font-semibold text-brand-ink">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
          </div>
          <button onClick={onFechar} className="btn-ghost -mr-2 p-1.5" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* data-modal-corpo: é daqui que sai o foco inicial — do CORPO, não do
            cabeçalho, onde mora o "X". Ver o efeito lá em cima. */}
        <div data-modal-corpo className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  aberto,
  onFechar,
  onConfirmar,
  titulo,
  mensagem,
  textoConfirmar = "Excluir",
  perigo = true,
}: {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
  titulo: string;
  mensagem: React.ReactNode;
  textoConfirmar?: string;
  perigo?: boolean;
}) {
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      largura="max-w-md"
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>
            Cancelar
          </button>
          <button
            className={perigo ? "btn-danger" : "btn-primary"}
            onClick={() => {
              onConfirmar();
              onFechar();
            }}
          >
            {textoConfirmar}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{mensagem}</p>
    </Modal>
  );
}
