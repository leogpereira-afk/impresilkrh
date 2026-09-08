import { idPessoa } from "@/lib/identidade";
import { useDominio } from "@/lib/dominio";

/**
 * A pessoa numa tela de CONFERÊNCIA: nome para ler, ID para decidir.
 *
 * Ordem do Leonardo (07/09/2026): "vamos vincular tudo ao id" · "nas
 * conferências" · "do de donos e sócios também" · "jogar id a todo o sistema
 * em todas as esferas". É a mesma regra que lib/identidade já declarava desde
 * 17/08 e que só metade das telas seguia.
 *
 * POR QUE IMPORTA JUSTAMENTE NA CONFERÊNCIA. O nome não distingue: no cadastro
 * há três fichas "José Adilando Pereira" e três "Dermeval Vieira". Numa lista
 * onde se decide o que corrigir, o que apagar e a quem vincular, escolher pelo
 * nome é escolher no escuro — e o erro é silencioso: o dinheiro sai da ficha
 * certa e entra na errada.
 *
 * O ID são os 6 primeiros dígitos do CPF, únicos entre as 93 fichas.
 *
 * O SELO BUSCA SOZINHO. Basta o `colaboradorId`; ele acha nome e CPF no
 * cadastro. Foi a segunda tentativa: a primeira atravessava um `cpfDe` de tela
 * em tela, e o `previa-folha` desenha a pessoa dentro de duas subtabelas —
 * cada uma teria de repassar a função, e a que esquecesse mostraria "sem ID"
 * para todo mundo, que é pior que não mostrar nada.
 *
 * SEM CPF É ACHADO, NÃO DETALHE: ficha sem CPF não casa pela chave forte, então
 * o pagamento dela depende de como o ERP escreveu o nome. Aparece escrito, em
 * âmbar — não some.
 */
export function Pessoa({
  colaboradorId,
  nome,
  cpf,
  className,
}: {
  /** Quem é. Com ele, nome e CPF saem do cadastro sozinhos. */
  colaboradorId?: string;
  /** Nome já resolvido (a tela costuma ter o dela, com fallback próprio). */
  nome?: string;
  /** CPF já em mãos — evita a busca quando a tela já tem a ficha. */
  cpf?: string | null;
  className?: string;
}) {
  const d = useDominio();
  const ficha = colaboradorId ? d.colabById.get(colaboradorId) : undefined;
  const doc = cpf ?? ficha?.cpf;
  const id = idPessoa(doc);
  const rotulo = nome ?? ficha?.nome ?? colaboradorId ?? "—";

  return (
    <span className={className}>
      <span className="font-medium text-slate-800">{rotulo}</span>{" "}
      {id ? (
        <span
          className="whitespace-nowrap rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium tabular-nums text-slate-500"
          title="ID da pessoa — 6 primeiros dígitos do CPF"
        >
          {id}
        </span>
      ) : (
        <span
          className="whitespace-nowrap rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800"
          title="Sem CPF no cadastro: esta ficha não casa pela chave forte, só pelo nome — e nome se repete."
        >
          sem ID
        </span>
      )}
    </span>
  );
}
