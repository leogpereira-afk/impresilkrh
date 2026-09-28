/* CADASTRAR A OPÇÃO SEM SAIR DO CADASTRO.
 *
 * Pedido do Léo (28/09/2026), olhando o formulário da pessoa: "nas áreas
 * selecionáveis preciso conseguir cadastrar opções, ou saber o local onde
 * posso fazer isso lá em configurações, ou então no próprio card ter uma aba
 * de edição". As opções de Área, Cargo, Nível e Status sempre foram editáveis,
 * mas em Configurações do RH, e nada no cadastro dizia isso: quem não achava a
 * área certa ficava sem ter o que escolher.
 *
 * Duas saídas, ao lado de cada lista:
 *  - o "+" cria a opção ali mesmo, só com o nome, e já a deixa escolhida. Só
 *    existe onde o nome basta (Área e Cargo). Status tem regra (conta no
 *    quadro? é ausência?) e Nível é a régua fixa N1 a N5: esses não se criam
 *    pela metade num campo de nome.
 *  - a engrenagem abre a lista completa em Configurações do RH, NUMA ABA NOVA:
 *    o que já foi digitado no cadastro continua aqui. O que for salvo lá
 *    aparece aqui sozinho (a loja escuta a outra aba).
 *
 * Só o RH vê os botões: Configurações do RH é tela só do RH, e criar área ou
 * cargo muda a estrutura da empresa para todo mundo.
 *
 * DENTRO DE UM <label>. O Campo (components/ui/form) embrulha tudo num label,
 * e isso cobra dois cuidados (achados da revisão de 28/09/2026):
 *  - o nome que o leitor de tela anuncia no select viria do label INTEIRO,
 *    botões e painel juntos; por isso o select recebe o nome do campo em
 *    aria-label, que tem precedência;
 *  - clique numa parte "vazia" do label (o vão entre os botões, o fundo do
 *    painel) manda o foco para o select e tira o cursor do nome que se está
 *    digitando; esses cliques são barrados.
 */
import { cloneElement, isValidElement, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/form";

export function OpcoesDaLista({
  children,
  nomeCampo,
  podeEditar,
  novoRotulo,
  listaRotulo,
  ondeEditar,
  onCriar,
}: {
  /** O <Select> de sempre. */
  children: React.ReactElement;
  /** "Área", "Cargo"... vira o nome acessível do select. */
  nomeCampo: string;
  /** Falso para quem não é do RH: a lista aparece sozinha, sem botões. */
  podeEditar: boolean;
  /** "Nova área", "Novo cargo". Sem ele (e sem onCriar), não há "+". */
  novoRotulo?: string;
  /** "áreas", "status"... para os textos da engrenagem. */
  listaRotulo: string;
  /** Rota da lista completa em Configurações do RH. */
  ondeEditar: string;
  /** Cria a opção. Devolva uma mensagem para RECUSAR; nada para aceitar. */
  onCriar?: (nome: string) => string | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const maisRef = useRef<HTMLButtonElement>(null);
  if (!podeEditar) return children;

  const select = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ "aria-label"?: string }>, { "aria-label": nomeCampo })
    : children;

  /* Fechar devolve o foco ao "+". Sem isso o foco caía no nada quando o painel
     sumia, e o Tab seguinte pulava para o X do modal: um Espaço ali, achando
     que era a lista de Cargo, fechava o cadastro com tudo o que foi digitado. */
  const fechar = () => {
    setAberto(false); setNome(""); setErro(null);
    requestAnimationFrame(() => maisRef.current?.focus());
  };
  const criar = () => {
    const n = nome.trim().replace(/\s+/g, " ");
    if (!n) { setErro("Escreva o nome."); return; }
    const recusa = onCriar?.(n);
    if (recusa) { setErro(recusa); return; }
    fechar();
  };

  return (
    <div>
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
      >
        <div className="min-w-0 flex-1">{select}</div>
        {onCriar && novoRotulo && (
          <button
            ref={maisRef}
            type="button"
            className="btn-outline h-[42px] w-[42px] shrink-0 p-0"
            title={`${novoRotulo}: cadastrar aqui mesmo`}
            aria-label={`${novoRotulo}: cadastrar aqui mesmo`}
            aria-expanded={aberto}
            onClick={() => (aberto ? fechar() : setAberto(true))}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        <Link
          to={ondeEditar}
          target="_blank"
          rel="noopener"
          className="btn-ghost h-[42px] w-[42px] shrink-0 p-0 text-slate-500"
          title={`Editar a lista de ${listaRotulo} em Configurações do RH (abre em outra aba)`}
          aria-label={`Editar a lista de ${listaRotulo} em Configurações do RH (abre em outra aba)`}
        >
          <Settings2 className="h-4 w-4" />
        </Link>
      </div>
      {aberto && (
        // Clique no fundo do painel não é clique no label: não rouba o foco.
        // (Os botões e o campo recebem o clique antes; aqui só se cancela o
        // efeito do label, que é o que vem depois.)
        <div className="mt-1.5 rounded-lg border border-brand-100 bg-brand-50/40 p-2" onClick={(e) => e.preventDefault()}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              autoFocus
              value={nome}
              onChange={(e) => { setNome(e.target.value); setErro(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); criar(); }
                // Escape desiste do nome novo, não do cadastro inteiro.
                if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); }
              }}
              placeholder={novoRotulo}
              aria-label={novoRotulo}
              className="min-w-0 flex-[1_1_9rem]"
            />
            <button type="button" className="btn-primary h-[42px] px-3" onClick={criar}>Criar</button>
            <button type="button" className="btn-ghost h-[42px] px-3" onClick={fechar}>Cancelar</button>
          </div>
          {erro && <p role="alert" className="mt-1 text-xs text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}
