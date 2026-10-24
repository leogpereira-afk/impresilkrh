/* A02: o servidor preserva a lista do próprio usuário, sem ampliar o papel. */
import { expect, it } from "vitest";
import { servidorRh } from "@/test/servidorRh";
it.each([undefined, [], ["*"], ["ferias"]])("devolve permissões %j sem converter vazio em acesso total", async (permissoes) => {
  const registro = { id: "u-ficticio", colaboradorId: "gestor-ficticio", perfil: "GESTOR", ativo: true, ...(permissoes === undefined ? {} : { permissoes }), senhaHash: { segredo: "ficticio" } };
  const s = servidorRh({ perfil: "GESTOR", pessoa: "gestor-ficticio", rows: [
    { colecao: "usuarios", id: registro.id, registro },
    { colecao: "planoContas", id: "conta-ficticia", registro: { id: "conta-ficticia", codigo: "8.8", valor: 123 } },
    { colecao: "usuarios", id: "outro-usuario", registro: { id: "outro-usuario", colaboradorId: "outro-ficticio", permissoes: ["*"] } },
  ] });
  const r = await s.call({ action: "list", colecoes: ["usuarios", "planoContas"] });
  expect(r.status).toBe(200);
  expect(r.body.registros).toHaveLength(1);
  const recebido = r.body.registros[0].registro;
  expect(recebido.permissoes).toEqual(permissoes);
  expect(recebido).not.toHaveProperty("senhaHash");
  const gravacao = await s.call({ action: "upsert", colecao: "planoContas", registro: { id: "conta-ficticia", codigo: "8.8" } });
  expect(gravacao.status).toBe(403);
});

it.each(["COLABORADOR", "GESTOR", "ADMIN_RH"])("eventos privados respeitam perfil %s no servidor", async (perfil) => {
  const registro = { id: "aviso-ficticio", titulo: "Aviso restrito fictício", data: "2026-10-01" };
  const s = servidorRh({ perfil, rows: [{ colecao: "eventos", id: registro.id, registro }] });
  const r = await s.call({ action: "list", colecoes: ["eventos"] });
  expect(r.status).toBe(200);
  expect(r.body.registros).toHaveLength(perfil === "ADMIN_RH" ? 1 : 0);
  if (perfil !== "ADMIN_RH") {
    expect((await s.call({ action: "upsert", colecao: "eventos", registro })).status).toBe(403);
  }
});
