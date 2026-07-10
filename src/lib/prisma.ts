import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import WebSocket from "ws";

neonConfig.webSocketConstructor = WebSocket;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  const config = { connectionString: process.env.DATABASE_URL };
  const adapter = new PrismaNeon(config);
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
