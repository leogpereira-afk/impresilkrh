// ============================================================================
// QUANTO DA FICHA ESTÁ PREENCHIDO.
//
// Pedido da direção: "nos cadastros de tudo do RH eu quero % de quanto está
// preenchido o cadastro". O motivo é prático — ficha pela metade só aparece
// quando ela é necessária: na hora do eSocial, do exame, do contato de
// emergência, da rescisão. Aí já é tarde.
//
// O QUE ESTA CONTA NÃO FAZ: tratar todo campo como igual. CPF ausente trava a
// admissão; "estilo de aprendizagem" ausente não trava nada. Uma média simples
// dos 40 campos daria 85% para quem está sem CPF e sem contato de emergência,
// e a direção leria isso como "quase pronto".
//
// Por isso os campos têm PESO, e a tela mostra o que falta — não só o número.
// ============================================================================

export type Peso = "essencial" | "importante" | "complementar";

export interface CampoFicha {
  chave: string;
  rotulo: string;
  peso: Peso;
  /** Quando o campo só faz sentido para parte das pessoas. */
  soSe?: (c: Record<string, unknown>) => boolean;
}

/* O peso é o custo de NÃO ter o campo:
   - essencial: trava obrigação legal ou pagamento (admissão, eSocial, folha);
   - importante: trava um processo do RH (exame, contato em emergência, crachá);
   - complementar: enriquece a gestão de pessoas, não trava nada. */
export const CAMPOS_FICHA: CampoFicha[] = [
  { chave: "nome", rotulo: "Nome completo", peso: "essencial" },
  { chave: "cpf", rotulo: "CPF", peso: "essencial" },
  { chave: "dataNascimento", rotulo: "Data de nascimento", peso: "essencial" },
  { chave: "dataAdmissao", rotulo: "Data de admissão", peso: "essencial" },
  { chave: "cargoId", rotulo: "Cargo", peso: "essencial" },
  { chave: "salario", rotulo: "Salário", peso: "essencial" },
  { chave: "matriculaEsocial", rotulo: "Matrícula eSocial", peso: "essencial" },

  { chave: "telefone", rotulo: "Telefone", peso: "importante" },
  { chave: "enderecoRua", rotulo: "Endereço", peso: "importante" },
  { chave: "enderecoBairro", rotulo: "Bairro", peso: "importante" },
  { chave: "enderecoCep", rotulo: "CEP", peso: "importante" },
  { chave: "contatoEmergencia", rotulo: "Contato de emergência", peso: "importante" },
  { chave: "areaId", rotulo: "Área", peso: "importante" },
  { chave: "gestorId", rotulo: "Gestor", peso: "importante" },
  { chave: "apelido", rotulo: "Login (apelido)", peso: "importante" },
  { chave: "email", rotulo: "E-mail", peso: "importante" },

  { chave: "nivelId", rotulo: "Nível", peso: "complementar" },
  { chave: "perfilComportamental", rotulo: "Perfil comportamental", peso: "complementar" },
  { chave: "estiloAprendizagem", rotulo: "Estilo de aprendizagem", peso: "complementar" },
  { chave: "fotoDataUrl", rotulo: "Foto", peso: "complementar" },
  { chave: "cnh", rotulo: "CNH", peso: "complementar" },
  { chave: "dataInicioCargo", rotulo: "Início no cargo", peso: "complementar" },
  // Só cobra dados de cônjuge/filhos de quem declarou ter.
  { chave: "conjugeNome", rotulo: "Cônjuge", peso: "complementar" },
  {
    chave: "filhos", rotulo: "Filhos", peso: "complementar",
    soSe: (c) => Number(c.qtdFilhos ?? 0) > 0,
  },
];

const PESO_VALOR: Record<Peso, number> = { essencial: 5, importante: 3, complementar: 1 };

/** Está preenchido? Zero e string vazia contam como VAZIO; `false` não —
 *  "não tem CNH" é uma resposta, não uma lacuna. */
export function preenchido(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v as object).some(preenchido);
  return true; // boolean, inclusive false
}

export interface Completude {
  /** 0 a 100, com peso. */
  pct: number;
  /** Quantos campos de cada peso ainda faltam. */
  faltam: { chave: string; rotulo: string; peso: Peso }[];
  faltamEssenciais: number;
  /** Pronto para as obrigações: nenhum essencial faltando. */
  essenciaisOk: boolean;
  contados: number;
}

/**
 * Quanto da ficha está preenchido, com peso.
 *
 * A porcentagem sozinha engana: por isso `faltamEssenciais` sai separado, e a
 * tela mostra o que falta. 90% com o CPF faltando não é uma ficha quase pronta
 * — é uma ficha que não admite ninguém.
 */
export function completudeDaFicha(colab: Record<string, unknown>): Completude {
  const aplicaveis = CAMPOS_FICHA.filter((c) => !c.soSe || c.soSe(colab));
  let total = 0, feito = 0;
  const faltam: Completude["faltam"] = [];
  for (const campo of aplicaveis) {
    const p = PESO_VALOR[campo.peso];
    total += p;
    if (preenchido(colab[campo.chave])) feito += p;
    else faltam.push({ chave: campo.chave, rotulo: campo.rotulo, peso: campo.peso });
  }
  const faltamEssenciais = faltam.filter((f) => f.peso === "essencial").length;
  return {
    pct: total ? Math.round((feito / total) * 100) : 100,
    faltam,
    faltamEssenciais,
    essenciaisOk: faltamEssenciais === 0,
    contados: aplicaveis.length,
  };
}

/** A cor do indicador. Essencial faltando é sempre vermelho, mesmo com 90%. */
export function tomDaCompletude(c: Completude): "bom" | "atencao" | "ruim" {
  if (c.faltamEssenciais > 0) return "ruim";
  if (c.pct >= 90) return "bom";
  return "atencao";
}
