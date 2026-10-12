/* O ID DA PESSOA GRAVADO NO CADASTRO (D-004 do RH, D-015 do PCP, 12/10/2026).
 *
 * O ID são os 6 primeiros dígitos do CPF (D-003). Até aqui ele era CALCULADO
 * a cada leitura, e por isso mudava sozinho quando o RH corrigia um CPF
 * digitado errado: a pessoa perdia, sem aviso, as equipes, as divisões, o
 * ranking e a comissão gravados com o ID antigo no PCP. Agora ele nasce
 * gravado no campo `idPessoa` (texto com exatamente 6 dígitos) da ficha
 * (coleção `colaboradores`) e do contrato de freelancer (`freelancers`), e
 * não muda mais com o CPF.
 *
 * AS REGRAS, numa frase cada:
 *   1. Nasce no SERVIDOR (sync) quando o cadastro é criado: o ID do mesmo CPF
 *      que já existe em outro cadastro (o ex-colaborador que volta como
 *      freelancer herda o da ficha) ou, sem ele, os 6 primeiros dígitos do CPF.
 *   2. ID que já é de OUTRA pessoa (CPF diferente) não é gravado: o cadastro
 *      fica sem o campo, com aviso, e o admin decide.
 *   3. Gravado, não muda: nem no conserto do CPF, nem no envio que vem sem o
 *      campo (campo ausente nunca apaga), nem no envio que traz outro valor
 *      (descartado com aviso). Só o admin troca, pela ação própria, com motivo.
 *
 * UMA RÉGUA, DOIS LADOS: a porta de dados (sync/index.ts) e a tela
 * (src/lib/identidade.ts) usam estas funções. Sem import: o harness dos
 * testes (src/test/servidorRh.ts) injeta os símbolos no servidor. */

export const CAMPO_ID_PESSOA = "idPessoa";
/** O ID e o carimbo dele andam juntos: quem preserva um preserva todos. */
export const CAMPOS_DO_ID = ["idPessoa", "idPessoaEm", "idPessoaPor", "idPessoaMotivo"] as const;
export const COLECOES_COM_ID = ["colaboradores", "freelancers"] as const;
export type ColecaoComId = typeof COLECOES_COM_ID[number];
export const temIdGravavel = (colecao: string): colecao is ColecaoComId =>
  (COLECOES_COM_ID as readonly string[]).includes(colecao);

/* Qualquer cadastro (ficha, contrato, linha do banco): só se lê por chave. */
type Reg = object | null | undefined;
const campo = (r: Reg, k: string): unknown => (r ? (r as Record<string, unknown>)[k] : undefined);

const digitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

/** Texto com exatamente 6 dígitos (sem pontuação, sem espaço). */
export const idValido = (v: unknown): v is string => typeof v === "string" && /^\d{6}$/.test(v);

/** O ID gravado no cadastro, ou "" quando não há (ou está fora do formato). */
export const idGravado = (r: Reg): string => { const v = campo(r, "idPessoa"); return idValido(v) ? v : ""; };

/** CPF com 11 dígitos, ou "". */
export const cpf11 = (v: unknown): string => {
  const d = digitos(v);
  return d.length === 11 ? d : "";
};

/** CPF com os dois verificadores certos (a régua do contrato de freelancer). */
function cpfConfere(n: string): boolean {
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  const dv = (base: string, peso: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (peso - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(n.slice(0, 9), 10) === Number(n[9]) && dv(n.slice(0, 10), 11) === Number(n[10]);
}

/** O CPF de onde o ID pode sair: a ficha basta ter 11 dígitos (régua de
 *  sempre do RH); o contrato precisa do CPF que confere (régua da F07, a mesma
 *  que o PCP usa para calcular o ID do contrato). */
export function cpfDoCadastro(colecao: string, r: Reg): string {
  const c = cpf11(campo(r, "cpf"));
  if (!c) return "";
  return colecao === "freelancers" && !cpfConfere(c) ? "" : c;
}

/** O ID que vale para o cadastro: o gravado; sem ele, o do CPF de hoje. */
export const idQueVale = (colecao: string, r: Reg): string =>
  idGravado(r) || cpfDoCadastro(colecao, r).slice(0, 6);

/** O ID gravado é diferente do começo do CPF de hoje? (a mesma marca do PCP).
 *  Sem CPF à vista (máscara) não há o que comparar: não marca. */
export function idDivergeDoCpf(r: Reg): boolean {
  const g = idGravado(r);
  const c = cpf11(campo(r, "cpf"));
  return !!g && !!c && !c.startsWith(g);
}

export interface CadastroComId {
  colecao: string;
  id: string;
  registro: Record<string, unknown>;
}

export type MotivoSemId = "sem-cpf" | "id-de-outra-pessoa" | "mesmo-cpf-com-ids-diferentes";

export type DecisaoId =
  | { idPessoa: string; herdadoDe?: { colecao: string; id: string } }
  | { idPessoa: ""; motivo: MotivoSemId; outro?: { colecao: string; id: string; nome: string } };

export const MOTIVO_SEM_ID: Record<MotivoSemId, string> = {
  "sem-cpf": "sem CPF que dê o ID",
  "id-de-outra-pessoa": "o ID do CPF já é de outra pessoa",
  "mesmo-cpf-com-ids-diferentes": "o mesmo CPF tem IDs gravados diferentes em outros cadastros",
};

const mesmaChave = (a: { colecao: string; id: string }, b: { colecao: string; id: string }) =>
  a.colecao === b.colecao && a.id === b.id;

/** Quem, entre os outros cadastros, já usa este ID sendo OUTRA pessoa (CPF
 *  diferente do alvo, ou sem CPF). Conta o gravado e, para quem ainda não tem
 *  o campo, o do CPF de hoje. */
export function outraPessoaComId(
  id: string,
  cpfAlvo: string,
  alvo: { colecao: string; id: string },
  outros: CadastroComId[],
): CadastroComId | null {
  for (const o of outros) {
    if (mesmaChave(o, alvo)) continue;
    if (idQueVale(o.colecao, o.registro) !== id) continue;
    if (cpfAlvo && cpf11(o.registro.cpf) === cpfAlvo) continue; // mesma pessoa
    return o;
  }
  return null;
}

/** Que ID um cadastro SEM o campo deve receber, olhando os outros cadastros
 *  vivos (fichas e contratos). Não olha o próprio `idPessoa`: quem chama decide
 *  se o cadastro já tem um (e aí ele não muda). */
export function idParaCadastro(alvo: CadastroComId, outros: CadastroComId[]): DecisaoId {
  const cpf = cpfDoCadastro(alvo.colecao, alvo.registro);
  if (!cpf) return { idPessoa: "", motivo: "sem-cpf" };
  const mesmos = outros.filter((o) => !mesmaChave(o, alvo) && cpf11(o.registro.cpf) === cpf);
  const herdaveis = [...new Set(mesmos.map((o) => idGravado(o.registro)).filter(Boolean))];
  if (herdaveis.length > 1) return { idPessoa: "", motivo: "mesmo-cpf-com-ids-diferentes" };
  const id = herdaveis[0] ?? cpf.slice(0, 6);
  const outro = outraPessoaComId(id, cpf, alvo, outros);
  if (outro) {
    return { idPessoa: "", motivo: "id-de-outra-pessoa", outro: { colecao: outro.colecao, id: outro.id, nome: String(outro.registro.nome ?? "") } };
  }
  if (herdaveis[0]) {
    const de = mesmos.find((o) => idGravado(o.registro) === id)!;
    return { idPessoa: id, herdadoDe: { colecao: de.colecao, id: de.id } };
  }
  return { idPessoa: id };
}

export const AVISO_ID_MANTIDO =
  "O ID da pessoa não muda por esta gravação: ficou o ID gravado no cadastro. Só o admin do RH troca o ID, com motivo, em Configurações do RH › Cadastros.";
export const AVISO_ID_ANTIGO =
  "O ID das fichas e contratos antigos é gravado pelo admin do RH, em Configurações do RH › Cadastros. O restante foi salvo.";
export const avisoSemId = (motivo: MotivoSemId, outroNome?: string): string =>
  motivo === "id-de-outra-pessoa"
    ? `O cadastro foi salvo sem o ID da pessoa: o ID do CPF já é de ${outroNome ? `outra pessoa (${outroNome})` : "outra pessoa"}. Confira o CPF; o admin do RH decide o ID em Configurações do RH › Cadastros.`
    : motivo === "mesmo-cpf-com-ids-diferentes"
      ? "O cadastro foi salvo sem o ID da pessoa: outros cadastros com o mesmo CPF têm IDs diferentes. O admin do RH decide em Configurações do RH › Cadastros."
      : "O cadastro foi salvo sem o ID da pessoa: o ID nasce do CPF, que falta. Preencha o CPF.";

/** O que gravar no lugar dos campos do ID, partindo do registro enviado.
 *  `fonte` é de onde os campos vêm (o cadastro gravado); sem fonte, os campos
 *  saem do registro. */
export function comCamposDoId(registro: Record<string, unknown>, fonte: Reg): Record<string, unknown> {
  const r: Record<string, unknown> = { ...registro };
  for (const k of CAMPOS_DO_ID) {
    const v = campo(fonte, k);
    if (v !== undefined && v !== null && v !== "") r[k] = v;
    else delete r[k];
  }
  return r;
}

/** O envio trouxe um ID diferente do que fica? (ausente não conta: ausente não apaga) */
export const enviouOutroId = (registro: Reg, fica: string): boolean => {
  const v = campo(registro, "idPessoa");
  return v !== undefined && v !== null && v !== "" && v !== fica;
};
