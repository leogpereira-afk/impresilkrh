import { useMemo, useState } from "react";
import { Briefcase, Trophy, Send, Users, Undo2, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Campo, Textarea } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/misc";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { Vaga, EtapaCandidato } from "@/data/types";

// Mural de vagas internas: o colaborador vê as vagas que o RH marcou para
// divulgação interna, candidata-se ("disputa") e acompanha a própria etapa.
// Transparência com privacidade: o nº de disputantes é público; os NOMES dos
// outros candidatos, só o RH vê (na página de Vagas).

const corEtapa = (e: EtapaCandidato) =>
  e === "Contratado" || e === "Aprovado" ? "success" : e === "Reprovado" ? "danger" : e === "Entrevista" || e === "Teste" ? "info" : "neutral";

export default function MuralVagas() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items: vagas } = useColecao("vagas");
  const { items: candidatos, criar, remover } = useColecao("candidatos");

  const [candidatar, setCandidatar] = useState<Vaga | null>(null);
  const [motivacao, setMotivacao] = useState("");
  const [retirar, setRetirar] = useState<{ vaga: Vaga; candId: string } | null>(null);

  const eu = sessao ? d.colabById.get(sessao.colaboradorId) : undefined;

  const emDisputa = useMemo(
    () =>
      vagas
        .filter((v) => v.divulgacaoInterna && (v.status === "Aberta" || v.status === "Em triagem"))
        .sort((a, b) => String(b.dataAbertura ?? "").localeCompare(String(a.dataAbertura ?? ""))),
    [vagas],
  );

  const internosDaVaga = (vagaId: string) => candidatos.filter((c) => c.vagaId === vagaId && c.colaboradorId);
  const minhaCandidatura = (vagaId: string) =>
    eu ? candidatos.find((c) => c.vagaId === vagaId && c.colaboradorId === eu.id) : undefined;

  const enviar = () => {
    if (!eu || !candidatar) return;
    if (minhaCandidatura(candidatar.id)) {
      toast("Você já está disputando esta vaga.", "info");
      setCandidatar(null);
      return;
    }
    criar({
      vagaId: candidatar.id,
      colaboradorId: eu.id,
      nome: eu.nome,
      origem: "Interno",
      etapa: "Triagem",
      observacao: motivacao.trim() ? `Motivação: ${motivacao.trim()}` : undefined,
      criadoEm: new Date().toISOString(),
    });
    toast("Candidatura enviada! O RH vai analisar a disputa.", "sucesso");
    setCandidatar(null);
    setMotivacao("");
  };

  if (!eu) {
    return <EmptyState title="Perfil indisponível" description="Entre com o seu usuário para ver o mural de vagas." icon={<Briefcase className="h-8 w-8" />} />;
  }

  return (
    <div>
      <PageHeader
        title="Mural de Vagas"
        description="Vagas em divulgação interna. Candidate-se e acompanhe a disputa — o número de participantes é público; os nomes, só o RH vê."
      />

      {emDisputa.length === 0 ? (
        <EmptyState
          title="Nenhuma vaga em disputa no momento"
          description="Quando o RH divulgar uma vaga internamente, ela aparece aqui."
          icon={<Trophy className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          {emDisputa.map((v) => {
            const internos = internosDaVaga(v.id);
            const minha = minhaCandidatura(v.id);
            return (
              <Card key={v.id} className="overflow-hidden">
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Briefcase className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{v.titulo}</p>
                      <p className="truncate text-xs text-slate-400">
                        {d.nomeArea(v.areaId)}
                        {v.cargoId ? ` · ${d.cargoById.get(v.cargoId)?.nome ?? ""}` : ""}
                        {v.nivelId ? ` · ${v.nivelId}` : ""}
                        {v.quantidade && v.quantidade > 1 ? ` · ${v.quantidade} posições` : ""}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      <Trophy className="h-3.5 w-3.5" /> {internos.length} disputando
                    </span>
                    {v.dataAbertura && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" /> desde {formatDate(v.dataAbertura)}
                      </span>
                    )}
                  </div>

                  {(v.descricao || v.requisitos) && (
                    <div className="space-y-1 rounded-lg bg-slate-50/60 p-3 text-xs text-slate-600">
                      {v.descricao && <p><span className="font-medium text-slate-700">O que você vai fazer:</span> {v.descricao}</p>}
                      {v.requisitos && <p><span className="font-medium text-slate-700">O que precisa:</span> {v.requisitos}</p>}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {minha ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Sua candidatura:</span>
                        <Badge variant={corEtapa(minha.etapa)}>{minha.etapa === "Triagem" ? "Em análise" : minha.etapa}</Badge>
                        {minha.etapa === "Triagem" && (
                          <button
                            className="btn-ghost h-8 px-2 py-0 text-xs text-slate-500 hover:text-red-600"
                            onClick={() => setRetirar({ vaga: v, candId: minha.id })}
                          >
                            <Undo2 className="h-3.5 w-3.5" /> Retirar candidatura
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400"><Users className="mr-1 inline h-3.5 w-3.5" />Disputa aberta a todos os colaboradores.</p>
                    )}
                    {!minha && (
                      <button className="btn-primary" onClick={() => { setMotivacao(""); setCandidatar(v); }}>
                        <Send className="h-4 w-4" /> Quero disputar esta vaga
                      </button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {candidatar && (
        <Modal
          aberto
          onFechar={() => setCandidatar(null)}
          titulo={`Disputar: ${candidatar.titulo}`}
          descricao="Sua candidatura vai para o RH com seus dados do cadastro. Conte por que você quer a vaga."
          largura="max-w-lg"
          rodape={
            <>
              <button className="btn-outline" onClick={() => setCandidatar(null)}>Cancelar</button>
              <button className="btn-primary" onClick={enviar}><Send className="h-4 w-4" /> Enviar candidatura</button>
            </>
          }
        >
          <Campo label="Por que você quer esta vaga?" hint="Opcional, mas ajuda o RH a conhecer sua motivação.">
            <Textarea rows={4} value={motivacao} onChange={(e) => setMotivacao(e.target.value)} placeholder="Ex.: Já ajudo o setor nas urgências, quero crescer nessa função…" />
          </Campo>
        </Modal>
      )}

      <ConfirmDialog
        aberto={!!retirar}
        onFechar={() => setRetirar(null)}
        onConfirmar={() => {
          if (retirar) {
            remover(retirar.candId);
            toast("Candidatura retirada.");
          }
          setRetirar(null);
        }}
        titulo="Retirar candidatura"
        mensagem={retirar ? `Sair da disputa pela vaga "${retirar.vaga.titulo}"?` : ""}
        textoConfirmar="Retirar"
      />
    </div>
  );
}
