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

const NOMES_DE_FABRICA = new Set(TIPOS_DE_FABRICA.map((t) => t.nome.toLowerCase()));

export const COR_PADRAO_TIPO = "#64748b";

/** Limpa o que foi digitado: sem espaço sobrando, sem nome vazio. */
export const normalizarNomeTipo = (s: string) => String(s ?? "").trim().replace(/\s+/g, " ");

/**
 * A lista completa para o seletor: os de fábrica primeiro, depois os criados
 * pela empresa, em ordem alfabética.
 *
 * Um personalizado com o MESMO nome de um de fábrica é ignorado — senão o
 * seletor mostraria "Reunião" duas vezes e a cor dependeria de qual das duas o
 * código encontrasse primeiro.
 */
export function tiposDisponiveis(personalizados: TipoPersonalizado[] = []): TipoPersonalizado[] {
  const vistos = new Set(NOMES_DE_FABRICA);
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

/** Pode criar um tipo com este nome? Devolve o motivo quando não. */
export function validarNovoTipo(
  nome: string,
  personalizados: TipoPersonalizado[] = [],
): { ok: true } | { ok: false; motivo: string } {
  const limpo = normalizarNomeTipo(nome);
  if (!limpo) return { ok: false, motivo: "Dê um nome ao tipo." };
  if (limpo.length > 40) return { ok: false, motivo: "O nome do tipo é longo demais (máximo 40 letras)." };
  const existe = tiposDisponiveis(personalizados).some(
    (t) => t.nome.toLowerCase() === limpo.toLowerCase(),
  );
  if (existe) return { ok: false, motivo: `Já existe um tipo chamado "${limpo}".` };
  return { ok: true };
}

/** É um tipo criado pela empresa (e portanto removível)? */
export function ehPersonalizado(nome: string): boolean {
  return !NOMES_DE_FABRICA.has(normalizarNomeTipo(nome).toLowerCase());
}
