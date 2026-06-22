import type { ModeloChecklist, Tarefa } from "./types";
import { HOJE, addDias } from "./_gen";

// Modelos de checklist (editáveis no Painel de Controle)
export const MODELOS_CHECKLIST: ModeloChecklist[] = [
  {
    id: "modelo-onboarding",
    tipo: "Admissão",
    itens: [
      { titulo: "Assinatura do contrato de trabalho", responsavel: "RH" },
      { titulo: "Entrega e conferência de documentos (RG, CPF, CTPS)", responsavel: "RH" },
      { titulo: "Exame admissional (ASO)", responsavel: "SST" },
      { titulo: "Cadastro no eSocial", responsavel: "RH" },
      { titulo: "Abertura de conta salário / dados bancários", responsavel: "RH" },
      { titulo: "Entrega de uniforme e EPIs", responsavel: "SST" },
      { titulo: "Criação de e-mail e acessos", responsavel: "Gestor" },
      { titulo: "Apresentação à equipe e tour pela empresa", responsavel: "Gestor" },
      { titulo: "Tour e conhecimento das instalações físicas", responsavel: "Gestor" },
      { titulo: "Leitura e aceite do Código de Ética", responsavel: "Colaborador" },
      { titulo: "Treinamento inicial completo do cargo", responsavel: "Gestor" },
      { titulo: "Aplicação do Perfil Comportamental", responsavel: "RH" },
      { titulo: "Designação de Padrinho (mentor)", responsavel: "Gestor" },
    ],
  },
  {
    id: "modelo-offboarding",
    tipo: "Desligamento",
    itens: [
      { titulo: "Comunicado e aviso prévio", responsavel: "RH" },
      { titulo: "Exame demissional (ASO)", responsavel: "SST" },
      { titulo: "Devolução de uniforme, EPIs e equipamentos", responsavel: "Gestor" },
      { titulo: "Revogação de acessos e e-mail", responsavel: "Gestor" },
      { titulo: "Cálculo das verbas rescisórias", responsavel: "RH" },
      { titulo: "Baixa na CTPS e eSocial", responsavel: "RH" },
      { titulo: "Entrevista de desligamento", responsavel: "RH" },
      { titulo: "Homologação e entrega de documentos", responsavel: "RH" },
    ],
  },
];

const onboarding = MODELOS_CHECKLIST[0].itens;
const offboarding = MODELOS_CHECKLIST[1].itens;
const lista: Tarefa[] = [];

// Onboarding em andamento para as admissões mais recentes
["daniel-pereira-de-oliveira", "candida-elia-david-barros"].forEach((cid) => {
  onboarding.forEach((t, i) => {
    lista.push({
      id: `tar-on-${cid}-${i}`,
      colaboradorId: cid,
      tipo: "Admissão",
      titulo: t.titulo,
      responsavel: t.responsavel,
      ordem: i,
      concluida: i < 6,
      concluidaEm: i < 6 ? addDias(HOJE, -(10 - i)) : null,
    });
  });
});

// Offboarding concluído para os desligados
["tiago-mendes-rocha", "patricia-gomes-lopes"].forEach((cid) => {
  offboarding.forEach((t, i) => {
    lista.push({
      id: `tar-off-${cid}-${i}`,
      colaboradorId: cid,
      tipo: "Desligamento",
      titulo: t.titulo,
      responsavel: t.responsavel,
      ordem: i,
      concluida: true,
      concluidaEm: addDias(HOJE, -(20 - i)),
    });
  });
});

export const TAREFAS: Tarefa[] = lista;
