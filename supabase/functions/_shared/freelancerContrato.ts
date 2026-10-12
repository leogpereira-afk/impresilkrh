/* CPF DO FREELANCER QUE INSTALA (F07 do programa das equipes do PCP, caminho
 * B, decisão do dono de 29/09/2026).
 *
 * Quem instala como freelancer continua no Contrato de freelancer, e não numa
 * ficha de Colaboradores: o contrato existe para o prestador não entrar no
 * quadro, na folha nem no organograma. O PCP passou a ler esta coleção, e a
 * pessoa lá é o ID de 6 dígitos que sai do CPF, o mesmo da ficha. Sem CPF não
 * há ID; sem ID o freelancer fica fora do ranking e da cesta de pontos. Por
 * isso o CPF passa a ser obrigatório quando a função é de instalação.
 *
 * UMA RÉGUA, DOIS LADOS: a tela (Freelancers.tsx) e a porta de dados
 * (sync/index.ts) usam estas funções. Contrato que já está no banco sem CPF
 * não é apagado nem reescrito: ele aparece como pendente, a próxima edição
 * pela tela pede o CPF (ou o encerramento), e a gravação de sistema que não
 * mexe no CPF passa (problemaCpfFreelancer com o `atual`).
 */

export const soDigitosCpf = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

/** CPF com 11 dígitos e os dois verificadores certos. */
export function cpfValido(v: unknown): boolean {
  const n = soDigitosCpf(v);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  const dv = (base: string, peso: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (peso - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(n.slice(0, 9), 10) === Number(n[9]) && dv(n.slice(0, 10), 11) === Number(n[10]);
}

/** "Instalador", "instaladora", "Instalação", "INSTALACAO": função de instalação. */
export function ehFuncaoInstalacao(funcao: unknown): boolean {
  const t = String(funcao ?? "").normalize("NFD").toLowerCase().replace(/[^a-z]/g, "");
  return t.includes("instal");
}

type ContratoMinimo = { funcao?: unknown; situacao?: unknown; cpf?: unknown };

/** O contrato precisa de CPF? Só o de instalação que não está encerrado. */
export function exigeCpf(f: ContratoMinimo | null | undefined): boolean {
  return !!f && String(f.situacao ?? "") !== "encerrado" && ehFuncaoInstalacao(f.funcao);
}

export const MSG_CPF_INSTALADOR =
  "Contrato de instalador precisa do CPF: é dele que sai o ID de 6 dígitos que o PCP usa para dar o ponto. Preencha o CPF ou encerre o contrato.";
export const MSG_CPF_INVALIDO =
  "O CPF do contrato não confere (os dois últimos dígitos não batem). Confira o número.";

/** O que impede gravar este contrato, ou "" quando pode.
 *
 * BARRA SÓ O QUE CRIA OU PIORA A FALTA (revisão da F07). `atual` é o contrato
 * como está gravado (null quando é novo). Contrato antigo sem CPF, ou com CPF
 * de verificador errado, continua aceitando a gravação que não mexe no CPF nem
 * o torna exigível: limpar o responsável de uma ficha apagada, renovar a data
 * por uma aba antiga, encerrar. Ele segue pendente na tela. O que se recusa:
 * contrato novo fora da régua, CPF novo ou trocado que não confere, e a troca
 * de função ou situação que passa a exigir o CPF que falta.
 *
 * `edicaoManual` (a tela de Freelancers): quem está com o contrato de
 * instalador aberto preenche o CPF que falta, como a faixa pede. Encerrar
 * continua possível pela tela também. */
export function problemaCpfFreelancer(
  f: ContratoMinimo | null | undefined,
  atual: ContratoMinimo | null | undefined = null,
  { edicaoManual = false }: { edicaoManual?: boolean } = {},
): string {
  if (!f) return "";
  const cpf = soDigitosCpf(f.cpf);
  const mesmoCpf = !!atual && soDigitosCpf(atual.cpf) === cpf;
  // CPF novo ou trocado que não confere não passa em contrato nenhum: vira ID de outra pessoa.
  if (cpf && !cpfValido(cpf) && !mesmoCpf) return MSG_CPF_INVALIDO;
  if (exigeCpf(f) && !cpfValido(cpf)) {
    // Já estava gravado assim e já era exigível: a gravação não piora nada.
    const legado = mesmoCpf && exigeCpf(atual) && !edicaoManual;
    if (!legado) return cpf ? MSG_CPF_INVALIDO : MSG_CPF_INSTALADOR;
  }
  return "";
}

/** Contrato que já está gravado e ainda deve o CPF: a tela marca como pendente. */
export function cpfPendente(f: ContratoMinimo | null | undefined): boolean {
  return exigeCpf(f) && !cpfValido(f?.cpf);
}

/** O ID de 6 dígitos que o PCP vai usar, ou "" sem CPF válido. */
export function idDoContrato(f: ContratoMinimo | null | undefined): string {
  const cpf = soDigitosCpf(f?.cpf);
  return cpfValido(cpf) ? cpf.slice(0, 6) : "";
}

/* NA GRAVAÇÃO QUE PASSA PELA FILA, A RÉGUA NÃO RECUSA: AJUSTA E AVISA
 * (12/10/2026). A porta respondia 422 com o motivo acima. Na tela isso não
 * acontece (ela confere antes, com a mesma régua), mas a gravação que chega
 * pela fila do aparelho (aba com o bundle antigo, cópia local diferente do
 * banco, contrato apagado em outro aparelho) não tem quem leia o 422: o envio
 * voltava a cada ciclo, contava 25 tentativas e ia para a caixa de falhas, e
 * o contrato digitado ficava só no aparelho, diferente do banco.
 *
 * Regra da casa: nunca 4xx em gravação da fila. O contrato é salvo com tudo o
 * que foi digitado, MENOS o que a régua recusa, e o aviso diz o que ficou de
 * fora. O que a régua protege continua protegido:
 *   - CPF novo ou trocado que não confere não vai para o campo `cpf` (viraria
 *     o ID de outra pessoa): fica o CPF que estava gravado (ou nenhum, no
 *     contrato novo). O número digitado não some: vai para `cpfRecusado`, que
 *     a tela de Freelancers mostra no contrato para alguém conferir.
 *   - Envio sem CPF de um instalador que tinha CPF válido no banco não apaga
 *     o CPF: fica o gravado.
 *   - Instalador que continua sem CPF válido (novo, reativado, ou que virou
 *     instalador) é salvo como está e fica com "CPF pendente", o mesmo estado
 *     do contrato antigo: sem ID, fora do ponto no PCP até alguém preencher.
 *     Desfazer a função ou a situação seria descartar o que foi digitado.
 * O aparelho adota o contrato que o servidor gravou (a resposta traz o
 * registro), e o aviso aparece para quem está com o app aberto. */
export const AVISO_CPF_RECUSADO_MANTIDO =
  "O CPF enviado no contrato de freelancer não confere e não foi gravado: ficou o CPF que já estava. O número digitado ficou guardado no contrato para conferir em Freelancers.";
export const AVISO_CPF_RECUSADO_SEM =
  "O CPF enviado no contrato de freelancer não confere e não foi gravado. O número digitado ficou guardado no contrato para conferir em Freelancers.";
export const AVISO_CPF_MANTIDO =
  "O contrato de freelancer chegou sem o CPF: o CPF que estava gravado foi mantido.";
export const AVISO_CPF_PENDENTE =
  "Contrato de instalador salvo sem CPF válido: ele fica com CPF pendente, e o PCP não dá o ponto a essa pessoa até alguém preencher o CPF (ou encerrar o contrato) em Freelancers.";

type ContratoNaPorta = Record<string, unknown> & ContratoMinimo;

/** O contrato como a porta de dados grava, e o aviso do que ficou de fora
 *  (null quando nada mudou). Nunca recusa: ver o comentário acima. */
export function contratoNaPorta(
  f: ContratoNaPorta,
  atual: ContratoMinimo | null | undefined = null,
): { registro: ContratoNaPorta; aviso: string | null } {
  const registro: ContratoNaPorta = { ...f };
  if (!problemaCpfFreelancer(f, atual)) {
    /* Envio sem CPF não apaga o CPF válido gravado, em contrato de qualquer
       função ou situação (verificação da F07, 12/10/2026): o idPessoa fica
       e, no PCP, um contrato com ID e sem CPF faria o ID da mesma pessoa
       virar repetido. Campo ausente ou vazio nunca apaga. */
    if (!soDigitosCpf(f.cpf) && cpfValido(atual?.cpf)) {
      registro.cpf = atual?.cpf;
      return { registro, aviso: AVISO_CPF_MANTIDO };
    }
    // O CPF recusado só sai quando chega um CPF válido NOVO (diferente do gravado):
    // outra gravação qualquer do contrato não apaga o lembrete sem ninguém conferir.
    if ("cpfRecusado" in registro && cpfValido(registro.cpf) && soDigitosCpf(registro.cpf) !== soDigitosCpf(atual?.cpf)) delete registro.cpfRecusado;
    return { registro, aviso: null };
  }
  const avisos: string[] = [];
  const digitado = soDigitosCpf(f.cpf);
  const cpfGravado = atual?.cpf;
  if (digitado && !cpfValido(digitado) && digitado !== soDigitosCpf(cpfGravado)) {
    const temAnterior = !!soDigitosCpf(cpfGravado);
    registro.cpf = temAnterior ? cpfGravado : "";
    registro.cpfRecusado = String(f.cpf);
    avisos.push(temAnterior ? AVISO_CPF_RECUSADO_MANTIDO : AVISO_CPF_RECUSADO_SEM);
  } else if (!digitado && cpfValido(cpfGravado)) {
    registro.cpf = cpfGravado;
    avisos.push(AVISO_CPF_MANTIDO);
  }
  if (cpfPendente(registro)) avisos.push(AVISO_CPF_PENDENTE);
  return { registro, aviso: avisos.join(" ") || null };
}
