// ============================================================
// SEED COMPLETO — FOGÓN DORADO (Carta Real)
// Categorías → Destino:
//   COCINA: Pollos a la Brasa, Parrillas y Cortes, Porciones y Piqueos,
//           Parrilladas Mixtas, Platos Criollos, Tallarines Verdes,
//           Ensaladas, Guarniciones, Combos
//   BARRA:  Bebidas y Refrescos, Cervezas, Bar y Cocteles, Postres
// ============================================================
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de datos iniciales de Fogón Dorado...');

  // ── 1. Usuario administrador por defecto ──────────────────
  await prisma.usuario.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Admin Principal',
      rol: 'Administrador',
      pin: '1234',
      permisos: ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Reportes', 'Usuarios'],
    },
  });

  // ── 2. Mesas del salón (15 mesas) ─────────────────────────
  for (let i = 1; i <= 15; i++) {
    await prisma.mesa.upsert({
      where: { numero: i },
      update: {},
      create: { numero: i, estado: 'Libre' },
    });
  }

  // ── 3. Carta completa de productos ────────────────────────
  const carta = [

    // ── POLLOS A LA BRASA (→ Cocina) ──────────────────────
    { nombre: '1 Pollo a la Brasa',                   categoria: 'Pollos a la Brasa',    precio: 68.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/2 Pollo a la Brasa',                 categoria: 'Pollos a la Brasa',    precio: 36.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/4 Pollo a la Brasa',                 categoria: 'Pollos a la Brasa',    precio: 21.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/8 Pollo a la Brasa',                 categoria: 'Pollos a la Brasa',    precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1 Pollo Solo (Solo Para Llevar)',       categoria: 'Pollos a la Brasa',    precio: 39.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/2 Pollo Solo (Solo Para Llevar)',     categoria: 'Pollos a la Brasa',    precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1 Pollo + Papas + Chaufa',             categoria: 'Pollos a la Brasa',    precio: 75.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/2 Pollo + Papas + Chaufa',           categoria: 'Pollos a la Brasa',    precio: 40.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/4 Pollo + Papas + Chaufa',           categoria: 'Pollos a la Brasa',    precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/8 Pollo + Papas + Chaufa',           categoria: 'Pollos a la Brasa',    precio: 18.00, tipoStock: 'ilimitado', stock: 0 },

    // ── PARRILLAS Y CORTES (→ Cocina) ─────────────────────
    { nombre: 'Lomo Fino a la Parrilla (350g)',        categoria: 'Parrillas y Cortes',   precio: 45.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Bife a la Parrilla (350g)',             categoria: 'Parrillas y Cortes',   precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Parrilla de Res (350g)',                categoria: 'Parrillas y Cortes',   precio: 35.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Filete de Cerdo con Hueso (300g)',      categoria: 'Parrillas y Cortes',   precio: 30.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chuleta de Cerdo (300g)',               categoria: 'Parrillas y Cortes',   precio: 28.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Churrasco de Res (200g)',               categoria: 'Parrillas y Cortes',   precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pechuga Fogón Dorado',                  categoria: 'Parrillas y Cortes',   precio: 36.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pechuga Especial',                      categoria: 'Parrillas y Cortes',   precio: 33.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pechuga Hawaiana',                      categoria: 'Parrillas y Cortes',   precio: 33.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pollo Deshuesado a la Parrilla',        categoria: 'Parrillas y Cortes',   precio: 30.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pechuga a la Parrilla',                 categoria: 'Parrillas y Cortes',   precio: 30.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1 Conejo a la Parrilla',                categoria: 'Parrillas y Cortes',   precio: 80.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: '1/2 Conejo a la Parrilla',              categoria: 'Parrillas y Cortes',   precio: 42.00, tipoStock: 'ilimitado', stock: 0 },

    // ── PORCIONES Y PIQUEOS (→ Cocina) ────────────────────
    { nombre: 'Brocheta de Lomo (2 palos)',            categoria: 'Porciones y Piqueos',  precio: 42.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Brocheta Mixta (3 palitos)',            categoria: 'Porciones y Piqueos',  precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Anticuchos (3 palos)',                  categoria: 'Porciones y Piqueos',  precio: 30.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Brocheta de Pollo (3 palos)',           categoria: 'Porciones y Piqueos',  precio: 28.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Lengua a la Parrilla',                  categoria: 'Porciones y Piqueos',  precio: 26.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Anticuchos (2 palos)',                  categoria: 'Porciones y Piqueos',  precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pancita',                               categoria: 'Porciones y Piqueos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Panceta',                               categoria: 'Porciones y Piqueos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Trompa de Res',                         categoria: 'Porciones y Piqueos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Alitas a la Parrilla',                  categoria: 'Porciones y Piqueos',  precio: 20.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Criadilla',                             categoria: 'Porciones y Piqueos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Ubre',                                  categoria: 'Porciones y Piqueos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Molleja',                               categoria: 'Porciones y Piqueos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Riñón',                                 categoria: 'Porciones y Piqueos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chorizo a la Parrilla',                 categoria: 'Porciones y Piqueos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Piqueo Personal (1 persona)',           categoria: 'Porciones y Piqueos',  precio: 28.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Piqueo 2 Personas',                    categoria: 'Porciones y Piqueos',  precio: 55.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Piqueo Familiar',                       categoria: 'Porciones y Piqueos',  precio: 65.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Piqueo Fogón Dorado',                   categoria: 'Porciones y Piqueos',  precio: 150.00, tipoStock: 'ilimitado', stock: 0 },

    // ── PARRILLADAS MIXTAS (→ Cocina) ─────────────────────
    { nombre: 'Parrillada Mixta Personal',             categoria: 'Parrilladas Mixtas',   precio: 40.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Parrillada Mixta 2 Personas',           categoria: 'Parrilladas Mixtas',   precio: 60.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Parrillada Mixta 3 Personas',           categoria: 'Parrilladas Mixtas',   precio: 120.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Parrillada Fina Familiar (5 personas)', categoria: 'Parrilladas Mixtas',   precio: 170.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Parrillada Fogón Dorado (8-10 personas)',categoria: 'Parrilladas Mixtas',  precio: 220.00, tipoStock: 'ilimitado', stock: 0 },

    // ── PLATOS CRIOLLOS (→ Cocina) ────────────────────────
    { nombre: 'Bisteck a lo Pobre',                    categoria: 'Platos Criollos',      precio: 30.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pechuga a lo Pobre',                    categoria: 'Platos Criollos',      precio: 30.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Lomo Saltado',                          categoria: 'Platos Criollos',      precio: 26.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarín Saltado de Pollo',             categoria: 'Platos Criollos',      precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarín Saltado de Res',               categoria: 'Platos Criollos',      precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pollo Saltado',                         categoria: 'Platos Criollos',      precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Arroz Chaufa de Pollo',                 categoria: 'Platos Criollos',      precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Arroz Chaufa de Res',                   categoria: 'Platos Criollos',      precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chicharrón de Pollo',                   categoria: 'Platos Criollos',      precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Milanesa de Pollo',                     categoria: 'Platos Criollos',      precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Trucha Frita',                          categoria: 'Platos Criollos',      precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Caldo de Gallina',                      categoria: 'Platos Criollos',      precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Dieta de Pollo',                        categoria: 'Platos Criollos',      precio: 10.00, tipoStock: 'ilimitado', stock: 0 },

    // ── TALLARINES VERDES (→ Cocina) ──────────────────────
    { nombre: 'Tallarines Verdes con Lomo Fino',       categoria: 'Tallarines Verdes',    precio: 45.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarines Verdes con Bife',            categoria: 'Tallarines Verdes',    precio: 40.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarines Verdes con Pechuga',         categoria: 'Tallarines Verdes',    precio: 33.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarines Verdes con Chuleta',         categoria: 'Tallarines Verdes',    precio: 33.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarines Verdes con Pollo Deshuesado',categoria: 'Tallarines Verdes',    precio: 33.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tallarines Verdes con Churrasco',       categoria: 'Tallarines Verdes',    precio: 30.00, tipoStock: 'ilimitado', stock: 0 },

    // ── ENSALADAS (→ Cocina) ───────────────────────────────
    { nombre: 'Ensalada Fogón Dorado',                 categoria: 'Ensaladas',            precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Ensalada Campesina',                    categoria: 'Ensaladas',            precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Ensalada Hawaiana',                     categoria: 'Ensaladas',            precio: 20.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Ensalada Mixta Especial',               categoria: 'Ensaladas',            precio: 17.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Ensalada Cocida',                       categoria: 'Ensaladas',            precio: 16.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Ensalada Mixta',                        categoria: 'Ensaladas',            precio: 12.00, tipoStock: 'ilimitado', stock: 0 },

    // ── GUARNICIONES (→ Cocina) ───────────────────────────
    { nombre: 'Arroz Chaufa (Guarnición)',             categoria: 'Guarniciones',         precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Papas Fritas (Guarnición)',             categoria: 'Guarniciones',         precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Choclo',                                categoria: 'Guarniciones',         precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Papa Sancochada',                       categoria: 'Guarniciones',         precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Arroz Blanco',                          categoria: 'Guarniciones',         precio: 6.00,  tipoStock: 'ilimitado', stock: 0 },

    // ── COMBOS — Almuerzo 12pm-4pm (→ Cocina) ────────────
    { nombre: 'Combo Criollo (Almuerzo)',              categoria: 'Combos',               precio: 17.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Combo Parrillero (Almuerzo)',           categoria: 'Combos',               precio: 17.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Combo Tallarines Verdes (Almuerzo)',    categoria: 'Combos',               precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Combo Junior',                          categoria: 'Combos',               precio: 18.00, tipoStock: 'ilimitado', stock: 0 },

    // ── BEBIDAS Y REFRESCOS (→ Barra) ─────────────────────
    // Chicha Morada
    { nombre: 'Chicha Morada - Vaso',                  categoria: 'Bebidas y Refrescos',  precio: 3.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chicha Morada - 1/2 Lt',               categoria: 'Bebidas y Refrescos',  precio: 5.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chicha Morada - 1 Lt',                 categoria: 'Bebidas y Refrescos',  precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chicha Morada - 1 1/2 Lt',             categoria: 'Bebidas y Refrescos',  precio: 11.00, tipoStock: 'ilimitado', stock: 0 },
    // Maracuyá
    { nombre: 'Maracuyá - Vaso',                       categoria: 'Bebidas y Refrescos',  precio: 3.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Maracuyá - 1/2 Lt',                    categoria: 'Bebidas y Refrescos',  precio: 5.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Maracuyá - 1 Lt',                      categoria: 'Bebidas y Refrescos',  precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Maracuyá - 1 1/2 Lt',                  categoria: 'Bebidas y Refrescos',  precio: 11.00, tipoStock: 'ilimitado', stock: 0 },
    // Limonada
    { nombre: 'Limonada - Vaso',                       categoria: 'Bebidas y Refrescos',  precio: 3.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Limonada - 1/2 Lt',                    categoria: 'Bebidas y Refrescos',  precio: 5.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Limonada - 1 Lt',                      categoria: 'Bebidas y Refrescos',  precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Limonada - 1 1/2 Lt',                  categoria: 'Bebidas y Refrescos',  precio: 11.00, tipoStock: 'ilimitado', stock: 0 },
    // Naranjada
    { nombre: 'Naranjada - Vaso',                      categoria: 'Bebidas y Refrescos',  precio: 3.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Naranjada - 1/2 Lt',                   categoria: 'Bebidas y Refrescos',  precio: 5.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Naranjada - 1 Lt',                     categoria: 'Bebidas y Refrescos',  precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Naranjada - 1 1/2 Lt',                 categoria: 'Bebidas y Refrescos',  precio: 11.00, tipoStock: 'ilimitado', stock: 0 },
    // Jugos de papaya, piña, surtido
    { nombre: 'Jugo de Papaya - Vaso',                 categoria: 'Bebidas y Refrescos',  precio: 6.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Papaya - 1/2 Lt',              categoria: 'Bebidas y Refrescos',  precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Papaya - 1 Lt',                categoria: 'Bebidas y Refrescos',  precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Papaya - 1 1/2 Lt',            categoria: 'Bebidas y Refrescos',  precio: 19.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Piña - Vaso',                   categoria: 'Bebidas y Refrescos',  precio: 6.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Piña - 1/2 Lt',                categoria: 'Bebidas y Refrescos',  precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Piña - 1 Lt',                  categoria: 'Bebidas y Refrescos',  precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Piña - 1 1/2 Lt',              categoria: 'Bebidas y Refrescos',  precio: 19.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Surtido - Vaso',                   categoria: 'Bebidas y Refrescos',  precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Surtido - 1/2 Lt',                categoria: 'Bebidas y Refrescos',  precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Surtido - 1 Lt',                  categoria: 'Bebidas y Refrescos',  precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Surtido - 1 1/2 Lt',              categoria: 'Bebidas y Refrescos',  precio: 19.00, tipoStock: 'ilimitado', stock: 0 },
    // Jugos especiales
    { nombre: 'Jugo de Fresa - Vaso',                  categoria: 'Bebidas y Refrescos',  precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Fresa - 1/2 Lt',               categoria: 'Bebidas y Refrescos',  precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Fresa - 1 Lt',                 categoria: 'Bebidas y Refrescos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Fresa - 1 1/2 Lt',             categoria: 'Bebidas y Refrescos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Arándano - Vaso',               categoria: 'Bebidas y Refrescos',  precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Arándano - 1/2 Lt',            categoria: 'Bebidas y Refrescos',  precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Arándano - 1 Lt',              categoria: 'Bebidas y Refrescos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Arándano - 1 1/2 Lt',          categoria: 'Bebidas y Refrescos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Durazno - Vaso',                categoria: 'Bebidas y Refrescos',  precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Durazno - 1/2 Lt',             categoria: 'Bebidas y Refrescos',  precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Durazno - 1 Lt',               categoria: 'Bebidas y Refrescos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo de Durazno - 1 1/2 Lt',           categoria: 'Bebidas y Refrescos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Virgen Colada - Vaso',                  categoria: 'Bebidas y Refrescos',  precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Virgen Colada - 1/2 Lt',               categoria: 'Bebidas y Refrescos',  precio: 13.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Virgen Colada - 1 Lt',                 categoria: 'Bebidas y Refrescos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Virgen Colada - 1 1/2 Lt',             categoria: 'Bebidas y Refrescos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Especial - Vaso',                  categoria: 'Bebidas y Refrescos',  precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Especial - 1/2 Lt',               categoria: 'Bebidas y Refrescos',  precio: 13.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Especial - 1 Lt',                 categoria: 'Bebidas y Refrescos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Jugo Especial - 1 1/2 Lt',             categoria: 'Bebidas y Refrescos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    // Batidos
    { nombre: 'Batido - Vaso',                         categoria: 'Bebidas y Refrescos',  precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Batido - 1/2 Lt',                      categoria: 'Bebidas y Refrescos',  precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Batido - 1 Lt',                        categoria: 'Bebidas y Refrescos',  precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Batido - 1 1/2 Lt',                    categoria: 'Bebidas y Refrescos',  precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    // Gaseosas y cafés
    { nombre: 'Gaseosa 3 Lt',                          categoria: 'Bebidas y Refrescos',  precio: 17.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gaseosa 1 1/2 Lt',                     categoria: 'Bebidas y Refrescos',  precio: 10.50, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gaseosa 1 Lt',                         categoria: 'Bebidas y Refrescos',  precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gaseosa 1/2 Lt (Gordita)',              categoria: 'Bebidas y Refrescos',  precio: 5.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gaseosa 1/2 Lt',                       categoria: 'Bebidas y Refrescos',  precio: 4.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gaseosa Mediana',                       categoria: 'Bebidas y Refrescos',  precio: 3.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Café con Leche',                        categoria: 'Bebidas y Refrescos',  precio: 6.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Café Pasado',                           categoria: 'Bebidas y Refrescos',  precio: 4.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Café Instantáneo',                      categoria: 'Bebidas y Refrescos',  precio: 3.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Infusiones',                            categoria: 'Bebidas y Refrescos',  precio: 3.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Agua Mineral 1/2 Lt',                   categoria: 'Bebidas y Refrescos',  precio: 2.50,  tipoStock: 'ilimitado', stock: 0 },

    // ── CERVEZAS (→ Barra) ─────────────────────────────────
    { nombre: 'Cerveza Negra 620ml',                   categoria: 'Cervezas',             precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cerveza de Trigo 620ml',                categoria: 'Cervezas',             precio: 10.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cerveza Blanca Grande',                 categoria: 'Cervezas',             precio: 8.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cerveza Importada Personal',            categoria: 'Cervezas',             precio: 8.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cerveza Negra Chica',                   categoria: 'Cervezas',             precio: 6.50,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cerveza Blanca Chica',                  categoria: 'Cervezas',             precio: 5.50,  tipoStock: 'ilimitado', stock: 0 },

    // ── BAR Y COCTELES (→ Barra) ──────────────────────────
    // Cocteles por copa
    { nombre: 'Cóctel Fogón Dorado',                   categoria: 'Bar y Cocteles',       precio: 25.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Baileys Colado',                        categoria: 'Bar y Cocteles',       precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Whisky Etiqueta Negra (Copa)',           categoria: 'Bar y Cocteles',       precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Anís del Mono (Copa)',                  categoria: 'Bar y Cocteles',       precio: 22.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Orgasmo',                               categoria: 'Bar y Cocteles',       precio: 20.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Whisky Sour',                           categoria: 'Bar y Cocteles',       precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cucaracha',                             categoria: 'Bar y Cocteles',       precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Martini Dry',                           categoria: 'Bar y Cocteles',       precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Apple Martini',                         categoria: 'Bar y Cocteles',       precio: 18.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Whisky Etiqueta Roja (Copa)',            categoria: 'Bar y Cocteles',       precio: 17.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Amor en Llamas',                        categoria: 'Bar y Cocteles',       precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Mojito',                                categoria: 'Bar y Cocteles',       precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Piña Colada',                           categoria: 'Bar y Cocteles',       precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Machu Picchu',                          categoria: 'Bar y Cocteles',       precio: 15.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Sol y Sombra',                          categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Primavera',                             categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Daiquiri de Durazno',                   categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cocktail de Algarrobina',               categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vodka Dry',                             categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vodka Tonic',                           categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Screwdriver',                           categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Tequila Sunrise',                       categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Margarita',                             categoria: 'Bar y Cocteles',       precio: 14.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Chilcano de Pisco',                     categoria: 'Bar y Cocteles',       precio: 13.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pisco Sour',                            categoria: 'Bar y Cocteles',       precio: 13.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Aguaymanto Sour',                       categoria: 'Bar y Cocteles',       precio: 13.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Coca Sour',                             categoria: 'Bar y Cocteles',       precio: 13.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Daiquiri de Limón',                     categoria: 'Bar y Cocteles',       precio: 13.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pisco Shot (Puro)',                     categoria: 'Bar y Cocteles',       precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Perú Libre',                            categoria: 'Bar y Cocteles',       precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cuba Libre',                            categoria: 'Bar y Cocteles',       precio: 12.00, tipoStock: 'ilimitado', stock: 0 },
    // Por litro
    { nombre: 'Chilcano de Pisco x Litro',             categoria: 'Bar y Cocteles',       precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Perú Libre x Litro',                    categoria: 'Bar y Cocteles',       precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Cuba Libre x Litro',                    categoria: 'Bar y Cocteles',       precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Pisco Sour x Litro',                    categoria: 'Bar y Cocteles',       precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Aguaymanto Sour x Litro',               categoria: 'Bar y Cocteles',       precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Coca Sour x Litro',                     categoria: 'Bar y Cocteles',       precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    // Sangrías
    { nombre: 'Sangría Especial 1 Lt',                 categoria: 'Bar y Cocteles',       precio: 52.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Sangría Española o Hawaiana 1 Lt',      categoria: 'Bar y Cocteles',       precio: 37.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Sangría Española o Hawaiana 1/2 Lt',    categoria: 'Bar y Cocteles',       precio: 20.00, tipoStock: 'ilimitado', stock: 0 },
    // Vinos (por botella)
    { nombre: 'Vino Navarro Correa (Botella)',          categoria: 'Bar y Cocteles',       precio: 80.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Cousiño Macul Don Matías (Bot.)',   categoria: 'Bar y Cocteles',       precio: 80.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Marqués de Riscal (Botella)',       categoria: 'Bar y Cocteles',       precio: 80.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Sangre de Toro (Botella)',          categoria: 'Bar y Cocteles',       precio: 80.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino La Linda (Botella)',                categoria: 'Bar y Cocteles',       precio: 80.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Tacama Selección Especial (Bot.)',  categoria: 'Bar y Cocteles',       precio: 60.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Tacama Gran Tinto (Botella)',       categoria: 'Bar y Cocteles',       precio: 50.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Casillero del Diablo (Botella)',    categoria: 'Bar y Cocteles',       precio: 50.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Fond de Cave (Botella)',            categoria: 'Bar y Cocteles',       precio: 40.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Frontera (Botella)',                categoria: 'Bar y Cocteles',       precio: 40.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Tacama Rosé (Botella)',             categoria: 'Bar y Cocteles',       precio: 38.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Tabernero Gran Tinto (Botella)',    categoria: 'Bar y Cocteles',       precio: 35.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Queirolo (Botella)',                categoria: 'Bar y Cocteles',       precio: 33.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Vino Tabernero (Botella)',               categoria: 'Bar y Cocteles',       precio: 33.00, tipoStock: 'ilimitado', stock: 0 },
    // Licores por botella
    { nombre: 'Whisky Etiqueta Negra (Botella)',        categoria: 'Bar y Cocteles',       precio: 200.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Anís del Mono (Botella)',                categoria: 'Bar y Cocteles',       precio: 190.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Whisky Etiqueta Roja (Botella)',         categoria: 'Bar y Cocteles',       precio: 140.00, tipoStock: 'ilimitado', stock: 0 },

    // ── POSTRES (→ Barra) ──────────────────────────────────
    { nombre: 'Crepes',                                categoria: 'Postres',              precio: 8.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Ensalada de Frutas',                    categoria: 'Postres',              precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Durazno al Jugo',                       categoria: 'Postres',              precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Porción de Helado',                     categoria: 'Postres',              precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Selva Negra (Porción)',                 categoria: 'Postres',              precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: '3 Leches (Porción)',                    categoria: 'Postres',              precio: 7.00,  tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Gelatina',                              categoria: 'Postres',              precio: 2.00,  tipoStock: 'ilimitado', stock: 0 },

    // ── MENÚS (→ Cocina) ──────────────────────────────────
    { nombre: 'Pollo Frito',                           categoria: 'Menú',                 precio: 11.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Alitas Fritas (Menú)',                  categoria: 'Menú',                 precio: 11.00, tipoStock: 'ilimitado', stock: 0 },
    { nombre: 'Arroz a la cubana',                     categoria: 'Menú',                 precio: 11.00, tipoStock: 'ilimitado', stock: 0 },
  ];

  // Cargar productos sin duplicar y reactivar si existían
  let creados = 0;
  let existentes = 0;
  for (const p of carta) {
    const existe = await prisma.producto.findFirst({
      where: { nombre: p.nombre }
    });
    if (!existe) {
      await prisma.producto.create({ data: p,  activo: true });
      creados++;
    } else {
      await prisma.producto.update({
        where: { id: existe.id },
        data: {
          activo: true,
          precio: p.precio,
          categoria: p.categoria,
          tipoStock: p.tipoStock || 'ilimitado',
          requiereGuarnicion: p.requiereGuarnicion || false,
        }
      });
      existentes++;
    }
  }

  console.log(`✅ Carta cargada: ${creados} nuevos productos, ${existentes} reactivados/actualizados.`);
  console.log('✅ Seed completado correctamente.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
