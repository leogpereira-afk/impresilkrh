import { useState } from "react";
import { AlertTriangle, Fingerprint } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { idDivergeDoCpf, idGravado, idQueVale, TITULO_ID_DIVERGENTE } from "@/lib/identidade";
import { previaIdPessoa, preencherIdPessoa, trocarIdPessoa, type ItemIdPessoa } from "@/lib/sync";

/* O ID DA PESSOA NA TELA DO RH (D-004, 12/10/2026).
 *
 * A ficha e o contrato de freelancer guardam o ID (`idPessoa`), que nasce no
 * servidor e não muda quando o CPF é corrigido. Aqui ficam as três peças da
 * tela:
 *   · o selo, que mostra o ID que vale (o gravado; sem ele, o do CPF) e a
 *     mesma marca do PCP quando o gravado não bate com o CPF de hoje;
 *   · a troca, só do admin, com motivo (fica no histórico);
 *   · o botão "Gravar o ID nas fichas antigas", que mostra antes o que vai
 *     gravar e só grava com a confirmação (escrita em produção só pela tela,
 *     D-005).
 *
 * QUEM VÊ: o ID gravado anda com o CPF (a porta de dados poda os dois para quem
 * não é o RH nem a própria pessoa), então quem não vê o CPF também não vê o
 * ID nem a marca. */

type Cadastro = { id: string; nome?: string; cpf?: string; idPessoa?: string; idPessoaMotivo?: string; idPessoaEm?: string };

export function SeloIdPessoa({
  cadastro, colecao, podeTrocar = false, compacto = false,
}: {
  cadastro: Cadastro;
  colecao: "colaboradores" | "freelancers";
  /** Só o admin do RH troca o ID. */
  podeTrocar?: boolean;
  compacto?: boolean;
}) {
  const [trocando, setTrocando] = useState(false);
  const id = idQueVale(colecao, cadastro);
  const gravado = idGravado(cadastro);
  const diverge = idDivergeDoCpf(cadastro);
  if (!id && !podeTrocar) return null;
  const titulo = gravado
    ? `ID da pessoa, gravado no cadastro${cadastro.idPessoaMotivo ? ` (${cadastro.idPessoaMotivo})` : ""}. Não muda quando o CPF é corrigido.`
    : "ID da pessoa: os 6 primeiros dígitos do CPF. Ainda não gravado no cadastro: o admin grava em Configurações do RH › Cadastros.";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {id && (
        <span
          className={compacto
            ? "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
            : "rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600"}
          title={titulo}
        >
          ID {id}{!gravado && <span className="ml-1 font-sans text-slate-400">(do CPF)</span>}
        </span>
      )}
      {diverge && (
        <span
          className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
          title={TITULO_ID_DIVERGENTE}
        >
          <AlertTriangle className="h-3 w-3" /> ID diferente do CPF
        </span>
      )}
      {podeTrocar && (
        <button type="button" className="btn-ghost min-h-10 px-2 py-0 text-xs" onClick={() => setTrocando(true)}>
          {gravado ? "trocar ID" : "gravar ID"}
        </button>
      )}
      {trocando && <TrocarIdPessoa cadastro={cadastro} colecao={colecao} fechar={() => setTrocando(false)} />}
    </span>
  );
}

function TrocarIdPessoa({ cadastro, colecao, fechar }: { cadastro: Cadastro; colecao: "colaboradores" | "freelancers"; fechar: () => void }) {
  const toast = useToast();
  const atual = idGravado(cadastro);
  const [novo, setNovo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const novoLimpo = novo.replace(/\D/g, "");
  const pronto = novoLimpo.length === 6 && novoLimpo !== atual && motivo.trim().length >= 10;
  const salvar = async () => {
    if (!pronto || enviando) return;
    setEnviando(true);
    try {
      const r = await trocarIdPessoa(colecao, cadastro.id, novoLimpo, motivo.trim());
      toast(`ID da pessoa gravado: ${r.idPessoa}.`);
      if (r.aviso) toast(r.aviso, "info");
      fechar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível trocar o ID.", "erro");
    } finally { setEnviando(false); }
  };
  return (
    <Modal
      aberto
      onFechar={fechar}
      titulo={atual ? "Trocar o ID da pessoa" : "Gravar o ID da pessoa"}
      descricao={`${cadastro.nome ?? "Cadastro"}${atual ? `, hoje com o ID ${atual}` : ", ainda sem ID gravado"}.`}
      rodape={
        <>
          <button className="btn-ghost" onClick={fechar}>Cancelar</button>
          <button className="btn-primary" disabled={!pronto || enviando} onClick={salvar}>
            {enviando ? "Gravando..." : atual ? "Trocar o ID" : "Gravar o ID"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Corrigir o CPF não pede troca de ID: o ID nasce com o cadastro e fica. Troque só quando o ID foi gravado
          errado. A pessoa sai das O.S., equipes e divisões do PCP gravadas com o ID antigo.
        </p>
        <Campo label="ID novo" obrigatorio hint="6 dígitos">
          <Input value={novo} inputMode="numeric" maxLength={6} autoComplete="off" onChange={(e) => setNovo(e.target.value)} />
        </Campo>
        <Campo label="Motivo" obrigatorio hint="fica no histórico de alterações">
          <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}

/** "Gravar o ID nas fichas antigas": prévia, conferência e gravação (só admin). */
export function PreencherIdPessoa() {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [previa, setPrevia] = useState<{ itens: ItemIdPessoa[]; total: number; comId: number } | null>(null);

  const abrir = async () => {
    setAberto(true); setPrevia(null); setCarregando(true);
    try { setPrevia(await previaIdPessoa()); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível conferir os cadastros.", "erro"); setAberto(false); }
    finally { setCarregando(false); }
  };
  const gravaveis = previa?.itens.filter((i) => i.idPessoa) ?? [];
  const decidir = previa?.itens.filter((i) => !i.idPessoa) ?? [];
  const gravar = async () => {
    if (!gravaveis.length || gravando) return;
    setGravando(true);
    try {
      const r = await preencherIdPessoa(gravaveis);
      toast(`ID gravado em ${r.gravados} cadastro${r.gravados === 1 ? "" : "s"}.`);
      if (r.pulados.length) toast(`${r.pulados.length} ficou${r.pulados.length === 1 ? "" : "aram"} de fora porque o cadastro mudou depois da conferência. Abra de novo para conferir.`, "info");
      if (r.aviso) toast(r.aviso, "info");
      setAberto(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível gravar.", "erro");
    } finally { setGravando(false); }
  };

  return (
    <Card>
      <CardBody className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Fingerprint className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">ID da pessoa gravado no cadastro</h2>
            <p className="text-xs text-slate-500">
              Ficha e contrato novos já nascem com o ID. Os antigos recebem por aqui: confira a lista e confirme.
              Depois de gravado, o ID não muda quando o CPF é corrigido.
            </p>
          </div>
        </div>
        <button type="button" className="btn-outline min-h-10 whitespace-nowrap" onClick={abrir}>
          Gravar o ID nas fichas antigas
        </button>
      </CardBody>
      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Gravar o ID nas fichas antigas"
        descricao="O ID que vai ser gravado é o de hoje: os 6 primeiros dígitos do CPF, ou o ID que o mesmo CPF já tem em outro cadastro. Nada é gravado antes de confirmar."
        largura="max-w-2xl"
        rodape={
          <>
            <button className="btn-ghost" onClick={() => setAberto(false)}>Cancelar</button>
            <button className="btn-primary" disabled={!gravaveis.length || gravando} onClick={gravar}>
              {gravando ? "Gravando..." : `Gravar ${gravaveis.length} ID${gravaveis.length === 1 ? "" : "s"}`}
            </button>
          </>
        }
      >
        {carregando || !previa ? (
          <p className="text-sm text-slate-500">Conferindo os cadastros...</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              {previa.comId} de {previa.total} cadastros vivos já têm o ID gravado. {gravaveis.length} vão receber agora
              {decidir.length ? `; ${decidir.length} pedem decisão e ficam de fora` : ""}.
            </p>
            {decidir.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <b>Pedem decisão</b> (não são gravados por aqui; confira o CPF ou grave o ID pela ficha):
                <ul className="mt-1 space-y-0.5">
                  {decidir.map((i) => (
                    <li key={`${i.colecao}:${i.id}`}>
                      {i.nome || i.id} {i.colecao === "freelancers" && <Badge variant="neutral">contrato</Badge>}: {i.motivo}{i.outro ? ` (${i.outro})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gravaveis.length === 0 ? (
              <p className="text-slate-500">Nenhum cadastro para gravar.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                    <tr><th className="px-3 py-1.5">Cadastro</th><th className="px-3 py-1.5">ID que vai ser gravado</th></tr>
                  </thead>
                  <tbody>
                    {gravaveis.map((i) => (
                      <tr key={`${i.colecao}:${i.id}`} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">
                          {i.nome || i.id}{" "}
                          {i.colecao === "freelancers" && <Badge variant="neutral">contrato</Badge>}{" "}
                          {i.desligado && <Badge variant="neutral">{i.colecao === "freelancers" ? "encerrado" : "desligado"}</Badge>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {i.idPessoa}{i.herdado && <span className="ml-1 font-sans text-slate-400">(do outro cadastro do mesmo CPF)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
