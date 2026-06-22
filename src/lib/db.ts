import { PrismaClient } from "@prisma/client";

// Singleton do Prisma para evitar múltiplas conexões em desenvolvimento (hot reload).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Aceita tanto DATABASE_URL (padrão) quanto NETLIFY_DATABASE_URL (criada
// automaticamente pelo "Netlify DB"/Neon), nesta ordem de preferência.
const urlBanco =
  process.env.DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED;

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(urlBanco ? { datasourceUrl: urlBanco } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
