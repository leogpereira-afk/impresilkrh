// ============================================================================
// Conferência do cadastro: RH × módulo de RH do Mubisys.
//
// Pedido do Léo (22/09/2026): "só as conferências de dados mesmo, pra ficar
// completo".
//
// POR QUE COLAR, E NÃO BUSCAR. A API pública do Mubisys não expõe o módulo de
// RH — sondei a documentação ao vivo e os recursos são cliente, fornecedor,
// contas-pagar/receber, ordem-servico, nota-fiscal, orcamento, produto e
// usuario. A lista de colaboradores só existe atrás do login do navegador.
// Então o caminho que funciona sem ninguém entregar senha a ninguém é o RH
// LER o que foi copiado da tela do ERP.
//
// O QUE A CONFERÊNCIA ACHOU DE VERDADE na primeira vez que rodei (22/09):
// cinco admissões divergentes — uma delas com CINCO MESES de diferença — e o
// Dermeval com um CPF em cada sistema, sendo que o do Mubisys tem 10 dígitos.
// Admissão manda em férias, 13º e experiência; não é detalhe de cadastro.
//
// A REGRA DE OURO DAQUI: esta função NÃO DECIDE QUEM ESTÁ CERTO. Ela mostra os
// dois lados e quem decide é quem conhece a pessoa. Em cinco casos eu não
// tinha como saber qual lado valia, e um "corrigir automaticamente" teria
// gravado o errado em silêncio.
// ============================================================================
import { idPessoa } from "./identidade";

export interface LinhaMubisys {
  nome: string;
  cpf: string;
  admissao: string;
  demissao: string;
  profissao: string;
  telefone: string;
  salario: string;
  tipo: string;
  /** A linha como veio, para a tela poder mostrar o que não entendeu. */
  bruto: string;
}

export interface LeituraMubisys {
  linhas: LinhaMubisys[];
  /**
   * Linhas que pareciam gente e não deram para ler.
   *
   * Nunca descartadas em silêncio: uma lista de 30 que lê 27 e não avisa faz
   * três pessoas sumirem da conferência, e some junto o defeito delas.
   */
  naoLidas: string[];
}

/* Um CPF do Mubisys nem sempre é um CPF: o do Dermeval está gravado lá com 10
   dígitos ("965640246-9"). A régua aceita o malformado de propósito — é
   justamente ele que a conferência precisa mostrar. */
const CPF = /\b\d{2,3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{1,2}\b/;
const DATA = /\b\d{2}\/\d{2}\/\d{4}\b/g;
const DINHEIRO = /R\$\s*[\d.]+,\d{2}/g;
const TELEFONE = /\+?\d{2}\s*\(?\d{2}\)?\s*\d{4,5}-?\d{4}/;
const TIPOS = ["Produção", "Administrativo", "Producao"];

export const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/**
 * Lê a lista de colaboradores copiada da tela do Mubisys.
 *
 * O formato é uma linha por pessoa, com os campos separados por espaço — o que
 * sai quando se seleciona a tabela e copia. Ler por POSIÇÃO quebraria no
 * primeiro nome com quatro palavras; então cada campo é achado pela FORMA dele
 * (CPF, data, telefone, dinheiro) e o nome é o que sobra na frente.
 */
export function lerListaMubisys(texto: string): LeituraMubisys {
  const linhas: LinhaMubisys[] = [];
  const naoLidas: string[] = [];
  for (const cru of String(texto ?? "").split(/\r?\n/)) {
    const linha = cru.trim();
    if (!linha) continue;
    // Cabeçalho e rodapé da tela do ERP não são gente.
    if (/^(Situação|Total:|Adicionar|Prev\.|Previsão|Cálculo)/i.test(linha)) continue;
    const mCpf = linha.match(CPF);
    if (!mCpf) {
      // Só reclama do que PARECIA gente: linha com duas ou mais palavras
      // capitalizadas. Assim o ruído da cópia (ícones, contadores) não vira
      // alarme, e a pessoa de verdade sem CPF vira.
      if (/\p{Lu}\p{L}+\s+\p{Lu}\p{L}+/u.test(linha)) naoLidas.push(linha);
      continue;
    }
    const cpf = mCpf[0];
    const nome = linha.slice(0, mCpf.index).trim().replace(/\s+/g, " ");
    const resto = linha.slice((mCpf.index ?? 0) + cpf.length);
    const datas = resto.match(DATA) ?? [];
    const dinheiros = resto.match(DINHEIRO) ?? [];
    const tel = resto.match(TELEFONE)?.[0] ?? "";
    const tipo = TIPOS.find((t) => resto.includes(t)) ?? "";
    // A profissão é o que sobra entre a última data e o telefone.
    let profissao = resto;
    for (const d of datas) profissao = profissao.replace(d, " ");
    if (tel) profissao = profissao.slice(0, profissao.indexOf(tel));
    profissao = profissao.replace(/\s+/g, " ").trim();
    if (!nome) {
      naoLidas.push(linha);
      continue;
    }
    linhas.push({
      nome,
      cpf,
      admissao: datas[0] ?? "",
      demissao: datas[1] ?? "",
      profissao,
      telefone: tel,
      salario: dinheiros[0] ?? "",
      tipo,
      bruto: linha,
    });
  }
  return { linhas, naoLidas };
}

// ---------------------------------------------------------------------------

export interface FichaRh {
  id: string;
  nome: string;
  cpf?: string | null;
  /* `null` é um valor de verdade no cadastro (desligamento apagado grava null,
     não undefined). Recusar null no tipo obrigaria quem chama a mentir com um
     `?? undefined`, e mentira de tipo vira defeito calado. */
  dataAdmissao?: string | null;
  dataDesligamento?: string | null;
  telefone?: string | null;
}

export type CampoConferido = "CPF" | "Admissão" | "Desligamento" | "Telefone";

export interface Divergencia {
  campo: CampoConferido;
  noRh: string;
  noMubisys: string;
  /** Vazio no RH e preenchido no ERP: é só completar, não é discordância. */
  falta: boolean;
  /**
   * Por que este valor NÃO pode ser aplicado. Vazio = pode.
   *
   * Duas razões, as duas de 22/09/2026:
   *  - admissão: o Léo decidiu não mexer. A diferença continua VISÍVEL (uma é
   *    de cinco meses), só não tem botão — decisão tomada não é defeito, mas
   *    apagar a informação seria esconder.
   *  - CPF malformado: o do Dermeval está no Mubisys com 10 dígitos. Aplicar
   *    trocaria um documento bom por um quebrado — aqui o ERP é que está
   *    errado, não o RH.
   */
  naoAplicavel?: string;
}

/** Um CPF de gente tem 11 dígitos. O do Dermeval no Mubisys tem 10. */
export const cpfValido = (v: unknown) => soDigitos(v).length === 11;

export interface ParConferido {
  ficha: FichaRh;
  mubi: LinhaMubisys;
  /** Como os dois foram ligados: por ID (forte) ou por nome (palpite). */
  casadoPor: "id" | "nome";
  divergencias: Divergencia[];
}

export interface Conferencia {
  pares: ParConferido[];
  soNoRh: FichaRh[];
  soNoMubisys: LinhaMubisys[];
  naoLidas: string[];
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** dd/mm/aaaa → aaaa-mm-dd, para comparar data com data e não texto com texto. */
export function dataIso(br: unknown): string {
  const m = String(br ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/**
 * Compara os dois cadastros.
 *
 * Casa primeiro pelo ID da pessoa (6 primeiros dígitos do CPF — a regra da
 * casa), depois pelo NOME. O casamento por nome existe justamente para o caso
 * do Dermeval: ele tem um CPF em cada sistema, então o id não casa — e se a
 * conferência parasse aí, ele apareceria como duas pessoas diferentes e o
 * defeito de verdade (documento divergente) ficaria escondido atrás de um
 * "só no RH" e um "só no Mubisys".
 */
export function conferirComMubisys(fichas: FichaRh[], leitura: LeituraMubisys): Conferencia {
  const porId = new Map<string, FichaRh>();
  const porNome = new Map<string, FichaRh>();
  for (const f of fichas) {
    const id = idPessoa(f.cpf);
    if (id && !porId.has(id)) porId.set(id, f);
    const n = norm(f.nome);
    if (n && !porNome.has(n)) porNome.set(n, f);
  }

  const pares: ParConferido[] = [];
  const usadas = new Set<string>();
  const soNoMubisys: LinhaMubisys[] = [];

  for (const m of leitura.linhas) {
    const id = idPessoa(m.cpf);
    let ficha = id ? porId.get(id) : undefined;
    let casadoPor: "id" | "nome" = "id";
    if (!ficha) {
      ficha = porNome.get(norm(m.nome));
      casadoPor = "nome";
    }
    if (!ficha) {
      soNoMubisys.push(m);
      continue;
    }
    usadas.add(ficha.id);
    const div: Divergencia[] = [];
    /* A régua vale para os dois casos: RH vazio (falta) e RH diferente
       (discordam). Antes só entrava quando os DOIS lados tinham valor, então
       campo vazio no RH nunca aparecia — e completar o que falta é metade do
       trabalho de uma conferência. */
    const rhCpf = soDigitos(ficha.cpf);
    const mubiCpf = soDigitos(m.cpf);
    if (mubiCpf && rhCpf !== mubiCpf) {
      div.push({
        campo: "CPF",
        noRh: String(ficha.cpf ?? ""),
        noMubisys: m.cpf,
        falta: !rhCpf,
        ...(cpfValido(m.cpf) ? {} : { naoAplicavel: `o CPF do Mubisys tem ${mubiCpf.length} dígitos — aqui quem está errado é o ERP` }),
      });
    }
    const adm = dataIso(m.admissao);
    const rhAdm = String(ficha.dataAdmissao ?? "").slice(0, 10);
    if (adm && adm !== rhAdm) {
      div.push({
        campo: "Admissão",
        noRh: rhAdm,
        noMubisys: adm,
        falta: !rhAdm,
        naoAplicavel: "a admissão fica como está — fica visível só para você saber que os dois sistemas discordam",
      });
    }
    const des = dataIso(m.demissao);
    const rhDes = String(ficha.dataDesligamento ?? "").slice(0, 10);
    if (des !== rhDes && (des || rhDes)) {
      div.push({ campo: "Desligamento", noRh: rhDes, noMubisys: des, falta: !rhDes });
    }
    const rhTel = soDigitos(ficha.telefone);
    const mubiTel = soDigitos(m.telefone).replace(/^55/, "");
    if (mubiTel && rhTel.slice(-8) !== mubiTel.slice(-8)) {
      div.push({ campo: "Telefone", noRh: String(ficha.telefone ?? ""), noMubisys: m.telefone, falta: !rhTel });
    }
    pares.push({ ficha, mubi: m, casadoPor, divergencias: div });
  }

  return {
    pares,
    soNoRh: fichas.filter((f) => !usadas.has(f.id)),
    soNoMubisys,
    naoLidas: leitura.naoLidas,
  };
}

/** A frase de resumo — o que a tela mostra antes de qualquer lista. */
export function resumoDaConferencia(c: Conferencia): string {
  const todas = c.pares.flatMap((p) => p.divergencias);
  const faltam = todas.filter((d) => d.falta).length;
  const discordam = todas.filter((d) => !d.falta).length;
  const partes = [`${c.pares.length} conferido(s)`];
  if (faltam) partes.push(`${faltam} campo(s) faltando no RH`);
  if (discordam) partes.push(`${discordam} campo(s) em que discordam`);
  if (c.soNoRh.length) partes.push(`${c.soNoRh.length} só no RH`);
  if (c.soNoMubisys.length) partes.push(`${c.soNoMubisys.length} só no Mubisys`);
  if (c.naoLidas.length) partes.push(`${c.naoLidas.length} linha(s) não entendida(s)`);
  return partes.join(" · ");
}
