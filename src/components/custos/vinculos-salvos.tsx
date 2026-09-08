import { useMemo } from "react";
import { Link2, Trash2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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
  onRemover,
  podeEditar,
}: {
  vinculos: Record<string, string>;
  colaboradores: Colaborador[];
  onRemover: (chave: string) => void;
  podeEditar: boolean;
}) {
  const lista = useMemo(() => conferirVinculos(vinculos, colaboradores), [vinculos, colaboradores]);
  const comAlerta = lista.filter((v) => v.alerta).length;

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
                {podeEditar && (
                  <button
                    type="button"
                    className="btn-ghost ml-auto h-7 px-2 text-xs text-slate-500 hover:text-red-600"
                    onClick={() => onRemover(v.chave)}
                    title="Apagar este vínculo. Os títulos com este nome voltam a ser casados por CPF, ID ou nome."
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Apagar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          O vínculo só vale quando o título vem <strong className="font-semibold">sem CPF</strong>: com CPF (ou com o ID escrito na descrição), a chave manda e o vínculo é ignorado.
        </p>
      </CardBody>
    </Card>
  );
}
