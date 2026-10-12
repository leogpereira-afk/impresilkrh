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
 *   4. O ID que a pessoa já teve fica guardado (`idPessoaAnteriores`) e não
 *      é dado a ninguém: a troca acrescenta o que sai, e o admin registra o
 *      de uma troca antiga pela ficha. Sem isto o ID antigo ficava livre, e a
 *      ficha nova cujo CPF começasse por ele passava a ser, no PCP, a pessoa
 *      das O.S. antigas (auditoria de 12/10/2026, P1).
 *   5. Cadastro gravado SEM ID porque o ID do CPF é (ou foi) de outra pessoa
 *      leva a marca `idPessoaBloqueado` (o motivo, sem número): quem calcula o
 *      ID pelo CPF (o PCP, rh-programacao, rh-performance, a tela) não calcula
 *      para ele. Só o servidor escreve; some quando o cadastro ganha ID.
 *
 * UMA RÉGUA, DOIS LADOS: a porta de dados (sync/index.ts) e a tela
 * (src/lib/identidade.ts) usam estas funções. Sem import: o harness dos
 * testes (src/test/servidorRh.ts) injeta os símbolos no servidor. */

export const CAMPO_ID_PESSOA = "idPessoa";
/** O ID e o carimbo dele andam juntos: quem preserva um preserva todos. */
export const CAMPOS_DO_ID = ["idPessoa", "idPessoaEm", "idPessoaPor", "idPessoaMotivo", "idPessoaAnteriores"] as const;
/** A marca de cadastro sem ID por decisão da régua (verificação de 12/10/2026,
 *  D1). Não é sensível: é só o motivo, sem número. Os valores são os motivos da
 *  régua que bloqueiam (não "sem-cpf": sem CPF não há o que calcular). */
export const CAMPO_ID_BLOQUEADO = "idPessoaBloqueado";
export const MOTIVOS_DE_BLOQUEIO = ["id-de-outra-pessoa", "mesmo-cpf-com-ids-diferentes"] as const;
export type MotivoDeBloqueio = typeof MOTIVOS_DE_BLOQUEIO[number];
/** Tudo o que só o servidor escreve no cadastro: o ID, o carimbo, a lista e a marca. */
export const CAMPOS_DO_SERVIDOR = [...CAMPOS_DO_ID, CAMPO_ID_BLOQUEADO] as const;
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

/** Um ID que a pessoa já teve. `em` é quando o servidor guardou (na troca, o
 *  dia em que o ID saiu); `como` diz se veio da troca ou do registro do admin
 *  (troca de antes deste campo). O motivo não fica aqui: ele mora no histórico,
 *  com o carimbo de quem fez. */
export interface IdAnterior {
  idPessoa: string;
  em: string;
  por?: string;
  como: "troca" | "registro";
}

/** A lista de IDs anteriores do cadastro, só as entradas válidas (6 dígitos). */
export function anterioresDe(r: Reg): IdAnterior[] {
  const v = campo(r, "idPessoaAnteriores");
  if (!Array.isArray(v)) return [];
  const out: IdAnterior[] = [];
  for (const e of v) {
    const id = typeof e === "string" ? e : campo(e as Reg, "idPessoa");
    if (!idValido(id) || out.some((o) => o.idPessoa === id)) continue;
    const em = typeof e === "object" && e ? String(campo(e as Reg, "em") ?? "") : "";
    const por = typeof e === "object" && e ? campo(e as Reg, "por") : undefined;
    const como = typeof e === "object" && e && campo(e as Reg, "como") === "troca" ? "troca" : "registro";
    out.push({ idPessoa: id, em, como, ...(typeof por === "string" && por ? { por } : {}) });
  }
  return out;
}

/** Só os IDs (6 dígitos) que o cadastro já teve. */
export const idsAnteriores = (r: Reg): string[] => anterioresDe(r).map((a) => a.idPessoa);

/** Junta listas de IDs anteriores (ficha e contrato do mesmo CPF dividem a
 *  lista): cada ID uma vez, ficando a entrada mais antiga. */
export function juntarAnteriores(...listas: IdAnterior[][]): IdAnterior[] {
  const por = new Map<string, IdAnterior>();
  for (const l of listas) {
    for (const a of l) {
      const ja = por.get(a.idPessoa);
      if (!ja || (a.em && (!ja.em || a.em < ja.em))) por.set(a.idPessoa, a);
    }
  }
  return [...por.values()].sort((a, b) => a.em.localeCompare(b.em));
}

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

/** A marca de bloqueio do cadastro (um dos MOTIVOS_DE_BLOQUEIO), ou "". */
export const idBloqueado = (r: Reg): MotivoDeBloqueio | "" => {
  const v = campo(r, CAMPO_ID_BLOQUEADO);
  return (MOTIVOS_DE_BLOQUEIO as readonly unknown[]).includes(v) ? v as MotivoDeBloqueio : "";
};

/** O ID que vale para o cadastro: o gravado; sem ele, o do CPF de hoje, a não
 *  ser que o cadastro tenha a marca de bloqueio (o do CPF é de outra pessoa). */
export const idQueVale = (colecao: string, r: Reg): string =>
  idGravado(r) || (idBloqueado(r) ? "" : cpfDoCadastro(colecao, r).slice(0, 6));

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
  /** Lápide (cadastro apagado): o ID gravado dela e os IDs anteriores dela
   *  continuam sendo de quem saiu (o histórico do PCP tem esses IDs). */
  apagado?: boolean;
}

/** Linha de arquivo cujo ID o admin devolveu à mesma pessoa (op devolverId):
 *  o ID e a lista moram agora no cadastro vivo `devolvidoA`; ela sai da régua. */
const devolvida = (o: CadastroComId): boolean => !!o.apagado && !!campo(o.registro, "devolvidoA");

export type MotivoSemId = "sem-cpf" | "id-de-outra-pessoa" | "mesmo-cpf-com-ids-diferentes";

/** Quem já tem (ou já teve) o ID. `anterior`: o ID é um dos anteriores dele. */
export interface OutroComId { colecao: string; id: string; nome: string; anterior?: boolean; apagado?: boolean }

export type DecisaoId =
  | { idPessoa: string; herdadoDe?: { colecao: string; id: string } }
  | { idPessoa: ""; motivo: MotivoSemId; outro?: OutroComId };

export const MOTIVO_SEM_ID: Record<MotivoSemId, string> = {
  "sem-cpf": "sem CPF que dê o ID",
  "id-de-outra-pessoa": "o ID do CPF já é de outra pessoa",
  "mesmo-cpf-com-ids-diferentes": "o mesmo CPF tem IDs gravados diferentes em outros cadastros",
};

const mesmaChave = (a: { colecao: string; id: string }, b: { colecao: string; id: string }) =>
  a.colecao === b.colecao && a.id === b.id;

/** Quem, entre os outros cadastros, já usa este ID sendo OUTRA pessoa (CPF
 *  diferente do alvo, ou sem CPF). Conta, de cada um:
 *    · vivo: o gravado e, para quem ainda não tem o campo, o do CPF de hoje;
 *    · lápide: o gravado (a pessoa saiu, mas o histórico do PCP tem o ID dela);
 *    · vivo ou lápide: os IDs ANTERIORES.
 *  A lápide da PRÓPRIA linha também conta: reviver a vaga com outro CPF é
 *  outra pessoa nascendo ali, e o que era de quem saiu continua de quem saiu
 *  (verificação de 12/10/2026). Só o cadastro vivo da própria linha é pulado. */
export function outraPessoaComId(
  id: string,
  cpfAlvo: string,
  alvo: { colecao: string; id: string },
  outros: CadastroComId[],
  /** IDs que o alvo já tem por direito (o herdado do mesmo CPF, os anteriores
   *  dele, o devolvido pelo admin): a ficha MARCADA não os segura contra ele. */
  doAlvo: string[] = [],
): (CadastroComId & { anterior?: boolean }) | null {
  for (const o of outros) {
    if ((!o.apagado && mesmaChave(o, alvo)) || devolvida(o)) continue;
    /* O ID que o cadastro segura: o gravado; sem ele, o do CPF, também na
       lápide sem ID gravado (quem saiu antes de 12/10 já estava por ID nas O.S.
       do PCP desde 29/09) e também na ficha marcada (o ID do CPF dela não é
       dela, mas também não é de uma terceira pessoa; revisão do 80e7d8f). */
    const gravado = idGravado(o.registro);
    const segura = gravado || cpfDoCadastro(o.colecao, o.registro).slice(0, 6);
    if (!gravado && idBloqueado(o.registro) && !o.apagado && doAlvo.includes(id)) continue;
    const hoje = segura === id;
    const antes = !hoje && idsAnteriores(o.registro).includes(id);
    if (!hoje && !antes) continue;
    if (cpfAlvo && cpf11(o.registro.cpf) === cpfAlvo) continue; // mesma pessoa
    return antes ? { ...o, anterior: true } : o;
  }
  return null;
}

/** Os IDs anteriores que um cadastro do CPF recebe dos outros cadastros do
 *  mesmo CPF (ficha e contrato dividem a lista), vivos e lápides: quem volta
 *  em outra linha recebe a lista de quando saiu (verificação de 12/10/2026, D3). */
export const anterioresDoCpf = (cpf: string, alvo: { colecao: string; id: string }, outros: CadastroComId[]): IdAnterior[] =>
  cpf ? juntarAnteriores(...outros.filter((o) => !devolvida(o) && !(!o.apagado && mesmaChave(o, alvo)) && cpf11(o.registro.cpf) === cpf).map((o) => anterioresDe(o.registro))) : [];

/** Que ID um cadastro SEM o campo deve receber, olhando os outros cadastros
 *  vivos (fichas e contratos). Não olha o próprio `idPessoa`: quem chama decide
 *  se o cadastro já tem um (e aí ele não muda).
 *
 *  `lapide` é o cadastro apagado que esta gravação revive (mesma coleção, mesmo
 *  id). Reviver conta como cadastro que NASCE: o id da linha pode ser o mesmo
 *  para outra pessoa (o Organograma cria a ficha com id = slug do nome, então
 *  um homônimo cai na lápide de quem saiu). O ID da lápide só entra como o ID
 *  de um cadastro do mesmo CPF (o CPF enviado igual ao da lápide), e passa pela
 *  mesma conferência contra os vivos; sem CPF, não há ID. */
export function idParaCadastro(alvo: CadastroComId, outros: CadastroComId[], lapide?: Reg): DecisaoId {
  const cpf = cpfDoCadastro(alvo.colecao, alvo.registro);
  if (!cpf) return { idPessoa: "", motivo: "sem-cpf" };
  const mesmos = outros.filter((o) => !o.apagado && !mesmaChave(o, alvo) && cpf11(o.registro.cpf) === cpf);
  const daLapide = cpf11(campo(lapide, "cpf")) === cpf ? idGravado(lapide) : "";
  let herdaveis = [...new Set([daLapide, ...mesmos.map((o) => idGravado(o.registro))].filter(Boolean))];
  // Sem cadastro vivo do CPF: quem volta em outra linha recebe o ID que tinha
  // quando saiu (a lápide ou a linha de arquivo do mesmo CPF; D3).
  if (!herdaveis.length) {
    herdaveis = [...new Set(outros.filter((o) => o.apagado && !devolvida(o) && cpf11(o.registro.cpf) === cpf).map((o) => idGravado(o.registro)).filter(Boolean))];
  }
  if (herdaveis.length > 1) return { idPessoa: "", motivo: "mesmo-cpf-com-ids-diferentes" };
  const id = herdaveis[0] ?? cpf.slice(0, 6);
  const outro = outraPessoaComId(id, cpf, alvo, outros, herdaveis);
  if (outro) {
    return { idPessoa: "", motivo: "id-de-outra-pessoa", outro: { colecao: outro.colecao, id: outro.id, nome: String(outro.registro.nome ?? ""), ...(outro.anterior ? { anterior: true } : {}), ...(outro.apagado ? { apagado: true } : {}) } };
  }
  if (herdaveis[0]) {
    const de = mesmos.find((o) => idGravado(o.registro) === id);
    return de ? { idPessoa: id, herdadoDe: { colecao: de.colecao, id: de.id } } : { idPessoa: id };
  }
  return { idPessoa: id };
}

export const AVISO_ID_MANTIDO =
  "O ID da pessoa não muda por esta gravação: ficou o ID gravado no cadastro. Só o admin do RH troca o ID, com motivo, em Configurações do RH › Cadastros.";
/** A conta da Central de Acessos (acesso_conta.id_pessoa) é gravada pelo
 *  Painel a partir da ficha, quando a conta é salva: depois da troca ela fica
 *  com o ID antigo até alguém salvar de novo (auditoria de 12/10/2026, P1). */
export const AVISO_CENTRAL_ID_NOVO =
  "Atualize a conta desta pessoa em Painel › Sistemas › Pessoas (salvar de novo) para a Central usar o ID novo.";
export const AVISO_ID_ANTIGO =
  "O ID das fichas e contratos antigos é gravado pelo admin do RH, em Configurações do RH › Cadastros. O restante foi salvo.";
export const avisoSemId = (motivo: MotivoSemId, outroNome?: string, anterior = false): string =>
  motivo === "id-de-outra-pessoa"
    ? `O cadastro foi salvo sem o ID da pessoa: o ID do CPF ${anterior ? "já foi" : "já é"} de ${outroNome ? `outra pessoa (${outroNome})` : "outra pessoa"}. Confira o CPF; o admin do RH decide o ID em Configurações do RH › Cadastros.`
    : motivo === "mesmo-cpf-com-ids-diferentes"
      ? "O cadastro foi salvo sem o ID da pessoa: outros cadastros com o mesmo CPF têm IDs diferentes. O admin do RH decide em Configurações do RH › Cadastros."
      : "O cadastro foi salvo sem o ID da pessoa: o ID nasce do CPF, que falta. Preencha o CPF.";

/** O que gravar no lugar dos campos do ID, partindo do registro enviado.
 *  `fonte` é de onde os campos vêm (o cadastro gravado); sem fonte, os campos
 *  saem do registro (o envio nunca escreve nenhum deles). */
export function comCamposDoId(registro: Record<string, unknown>, fonte: Reg): Record<string, unknown> {
  const r: Record<string, unknown> = { ...registro };
  for (const k of CAMPOS_DO_SERVIDOR) {
    const v = campo(fonte, k);
    if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) r[k] = v;
    else delete r[k];
  }
  return semBloqueioComId(r);
}

/** Cadastro com ID gravado não tem marca de bloqueio (ela some quando o ID chega). */
export function semBloqueioComId(r: Record<string, unknown>): Record<string, unknown> {
  if (idGravado(r) && CAMPO_ID_BLOQUEADO in r) { const o = { ...r }; delete o[CAMPO_ID_BLOQUEADO]; return o; }
  return r;
}

/** Põe (ou tira, com "") a marca de bloqueio. Só os MOTIVOS_DE_BLOQUEIO valem. */
export function comBloqueio(registro: Record<string, unknown>, motivo: string): Record<string, unknown> {
  const r: Record<string, unknown> = { ...registro };
  if ((MOTIVOS_DE_BLOQUEIO as readonly string[]).includes(motivo) && !idGravado(r)) r[CAMPO_ID_BLOQUEADO] = motivo;
  else delete r[CAMPO_ID_BLOQUEADO];
  return r;
}

/** Põe a lista de IDs anteriores no registro (vazia: tira o campo). A lista
 *  nunca traz o ID de hoje do próprio cadastro. */
export function comAnteriores(registro: Record<string, unknown>, lista: IdAnterior[]): Record<string, unknown> {
  const r: Record<string, unknown> = { ...registro };
  const hoje = idGravado(r);
  const fica = lista.filter((a) => a.idPessoa !== hoje);
  if (fica.length) r.idPessoaAnteriores = fica; else delete r.idPessoaAnteriores;
  return semBloqueioComId(r);
}

/** A lápide é da mesma pessoa que chega na mesma linha? Só com o mesmo CPF
 *  dos dois lados (sem CPF de um lado, não dá para dizer que é a mesma). */
export const mesmaPessoaDaLapide = (colecao: string, lapide: Reg, registro: Reg): boolean => {
  const daLapide = cpf11(campo(lapide, "cpf"));
  return !!daLapide && daLapide === cpfDoCadastro(colecao, registro);
};

/** O cadastro guarda ID gravado ou IDs anteriores? */
export const guardaIdGravado = (r: Reg): boolean => !!idGravado(r) || idsAnteriores(r).length > 0;
/** A lápide segura algum ID (tem o que perder se a vaga for ocupada)? O
 *  gravado, os anteriores, ou o do CPF (quem saiu antes do ID gravado). */
export const lapideGuardaId = (lapide: Reg): boolean => guardaIdGravado(lapide) || !!cpf11(campo(lapide, "cpf"));

/** CPF para o admin comparar: começo e fim, o meio escondido. */
export const cpfMascarado = (v: unknown): string => {
  const d = cpf11(v);
  return d ? `${d.slice(0, 3)}.${d.slice(3, 6)}.***-${d.slice(9)}` : "";
};

/** É linha de arquivo de lápide (pelo nome ou pelo campo `arquivadaDe`)? */
export const ehLinhaDeArquivo = (id: string, r: Reg): boolean => /\.saiu-v\d+$/.test(id) || !!campo(r, "arquivadaDe");

/** O id da linha onde a lápide fica guardada quando OUTRA pessoa ocupa a vaga
 *  dela. Determinístico (a versão da lápide): a fila pode repetir o envio. */
export const idDoArquivoDaLapide = (id: string, versao: number | null | undefined): string =>
  `${id.slice(0, 170)}.saiu-v${Number.isSafeInteger(versao) ? versao : 0}`;

/** O envio trouxe um ID diferente do que fica? (ausente não conta: ausente não apaga) */
export const enviouOutroId = (registro: Reg, fica: string): boolean => {
  const v = campo(registro, "idPessoa");
  return v !== undefined && v !== null && v !== "" && v !== fica;
};
