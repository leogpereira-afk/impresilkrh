import { Children, cloneElement, createContext, Fragment, isValidElement, useContext, useId } from "react";
import { cn } from "@/lib/cn";

type ContextoCampo = { labelId?: string; hintId?: string };
const CampoContext = createContext<ContextoCampo>({});

type AtributosCampo = Pick<React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-required">;

function atributosCampo(props: AtributosCampo, contexto: ContextoCampo): AtributosCampo {
  const descricao = [...new Set([props["aria-describedby"], contexto.hintId]
    .filter(Boolean).join(" ").split(/\s+/).filter(Boolean))].join(" ");
  return {
    "aria-labelledby": props["aria-labelledby"] ?? (props["aria-label"] ? undefined : contexto.labelId),
    "aria-describedby": descricao || undefined,
    "aria-required": props["aria-required"],
  };
}

function useAtributosCampo(props: AtributosCampo): AtributosCampo {
  const contexto = useContext(CampoContext);
  const id = useId();
  return { id: props.id ?? (contexto.labelId || contexto.hintId ? `campo-controle-${id}` : undefined), ...atributosCampo(props, contexto) };
}

/** Percorre apenas elementos HTML, Fragment e os três controles deste arquivo.
 * Componentes externos continuam intactos; seus Input/Select/Textarea recebem
 * a orientação pelo contexto, mesmo quando há wrappers intermediários.
 */
function prepararControles(children: React.ReactNode, contexto: ContextoCampo, prefixo: string, obrigatorio?: boolean) {
  // O asterisco de um grupo não torna obrigatórios o filtro nem cada checkbox.
  // Só anunciamos a exigência automaticamente para um controle direto e único.
  const diretos: React.ReactNode[] = [];
  let composto = false;
  Children.forEach(children, no => {
    if (!isValidElement<{ type?: string }>(no)) return;
    const controle = [Input, Textarea, Select, "input", "textarea", "select"].some(tipo => tipo === no.type);
    if (controle && !["checkbox", "radio", "hidden"].includes(no.props.type ?? "")) diretos.push(no);
    else if (no.type !== "datalist") composto = true;
  });
  const exigido = obrigatorio && !composto && diretos.length === 1 ? diretos[0] : undefined;
  const controles: { id: string; rotuloProprio: boolean }[] = [];
  function percorrer(nos: React.ReactNode, atual: ContextoCampo, rotuloProprio = false): React.ReactNode {
    return Children.map(nos, (no) => {
      if (!isValidElement<AtributosCampo & { children?: React.ReactNode; type?: string }>(no)) return no;
      const controle = [Input, Textarea, Select, "input", "textarea", "select"].some((tipo) => tipo === no.type);
      if (controle && no.props.type !== "hidden") {
        const id = no.props.id ?? `${prefixo}-controle-${controles.length}`;
        controles.push({ id, rotuloProprio });
        return cloneElement(no, { id, ...atributosCampo(no.props, atual),
          "aria-required": no.props["aria-required"] ?? (no === exigido || undefined),
        });
      }
      if ((typeof no.type !== "string" && no.type !== Fragment) || !no.props.children) return no;
      // Um checkbox já envolvido por um label mantém o próprio nome e clique.
      const proprio = rotuloProprio || no.type === "label";
      const proximo = proprio ? { ...atual, labelId: undefined } : atual;
      const filhos = percorrer(no.props.children, proximo, proprio);
      return cloneElement(no, undefined, no.type === "label"
        ? <CampoContext.Provider value={proximo}>{filhos}</CampoContext.Provider>
        : filhos);
    });
  }
  const filhos = percorrer(children, contexto);
  return { filhos, alvo: controles.length === 1 && !controles[0].rotuloProprio ? controles[0].id : undefined };
}

export function Campo({
  label,
  children,
  hint,
  className,
  obrigatorio,
  estado,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  obrigatorio?: boolean;
  /**
   * Pinta o campo pelo preenchimento (pedido do Leonardo, 08/09/2026): verde
   * claro quando está preenchido, vermelho quando falta e o cadastro precisa.
   * "neutro" mantém o mesmo espaçamento dos outros, sem cor — senão os campos
   * pintados ficariam maiores que os demais e a grade dançaria.
   */
  estado?: "ok" | "falta" | "neutro";
}) {
  const id = useId();
  const contexto = { labelId: label ? `campo-${id}-rotulo` : undefined, hintId: hint ? `campo-${id}-ajuda` : undefined };
  const { filhos, alvo } = prepararControles(children, contexto, `campo-${id}`, obrigatorio);
  const Rotulo = alvo ? "label" : "span";
  return (
    <CampoContext.Provider value={contexto}>
      <div className={cn(
        "rh-campo block",
        estado && "rounded-lg p-2 transition-colors",
        estado === "ok" && "bg-green-50/70",
        estado === "falta" && "bg-red-50 ring-1 ring-red-200",
        className,
      )}>
        {label && (
          <Rotulo htmlFor={alvo} className="label">
            <span id={contexto.labelId}>{label}</span> {obrigatorio && <span aria-hidden="true" className="text-red-500">*</span>}
            {estado === "falta" && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">falta</span>}
          </Rotulo>
        )}
        {filhos}
        {hint && <span id={contexto.hintId} className="rh-campo-ajuda mt-1 block text-xs text-slate-400">{hint}</span>}
      </div>
    </CampoContext.Provider>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const atributos = useAtributosCampo(props);
  return <input {...props} {...atributos} className={cn("input", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const atributos = useAtributosCampo(props);
  return <textarea {...props} {...atributos} className={cn("input min-h-[80px]", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const atributos = useAtributosCampo(props);
  return <select {...props} {...atributos} className={cn("input", props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
} & ({ label: React.ReactNode; ariaLabel?: string } | { label?: never; ariaLabel: string })) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 min-w-11 items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 rounded-full transition",
          checked ? "bg-brand" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </button>
  );
}
