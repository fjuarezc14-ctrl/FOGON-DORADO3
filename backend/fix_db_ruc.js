const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Venta" SET "estadoSunat" = REPLACE("estadoSunat", '20496009259', '10710311191') WHERE "estadoSunat" LIKE '%20496009259%'`
  );
  console.log(`✅ Filas actualizadas en la base de datos: ${result}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
