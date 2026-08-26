// ================================================================
// SCRIPT DE MIGRACIÓN Y REPARACIÓN DE DATOS — VT VALETEC
// Ejecutar de forma independiente: npm run db:repair
// ================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SIDE_DISH_CATEGORIES = ['Pollos', 'Pollos a la Brasa', 'Parrillas y Cortes', 'Parrilladas Mixtas', 'Combos', 'Ensaladas'];

/**
 * Evalúa el estado de ensalada para una lista de ítems de pedido.
 */
async function evaluateSaladStatus(itemsList) {
  try {
    let hasPendingSalad = false;

    for (const item of itemsList) {
      if (item.notas && (item.notas.toLowerCase().includes('ensalada') || item.notas.toLowerCase().includes('cremas'))) {
        hasPendingSalad = true;
        break;
      }
      if (item.productoId) {
        const prod = await prisma.producto.findUnique({ where: { id: item.productoId } });
        if (prod && SIDE_DISH_CATEGORIES.includes(prod.categoria)) {
          hasPendingSalad = true;
          break;
        }
      }
    }

    return hasPendingSalad ? 'Pendiente' : 'No Aplica';
  } catch (err) {
    console.error('[evaluateSaladStatus] Error evaluando estado de ensalada:', err.message);
    return 'No Aplica';
  }
}

/**
 * Repara montos de pagos históricos cuando los desgloses específicos se guardaron en 0.
 */
async function repairPaymentAmounts() {
  console.log('⚡ [1/3] Iniciando auto-reparación de montos de pago históricos...');
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoEfectivo" = "total" 
      WHERE "metodoPago" = 'Efectivo' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoTarjeta" = "total" 
      WHERE "metodoPago" = 'Tarjeta' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoYape" = "total" 
      WHERE "metodoPago" = 'Yape' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Venta" 
      SET "montoEfectivo" = "total" 
      WHERE "metodoPago" = 'Mixto' AND "montoEfectivo" = 0 AND "montoTarjeta" = 0 AND "montoYape" = 0 AND "total" > 0;
    `);
    console.log('✅ [1/3] Reparación de montos históricos completada exitosamente.');
  } catch (err) {
    console.error('❌ [1/3] Error en reparación de montos históricos:', err.message);
  }
}

/**
 * Sincroniza el estado de ensaladas/cremas para pedidos activos en cocina/salón.
 */
async function syncSaladStatus() {
  console.log('⚡ [2/3] Sincronizando estado de ensaladas/cremas para pedidos activos...');
  try {
    const activeOrders = await prisma.pedido.findMany({
      where: { estado: { in: ['Cocina', 'Servido'] } },
      include: { items: true }
    });

    for (const order of activeOrders) {
      if (order.estadoEnsalada !== 'Listo') {
        const calculatedStatus = await evaluateSaladStatus(order.items);
        if (calculatedStatus !== order.estadoEnsalada) {
          await prisma.pedido.update({
            where: { id: order.id },
            data: { estadoEnsalada: calculatedStatus }
          });
        }
      }
    }
    console.log(`✅ [2/3] Sincronización de ensaladas completada para ${activeOrders.length} pedidos activos.`);
  } catch (err) {
    console.error('❌ [2/3] Error en sincronización de ensaladas:', err.message);
  }
}

/**
 * Sincroniza el flag requiereGuarnicion para la carta de productos.
 */
async function syncSideDishRequirement() {
  console.log('⚡ [3/3] Sincronizando propiedad requiereGuarnicion en productos...');
  try {
    const updatedCount = await prisma.producto.updateMany({
      where: {
        categoria: { in: SIDE_DISH_CATEGORIES }
      },
      data: { requiereGuarnicion: true }
    });
    console.log(`✅ [3/3] Sincronizado requiereGuarnicion para ${updatedCount.count} productos.`);
  } catch (err) {
    console.error('❌ [3/3] Error en sincronización de requiereGuarnicion:', err.message);
  }
}

async function runAllDataRepairs() {
  console.log('🚀 Iniciando proceso CLI de mantenimiento y reparación de datos...');
  await repairPaymentAmounts();
  await syncSaladStatus();
  await syncSideDishRequirement();
  console.log('🎉 Proceso de mantenimiento finalizado.');
}

// Ejecutar si es llamado directamente por CLI
if (require.main === module) {
  runAllDataRepairs()
    .catch((err) => {
      console.error('❌ Error crítico en ejecución de mantenimiento:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  repairPaymentAmounts,
  syncSaladStatus,
  syncSideDishRequirement,
  runAllDataRepairs
};
