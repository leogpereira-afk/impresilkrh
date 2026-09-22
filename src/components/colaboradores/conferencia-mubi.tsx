/* Conferência do cadastro: RH × módulo de RH do Mubisys.
 *
 * Pedido do Léo (22/09/2026): "só as conferências de dados mesmo, pra ficar
 * completo".
 *
 * POR QUE COLAR E NÃO BUSCAR: a API pública do Mubisys não expõe o módulo de
 * RH (sondei a documentação ao vivo — só cliente, fornecedor, títulos, O.S.,
 * nota fiscal, orçamento, produto e usuário). A lista de colaboradores vive
 * atrás do login do navegador. Colar o que foi copiado da tela do ERP é o
 * caminho que funciona sem ninguém entregar senha a ninguém.
 *
 * A TELA NÃO CORRIGE SOZINHA. Cada divergência mostra os dois lados e um botão
 * por linha: "usar o do Mubisys". Na primeira rodada real, em cinco casos de
 * admissão divergente não havia como saber qual lado valia — corrigir em massa
 * gravaria o errado em silêncio.
 */
import { useMemo, useState } from "react";
import { ArrowLeftRight, ClipboardPaste } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Pessoa } from "@/components/ui/pessoa";
import {
  conferirComMubisys,
  lerListaMubisys,
  resumoDaConferencia,
  type CampoConferido,
  type FichaRh,
} from "@/lib/conferenciaMubiRh";

const COMO_COPIAR =
  "No Mubisys: menu RH → Colaboradores. Selecione a tabela inteira (clique antes do primeiro nome e arraste até o fim), copie e cole aqui.";

export function ConferenciaMubi({
  fichas,
  onAplicar,
}: {
  fichas: FichaRh[];
  /** Grava UM campo de UMA pessoa. A tela nunca aplica em massa. */
  onAplicar?: (colaboradorId: string, campo: CampoConferido, valor: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const conf = useMemo(
    () => (texto.trim() ? conferirComMubisys(fichas, lerListaMubisys(texto)) : null),
    [texto, fichas],
  );

  return (
    <Card idPersistencia="painel:cadastros:conferencia-mubi">
      <CardHeader
        title="Conferir com o Mubisys"
        subtitle="Cole aqui a lista de colaboradores do ERP. A tela compara com o cadastro do RH e mostra onde os dois discordam — sem corrigir nada sozinha."
        icon={<ArrowLeftRight className="h-5 w-5" />}
      />
      <CardBody>
        <p className="mb-2 text-xs text-slate-500">{COMO_COPIAR}</p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={texto ? 4 : 6}
          placeholder="Cole aqui o que você copiou da tela do Mubisys…"
          className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs focus:border-brand-300 focus:outline-none"
        />

        {!conf ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <ClipboardPaste className="h-4 w-4" /> Nada colado ainda.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium text-brand-ink">{resumoDaConferencia(conf)}</p>

            {conf.naoLidas.length > 0 && (
              /* Linha que parecia gente e não deu para ler NUNCA some calada:
                 uma lista de 30 que lê 27 esconde três pessoas e os defeitos
                 delas junto. */
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">
                  {conf.naoLidas.length} linha(s) que eu não entendi — confira se o texto veio inteiro:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {conf.naoLidas.map((l, i) => (
                    <li key={i} className="font-mono text-[11px] text-amber-800">{l}</li>
                  ))}
                </ul>
              </div>
            )}

            <Secao titulo="Para conferir" vazio="Nada a completar nem a conferir — os dois cadastros batem.">
              {conf.pares
                .filter((p) => p.divergencias.length > 0)
                .map((p) => (
                  <div key={p.ficha.id} className="border-t border-slate-100 py-2.5 first:border-t-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                      <Pessoa colaboradorId={p.ficha.id} nome={p.ficha.nome} cpf={p.ficha.cpf} />
                      {p.casadoPor === "nome" && (
                        /* Casado pelo NOME é palpite, e quem lê precisa saber:
                           o id não bateu justamente porque o documento difere. */
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          ligado pelo nome — o CPF não casou
                        </span>
                      )}
                    </p>
                    <table className="mt-1.5 w-full text-xs">
                      <tbody>
                        {p.divergencias.map((d) => (
                          <tr key={d.campo}>
                            <td className="py-1 pr-3 text-slate-500">
                              {d.campo}
                              {d.falta && (
                                <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                                  falta no RH
                                </span>
                              )}
                            </td>
                            <td className="py-1 pr-3 tabular-nums text-slate-700">
                              RH: <strong>{d.noRh || "—"}</strong>
                            </td>
                            <td className="py-1 pr-3 tabular-nums text-slate-700">
                              Mubisys: <strong>{d.noMubisys || "—"}</strong>
                            </td>
                            <td className="py-1 text-right">
                              {/* Sem botão quando não se aplica — e com o
                                  MOTIVO ao lado. Botão desabilitado sem
                                  explicação faz quem lê achar que a tela
                                  quebrou; o motivo é o que ensina. */}
                              {d.naoAplicavel ? (
                                <span className="text-[11px] italic text-slate-400">{d.naoAplicavel}</span>
                              ) : onAplicar && d.noMubisys ? (
                                <button
                                  type="button"
                                  onClick={() => onAplicar(p.ficha.id, d.campo, d.noMubisys)}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand hover:text-brand"
                                >
                                  {d.falta ? "preencher com o do Mubisys" : "usar o do Mubisys"}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </Secao>

            <Secao
              titulo="Só no RH"
              vazio="Ninguém — todo o quadro do RH está no ERP."
              nota="Pode ser freelancer, pode ser quem o ERP ainda não cadastrou — ou ficha que sobrou."
            >
              {conf.soNoRh.map((f) => (
                <p key={f.id} className="border-t border-slate-100 py-1.5 text-sm first:border-t-0">
                  <Pessoa colaboradorId={f.id} nome={f.nome} cpf={f.cpf} />
                </p>
              ))}
            </Secao>

            <Secao
              titulo="Só no Mubisys"
              vazio="Ninguém — todo o quadro do ERP está no RH."
              nota="Gente na folha do ERP que o RH não conhece. Aqui é onde some pagamento sem ficha."
            >
              {conf.soNoMubisys.map((m) => (
                <p key={m.bruto} className="border-t border-slate-100 py-1.5 text-sm text-slate-700 first:border-t-0">
                  {m.nome} <span className="text-xs text-slate-400">· {m.cpf} · admitido em {m.admissao || "—"}</span>
                </p>
              ))}
            </Secao>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** Bloco com título — e que DIZ quando está vazio, em vez de sumir da tela. */
function Secao({
  titulo,
  vazio,
  nota,
  children,
}: {
  titulo: string;
  vazio: string;
  nota?: string;
  children: React.ReactNode;
}) {
  const temConteudo = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      {nota && <p className="mt-0.5 text-[11px] text-slate-400">{nota}</p>}
      {/* Bloco vazio não some: "nenhuma divergência" e "não conferi" são
          coisas diferentes, e sumir faz as duas parecerem a mesma. */}
      {temConteudo ? <div className="mt-1.5">{children}</div> : <p className="mt-1 text-sm text-slate-400">{vazio}</p>}
    </div>
  );
}
