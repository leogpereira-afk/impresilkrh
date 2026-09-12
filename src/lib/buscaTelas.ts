// ============================================================================
// BUSCA DE TELAS — achar pelo nome em vez de caçar na barra.
//
// O menu do RH tem 25 itens em 6 grupos, e 11 deles no mesmo grupo ("Pessoas").
// Não havia busca nem atalho: a única forma de chegar numa tela era rolar a
// barra e reconhecer o rótulo. Quem usa o dia inteiro decora; quem entra uma vez
// por semana procura.
//
// A regra de casamento é o que faz a busca servir ou irritar, e aqui ela precisa
// aguentar como as pessoas realmente digitam:
//   - sem acento ("ferias" acha "Férias");
//   - por pedaço do meio ("custo" acha "Custos de Colaboradores");
//   - por APELIDO, que é como a casa chama ("ponto" acha "Frequência e
//     Advertências", "aso" acha "Saúde e Segurança").
// ============================================================================

/** Tira acento e caixa: "Férias" e "ferias" têm de casar. */
export function normalizar(txt: string): string {
  return String(txt ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface TelaBuscavel {
  href: string;
  label: string;
  grupo: string;
  /** Como a casa chama a tela, além do rótulo oficial. */
  apelidos?: string[];
}

/**
 * Apelidos por rota. Ficam aqui, e não no rótulo do menu, porque o menu precisa
 * do nome formal — quem procura é que usa o nome do dia a dia.
 */
export const APELIDOS: Record<string, string[]> = {
  "/ponto": ["ponto", "frequencia", "advertencia", "falta", "atraso", "hora extra", "folha variavel"],
  "/sst": ["aso", "exame", "nr", "seguranca", "epi", "cipa", "saude"],
  "/custos": ["folha", "salario", "pagamento", "custo", "adiantamento"],
  "/ferias": ["ferias", "descanso"],
  "/integracao": ["onboarding", "offboarding", "admissao", "desligamento", "checklist"],
  "/colaboradores": ["funcionario", "gente", "equipe", "quadro", "pessoal"],
  "/cargos": ["cargo", "funcao", "descricao de cargo"],
  "/carreira": ["salario", "faixa", "plano de carreira", "promocao"],
  "/desempenho": ["avaliacao", "nota", "9box", "pdi", "meta"],
  "/feedback": ["feedback", "conversa", "devolutiva"],
  "/treinamento": ["treinamento", "curso", "capacitacao", "nr"],
  "/vagas": ["vaga", "recrutamento", "candidato", "curriculo", "selecao"],
  "/organograma": ["organograma", "hierarquia", "quem manda", "gestor"],
  "/documentos": ["documento", "politica", "manual", "regulamento"],
  "/comunicacao": ["comunicado", "aviso", "mural", "recado"],
  "/mensagens": ["whatsapp", "disparo", "mensagem", "enviar"],
  "/relatorios": ["relatorio", "indicador", "numero"],
  "/aceites": ["termo", "aceite", "assinatura", "codigo de etica"],
  // "duplicado"/"repetido"/"orfao" levam à aba Cadastros, que mora aqui: quem
  // vai atrás disso procura pelo problema ("tem gente duplicada"), não pelo
  // nome da tela em que o problema se resolve.
  "/painel-controle": ["configuracao", "ajuste", "backup", "ciclo", "modelo", "cadastro", "duplicado", "duplicidade", "repetido", "ficha repetida", "orfao", "apagar cadastro", "excluir cadastro"],
  "/lgpd": ["lgpd", "acesso", "auditoria", "log", "privacidade"],
  "/calendario": ["calendario", "agenda", "data"],
  "/painel": ["inicio", "home", "resumo", "visao geral"],
  "/meu-perfil": ["meu perfil", "minha conta", "senha"],
  "/freelancers": ["freelancer", "prestador", "terceirizado", "contrato"],
};

/**
 * Filtra as telas pelo que foi digitado.
 *
 * Sem termo, devolve tudo — o painel aberto sem digitar nada é um índice do
 * sistema, que já é útil por si.
 *
 * A ordem importa mais que o filtro: quem digita "fer" quer Férias primeiro, e
 * não uma tela cujo apelido contenha "fer" no meio. Por isso a pontuação
 * favorece, em ordem, o rótulo que COMEÇA com o termo, o rótulo que o contém, e
 * só depois o apelido.
 */
export function buscarTelas(telas: readonly TelaBuscavel[], termo: string): TelaBuscavel[] {
  const t = normalizar(termo);
  if (!t) return [...telas];

  const pontos = (tela: TelaBuscavel): number => {
    const label = normalizar(tela.label);
    if (label.startsWith(t)) return 0;
    if (label.includes(t)) return 1;
    const apelidos = (tela.apelidos ?? APELIDOS[tela.href.split("?")[0]] ?? []).map(normalizar);
    if (apelidos.some((a) => a.startsWith(t))) return 2;
    if (apelidos.some((a) => a.includes(t))) return 3;
    if (normalizar(tela.grupo).includes(t)) return 4;
    return Infinity;
  };

  return telas
    .map((tela) => ({ tela, p: pontos(tela) }))
    .filter((x) => x.p !== Infinity)
    .sort((a, b) => a.p - b.p || a.tela.label.localeCompare(b.tela.label, "pt-BR"))
    .map((x) => x.tela);
}


/** Só expande destinos de módulos já permitidos pelo menu da sessão. */
export function destinosDaBusca(telas: readonly TelaBuscavel[], master = false): TelaBuscavel[] {
  const destinos: TelaBuscavel[] = [];
  for (const t of telas) {
    destinos.push({ ...t, href: t.href === '/custos' ? '/custos?aba=global' : t.href === '/ponto' ? '/ponto?aba=ponto' : t.href });
    const filhos: { aba: string; label: string; apelidos: string[] }[] = t.href === '/custos' ? [
      {aba:'custos',label:'Pagamentos por pessoa',apelidos:['pessoa','recebimentos']},
      {aba:'sync',label:'Importação e conferência',apelidos:['sincronizacao','importar','erp','mubisys']},
      {aba:'relatorios',label:'Relatórios financeiros',apelidos:['financeiro','relatorio de pagamentos']},
      {aba:'viagens',label:'Viagens e diárias',apelidos:['viagem','viagens','diarias']},
      {aba:'encargos',label:'Reservas estimadas',apelidos:['encargos','provisoes']},
      ...(master ? [{aba:'societarias',label:'Pagamentos societários',apelidos:['socios','societarias']}] : []),
    ] : t.href === '/ponto' ? [
      {aba:'advertencias',label:'Advertências',apelidos:['advertencia']},
      {aba:'absenteismo',label:'Ausências',apelidos:['falta','absenteismo']},
      {aba:'folha-variavel',label:'Verbas variáveis do mês',apelidos:['folha variavel','extras']},
    ] : t.href === '/painel-controle' ? [
      {aba:'cadastros',label:'Conferir cadastros e duplicidades',apelidos:['cadastro','duplicado','orfao','transferir']},
      {aba:'usuarios',label:'Usuários e permissões',apelidos:['acesso','usuario','permissao']},
      {aba:'aval',label:'Ciclos e modelos de avaliação',apelidos:['ciclo','checklist','pesos']},
      {aba:'historico',label:'Histórico de alterações',apelidos:['historico','quem alterou']},
      {aba:'marca',label:'Marca e backup',apelidos:['backup','restaurar','marca']},
    ] : t.href === '/desempenho' ? [
      {aba:'avaliacoes',label:'Avaliações da equipe',apelidos:['avaliacao','nota']},
      {aba:'metas',label:'Metas da equipe',apelidos:['meta','objetivo']},
      {aba:'pdi',label:'Planos de desenvolvimento',apelidos:['pdi','desenvolvimento']},
      {aba:'pesquisas',label:'Pesquisas e dinâmicas',apelidos:['pesquisa','enps','dinamica']},
    ] : t.href === '/integracao' ? [
      {aba:'admissao',label:'Checklist de admissão',apelidos:['admissao','onboarding']},
      {aba:'teste',label:'Teste antes da contratação',apelidos:['teste','experiencia antes']},
      {aba:'desligamento',label:'Checklist de desligamento',apelidos:['desligamento','saida']},
    ] : t.href === '/mensagens' ? [
      {aba:'templates',label:'Modelos de mensagem',apelidos:['template','modelo de mensagem']},
      {aba:'agendamentos',label:'Fila de mensagens',apelidos:['agendamento','fila','envio']},
    ] : t.href === '/sst' ? [
      {aba:'exames',label:'Exames e ASOs',apelidos:['exame','aso','validade']},
      {aba:'certificacoes',label:'Certificações e NRs',apelidos:['nr','certificado']},
      {aba:'programas',label:'Programas de saúde e segurança',apelidos:['pgr','pcmso','sst']}
    ] : t.href === '/vagas' ? [{aba:'banco',label:'Banco de talentos',apelidos:['curriculo','banco','talento']}
    ] : t.href === '/documentos' ? [{aba:'pops',label:'Procedimentos (POPs)',apelidos:['procedimento','pop']}] : [];
    for (const f of filhos) destinos.push({href:`${t.href}?aba=${f.aba}`,label:f.label,grupo:t.label,apelidos:f.apelidos});
    if (t.href === '/colaboradores') destinos.push({href:'/colaboradores?status=freelancer',label:'Freelancers no quadro',grupo:t.label,apelidos:['freelancer','freela']});
  }
  return destinos;
}
