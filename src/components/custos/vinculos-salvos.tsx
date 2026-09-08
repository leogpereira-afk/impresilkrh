import { useMemo } from "react";
import { Link2, Trash2, AlertTriangle, Check, CheckCircle2, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { idPessoa } from "@/lib/identidade";
import { conferirVinculos, type VinculoSalvo } from "@/lib/vinculosMubi";
import type { Colaborador } from "@/data/types";

const TEXTO: Record<NonNullable<VinculoSalvo["alerta"]>, { rotulo: string; explica: string }> = {
  generico: { rotulo: "não é uma pessoa", explica: "É uma leva do ERP, não um nome de gente. Mandaria os títulos de todo mundo para uma ficha só — o sistema já recusa, mas o vínculo continua guardado aqui." },
  "sem-ficha": { rotulo: "ficha não existe", explica: "Aponta para uma ficha que foi apagada. Os títulos com este nome ficariam sem dono." },
  "nome-diferente": { rotulo: "confira o nome", explica: "O nome do ERP não casa com o nome da ficha pela régua automática. Duas causas: erro de digitação no cadastro (aí o conserto é a ficha, e o vínculo deixa de ser preciso) ou pessoa diferente — o ERP corta o nome em 30 letras e dois nomes diferentes começam igual. Confira o CPF do título no Mubisys." },
};

/**
 * Os vínculos guardados: nome do ERP → ficha (pelo ID).
 *
 * Existe porque um vínculo errado era INVISÍVEL: ele só aparecia se o mesmo
 * nome voltasse numa importação, e enquanto isso mandava dinheiro para a ficha
 * errada em silêncio. Aqui todos ficam à vista, com o ID da pessoa ao lado do
 * nome — porque é o ID que manda, o nome só exibe.
 */
export function VinculosSalvos({
  vinculos,
  colaboradores,
  conferidos = {},
  onRemover,
  onConferir,
  onApontar,
  podeEditar,
}: {
  vinculos: Record<string, string>;
  colaboradores: Colaborador[];
  /** chave → colaboradorId já conferido (config.vinculosMubiConferidos). */
  conferidos?: Record<string, string>;
  onRemover: (chave: string) => void;
  /** "Está certo": o aviso deste par nome→ficha se cala. */
  onConferir?: (chave: string, colaboradorId: string) => void;
  /** "É outra pessoa": aponta o vínculo para a ficha certa. */
  onApontar?: (chave: string, colaboradorId: string) => void;
  podeEditar: boolean;
}) {
  const lista = useMemo(() => conferirVinculos(vinculos, colaboradores, conferidos), [vinculos, colaboradores, conferidos]);
  const comAlerta = lista.filter((v) => v.alerta).length;
  const porNome = useMemo(
    () => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [colaboradores],
  );

  return (
    <Card idPersistencia="custos:vinculos-salvos">
      <CardHeader
        icon={<Link2 className="h-5 w-5" />}
        title={`Vínculos guardados (${lista.length})`}
        subtitle="Nome do ERP → ficha. Quando o Mubisys manda um título sem CPF, é por aqui que ele acha a pessoa."
        action={comAlerta > 0 ? <Badge variant="warning">{comAlerta} para conferir</Badge> : undefined}
      />
      <CardBody>
        {lista.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum vínculo guardado. O casamento está sendo feito por CPF, ID ou nome.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map((v) => (
              <li key={v.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-mono text-xs text-slate-600">{v.chave}</span>
                <span className="text-slate-300">→</span>
                <span className="text-slate-700">{v.ficha?.nome ?? <span className="text-red-600">ficha {v.colaboradorId} não existe</span>}</span>
                {v.ficha && idPessoa(v.ficha.cpf) && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500" title="ID da pessoa (6 primeiros dígitos do CPF)">
                    ID {idPessoa(v.ficha.cpf)}
                  </span>
                )}
                {v.alerta && (
                  <span className="inline-flex items-center gap-1" title={TEXTO[v.alerta].explica}>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <Badge variant={v.alerta === "sem-ficha" ? "danger" : "warning"}>{TEXTO[v.alerta].rotulo}</Badge>
                  </span>
                )}
                {v.conferido && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700" title="Alguém olhou este par nome → ficha e disse que está certo.">
                    <CheckCircle2 className="h-3.5 w-3.5" /> conferido
                  </span>
                )}

                {/* AS TRÊS SAÍDAS. Antes só existia "Apagar" — e apagar é
                    destrutivo e nem resolve: o vínculo volta na importação
                    seguinte, porque o nome do ERP continua sem CPF. Quem olhava
                    um vínculo CERTO não tinha como dizer que está certo, e o
                    aviso ficava para sempre. */}
                {podeEditar && (
                  <span className="ml-auto flex flex-wrap items-center gap-1">
                    {onApontar && v.sugestao && (
                      <button
                        type="button"
                        className="btn-outline h-7 px-2 py-0 text-xs"
                        onClick={() => onApontar(v.chave, v.sugestao!.id)}
                        title={`Apontar este nome para ${v.sugestao.nome} — é quem o casamento automático acha para ele.`}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" /> É {v.sugestao.nome.split(" ")[0]}
                      </button>
                    )}

                    {onApontar && (
                      <Select
                        value=""
                        onChange={(e) => { if (e.target.value) onApontar(v.chave, e.target.value); }}
                        className="h-7 w-auto py-0 text-xs"
                        aria-label={`Apontar "${v.chave}" para outra ficha`}
                        title="Apontar este nome para outra ficha."
                      >
                        <option value="">é outra pessoa…</option>
                        {porNome.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </Select>
                    )}

                    {/* A régua de quem PODE ser conferido mora na lib
                        (`podeConferir`). Repeti-la aqui era o começo de duas
                        réguas divergentes sobre a mesma pergunta. */}
                    {onConferir && v.podeConferir && v.ficha && (
                      <button
                        type="button"
                        className="btn-outline h-7 px-2 py-0 text-xs text-emerald-700"
                        onClick={() => onConferir(v.chave, v.colaboradorId)}
                        title="Está certo: o aviso deste par nome → ficha se cala. Se o vínculo for reapontado depois, o aviso volta sozinho."
                      >
                        <Check className="h-3.5 w-3.5" /> Está certo
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-ghost h-7 px-2 text-xs text-slate-500 hover:text-red-600"
                      onClick={() => onRemover(v.chave)}
                      title="Apagar este vínculo. Os títulos com este nome voltam a ser casados por CPF, ID ou nome — e, sem CPF, voltam a cair em “não casados” na próxima importação."
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Apagar
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          <strong className="font-semibold">Está certo</strong> cala o aviso deste par nome → ficha (e ele volta sozinho se
          o vínculo for reapontado). <strong className="font-semibold">É outra pessoa</strong> troca a ficha sem perder o
          vínculo. <strong className="font-semibold">Apagar</strong> é o último caso: o nome volta a não casar com ninguém.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          O vínculo só vale quando o título vem <strong className="font-semibold">sem CPF</strong>: com CPF (ou com o ID escrito na descrição), a chave manda e o vínculo é ignorado.
        </p>
      </CardBody>
    </Card>
  );
}
