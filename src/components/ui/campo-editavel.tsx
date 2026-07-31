// ============================================================================
// Campo que vira editor no clique — edição no lugar, sem abrir modal.
//
// Por quê: a ficha do colaborador mostrava dezenas de campos e, para corrigir um
// telefone, era preciso abrir o formulário inteiro, achar o campo no meio de 30
// outros, salvar e fechar. Para quem passa o dia arrumando cadastro isso é o
// trabalho todo. Aqui o valor é o próprio botão: clicou, editou, saiu — pronto.
//
// Regras de teclado: Enter (ou o ✓) salva, Esc (ou o ✗) cancela, sair do campo
// salva o que já está escrito. Os botões usam onMouseDown/preventDefault para o
// clique neles não virar um "saiu do campo" antes da hora.
//
// A regra que mais importa: sair do campo NUNCA apaga. Esvaziar um valor só vale
// quando a pessoa manda salvar de propósito — porque apagar para redigitar e ser
// interrompida por um clique é o gesto mais comum do mundo, e apagava salário,
// CPF e data de admissão em silêncio, com um "✓ salvo" verde por cima.
//
// Quem chama valida: onSalvar devolve uma mensagem de erro para recusar o valor
// (o editor continua aberto com o texto do erro) ou nada para aceitar.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export type OpcaoCampo = { valor: string; rotulo: string };
export type TipoCampoEditavel = "texto" | "numero" | "data" | "select";

export function CampoEditavel({
  label,
  exibicao,
  valor,
  tipo = "texto",
  opcoes,
  placeholder,
  dica,
  editavel = true,
  className,
  onSalvar,
}: {
  label: React.ReactNode;
  /** O que aparece quando não está editando (já formatado). */
  exibicao: React.ReactNode;
  /** Valor cru que vai para o editor (string; datas em AAAA-MM-DD). */
  valor: string;
  tipo?: TipoCampoEditavel;
  opcoes?: OpcaoCampo[];
  placeholder?: string;
  dica?: string;
  editavel?: boolean;
  className?: string;
  /** Devolva uma mensagem para RECUSAR o valor; nada para aceitar. */
  onSalvar: (novo: string) => string | void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(valor);
  const [tocado, setTocado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvouAgora, setSalvouAgora] = useState(false);
  // Input/Select do projeto não repassam ref (React 18 exigiria forwardRef);
  // o foco vai pelo container, que é o dono real do elemento.
  const caixa = useRef<HTMLDivElement>(null);
  const focar = () => caixa.current?.querySelector<HTMLElement>("input,select")?.focus();
  // "Ainda há uma edição em aberto?" — é o que impede o mesmo clique de gravar
  // duas vezes. Cancelar e salvar fecham a edição; um blur que chegue depois
  // (o navegador pode disparar ao tirar o campo da tela) encontra false e é
  // ignorado. Sem isso, o blur tardio de um select gravaria o valor ANTIGO por
  // cima do que acabou de ser escolhido — desfazendo a escolha em silêncio.
  const emAberto = useRef(false);

  // Enquanto NÃO houve digitação, o campo aberto continua acompanhando o valor
  // de fora. Isso importa porque a sincronização faz pull sozinha (a cada 20s e
  // ao voltar para a aba): sem isto, um campo aberto por engano e abandonado
  // gravaria o valor velho por cima da correção que outra pessoa acabou de
  // fazer em outro computador. Depois de digitar, o rascunho manda — ninguém
  // perde o que escreveu.
  useEffect(() => { if (!editando || !tocado) setRascunho(valor); }, [valor, editando, tocado]);
  // O "✓ salvo" some sozinho; sem o clearTimeout, trocar de campo depressa
  // deixava o aviso preso no campo anterior.
  useEffect(() => {
    if (!salvouAgora) return;
    const t = setTimeout(() => setSalvouAgora(false), 1600);
    return () => clearTimeout(t);
  }, [salvouAgora]);

  const abrir = () => { if (!editavel) return; emAberto.current = true; setRascunho(valor); setTocado(false); setErro(null); setEditando(true); };
  const fechar = () => { emAberto.current = false; setEditando(false); setTocado(false); setErro(null); };
  const cancelar = () => { fechar(); setRascunho(valor); };
  // "tocado" volta a false quando o texto retorna ao original: digitar e apagar
  // é o mesmo que não ter mexido, e deixar o latch preso fazia o campo aberto e
  // esquecido gravar o valor velho por cima do que a nuvem trouxe.
  const digitou = (v: string) => { setTocado(v !== valor); setRascunho(v); };

  /**
   * Tenta gravar.
   *
   * `explicito` = veio de Enter ou do botão ✓ (o usuário mandou salvar), contra
   * o blur (só saiu do campo). Duas diferenças:
   *
   * 1. Valor RECUSADO: no explícito o cursor volta para o campo; no blur, não —
   *    devolver o foco ali prendia a pessoa, porque cada tentativa de clicar
   *    fora revalidava e puxava o cursor de volta.
   *
   * 2. ESVAZIAR só vale no explícito. Esta é a regra que impede a família toda
   *    de perdas silenciosas: apagar o conteúdo para redigitar e ser
   *    interrompida por um clique já apagava salário, CPF e data de admissão —
   *    com um "✓ salvo" verde por cima. Campo de data é pior ainda: o navegador
   *    devolve vazio enquanto a data está pela metade. Agora, sair do campo com
   *    ele vazio não apaga nada: o editor fica aberto avisando.
   */
  const confirmar = (texto: string, explicito: boolean) => {
    if (!emAberto.current) return; // já resolvido: blur atrasado não repete a gravação
    if (texto === valor) { fechar(); return; }
    if (!explicito && texto.trim() === "" && valor !== "") {
      setErro("Sair do campo não apaga o valor. Corrija, ou aperte Esc para desistir.");
      return;
    }
    const problema = onSalvar(texto);
    if (typeof problema === "string" && problema) { setErro(problema); if (explicito) focar(); return; }
    fechar();
    setSalvouAgora(true);
  };
  const podeConfirmar = rascunho !== valor;

  // O valor gravado pode não estar na lista (gestor que foi desligado, nível
  // vazio, cargo apagado). Sem esta opção sintética o navegador exibe a PRIMEIRA
  // opção como se fosse a atual — o editor mentia sobre o que está salvo, e
  // escolher justo essa opção não disparava mudança nenhuma: fechava sem gravar,
  // em silêncio. Com ela, o que aparece é o que está gravado.
  const opcoesFinais = tipo === "select" && opcoes && !opcoes.some((o) => o.valor === rascunho)
    ? [{ valor: rascunho, rotulo: rascunho ? "(valor atual, fora da lista)" : "—" }, ...opcoes]
    : opcoes ?? [];

  return (
    <div className={cn("group", className)}>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {salvouAgora && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold normal-case text-green-700"><Check className="h-3 w-3" /> salvo</span>}
      </dt>
      {/* min-h e mensagem flutuante: abrir/fechar o editor NÃO pode mudar a
          altura da linha. Mudava — e quem corrige rápido clica no campo
          seguinte enquanto o anterior ainda está aberto: a grade subia entre o
          apertar e o soltar do mouse, o clique caía no vazio e o campo de
          destino não abria. */}
      <dd className="relative mt-1 min-h-[2rem] text-sm text-slate-800">
        {!editando ? (
          editavel ? (
            <button
              type="button"
              onClick={abrir}
              title={`Clique para editar: ${typeof label === "string" ? label : ""}`}
              /* hover:bg-slate-100 (e não brand-50) porque o tema escuro é feito
                 de regras que reescrevem classes conhecidas: brand-50 não tem
                 regra escura e pintava um fundo CLARO atrás de texto quase
                 branco — o valor sumia justo no gesto que revela que dá para
                 editar. slate-100 já é coberto pelo tema. */
              className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left -mx-1 transition hover:bg-slate-100"
            >
              {/* break-words, nunca truncate: cortar com "…" ESCONDE dado
                  (e-mail longo em coluna estreita) — o campo é para ler. */}
              <span className="min-w-0 flex-1 break-words">{exibicao}</span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" />
            </button>
          ) : (
            <span>{exibicao}</span>
          )
        ) : (
          <div ref={caixa} className="flex items-center gap-1">
            {tipo === "select" ? (
              /* O onChange NÃO grava — só anota a escolha. Gravar a cada change
                 fechava a lista na PRIMEIRA tecla: num select fechado, digitar
                 "mar" para achar "Maria" já seleciona "Marcos" no "m", grava e
                 some. Pelo teclado era pior: a primeira seta gravava o vizinho.
                 Agora vale o mesmo contrato do texto — Enter, ✓ ou sair salva. */
              <Select
                autoFocus
                value={rascunho}
                onChange={(e) => digitou(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); confirmar(rascunho, true); }
                  if (e.key === "Escape") { e.preventDefault(); cancelar(); }
                }}
                // A roda do mouse sobre um select focado troca a opção no Chrome
                // e no Firefox: rolar a página para conferir outro dado mudava a
                // escolha, e o clique seguinte gravava isso.
                onWheel={(e) => e.preventDefault()}
                onBlur={() => confirmar(rascunho, false)}
                className="h-8 py-0 text-sm"
              >
                {opcoesFinais.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </Select>
            ) : (
              /* "numero" é texto com teclado numérico, não <input type="number">.
                 O type=number devolve value="" para qualquer conteúdo que ele
                 não entenda ("2.500,38", "R$ 2.500") — e esse vazio, salvo no
                 blur, APAGAVA o salário em silêncio. Também é ele que deixa a
                 roda do mouse alterar o valor com o campo focado. Como texto,
                 quem chama lê o número no formato brasileiro e nada some. */
              <Input
                autoFocus
                type={tipo === "data" ? "date" : "text"}
                inputMode={tipo === "numero" ? "decimal" : undefined}
                value={rascunho}
                placeholder={placeholder}
                onChange={(e) => digitou(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); confirmar(rascunho, true); }
                  if (e.key === "Escape") { e.preventDefault(); cancelar(); }
                }}
                onBlur={() => confirmar(rascunho, false)}
                className="h-8 py-0 text-sm"
              />
            )}
            {podeConfirmar && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => confirmar(rascunho, true)}
                title="Salvar (Enter)"
                aria-label="Salvar alteração"
                className="shrink-0 rounded-md p-1 text-green-700 transition hover:bg-green-50"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelar}
              title="Cancelar (Esc)"
              aria-label="Cancelar edição"
              className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {(erro || (editando && dica)) && (
          <p className={cn(
            "absolute left-0 top-full z-10 mt-0.5 max-w-[22rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm",
            erro ? "font-medium text-red-600" : "text-slate-500",
          )}>
            {erro ?? dica}
          </p>
        )}
      </dd>
    </div>
  );
}
