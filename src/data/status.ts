import type { StatusColaborador } from "./types";

// Apêndice G — Status do quadro (cada status tem uma cor e define o headcount)
//
// ATENÇÃO — ESTA LISTA É SEMENTE, NÃO É A VERDADE DO CADASTRO.
// Ela só vale para quem abre o RH sem nada gravado (e para "restaurar padrão").
// Quem já usa o sistema tem a coleção `status` no disco e na nuvem, e o Léo já
// criou outros por lá pela tela — "Atestado médico" e "Abandono" existem no
// banco e NÃO estão aqui. Por isso acrescentar um status neste arquivo não o
// faz aparecer no cadastro de quem já usa: para isso existe o botão
// "Repor status padrão" no Painel de Controle (lib/statusPadrao.ts).
export const STATUS: StatusColaborador[] = [
  { id: "ativo", nome: "Ativo", cor: "#16a34a", contaComoAtivo: true, ordem: 1 },
  { id: "experiencia", nome: "Em experiência", cor: "#2563eb", contaComoAtivo: true, ordem: 2 },
  { id: "aviso", nome: "Aviso prévio", cor: "#f59e0b", contaComoAtivo: true, ordem: 3 },
  { id: "afastado", nome: "Afastado", cor: "#d97706", contaComoAtivo: true, ordem: 4 },
  { id: "inativo", nome: "Inativo", cor: "#64748b", contaComoAtivo: false, ordem: 5 },
  { id: "direcao", nome: "Direção", cor: "#16334f", contaComoAtivo: false, ordem: 6 },
  { id: "externo", nome: "Externo", cor: "#8b5cf6", contaComoAtivo: false, ordem: 7 },
  // Quem PAROU de ser CLT e continua trabalhando por empreita. Pedido do Léo em
  // 07/09/2026: "tem funcionários que param de trabalhar e vão para freelancer,
  // eles têm que ir pra lá" — e ele quer essa gente DENTRO do quadro, por isso
  // contaComoAtivo. Não confundir com a tela "Contratos de freelancer", que é
  // de prestador que nunca foi da casa.
  //
  // NÃO DÁ PARA DEDUZIR QUEM É: medido no banco em 07/09/2026, a verba
  // "Freelancer (Empreita)" foi paga a 18 pessoas ATIVAS de salário alto, como
  // avulso. Quem é freelancer é conhecimento do Léo — entra pela ficha, no
  // clique dele.
  //
  // ordem 9 e não 8: o banco já tem "Atestado médico" (7), "Abandono" (8) e o
  // "Externo" acima também em 7. 9 é o primeiro livre de verdade.
  { id: "freelancer", nome: "Freelancer", cor: "#0d9488", contaComoAtivo: true, ordem: 9 },
];
