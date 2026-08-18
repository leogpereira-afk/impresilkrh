// ============================================================================
// SELEÇÃO: banco de talentos, devolutiva ao candidato e teste de dias.
//
// Três pedidos da equipe que são a mesma história vista de pontos diferentes:
// um currículo entra, a pessoa é avaliada, e no fim ou vira colaborador ou vira
// registro. O que faltava era o "vira registro" — hoje quem não é contratado
// simplesmente some, e no mês seguinte a busca começa do zero.
//
// SOBRE OS "5 DIAS". A empresa trabalha com um teste curto antes de contratar.
// Esta biblioteca CONTA os dias e avisa quando passa do limite; ela não afirma
// que o teste é permitido, porque isso não é verdade que um sistema deva
// carimbar. O que existe na CLT (art. 29) é o prazo de cinco dias ÚTEIS que o
// empregador tem para anotar a carteira depois da admissão — e é daí que vem o
// número que todo mundo repete. Por isso a contagem aqui é em dias ÚTEIS, e por
// isso o registro de PAGAMENTO dos dias é campo de primeira classe: se algum dia
// alguém questionar, o que protege a empresa é o registro mostrando que a pessoa
// esteve lá e foi paga.
// ============================================================================

import { parseData } from "@/lib/format";

/** Limite de dias de teste adotado pela empresa. */
export const LIMITE_DIAS_TESTE = 5;

export type ResultadoTeste = "Aprovado" | "Não aprovado";

export interface TesteLike {
  testeInicio?: string | null;
  testeFim?: string | null;
  testeResultado?: ResultadoTeste | null;
  testePago?: boolean | null;
}

/**
 * Dias ÚTEIS entre início e fim, contando os dois extremos.
 *
 * Úteis, e não corridos, por dois motivos que apontam para o mesmo lado: o prazo
 * da CLT é em dias úteis, e a empresa não trabalha sábado nem domingo — contar
 * corridos faria um teste de segunda a sexta da semana seguinte parecer 12 dias
 * quando a pessoa trabalhou 10.
 *
 * Devolve `null` quando não dá para contar (falta data ou a data não vale), em
 * vez de 0: zero dia é um fato ("não teve teste"), e confundir os dois faria a
 * tela dizer que está tudo dentro do limite justamente quando não se sabe nada.
 */
export function diasUteisDeTeste(inicio?: string | null, fim?: string | null): number | null {
  const a = parseData(inicio);
  const b = parseData(fim);
  if (!a || !b) return null;
  if (b.getTime() < a.getTime()) return null; // fim antes do início: não é contagem, é erro
  let dias = 0;
  const cursor = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const ultimo = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  while (cursor.getTime() <= ultimo.getTime()) {
    const semana = cursor.getDay();
    if (semana >= 1 && semana <= 5) dias++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export type NivelAviso = "erro" | "aviso" | null;
export interface AvisoTeste {
  nivel: NivelAviso;
  texto: string;
  dias: number | null;
}

/**
 * O que a tela deve dizer sobre este teste.
 *
 * Erro trava a gravação; aviso não. A diferença importa: fim antes do início é
 * digitação errada e não pode entrar; passar do limite de dias é um fato que já
 * aconteceu e precisa ficar REGISTRADO, não escondido — travar aí faria o RH
 * mudar a data para caber, e o registro passaria a mentir.
 */
export function avisoDoTeste(t: TesteLike): AvisoTeste {
  const { testeInicio: ini, testeFim: fim } = t;
  if (!ini && !fim) return { nivel: null, texto: "", dias: null };
  if (!ini) return { nivel: "erro", texto: "Informe o primeiro dia do teste.", dias: null };
  if (!fim) return { nivel: null, texto: "Teste em andamento — falta marcar o último dia.", dias: null };

  const a = parseData(ini);
  const b = parseData(fim);
  if (!a || !b) return { nivel: "erro", texto: "Data inválida. Confira o ano — ele precisa ter quatro dígitos.", dias: null };
  if (b.getTime() < a.getTime()) {
    return { nivel: "erro", texto: "O último dia não pode ser antes do primeiro.", dias: null };
  }

  const dias = diasUteisDeTeste(ini, fim);
  if (dias == null) return { nivel: "erro", texto: "Não consegui contar os dias.", dias: null };
  if (dias > LIMITE_DIAS_TESTE) {
    return {
      nivel: "aviso",
      texto: `${dias} dias úteis — passou do limite de ${LIMITE_DIAS_TESTE} que a empresa adota. Fica registrado assim mesmo.`,
      dias,
    };
  }
  return { nivel: null, texto: `${dias} ${dias === 1 ? "dia útil" : "dias úteis"} de teste.`, dias };
}

/**
 * Falta algo que este registro precisa ter para servir de prova?
 *
 * Não trava nada — é lista de pendência, para a tela mostrar em vez de deixar o
 * registro pela metade e ninguém perceber meses depois.
 */
export function pendenciasDoTeste(t: TesteLike & { testeParecer?: string | null }): string[] {
  const faltando: string[] = [];
  if (!t.testeFim) faltando.push("marcar o último dia");
  if (!t.testeResultado) faltando.push("dizer se foi aprovado");
  // O pagamento é o que protege a empresa depois; sem ele o registro mostra
  // alguém trabalhando de graça, que é o pior dos dois mundos.
  if (t.testeFim && !t.testePago) faltando.push("confirmar o pagamento dos dias");
  if (t.testeResultado === "Não aprovado" && !String(t.testeParecer ?? "").trim()) {
    faltando.push("escrever o parecer de quem acompanhou");
  }
  return faltando;
}

// ============================================================================
// DEVOLUTIVA AO CANDIDATO
// ============================================================================

/**
 * Motivos de devolutiva.
 *
 * A lista é curta de propósito. Dar motivo detalhado a quem não foi contratado
 * é onde nasce reclamação por discriminação — o que se diz precisa ser sobre o
 * que a vaga pedia, nunca sobre a pessoa. Por isso não há "perfil", "postura"
 * nem nada que descreva quem ela é.
 */
export const MOTIVOS_DEVOLUTIVA = [
  { chave: "outro-perfil", rotulo: "Escolhemos outro candidato", frase: "seguimos com outra pessoa cujo perfil estava mais próximo do que a vaga pedia" },
  { chave: "experiencia", rotulo: "Faltou experiência no que a vaga pedia", frase: "para esta vaga precisávamos de mais experiência na função" },
  { chave: "vaga-fechada", rotulo: "A vaga foi fechada/suspensa", frase: "a vaga foi fechada antes de concluirmos o processo" },
  { chave: "banco", rotulo: "Guardamos o currículo para vagas futuras", frase: "não seguimos agora, mas guardamos seu currículo para as próximas vagas" },
] as const;

export type MotivoDevolutiva = (typeof MOTIVOS_DEVOLUTIVA)[number]["chave"];

/**
 * O texto que o RH copia e manda.
 *
 * Curto, com o nome da pessoa, o que aconteceu e um fim educado. Não promete
 * retorno que a empresa não vai dar, e não pede nada de volta.
 */
export function textoDevolutiva(d: {
  nome: string;
  vaga?: string | null;
  motivo: MotivoDevolutiva;
  empresa?: string;
}): string {
  const primeiro = String(d.nome ?? "").trim().split(/\s+/)[0] || "Olá";
  const empresa = d.empresa?.trim() || "Impresilk";
  const frase = MOTIVOS_DEVOLUTIVA.find((m) => m.chave === d.motivo)?.frase ?? MOTIVOS_DEVOLUTIVA[0].frase;
  const sobreAVaga = d.vaga?.trim() ? ` para a vaga de ${d.vaga.trim()}` : "";
  const guardado = d.motivo === "banco"
    ? ""
    : " Seu currículo fica no nosso banco, e a gente procura por ele quando abrir algo do seu perfil.";
  return (
    `Oi, ${primeiro}! Aqui é do RH da ${empresa}.\n\n` +
    `Obrigada por participar do nosso processo${sobreAVaga}. ` +
    `Desta vez ${frase}.${guardado}\n\n` +
    `Agradeço de verdade o seu tempo e desejo sucesso!`
  );
}

// ============================================================================
// BANCO DE TALENTOS
// ============================================================================

export interface CandidatoLike {
  vagaId?: string | null;
  etapa?: string;
  noBanco?: boolean | null;
}

/**
 * Este candidato está no banco de talentos?
 *
 * Duas portas de entrada, e as duas contam: quem foi cadastrado sem vaga (o
 * currículo que chegou espontaneamente) e quem o RH guardou depois de um
 * processo. Contratado nunca está no banco — virou colaborador, e continuar
 * aparecendo como currículo disponível confunde na hora de buscar.
 */
export function estaNoBanco(c: CandidatoLike): boolean {
  if (c.etapa === "Contratado") return false;
  return !!c.noBanco || !c.vagaId;
}
