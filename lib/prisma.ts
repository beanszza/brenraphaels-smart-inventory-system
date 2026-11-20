import { PrismaClient } from "@prisma/client";
import { watchStockWrites } from "@/lib/shop/stock-events";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function create() {
  const client = new PrismaClient();
  watchStockWrites(client);
  return client;
}

export const prisma = globalForPrisma.prisma || create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
