// ============================================================================
// Dinheiro que sai para SÓCIO não é folha.
//
// Pedro Ramos é fundador, não funcionário: no plano de contas ele vive em
// 2.14 "Despesas Societárias" › 2.14.1 "Arrendamento" (2.14.1.2 Pedro Ramos
// Pereira, 2.14.1.1 Plano de Saúde). Mas o contador lança os títulos dele em
// contas de folha (2.1.*, 2.11.1), e aí o sistema lia a conta e carimbava
// "FGTS", "Freelancer (Empreita)" — tipos de funcionário, em cima de um sócio.
// Foi o que o Léo viu em 07/09/2026 na prévia de setembro.
//
// A regra: quando a PESSOA é direção, a conta do ERP não decide mais o tipo.
// Só existem duas coisas para um sócio — o que ele retira (arrendamento ou
// retirada, conforme o grupo dele em 2.14) e o plano de saúde. E nada disso
// entra na folha: nem na base de FGTS/13º/férias, nem no custo da equipe.
// ============================================================================
import type { Colaborador } from "@/data/types";
import { nomeDoPlano } from "./tipoDoPlano";

/** Tipos que existem só para a direção. Nunca são folha. */
export const TIPO_ARRENDAMENTO = "Arrendamento";
export const TIPO_RETIRADA = "Retirada";
export const TIPOS_SOCIETARIOS = [TIPO_ARRENDAMENTO, TIPO_RETIRADA] as const;

/**
 * Como o dinheiro de cada sócio se chama, pelo grupo dele no plano de contas
 * do contador: 2.14.1 é Arrendamento (Pedro) e 2.14.2 é Retiradas (Leonardo).
 * Quem não estiver aqui cai em Arrendamento — que é o caso do sócio que só
 * arrenda, e o rótulo aparece na tela para ser corrigido se estiver errado.
 */
const ROTULO_POR_PESSOA: Record<string, string> = {
  "pedro-ramos": TIPO_ARRENDAMENTO,      // 2.14.1 Arrendamento
  "leonardo-goncalves": TIPO_RETIRADA,   // 2.14.2 Retiradas Leonardo
};

/** O card confidencial do plano (CARDS_CONFIDENCIAIS) que corresponde a cada sócio. */
export const CARD_POR_PESSOA: Record<string, string> = {
  "pedro-ramos": "arrendamento",      // 2.14.1 Arrendamento
  "leonardo-goncalves": "leonardo",   // 2.14.2 Retiradas
};

/** O rótulo do dinheiro de cada sócio, para títulos de tela. */
export const rotuloDoSocio = (id: string): string => ROTULO_POR_PESSOA[id] ?? TIPO_ARRENDAMENTO;

const semAcento = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O nome da conta fala de plano de saúde? (o sócio tem arrendamento E saúde) */
const contaDeSaude = (plano: string) =>
  /plano de saude|\bsaude\b|pro ?vida|unimed|\bamil\b|odonto/.test(semAcento(nomeDoPlano(plano)));

export const ehSocio = (c?: { id?: string; ehDirecao?: boolean; statusId?: string } | null): boolean =>
  !!c && (c.ehDirecao === true || c.statusId === "direcao");

/**
 * O tipo de um pagamento a sócio. `null` quando a pessoa não é sócia — aí quem
 * decide continua sendo a conta do ERP (lib/tipoDoPlano).
 */
export function tipoSocietario(plano: string, colaborador?: Colaborador | { id: string; ehDirecao?: boolean; statusId?: string } | null): string | null {
  if (!ehSocio(colaborador)) return null;
  if (contaDeSaude(plano)) return "Plano de Saúde";
  return ROTULO_POR_PESSOA[String(colaborador?.id ?? "")] ?? TIPO_ARRENDAMENTO;
}

/** É pagamento de sócio? (usado para tirar da folha sem tirar da vista) */
export const ehLancamentoSocietario = (tipo: string): boolean =>
  (TIPOS_SOCIETARIOS as readonly string[]).includes(tipo);
