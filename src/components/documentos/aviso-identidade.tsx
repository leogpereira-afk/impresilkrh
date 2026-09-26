/* Aviso + botão que troca a missão, a visão e os valores ANTIGOS do Código de
 * Ética pelos de 23/09/2026 (regra em lib/identidadeNoCodigo.ts).
 *
 * Mora em DUAS telas: Documentos > Institucionais e Termos e confirmações. Em
 * 26/09 o Léo abriu Termos e confirmações -- é ali que o Código de Ética aparece
 * para ser aceito -- e o botão só existia em Documentos: ele viu a missão
 * velha e nada para trocá-la. Um componente só, para as duas telas nunca
 * divergirem.
 *
 * Só o RH vê, e só enquanto o texto velho estiver gravado. Depois do clique o
 * aviso some sozinho nas duas telas.
 */
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { comIdentidadeNova, precisaAtualizarIdentidade, VERSAO_IDENTIDADE_NOVA } from "@/lib/identidadeNoCodigo";

export function AvisoIdentidadeVelha({ className }: { className?: string }) {
  const { items, atualizar } = useColecao("institucionais");
  const sessao = useSessao();
  const toast = useToast();
  const etica = items.find((d) => d.id === "codigo-etica");
  if (!etica || !ehRH(sessao) || !precisaAtualizarIdentidade(etica.blocos)) return null;

  const trocar = () => {
    atualizar(etica.id, { blocos: comIdentidadeNova(etica.blocos), versao: VERSAO_IDENTIDADE_NOVA, atualizadoEm: new Date().toISOString() });
    toast("Código de Ética atualizado com a missão, a visão e os valores novos.");
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 ${className ?? ""}`}>
      <p className="min-w-[14rem] flex-1 text-sm text-amber-900">
        O Código de Ética ainda mostra a missão, a visão e os valores <strong>antigos</strong>. A troca muda só essa parte; Abrangência e Temas principais ficam como estão.
      </p>
      <button type="button" className="btn-primary shrink-0 whitespace-nowrap" onClick={trocar}>Atualizar para os novos</button>
    </div>
  );
}
