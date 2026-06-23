import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    if (!aberto) return;
    const anteriorFoco = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    const focaveis = () =>
      dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
            (el) => el.offsetParent !== null,
          )
        : [];

    // Foco inicial dentro do modal (primeiro campo; senão o próprio diálogo).
    (focaveis()[0] ?? dialog)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onFechar();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focaveis();
      if (els.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const primeiro = els[0];
      const ultimo = els[els.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !dialog?.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || !dialog?.contains(ativo))) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      anteriorFoco?.focus?.(); // devolve o foco a quem abriu o modal
    };
  }, [aberto, onFechar]);

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
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
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
