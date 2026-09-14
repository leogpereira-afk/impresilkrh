import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";

const linha = (colecao: string, id: string, registro: Record<string, unknown> = {}) => ({ colecao, id, registro: { id, ...registro }, apagado: false });

describe("permissões efetivas da função RH", () => {
  it("colaborador não apaga dados financeiros nem documentos de colegas", async () => {
    for (const col of ["planoContas", "documentos", "avaliacoes", "pontos"]) {
      const s = servidorRh({ rows: [linha(col, "outro", { colaboradorId: "bia" })] });
      expect((await s.call({ action: "delete", colecao: col, id: "outro" })).status, col).toBe(403);
      expect(s.escritas).toHaveLength(0); expect(s.arquivos).toHaveLength(0);
    }
  });
  it("colaborador não cria ou altera o próprio pagamento", async () => {
    const s = servidorRh();
    expect((await s.call({ action: "upsert", colecao: "pagamentos", registro: { id: "p1", colaboradorId: "ana", valor: 100 } })).status).toBe(403);
    expect(s.escritas).toHaveLength(0);
  });
  it("mudar o dono no envio não toma o registro de outra pessoa", async () => {
    const s = servidorRh({ rows: [linha("aceites", "a1", { colaboradorId: "bia" })] });
    expect((await s.call({ action: "upsert", colecao: "aceites", registro: { id: "a1", colaboradorId: "ana" } })).status).toBe(403);
    expect(s.escritas).toHaveLength(0);
  });
  it("a autoria de um histórico não pode ser forjada usando o alvo como próprio", async () => {
    const s = servidorRh();
    expect((await s.call({ action: "upsert", colecao: "acessos", registro: { id: "log1", usuarioColaboradorId: "bia", colaboradorId: "ana" } })).status).toBe(403);
  });
  it("documento pessoal não pode ser baixado ou substituído por colega", async () => {
    const s = servidorRh({ rows: [linha("documentos", "d1", { colaboradorId: "bia" })] });
    expect((await s.call({ action: "getPhoto", id: "doc:d1" })).status).toBe(403);
    expect((await s.call({ action: "putPhoto", id: "doc:d1", dataUrl: "data:application/pdf;base64,ZmFrZQ==" })).status).toBe(403);
    expect(s.arquivos).toHaveLength(0);
  });
  it("colaborador consulta o próprio documento e material institucional", async () => {
    const s = servidorRh({ rows: [linha("documentos", "d1", { colaboradorId: "ana" }), linha("repositorio", "r1")] });
    expect((await s.call({ action: "getPhoto", id: "doc:d1" })).status).toBe(200);
    expect((await s.call({ action: "getPhoto", id: "doc:r1" })).status).toBe(200);
  });
  it("leitura indisponível não parece configuração ou revisão vazia", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", erroConsulta: true });
    for (const action of ["getCfg", "rev"]) expect((await s.call({ action })).status).toBe(500);
  });
  it("gestor não consulta avaliações fora da sua hierarquia", async () => {
    const s = servidorRh({ perfil: "GESTOR", rows: [
      linha("colaboradores", "ana"), linha("colaboradores", "bia", { gestorId: "ana" }), linha("colaboradores", "caio", { gestorId: "outro-gestor" }),
      linha("avaliacoes", "av1", { colaboradorId: "bia" }), linha("avaliacoes", "av2", { colaboradorId: "caio" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["avaliacoes"] });
    expect(r.status).toBe(200); expect(r.body.registros.map((x: any) => x.registro.id)).toEqual(["av1"]);
  });
  it("o organograma recebe só os campos profissionais dos colegas", async () => {
    const s = servidorRh({ rows: [linha("colaboradores", "bia", { nome: "Bia fictícia", salario: 1000, cpf: "ficticio", email: "ficticio", riscoSaida: "alto", humor: "triste", dataNascimento: "1990-01-01", cargoId: "cargo" })] });
    const r = await s.call({ action: "list", colecoes: ["colaboradores"] });
    expect(r.body.registros[0].registro).toEqual({ id: "bia", nome: "Bia fictícia", cargoId: "cargo", statusId: "ativo" });
  });
  it("edição e exclusão autorizadas passam a revisão e a autoria ao banco", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("tarefas", "t1")] });
    expect((await s.call({ action: "upsert", colecao: "tarefas", registro: { id: "t1", titulo: "Fictício" }, baseVersao: 1, mutationId: "m1" })).status).toBe(200);
    expect((await s.call({ action: "delete", colecao: "tarefas", id: "t1", baseVersao: 2, mutationId: "m2" })).status).toBe(200);
    expect(s.rpcs.map(x => [x.nome, x.args.p_versao, x.args.p_mutacao, x.args.p_apagar])).toEqual([["rh_gravar_seguro", 1, "auth-ficticio:m1", false], ["rh_gravar_seguro", 2, "auth-ficticio:m2", true]]);
    expect(s.escritas).toHaveLength(0); expect(s.arquivos).toHaveLength(0);
  });
  it("paginação adulterada e coleção desconhecida são recusadas", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    expect((await s.call({ action: "list", after: "tarefas::x),colecao.neq.x" })).status).toBe(400);
    expect((await s.call({ action: "upsert", colecao: "outra_base", registro: { id: "x" } })).status).toBe(400);
    expect(s.rpcs).toHaveLength(0);
  });
});

describe("vazamentos fechados em 07/09/2026", () => {
  it("conta societária (2.14, inclusive renumerada por equivaleA) não sai para ADMIN_RH que não é o master", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [
      linha("planoContas", "pc_2026-07_2.11.2.2", { codigo: "2.11.2.2", equivaleA: "2.14.2.2", nome: "Leonardo", valor: 28105.64, competencia: "2026-07" }),
      linha("planoContas", "pc_2026-07_2.14.1.2", { codigo: "2.14.1.2", nome: "Pedro", valor: 5000, competencia: "2026-07" }),
      linha("planoContas", "pc_2026-07_2.1.14", { codigo: "2.1.14", nome: "Contribuição Sindical", valor: 2526.42, competencia: "2026-07" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["planoContas"] });
    expect(r.status).toBe(200);
    expect(r.body.registros.map((x: any) => x.registro.codigo)).toEqual(["2.1.14"]);
  });
  it("o master vê as contas societárias", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "leonardo-goncalves", rows: [
      linha("planoContas", "pc_2026-07_2.14.1.2", { codigo: "2.14.1.2", nome: "Pedro", valor: 5000, competencia: "2026-07" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["planoContas"] });
    expect(r.body.registros).toHaveLength(1);
  });
  it("conta apontada ao sócio à mão (código novo, sem 2.14) também não sai", async () => {
    // O contador renumerou: as retiradas viraram 2.11.2.2 e o 2.14 sumiu do
    // código E do equivaleA. O dono apontou a conta ao sócio na tela, e é esse
    // apontamento que a porta passa a consultar (auditoria de 08/09/2026:
    // R$ 157.314,37 saíam para qualquer ADMIN_RH).
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [
      { id: true, config: { vinculosSocioConta: { "2.11.2.2|leonardo": "leonardo-goncalves", "2.11.1.2": "pedro-ramos", "2.7.2|consultoria": "nenhum" } } },
      linha("planoContas", "pc_2026-08_2.11.2.2", { codigo: "2.11.2.2", nome: "Leonardo", valor: 30641.92, competencia: "2026-08" }),
      linha("planoContas", "pc_2026-08_2.11.1.2", { codigo: "2.11.1.2", nome: "Pedro Ramos Pereira", valor: 8329.9, competencia: "2026-08" }),
      linha("planoContas", "pc_2026-08_2.7.2", { codigo: "2.7.2", nome: "Consultoria", valor: 5600, competencia: "2026-08" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["planoContas"] });
    // A chave antiga (só o código) também vale: é o que existe na config real.
    expect(r.body.registros.map((x: any) => x.registro.codigo)).toEqual(["2.7.2"]);
  });
  /* A CONFIG GLOBAL É LIDA POR QUALQUER UM QUE ENTRE — `getCfg` não confere
     papel, e é assim de propósito (nome da empresa, cores, vínculos). Só que
     `lancamentosSocio` é dinheiro do sócio escrito à mão, e saía inteiro junto
     com o resto: rótulo, competência e valor, para qualquer colaborador
     logado. Contagem pode, dinheiro não. */
  it("o dinheiro do sócio escrito à mão não sai pela config global", async () => {
    const config = {
      empresaNome: "Impresilk",
      vinculosSocioConta: { "2.11.2.2|leonardo": "leonardo-goncalves" },
      lancamentosSocio: [{ id: "m1", socioId: "leonardo-goncalves", competencia: "2026-08", rotulo: "Retirada extra", valor: 30000 }],
    };
    const comum = await servidorRh({ perfil: "COLABORADOR", pessoa: "ana", rows: [{ id: true, config }] }).call({ action: "getCfg" });
    expect(comum.body.config.config.lancamentosSocio).toBeUndefined();
    // O resto da config continua chegando — a tela precisa dela.
    expect(comum.body.config.config.empresaNome).toBe("Impresilk");
    expect(comum.body.config.config.vinculosSocioConta).toBeTruthy();
    // Nem o ADMIN_RH: quem manda no dinheiro do sócio é o master.
    const rh = await servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [{ id: true, config }] }).call({ action: "getCfg" });
    expect(rh.body.config.config.lancamentosSocio).toBeUndefined();
    // E o master lê inteiro.
    const master = await servidorRh({ perfil: "ADMIN_RH", pessoa: "leonardo-goncalves", rows: [{ id: true, config }] }).call({ action: "getCfg" });
    expect(master.body.config.config.lancamentosSocio).toHaveLength(1);
  });

  /* A RESPOSTA DO setCfg REABRIA A PORTA QUE O getCfg FECHOU. `rh_mesclar_config`
     faz `returning config` — devolve a linha INTEIRA depois da mesclagem. Um
     ADMIN_RH que gravasse uma cor recebia os lançamentos societários de volta
     no corpo da resposta, e nem precisava montar pedido: puxar o plano do ERP
     dispara `salvarCfg({ultimoPlanoMubi})` sozinho. */
  it("o setCfg também não devolve o dinheiro do sócio na resposta", async () => {
    const config = { empresaNome: "Impresilk", lancamentosSocio: [{ id: "m1", socioId: "leonardo-goncalves", competencia: "2026-08", rotulo: "Retirada extra", valor: 30000 }] };
    const rh = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [{ id: true, config }] });
    const r = await rh.call({ action: "setCfg", patch: { empresaCidade: "Montes Claros" } });
    expect(r.status).toBe(200);
    expect(r.body.config.lancamentosSocio).toBeUndefined();
    expect(r.body.config.empresaCidade).toBe("Montes Claros");
    // O master recebe inteiro.
    const m = servidorRh({ perfil: "ADMIN_RH", pessoa: "leonardo-goncalves", rows: [{ id: true, config }] });
    const rm = await m.call({ action: "setCfg", patch: { empresaCidade: "Montes Claros" } });
    expect(rm.body.config.lancamentosSocio).toHaveLength(1);
  });

  /* QUEM NÃO LÊ TAMBÉM NÃO APAGA. `rh_aplicar_retrato` SUBSTITUI a linha da
     config pela que o cliente manda — e o cliente manda a config local, que
     desde a poda já vem sem a chave. "Enviar tudo" de um ADMIN_RH apagaria os
     lançamentos do dono em silêncio. */
  it("'Enviar tudo' de quem não é master não apaga os lançamentos do sócio", async () => {
    const guardados = [{ id: "m1", socioId: "leonardo-goncalves", competencia: "2026-08", rotulo: "Retirada extra", valor: 30000 }];
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [{ id: true, config: { empresaNome: "Impresilk", lancamentosSocio: guardados } }] });
    await s.call({ action: "aplicarRetrato", dados: {}, rev: 1, substituir: true, config: { empresaNome: "Impresilk" } });
    const retrato = s.rpcs.find((r) => r.nome === "rh_aplicar_retrato");
    expect(retrato?.args.p_config.lancamentosSocio).toEqual(guardados);
  });

  it("o master pode reescrever os lançamentos pelo 'Enviar tudo'", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "leonardo-goncalves", rows: [{ id: true, config: { lancamentosSocio: [{ id: "velho" }] } }] });
    await s.call({ action: "aplicarRetrato", dados: {}, rev: 1, substituir: true, config: { lancamentosSocio: [{ id: "novo" }] } });
    const retrato = s.rpcs.find((r) => r.nome === "rh_aplicar_retrato");
    expect(retrato?.args.p_config.lancamentosSocio).toEqual([{ id: "novo" }]);
  });

  it("quem não pode ler os lançamentos do sócio também não pode gravá-los", async () => {
    // Como a leitura passou a omitir a chave, um cliente que devolvesse a
    // config inteira APAGARIA os lançamentos sem querer. Recusa explícita, e
    // não descarte em silêncio: responder "ok" sem cumprir é mentir.
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [{ id: true, config: {} }] });
    const r = await s.call({ action: "setCfg", patch: { lancamentosSocio: [] } });
    expect(r.status).toBe(403);
    expect(s.escritas.filter((e) => e.table === "config_global")).toHaveLength(0);
    // O master grava.
    const m = servidorRh({ perfil: "ADMIN_RH", pessoa: "leonardo-goncalves", rows: [{ id: true, config: {} }] });
    expect((await m.call({ action: "setCfg", patch: { lancamentosSocio: [] } })).status).toBe(200);
  });

  it("lançamento societário (arrendamento/retirada) não sai para ADMIN_RH que não é o master", async () => {
    // A societária virou LANÇAMENTO também, e a porta só olhava o plano.
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [
      linha("pagamentos", "mubi-1", { tipo: "Arrendamento", valor: 5250, colaboradorId: "pedro-ramos", competencia: "2026-08" }),
      linha("pagamentos", "mubi-2", { tipo: "Retirada", valor: 30641.92, colaboradorId: "leonardo-goncalves", competencia: "2026-08" }),
      linha("pagamentos", "mubi-3", { tipo: "Salário", valor: 1955.43, colaboradorId: "ana", competencia: "2026-08" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["pagamentos"] });
    expect(r.body.registros.map((x: any) => x.registro.tipo)).toEqual(["Salário"]);
  });
  it("o master continua vendo o lançamento societário", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "leonardo-goncalves", rows: [
      linha("pagamentos", "mubi-1", { tipo: "Arrendamento", valor: 5250, colaboradorId: "pedro-ramos", competencia: "2026-08" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["pagamentos"] });
    expect(r.body.registros).toHaveLength(1);
  });
  it("ADMIN_RH que não é o master não grava conta societária", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-comum", rows: [] });
    const r = await s.call({ action: "upsert", colecao: "planoContas", registro: { id: "pc_x", codigo: "2.14.2.2", valor: 1 }, baseVersao: 0, mutationId: "m9" });
    expect(r.status).toBe(403);
  });
  it("feedback em preparo não chega à própria pessoa; o que chega vem sem o roteiro", async () => {
    const s = servidorRh({ perfil: "COLABORADOR", pessoa: "carlos", rows: [
      linha("feedbacks", "f1", { colaboradorId: "carlos", tipo: "Ajuste", roteiro: "falar da peça", preparadoEm: "2026-09-07", conteudo: "" }),
      linha("feedbacks", "f2", { colaboradorId: "carlos", tipo: "Elogio", roteiro: "rascunho", preparadoEm: "2026-09-01", ocorridoEm: "2026-09-05", conteudo: "Mandou bem" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["feedbacks"] });
    const regs = r.body.registros.map((x: any) => x.registro);
    expect(regs.map((x: any) => x.id)).toEqual(["f2"]);
    expect(regs[0].roteiro).toBeUndefined();
    expect(regs[0].preparadoEm).toBeUndefined();
    expect(regs[0].conteudo).toBe("Mandou bem");
  });
  it("gestora não recebe os próprios dados de gestão, mas recebe os da subordinada", async () => {
    const s = servidorRh({ perfil: "GESTOR", pessoa: "maria", rows: [
      linha("colaboradores", "maria", { nome: "Maria", riscoSaida: "alto", potencial: "alto", cargoId: "c" }),
      linha("colaboradores", "bia", { nome: "Bia", gestorId: "maria", riscoSaida: "baixo", cargoId: "c" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["colaboradores"] });
    const por = Object.fromEntries(r.body.registros.map((x: any) => [x.registro.id, x.registro]));
    expect(por.maria.riscoSaida).toBeUndefined();
    expect(por.maria.potencial).toBeUndefined();
    expect(por.bia.riscoSaida).toBe("baixo");
  });
});

describe("gestor não lança nem aprova verba para si (auditoria de 07/09/2026)", () => {
  it("lançamento e fechamento com o próprio colaboradorId são recusados; da equipe, aceitos", async () => {
    const s = servidorRh({ perfil: "GESTOR", pessoa: "maria", rows: [linha("colaboradores", "maria"), linha("colaboradores", "bia", { gestorId: "maria" })] });
    expect((await s.call({ action: "upsert", colecao: "lancamentos", registro: { id: "l1", colaboradorId: "maria", valor: 3000 }, baseVersao: 0, mutationId: "m1" })).status).toBe(403);
    expect((await s.call({ action: "upsert", colecao: "fechamentos", registro: { id: "2026-09::maria", colaboradorId: "maria", aprovado: true }, baseVersao: 0, mutationId: "m2" })).status).toBe(403);
    expect((await s.call({ action: "upsert", colecao: "lancamentos", registro: { id: "l2", colaboradorId: "bia", valor: 300 }, baseVersao: 0, mutationId: "m3" })).status).toBe(200);
  });
});

describe("mural de vagas: a própria candidatura interna (auditoria de 07/09/2026)", () => {
  it("colaborador grava e lê a própria candidatura interna; não a de outro nem uma externa", async () => {
    const s = servidorRh({ perfil: "COLABORADOR", pessoa: "carlos", rows: [
      linha("candidatos", "c1", { colaboradorId: "carlos", origem: "Interno", vagaId: "v1" }),
      linha("candidatos", "c2", { colaboradorId: "bia", origem: "Interno", vagaId: "v1" }),
      linha("candidatos", "c3", { nome: "Externo", origem: "Externo", vagaId: "v1" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["candidatos"] });
    expect(r.body.registros.map((x: any) => x.registro.id)).toEqual(["c1"]);
    expect((await s.call({ action: "upsert", colecao: "candidatos", registro: { id: "c9", colaboradorId: "carlos", origem: "Interno", vagaId: "v2" }, baseVersao: 0, mutationId: "m1" })).status).toBe(200);
    expect((await s.call({ action: "upsert", colecao: "candidatos", registro: { id: "c8", colaboradorId: "bia", origem: "Interno", vagaId: "v2" }, baseVersao: 0, mutationId: "m2" })).status).toBe(403);
    expect((await s.call({ action: "upsert", colecao: "candidatos", registro: { id: "c7", colaboradorId: "carlos", origem: "Externo", vagaId: "v2" }, baseVersao: 0, mutationId: "m3" })).status).toBe(403);
  });
});
