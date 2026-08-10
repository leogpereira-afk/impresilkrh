// ============================================================================
// OS TIPOS DE AVISO DO CALENDÁRIO — os de fábrica e os que a empresa cria.
//
// A lista era fechada no código: cinco tipos e ponto. Só que "que tipo de aviso
// eu quero ver no calendário" é decisão de quem usa, não de quem programou —
// vistoria de extintor, vencimento de alvará, reunião de segurança, aniversário
// da empresa. Sem poder criar, tudo virava "Outro" e o calendário perdia a cor,
// que é justamente o que faz bater o olho e entender.
//
// Os tipos DERIVADOS (Aniversário, Documento vence, NR vence, Experiência,
// Pagamento…) não entram aqui: eles não são escolhidos, são calculados a partir
// de outro dado. Só os que a pessoa escolhe ao lançar um evento.
// ============================================================================

export interface TipoPersonalizado {
  nome: string;
  cor: string;
}

/** Os que vêm de fábrica. "Outro" fica por último: é a saída, não a escolha. */
export const TIPOS_DE_FABRICA: TipoPersonalizado[] = [
  { nome: "Comemorativa", cor: "#2563eb" },
  { nome: "Reunião", cor: "#16334f" },
  { nome: "Feriado", cor: "#dc2626" },
  { nome: "Empresa", cor: "#16a34a" },
  { nome: "Outro", cor: "#64748b" },
];

/**
 * Tipos DERIVADOS: o calendário os calcula a partir de outro dado (data de
 * nascimento, validade da NR, 5º dia útil…). Ninguém os escolhe ao lançar um
 * evento, e ninguém pode apagá-los ou reaproveitar o nome.
 *
 * Nome e cor moram aqui porque DUAS telas precisam deles — o calendário, para
 * pintar e montar a legenda, e o Painel de Controle, para recusar um tipo novo
 * com nome já ocupado. Enquanto a lista vivia só na página, o Painel não tinha
 * como saber que "Aniversário" já existia. O ícone continua na página: é
 * detalhe de desenho, não de regra.
 */
export const TIPOS_DERIVADOS: TipoPersonalizado[] = [
  { nome: "Aniversário", cor: "#db2777" },
  { nome: "Tempo de empresa", cor: "#c2a14d" },
  { nome: "Documento vence", cor: "#ea580c" },
  { nome: "NR vence", cor: "#b91c1c" },
  { nome: "Experiência", cor: "#7c3aed" },
  { nome: "Férias — prazo CLT", cor: "#0891b2" },
  { nome: "Férias", cor: "#0e7490" },
  { nome: "Pagamento", cor: "#047857" },
];

/** Todo nome que o sistema já usa — de fábrica ou derivado. */
export const NOMES_RESERVADOS = [
  ...TIPOS_DE_FABRICA.map((t) => t.nome),
  ...TIPOS_DERIVADOS.map((t) => t.nome),
];

const NOMES_DE_FABRICA = new Set(TIPOS_DE_FABRICA.map((t) => t.nome.toLowerCase()));

export const COR_PADRAO_TIPO = "#64748b";

/** Limpa o que foi digitado: sem espaço sobrando, sem nome vazio. */
export const normalizarNomeTipo = (s: string) => String(s ?? "").trim().replace(/\s+/g, " ");

/**
 * Nomes que o calendário JÁ USA e que ninguém pode reaproveitar — os de fábrica
 * mais os `reservados` que a tela passa (os tipos DERIVADOS: Aniversário, NR
 * vence, Pagamento…). A tela é dona dessa lista porque é lá que ela vive, com
 * cor e ícone; passar por parâmetro evita manter a mesma lista em dois lugares
 * e sair de sincronia.
 */
const nomesOcupados = (reservados: string[]) => {
  const s = new Set(NOMES_DE_FABRICA);
  for (const r of reservados) {
    const n = normalizarNomeTipo(r).toLowerCase();
    if (n) s.add(n);
  }
  return s;
};

/**
 * A lista completa para o seletor: os de fábrica primeiro, depois os criados
 * pela empresa, em ordem alfabética.
 *
 * Um personalizado com o MESMO nome de um de fábrica (ou de um reservado) é
 * ignorado — senão o seletor mostraria "Reunião" duas vezes e a cor dependeria
 * de qual das duas o código encontrasse primeiro.
 */
export function tiposDisponiveis(
  personalizados: TipoPersonalizado[] = [],
  reservados: string[] = [],
): TipoPersonalizado[] {
  const vistos = nomesOcupados(reservados);
  const extras: TipoPersonalizado[] = [];
  for (const t of personalizados) {
    const nome = normalizarNomeTipo(t?.nome);
    const chave = nome.toLowerCase();
    if (!nome || vistos.has(chave)) continue;
    vistos.add(chave);
    extras.push({ nome, cor: t.cor || COR_PADRAO_TIPO });
  }
  extras.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return [...TIPOS_DE_FABRICA, ...extras];
}

/**
 * Pode criar um tipo com este nome? Devolve o motivo quando não.
 *
 * `reservados` são os nomes que a tela já usa por conta própria. Sem eles dava
 * para criar um tipo chamado "Aniversário": ele entrava na config, colidia com
 * o tipo derivado de mesmo nome na legenda, e a cor passava a depender de qual
 * dos dois o código achasse primeiro.
 */
export function validarNovoTipo(
  nome: string,
  personalizados: TipoPersonalizado[] = [],
  reservados: string[] = [],
): { ok: true } | { ok: false; motivo: string } {
  const limpo = normalizarNomeTipo(nome);
  if (!limpo) return { ok: false, motivo: "Dê um nome ao tipo." };
  if (limpo.length > 40) return { ok: false, motivo: "O nome do tipo é longo demais (máximo 40 letras)." };
  const ocupados = nomesOcupados(reservados);
  if (ocupados.has(limpo.toLowerCase()) ||
      personalizados.some((t) => normalizarNomeTipo(t?.nome).toLowerCase() === limpo.toLowerCase())) {
    return { ok: false, motivo: `Já existe um tipo chamado "${limpo}".` };
  }
  return { ok: true };
}
