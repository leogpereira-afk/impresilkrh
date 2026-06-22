// Prepara o banco automaticamente durante o build (ex.: Netlify).
// - Usa a connection string do provedor (Netlify DB/Neon) se existir.
// - Cria/atualiza as tabelas (prisma db push) e popula os dados na primeira vez.
// - Se NENHUMA variável de banco existir, apenas pula (o build não falha).

import { execSync } from "node:child_process";

const url =
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!url) {
  console.log(
    "[cloud-db-setup] Nenhuma variável de banco encontrada (NETLIFY_DATABASE_URL / DATABASE_URL). " +
      "Pulando criação de tabelas e seed. Configure o banco e refaça o deploy.",
  );
  process.exit(0);
}

const env = { ...process.env, DATABASE_URL: url };

try {
  console.log("[cloud-db-setup] Sincronizando tabelas (prisma db push)…");
  execSync("npx prisma db push --accept-data-loss --skip-generate", { stdio: "inherit", env });

  console.log("[cloud-db-setup] Populando dados de demonstração (seed idempotente)…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });

  console.log("[cloud-db-setup] Banco pronto. ✅");
} catch (e) {
  console.error("[cloud-db-setup] Erro ao preparar o banco:", e?.message ?? e);
  process.exit(1);
}
