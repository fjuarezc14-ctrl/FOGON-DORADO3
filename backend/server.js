const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const LIMITE_CANCELACION_MS = 5 * 60 * 1000; // 5 minutos

function generarPinSignature(pin, userId) {
  return crypto.createHash('sha256').update(`${pin || ''}_${userId}_salt_fogon_auth`).digest('hex').substring(0, 16);
}

// ============================================================
// STORE EN MEMORIA: ALERTAS DE CANCELACIÓN PARA COCINA Y BARRA
// Se limpia automáticamente cada 2 horas (ítems > 2h se descartan).
// ============================================================
let cancelacionesCocina = []; // [{ id, pedidoId, items, mesaInfo, canceladoEn, codigoPedidosYa }]
let cancelacionesBarra = [];  // [{ id, pedidoId, items, mesaInfo, canceladoEn, codigoPedidosYa }]

setInterval(() => {
  const dosHorasAtras = Date.now() - 2 * 60 * 60 * 1000;
  cancelacionesCocina = cancelacionesCocina.filter(c => new Date(c.canceladoEn).getTime() > dosHorasAtras);
  cancelacionesBarra = cancelacionesBarra.filter(c => new Date(c.canceladoEn).getTime() > dosHorasAtras);
}, 30 * 60 * 1000); // limpiar cada 30 min

// Categorías que van a la BARRA (el resto va a COCINA)
const BARRA_CATEGORIAS = [
  'Bebidas y Refrescos',
  'Bebidas',
  'Cervezas',
  'Bar y Cocteles',
  'Postres',
];

function isBarraItem(item) {
  if (!item) return false;
  const cat = item.producto?.categoria || item.categoria || '';
  if (BARRA_CATEGORIAS.includes(cat)) return true;
  
  const normName = (item.nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Platos de comida (ej: Chicharrón de Pollo/Pescado/Cerdo) van SIEMPRE a Cocina
  if (normName.includes("chicharron")) return false;

  return (
    normName.includes("sangria") ||
    normName.includes("vino") ||
    normName.includes("chicha morada") ||
    (normName.includes("chicha") && !normName.includes("chicharron")) ||
    normName.includes("gaseosa") ||
    normName.includes("chiki") ||
    normName.includes("bebida") ||
    normName.includes("cerveza") ||
    normName.includes("coctel") ||
    normName.includes("sour") ||
    normName.includes("pisco") ||
    normName.includes("mojito") ||
    normName.includes("jugo") ||
    normName.includes("limonada") ||
    normName.includes("daiquiri") ||
    normName.includes("chilcano")
  );
}

// Helper para parsear la distribución de crédito en ventas con múltiples clientes
function parsearCreditoSplit(ofertaDescripcion, defaultClienteId, defaultMonto) {
  if (ofertaDescripcion && typeof ofertaDescripcion === 'string') {
    const match = ofertaDescripcion.match(/\[CREDITO_SPLIT:(.*?)\]/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            clienteId: parseInt(item.clienteId || item.id),
            nombre: item.nombre || '',
            monto: parseFloat(item.monto || 0)
          })).filter(item => !isNaN(item.clienteId) && item.monto > 0);
        }
      } catch (e) {
        console.error('Error parseando CREDITO_SPLIT:', e);
      }
    }
  }
  const defId = parseInt(defaultClienteId);
  const defM = parseFloat(defaultMonto || 0);
  if (!isNaN(defId) && defId > 0 && defM > 0) {
    return [{ clienteId: defId, monto: defM, nombre: '' }];
  }
  return [];
}

// Helper universal para desglosar y asegurar que el 100% de la venta real en Caja sume correctamente
function obtenerMontosVenta(v) {
  if (!v || v.anulado || v.pedido?.estado === 'Cancelado') {
    return { efec: 0, tarj: 0, yape: 0 };
  }
  if (v.metodoPago === 'Cortesía' || v.metodoPago === 'Consumo' || v.metodoPago === 'PedidosYa' || v.metodoPago === 'Crédito') {
    return { efec: 0, tarj: 0, yape: 0 };
  }

  let efec = parseFloat(v.montoEfectivo || 0);
  let tarj = parseFloat(v.montoTarjeta || 0);
  let yape = parseFloat(v.montoYape || 0);
  const total = parseFloat(v.total || 0);

  if (total <= 0) {
    return { efec: 0, tarj: 0, yape: 0 };
  }

  if (v.metodoPago === 'Efectivo') {
    return { efec: total, tarj: 0, yape: 0 };
  }
  if (v.metodoPago === 'Tarjeta') {
    return { efec: 0, tarj: total, yape: 0 };
  }
  if (v.metodoPago === 'Yape') {
    return { efec: 0, tarj: 0, yape: total };
  }

  // Para 'Mixto' u otros: si la suma difiere del total físico (restando la parte a crédito) o está incompleta
  const totalFisico = total - parseFloat(v.montoCredito || 0);
  const suma = efec + tarj + yape;
  if (Math.abs(suma - totalFisico) > 0.01) {
    if (suma === 0) {
      efec = totalFisico; // Fallback seguro
    } else if (totalFisico > suma) {
      efec += (totalFisico - suma); // Cubrir remanente en efectivo para no perder recaudación
    }
  }

  return { efec, tarj, yape };
}

// ============================================================
// CONFIGURACIÓN DE PARRILLADAS Y PIQUEOS MIX (COMBO DECOMPOSITION)
// Búsqueda por Nombre de Producto (Insensible a IDs de base de datos)
// ============================================================
const MIX_PRODUCTS_DECOMPOSITION = {
  piqueo_personal: {
    billingItemName: "Piqueo Personal (1 persona)",
    altNames: ["piqueo personal", "piqueo personal (1 persona)"],
    components: [
      { nombre: "Pancita, Mollejas, Ubres (4 u c/u)" }
    ],
    reportingItems: [],
    hasDrinkSelections: true
  },
  piqueo_2_personas: {
    billingItemName: "Piqueo 2 Personas",
    altNames: ["piqueo 2 personas", "piqueo 2 p", "piqueo 2p"],
    components: [
      { nombre: "Panceta, Mollejas, Ubre, Trompas (4 u c/u)" },
      { nombre: "Anticuchos y Brochetas (2 u c/u)" }
    ],
    reportingItems: [
      { productoId: 12, nombre: "1/4 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true },
      { productoId: 38, nombre: "Anticuchos (2 palos)", cantidadMultiplier: 1, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  },
  piqueo_familiar: {
    billingItemName: "Piqueo Familiar",
    altNames: ["piqueo familiar"],
    components: [
      { nombre: "Panceta, Mollejas, Ubre, Trompas (8 u c/u)" },
      { nombre: "Chorizos, Anticuchos, Brochetas (2 u c/u)" }
    ],
    reportingItems: [
      { productoId: 38, nombre: "Anticuchos (2 palos)", cantidadMultiplier: 1, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  },
  piqueo_fogon_dorado: {
    billingItemName: "Piqueo Fogón Dorado",
    altNames: ["piqueo fogon dorado", "piqueo el fogon dorado"],
    components: [
      { nombre: "Panceta, Molleja, Ubre, Trompa (12 u c/u)" },
      { nombre: "Chorizo, Anticucho, Brocheta, Lengua (4 u c/u)" }
    ],
    reportingItems: [
      { productoId: 11, nombre: "1/2 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true },
      { productoId: 35, nombre: "Anticuchos (3 palos)", cantidadMultiplier: 1.33, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  },
  parrillada_mixta_personal: {
    billingItemName: "Parrillada Mixta Personal",
    altNames: ["parrillada mixta personal", "parrilla mixta personal"],
    components: [
      { nombre: "Res y Pollo (150g c/u)" },
      { nombre: "Chorizo (1 u)" }
    ],
    reportingItems: [
      { productoId: 13, nombre: "1/8 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true },
      { productoId: 38, nombre: "Anticuchos (2 palos)", cantidadMultiplier: 0.5, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  },
  parrillada_mixta_2_personas: {
    billingItemName: "Parrillada Mixta 2 Personas",
    altNames: ["parrillada mixta 2 personas", "parrilla mixta 2 personas", "parrillada mixta 2p", "parrilla mixta 2p"],
    components: [
      { nombre: "Res, Pollo y Cerdo (150g c/u)" },
      { nombre: "Mollejas y Ubre (4 u c/u)" },
      { nombre: "Chorizo (1 u)" }
    ],
    reportingItems: [
      { productoId: 13, nombre: "1/8 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  },
  parrillada_mixta_3_personas: {
    billingItemName: "Parrillada Mixta 3 Personas",
    altNames: ["parrillada mixta 3 personas", "parrilla mixta 3 personas", "parrillada mixta 3p", "parrilla mixta 3p"],
    components: [
      { nombre: "Res, Pollo y Cerdo (150g c/u)" },
      { nombre: "Chorizos (3 u)" }
    ],
    reportingItems: [
      { productoId: 12, nombre: "1/4 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true },
      { productoId: 13, nombre: "1/8 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true },
      { productoId: 35, nombre: "Anticuchos (3 palos)", cantidadMultiplier: 1, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  },
  parrillada_fina_familiar: {
    billingItemName: "Parrillada Fina Familiar (5 personas)",
    altNames: ["parrillada fina familiar", "parrillada fina familiar (5 personas)", "parrilla fina familiar"],
    components: [
      { nombre: "Res, Pollo y Cerdo (300g c/u)" },
      { nombre: "Chorizos (4 u)" }
    ],
    reportingItems: [
      { productoId: 11, nombre: "1/2 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true },
      { productoId: 35, nombre: "Anticuchos (3 palos)", cantidadMultiplier: 1.33, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  },
  parrillada_fogon_dorado: {
    billingItemName: "Parrillada Fogón Dorado (8-10 personas)",
    altNames: ["parrillada fogon dorado", "parrillada fogon dorado (8-10 personas)", "parrilla fogon dorado"],
    components: [
      { nombre: "Lomo Fino y Cerdo (300g c/u)" },
      { nombre: "Filete Pollo (300g)" },
      { nombre: "Ubre, Pancita y Mollejas (8 u c/u)" },
      { nombre: "Chorizos y Brochetas (5 u c/u)" },
      { nombre: "Trompa de Res (8 u)" }
    ],
    reportingItems: [
      { productoId: 11, nombre: "1/2 Pollo a la Brasa", cantidadMultiplier: 1, toBar: false, reportOnly: true },
      { productoId: 35, nombre: "Anticuchos (3 palos)", cantidadMultiplier: 1.67, toBar: false, reportOnly: true }
    ],
    hasDrinkSelections: true
  }
};

function parseSelectionsFromNotes(notas) {
  const selections = {};
  if (!notas) return selections;

  const addKV = (k, v) => {
    if (!k || !v) return;
    const cleanK = k.trim();
    const cleanV = v.trim();
    selections[cleanK] = cleanV;
    const normK = cleanK.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    selections[normK] = cleanV;
  };

  const matches = notas.match(/\[([^\]:]+):\s*([^\]]+)\]/g);
  if (matches) {
    matches.forEach(m => {
      const parts = m.slice(1, -1).split(':');
      if (parts.length >= 2) {
        addKV(parts[0], parts[1]);
      }
    });
  }

  const partsDot = notas.split('·');
  partsDot.forEach(p => {
    const clean = p.replace(/[\[\]]/g, '').trim();
    if (clean.includes(':')) {
      const idx = clean.indexOf(':');
      addKV(clean.substring(0, idx), clean.substring(idx + 1));
    }
  });

  return selections;
}

async function expandPedidoItemsForDb(itemsList) {
  const expandedList = [];
  for (const i of itemsList) {
    const prodId = parseInt(i.productoId || i.id);
    const prodNombre = (i.nombre || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Búsqueda por Nombre en lugar de ID numérico para evitar descomposiciones erróneas
    const decomp = Object.values(MIX_PRODUCTS_DECOMPOSITION).find(d => {
      const mainNameNorm = d.billingItemName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (mainNameNorm === prodNombre) return true;
      if (d.altNames && d.altNames.some(alt => alt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === prodNombre)) return true;
      return false;
    });

    if (decomp) {
      const parsedNotes = parseSelectionsFromNotes(i.notas);
      const acompanamiento = parsedNotes["Acompañamiento"] || parsedNotes["Elige el Acompañamiento"] || parsedNotes["Elige la Guarnición"] || parsedNotes["guarnicion"] || "Sin Acompañamiento";

      const detailedGrillNotesArray = [
        `🥔 ACOMPAÑAMIENTO: ${acompanamiento}`
      ];

      // Conservar el número de ensaladas o notas de ensaladas enviadas desde la carta
      if (i.notas) {
        const partes = i.notas.split(' · ');
        partes.forEach(p => {
          const pTrim = p.trim();
          const pLower = pTrim.toLowerCase();
          if (pLower.includes('ensalada') && !pLower.includes('sin ensalada')) {
            if (!detailedGrillNotesArray.includes(pTrim)) {
              detailedGrillNotesArray.push(pTrim);
            }
          }
        });
      }

      if (i.notas && i.notas.includes("(Nota:")) {
        const customNoteMatch = i.notas.match(/\(Nota:\s*([^\)]+)\)/);
        if (customNoteMatch && customNoteMatch[1]) {
          detailedGrillNotesArray.push(`📝 NOTAS CAJA: ${customNoteMatch[1]}`);
        }
      }

      // 1. MAIN BILLING ITEM: marked as pending (historial: false, entregado: false)
      // so it shows up at the top (head) of Cocina card with the full price and accompaniment note.
      expandedList.push({
        productoId: prodId,
        nombre: String(i.nombre),
        precio: parseFloat(i.precio),
        cantidad: parseInt(i.cant || i.cantidad),
        historial: false,
        entregado: false,
        notas: detailedGrillNotesArray.join(' · '),
      });

      // 2. DETAILED GRILL COMPONENTS: created with precio: 0 and notes: null
      // so they are listed clean without repeating notes or S/ 0.00 price badges.
      if (decomp.components && decomp.components.length > 0) {
        for (const comp of decomp.components) {
          expandedList.push({
            productoId: prodId,
            nombre: comp.nombre,
            precio: 0,
            cantidad: parseInt(i.cant || i.cantidad),
            historial: false,
            entregado: false,
            notas: null,
          });
        }
      }

      // 3. DRINK SELECTIONS (historial: false, entregado: false -> Go to Barra!)
      if (decomp.hasDrinkSelections) {
        const selectedDrinkNames = [];

        // Buscar todas las posibles llaves de bebidas en parsedNotes (tanto nuevos como de legado)
        const drinkKeys = [
          "Elige Bebida 1 (Medio Litro)",
          "Elige Bebida 2 (Medio Litro)",
          "Elige Bebida 2 (Un Litro)",
          "Elige la Bebida",
          "Bebida",
          "Bebida 1",
          "Bebida 2"
        ];

        for (const key of drinkKeys) {
          const val = parsedNotes[key];
          if (val) {
            selectedDrinkNames.push(val);
          }
        }

        // Agrupar si hay duplicados de bebidas de medio litro
        let groupedDrinks = [...selectedDrinkNames];
        if (prodId === 49 || prodId === 53) {
          // Si hay 2 bebidas del mismo tipo de medio litro, agruparlas en 1 litro
          if (selectedDrinkNames.length === 2 && selectedDrinkNames[0] === selectedDrinkNames[1]) {
            const drinkName = selectedDrinkNames[0];
            const name1Lt = drinkName
              .replace("1/2 Lt", "1 Lt")
              .replace("1/2 Litro", "1 Litro")
              .replace("1/2 lt", "1 lt");
            groupedDrinks = [name1Lt];
          }
        }

        if (groupedDrinks.length === 0) {
          if (prodId === 50 || prodId === 51) {
            groupedDrinks.push("Vino Tabernero (Botella)");
          }
        }

        for (const drinkName of groupedDrinks) {
          let lookupName = drinkName;
          let displayName = drinkName;

          if (drinkName === "Gaseosa Chiki") {
            lookupName = "Gaseosa Mediana";
            displayName = "Gaseosa Chiki";
          } else if (drinkName === "Vino Tabernero (Copa)") {
            lookupName = "Vino Tabernero";
            displayName = "Vino Tabernero (Copa)";
          } else if (drinkName === "Vaso de Chicha Morada" || drinkName === "Chicha Morada - Vaso") {
            lookupName = "Chicha Morada - Vaso";
            displayName = "Chicha Morada - Vaso";
          } else if (drinkName === "Sangría 1/2 Litro" || drinkName === "Sangria 1/2 Litro") {
            lookupName = "Sangría Española o Hawaiana 1/2 Lt";
            displayName = "Sangría Española o Hawaiana 1/2 Lt";
          } else if (drinkName === "Sangría 1 Litro" || drinkName === "Sangria 1 Litro") {
            lookupName = "Sangría Española o Hawaiana 1 Lt";
            displayName = "Sangría Española o Hawaiana 1 Lt";
          }

          const drinkProd = await prisma.producto.findFirst({
            where: { nombre: { contains: lookupName } }
          });

          expandedList.push({
            productoId: drinkProd ? drinkProd.id : 213,
            nombre: drinkProd ? drinkProd.nombre : displayName,
            precio: 0,
            cantidad: parseInt(i.cant || i.cantidad),
            historial: false, // Go to Barra!
            entregado: false,
            notas: null,
          });
        }
      }

      // 4. FIXED REPORTING / BAR ITEMS (historial: true, entregado: true for reportOnly)
      if (decomp.reportingItems && decomp.reportingItems.length > 0) {
        for (const rep of decomp.reportingItems) {
          expandedList.push({
            productoId: rep.productoId,
            nombre: rep.nombre,
            precio: 0,
            cantidad: Math.ceil(rep.cantidadMultiplier * parseInt(i.cant || i.cantidad)),
            historial: rep.toBar ? false : true,
            entregado: rep.toBar ? false : true, // Mark as delivered if only for reporting
            notas: null,
          });
        }
      }
    } else {
      expandedList.push({
        productoId: prodId,
        nombre: String(i.nombre),
        precio: parseFloat(i.precio),
        cantidad: parseInt(i.cant || i.cantidad),
        historial: i.historial || false,
        entregado: i.entregado || false,
        notas: i.notas ? String(i.notas) : null,
      });

      // Si el item tiene notas que contienen selección de bebida, lo agregamos como bebida incluida S/ 0
      if (i.notas) {
        const parsedNotes = parseSelectionsFromNotes(i.notas);
        const drinkKeys = [
          "Elige la Bebida (1.5 Litros)",
          "Elige la Bebida (1 Litro)",
          "Elige la Bebida",
          "Bebida",
          "Bebida 1",
          "Bebida 2"
        ];
        const selectedDrinkNames = [];
        for (const key of drinkKeys) {
          const val = parsedNotes[key];
          if (val && val !== "Sin Bebida" && val !== "Omitir (Sin Bebida)" && val !== "Sin refresco") {
            selectedDrinkNames.push(val);
          }
        }

        for (const drinkName of selectedDrinkNames) {
          let lookupName = drinkName;
          let displayName = drinkName;

          if (drinkName === "Gaseosa Chiki") {
            lookupName = "Gaseosa Mediana";
            displayName = "Gaseosa Chiki";
          } else if (drinkName === "Gaseosa 1.5 Litros" || drinkName === "Gaseosa 1 1/2 Lt") {
            lookupName = "Gaseosa 1 1/2 Lt";
            displayName = "Gaseosa 1.5 Litros";
          } else if (drinkName === "Chicha Morada 1.5 Litros" || drinkName === "Chicha Morada - 1 1/2 Lt") {
            lookupName = "Chicha Morada - 1 1/2 Lt";
            displayName = "Chicha Morada 1.5 Litros";
          } else if (drinkName === "Limonada 1.5 Litros" || drinkName === "Limonada - 1 1/2 Lt") {
            lookupName = "Limonada - 1 1/2 Lt";
            displayName = "Limonada 1.5 Litros";
          }

          const drinkProd = await prisma.producto.findFirst({
            where: { nombre: { contains: lookupName, mode: 'insensitive' } }
          });

          expandedList.push({
            productoId: drinkProd ? drinkProd.id : 213, // por defecto vino o similar
            nombre: drinkProd ? drinkProd.nombre : displayName,
            precio: 0,
            cantidad: parseInt(i.cant || i.cantidad),
            historial: false, // Va para la barra
            entregado: false,
            notas: "(Bebida Incluida en Combo - S/ 0.00)",
          });
        }
      }
    }
  }
  return expandedList;
}

async function evaluarEstadoEnsalada(itemsList) {
  try {
    let tieneEnsaladaPendiente = false;
    const categoriasGuarnicion = ['Pollos', 'Pollos a la Brasa', 'Parrillas y Cortes', 'Parrilladas Mixtas', 'Combos', 'Ensaladas'];

    for (const item of itemsList) {
      const prodId = parseInt(item.productoId || item.id);
      let prod = null;
      if (prodId) {
        prod = await prisma.producto.findUnique({
          where: { id: prodId },
          select: { requiereGuarnicion: true, categoria: true }
        });
      }
      const cat = item.categoria || prod?.categoria;
      const requiereG = prod ? prod.requiereGuarnicion : false;

      if (requiereG || (cat && categoriasGuarnicion.includes(cat))) {
        tieneEnsaladaPendiente = true;
        break;
      }
    }
    if (tieneEnsaladaPendiente) {
      return 'Pendiente';
    }
  } catch (err) {
    console.error('Error al evaluar estado de ensalada:', err);
  }
  return 'No Aplica';
}

app.use(cors());
app.use(express.json());

// ============================================================
// ESTADO DEL SERVIDOR
// ============================================================
app.get('/api/status', (req, res) => {
  const token = process.env.APISUNAT_TOKEN;
  const modoDemo = !token || token.includes('tu_token') || token.trim() === '';
  res.json({
    ok: true,
    mensaje: '🚀 Fogón Dorado Backend v3 funcionando al 100%',
    modoDemo,
    apisunatActivo: !modoDemo
  });
});

// ============================================================
// CLIENTES CON CRÉDITO (MÓDULO DE CRÉDITOS)
// ============================================================

// GET /api/clientes → Listar todos los clientes con crédito
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: { AbonosCredito: { orderBy: { creadoEn: 'desc' } } },
    });

    // Obtener todas las ventas con crédito o split de crédito
    const ventasCredito = await prisma.venta.findMany({
      where: {
        OR: [
          { clienteCreditoId: { not: null } },
          { metodoPago: 'Crédito' },
          { ofertaDescripcion: { contains: '[CREDITO_SPLIT:' } }
        ],
        anulado: false
      },
      select: { clienteCreditoId: true, montoCredito: true, total: true, ofertaDescripcion: true, metodoPago: true },
    });

    const consumoPorCliente = {};
    ventasCredito.forEach(v => {
      const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      if (splits.length > 0) {
        splits.forEach(s => {
          consumoPorCliente[s.clienteId] = (consumoPorCliente[s.clienteId] || 0) + s.monto;
        });
      } else if (v.clienteCreditoId) {
        const monto = v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0);
        consumoPorCliente[v.clienteCreditoId] = (consumoPorCliente[v.clienteCreditoId] || 0) + monto;
      }
    });

    const formateados = clientes.map(c => {
      const totalAbonado = c.AbonosCredito.reduce((s, a) => s + a.monto, 0);
      const totalConsumido = consumoPorCliente[c.id] || 0;
      const saldo = Math.max(0, totalConsumido - totalAbonado);
      return {
        id: c.id,
        nombre: c.nombre,
        tipoDoc: c.tipoDoc,
        numDoc: c.numDoc,
        telefono: c.telefono,
        direccion: c.direccion,
        esTrabajador: c.esTrabajador,
        usuarioId: c.usuarioId,
        activo: c.activo,
        totalAbonado,
        totalConsumido,
        saldo,
        abonos: c.AbonosCredito,
      };
    });

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clientes → Crear un nuevo cliente
app.post('/api/clientes', async (req, res) => {
  try {
    const { nombre, tipoDoc, numDoc, telefono, direccion, esTrabajador, usuarioId } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }
    const cliente = await prisma.cliente.create({
      data: {
        nombre: String(nombre),
        tipoDoc: tipoDoc ? String(tipoDoc) : 'DNI',
        numDoc: numDoc ? String(numDoc) : null,
        telefono: telefono ? String(telefono) : null,
        direccion: direccion ? String(direccion) : null,
        esTrabajador: Boolean(esTrabajador),
        usuarioId: usuarioId ? parseInt(usuarioId) : null,
      },
    });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clientes/:id → Editar un cliente
app.put('/api/clientes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.tipoDoc !== undefined) data.tipoDoc = String(req.body.tipoDoc);
    if (req.body.numDoc !== undefined) data.numDoc = req.body.numDoc ? String(req.body.numDoc) : null;
    if (req.body.telefono !== undefined) data.telefono = req.body.telefono ? String(req.body.telefono) : null;
    if (req.body.direccion !== undefined) data.direccion = req.body.direccion ? String(req.body.direccion) : null;
    if (req.body.esTrabajador !== undefined) data.esTrabajador = Boolean(req.body.esTrabajador);
    if (req.body.usuarioId !== undefined) data.usuarioId = req.body.usuarioId ? parseInt(req.body.usuarioId) : null;
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);

    const cliente = await prisma.cliente.update({ where: { id }, data });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clientes/:id → Desactivar un cliente
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.cliente.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clientes/:id → Ver detalle de cuenta corriente de un cliente
app.get('/api/clientes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: { AbonosCredito: { orderBy: { creadoEn: 'desc' } } },
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });

    // Buscar todas las ventas que contengan crédito para este cliente (directo o por split)
    const ventasPosibles = await prisma.venta.findMany({
      where: {
        OR: [
          { clienteCreditoId: id },
          { ofertaDescripcion: { contains: '[CREDITO_SPLIT:' } }
        ],
        anulado: false
      },
      include: { pedido: true },
      orderBy: { createdAt: 'desc' },
    });

    const ventasCredito = [];
    ventasPosibles.forEach(v => {
      const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
      const miSplit = splits.find(s => s.clienteId === id);
      if (miSplit) {
        ventasCredito.push({
          id: v.id,
          fecha: v.createdAt.toISOString(),
          total: v.total,
          montoCredito: miSplit.monto,
          estado: v.pedido?.estado || 'Pagado',
          tipoComprobante: v.tipoComprobante,
        });
      } else if (v.clienteCreditoId === id && splits.length === 0) {
        ventasCredito.push({
          id: v.id,
          fecha: v.createdAt.toISOString(),
          total: v.total,
          montoCredito: v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0),
          estado: v.pedido?.estado || 'Pagado',
          tipoComprobante: v.tipoComprobante,
        });
      }
    });

    const totalConsumido = ventasCredito.reduce((s, v) => s + v.montoCredito, 0);
    const totalAbonado = cliente.AbonosCredito.reduce((s, a) => s + a.monto, 0);
    const saldo = Math.max(0, totalConsumido - totalAbonado);

    res.json({
      ...cliente,
      totalConsumido,
      totalAbonado,
      saldo,
      ventasCredito,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clientes/:id/abonar → Registrar un abono al crédito
app.post('/api/clientes/:id/abonar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { monto, metodoPago, montoEfectivo, montoTarjeta, montoYape, registradoPor, nota } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'El monto del abono debe ser mayor a 0.' });
    }

    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado.' });

    const finalMetodo = metodoPago || 'Efectivo';
    let finalEfectivo = 0, finalTarjeta = 0, finalYape = 0;
    const montoNum = parseFloat(monto);

    if (finalMetodo === 'Mixto') {
      finalEfectivo = parseFloat(montoEfectivo || 0);
      finalTarjeta = parseFloat(montoTarjeta || 0);
      finalYape = parseFloat(montoYape || 0);
    } else if (finalMetodo === 'Efectivo') {
      finalEfectivo = montoNum;
    } else if (finalMetodo === 'Tarjeta') {
      finalTarjeta = montoNum;
    } else if (finalMetodo === 'Yape') {
      finalYape = montoNum;
    }

    const abono = await prisma.abonoCredito.create({
      data: {
        clienteId: id,
        monto: montoNum,
        metodoPago: finalMetodo,
        montoEfectivo: finalEfectivo,
        montoTarjeta: finalTarjeta,
        montoYape: finalYape,
        registradoPor: registradoPor ? String(registradoPor) : 'Cajero',
        nota: nota ? String(nota) : null,
      },
    });

    res.json({ ok: true, abono });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/abonos → Listar todos los abonos registrados (opcional: filtrar por fecha desde)
app.get('/api/abonos', async (req, res) => {
  const { desde } = req.query;
  try {
    const where = {};
    if (desde) {
      where.creadoEn = { gte: new Date(desde) };
    }
    const abonos = await prisma.abonoCredito.findMany({
      where,
      include: { cliente: true },
      orderBy: { creadoEn: 'desc' },
    });
    res.json(abonos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clientes/ventas/credito → Historial de ventas a crédito (para reportes)
app.get('/api/clientes/ventas/credito', async (req, res) => {
  try {
    const ventas = await prisma.venta.findMany({
      where: { clienteCreditoId: { not: null }, anulado: false },
      include: {
        pedido: { include: { mesa: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formateadas = ventas.map(v => ({
      id: v.id,
      clienteId: v.clienteCreditoId,
      total: v.total,
      montoCredito: v.montoCredito || 0,
      nombreCliente: v.nombreCliente,
      fecha: v.createdAt.toISOString(),
      mesaNum: v.pedido?.mesa?.numero || null,
    }));

    res.json(formateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CONSULTA RUC/DNI SEGURA (APIsNetPe / Decolecta)
// ============================================================
app.get('/api/clientes/consulta/:doc', async (req, res) => {
  const { doc } = req.params;
  const cleaned = doc.trim();

  // Fallbacks rápidos locales para pruebas rápidas en desarrollo
  if (cleaned === '20613857321') {
    return res.json({
      razonSocial: 'FIRST FISH S.A.C.',
      direccion: 'LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS',
      tipo: 'Factura'
    });
  } else if (cleaned === '10404040404') {
    return res.json({
      nombre: 'JUAN PEREZ SOTO',
      direccion: 'CALLE SAN MARTÍN 109',
      tipo: 'Boleta'
    });
  }

  const token = process.env.APIS_NET_PE_TOKEN;

  // Si no hay token configurado, proveemos fallbacks dinámicos inteligentes para simulación
  if (!token || token.includes('tu_token') || token === '') {
    const esRuc = cleaned.length === 11;
    if (esRuc) {
      return res.json({
        razonSocial: `DISTRIBUIDORA Y RESTAURANTE ${cleaned} S.A.C. (MOCK)`,
        direccion: `AV. LOS PIONEROS N° ${cleaned.substring(4, 7)}, LIMA LIMA LOS OLIVOS`,
        tipo: 'Factura'
      });
    } else {
      return res.json({
        nombre: `CLIENTE DE PRUEBA ${cleaned} (MOCK)`,
        direccion: `CALLE PRINCIPAL N° ${cleaned.substring(3, 6)}`,
        tipo: 'Boleta'
      });
    }
  }

  try {
    const isRUC = cleaned.length === 11;
    const apiURL = isRUC
      ? `https://api.decolecta.com/v1/sunat/ruc?numero=${cleaned}`
      : `https://api.decolecta.com/v1/reniec/dni?numero=${cleaned}`;

    const response = await fetch(apiURL, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Referer': 'https://apis.net.pe/',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();

      // Mapear al formato consistente que espera el frontend
      if (isRUC) {
        return res.json({
          razonSocial: data.razon_social || '',
          direccion: data.direccion || '',
          tipo: 'Factura'
        });
      } else {
        return res.json({
          nombre: data.full_name || `${data.first_name || ''} ${data.first_last_name || ''} ${data.second_last_name || ''}`.trim() || '',
          direccion: '', // DNI de RENIEC no devuelve dirección de forma pública
          tipo: 'Boleta'
        });
      }
    } else {
      const errorText = await response.text();
      console.warn(`[Proxy Decolecta] Error de respuesta de API (${response.status}): ${errorText}`);
      throw new Error(`API responded with status ${response.status}`);
    }
  } catch (err) {
    console.error("Error en proxy de consulta RUC/DNI:", err);
    const esRuc = cleaned.length === 11;
    res.json({
      razonSocial: '',
      nombre: '',
      direccion: '',
      tipo: esRuc ? 'Factura' : 'Boleta'
    });
  }
});



// ============================================================
// MESAS — Consolidado con todos los pedidos activos
// ============================================================

app.get('/api/mesas', async (req, res) => {
  try {
    const mesas = await prisma.mesa.findMany({
      orderBy: { numero: 'asc' },
      include: {
        Pedidos: {
          where: { estado: { in: ['Cocina', 'Servido'] } },
          orderBy: { createdAt: 'asc' },
          include: {
            items: {
              include: { producto: { select: { categoria: true } } },
            },
          },
        },
      },
    });

    const formateadas = mesas.map(m => {
      const pedidosActivos = m.Pedidos;
      if (pedidosActivos.length === 0) {
        return { num: m.numero, estado: m.estado, pedidoData: null };
      }

      // Consolidar items de TODOS los pedidos activos (fix bug adicional)
      const todosLosItems = pedidosActivos.flatMap(p =>
        p.items.map(i => ({
          id: String(i.productoId),
          itemId: i.id,
          nombre: i.nombre,
          precio: i.precio,
          cant: i.cantidad,
          historial: i.historial,
          entregado: i.entregado,
          categoria: i.producto?.categoria || '',
          pedidoId: p.id,
          notas: i.notas || null,
        }))
      );

      const totalConsolidado = pedidosActivos.reduce((sum, p) => sum + p.total, 0);
      const pedidoIds = pedidosActivos.map(p => p.id);
      const primerPedido = pedidosActivos[0];
      const ultimoPedido = pedidosActivos[pedidosActivos.length - 1];

      let consolidadoEstadoEnsalada = 'No Aplica';
      const estadosEnsaladas = pedidosActivos.map(p => p.estadoEnsalada);
      if (estadosEnsaladas.includes('Pendiente')) {
        consolidadoEstadoEnsalada = 'Pendiente';
      } else if (estadosEnsaladas.includes('Listo')) {
        consolidadoEstadoEnsalada = 'Listo';
      }

      return {
        num: m.numero,
        estado: m.estado,
        pedidoData: {
          pedidoIds,
          pedidoId: ultimoPedido.id,
          mesero: primerPedido.mesero,
          total: totalConsolidado,
          hora: primerPedido.createdAt.toLocaleTimeString('es-PE', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
          }),
          pedidoCreadoEn: ultimoPedido.createdAt.toISOString(),
          adicional: pedidosActivos.length > 1,
          items: todosLosItems,
          estadoEnsalada: consolidadoEstadoEnsalada,
        },
      };
    });

    res.json(formateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas → Crear una nueva mesa
app.post('/api/mesas', async (req, res) => {
  const { numero } = req.body;
  const num = parseInt(numero);

  if (isNaN(num) || num <= 0) {
    return res.status(400).json({ error: 'El número de mesa debe ser un número entero positivo.' });
  }

  try {
    const existe = await prisma.mesa.findUnique({ where: { numero: num } });
    if (existe) {
      return res.status(400).json({ error: 'El número de mesa ya está en uso.' });
    }

    const nuevaMesa = await prisma.mesa.create({
      data: { numero: num, estado: 'Libre' }
    });
    res.json(nuevaMesa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/mesas/:numero → Modificar el número de una mesa
app.put('/api/mesas/:numero', async (req, res) => {
  const numeroActual = parseInt(req.params.numero);
  const { nuevoNumero } = req.body;
  const nuevoNum = parseInt(nuevoNumero);

  if (isNaN(nuevoNum) || nuevoNum <= 0) {
    return res.status(400).json({ error: 'El nuevo número de mesa debe ser un número entero positivo.' });
  }

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { numero: numeroActual },
      include: { Pedidos: { where: { estado: { in: ['Cocina', 'Servido'] } } } }
    });

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada.' });

    if (mesa.estado !== 'Libre' || mesa.Pedidos.length > 0) {
      return res.status(400).json({ error: 'No se puede modificar el número de una mesa con comandas activas.' });
    }

    if (numeroActual !== nuevoNum) {
      const existe = await prisma.mesa.findUnique({ where: { numero: nuevoNum } });
      if (existe) {
        return res.status(400).json({ error: 'El nuevo número de mesa ya está en uso.' });
      }
    }

    const mesaActualizada = await prisma.mesa.update({
      where: { numero: numeroActual },
      data: { numero: nuevoNum }
    });
    res.json(mesaActualizada);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/mesas/:numero → Eliminar una mesa
app.delete('/api/mesas/:numero', async (req, res) => {
  const numero = parseInt(req.params.numero);

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { numero },
      include: { Pedidos: { where: { estado: { in: ['Cocina', 'Servido'] } } } }
    });

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada.' });

    if (mesa.estado !== 'Libre' || mesa.Pedidos.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una mesa con comandas activas.' });
    }

    await prisma.mesa.delete({ where: { numero } });
    res.json({ ok: true, mensaje: `Mesa ${numero} eliminada correctamente.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas/:num/unir → Unir una mesa a otra principal
app.post('/api/mesas/:num/unir', async (req, res) => {
  try {
    const numPrincipal = parseInt(req.params.num);
    const { numeroMesaAUnir } = req.body;

    if (!numeroMesaAUnir) {
      return res.status(400).json({ error: 'Debe especificar el número de mesa a unir.' });
    }

    const numUnir = parseInt(numeroMesaAUnir);

    // Buscar ambas mesas
    const mesaPrincipal = await prisma.mesa.findUnique({ where: { numero: numPrincipal } });
    const mesaAUnir = await prisma.mesa.findUnique({ where: { numero: numUnir } });

    if (!mesaPrincipal || !mesaAUnir) {
      return res.status(404).json({ error: 'Mesa principal o mesa a unir no encontrada.' });
    }

    if (mesaAUnir.estado !== 'Libre') {
      return res.status(400).json({ error: `La mesa ${numUnir} no está libre (estado: ${mesaAUnir.estado}).` });
    }

    // Unir mesa (cambiar estado a "Unida a Mesa X")
    await prisma.mesa.update({
      where: { id: mesaAUnir.id },
      data: { estado: `Unida a Mesa ${numPrincipal}` },
    });

    res.json({ ok: true, mensaje: `Mesa ${numUnir} unida con éxito a Mesa ${numPrincipal}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas/:num/separar → Separar todas las mesas unidas a esta
app.post('/api/mesas/:num/separar', async (req, res) => {
  try {
    const numPrincipal = parseInt(req.params.num);

    // Liberar todas las mesas unidas a esta mesa principal
    await prisma.mesa.updateMany({
      where: { estado: `Unida a Mesa ${numPrincipal}` },
      data: { estado: 'Libre' },
    });

    res.json({ ok: true, mensaje: `Mesas unidas a la Mesa ${numPrincipal} han sido separadas.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mesas/:num/pedido → Enviar a cocina (con descuento de stock)
app.post('/api/mesas/:num/pedido', async (req, res) => {
  const { num } = req.params;
  const { mesero, items, total, adicional } = req.body;

  try {
    const mesa = await prisma.mesa.findUnique({ where: { numero: parseInt(num) } });
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    // Control de concurrencia: Evitar comandas adicionales en mesas que ya fueron cobradas/liberadas
    if (adicional) {
      const activeCount = await prisma.pedido.count({
        where: { mesaId: mesa.id, estado: { in: ['Cocina', 'Servido'] } }
      });
      if (activeCount === 0) {
        return res.status(400).json({
          error: 'Esta mesa ya ha sido cobrada y liberada por caja. Por favor, vuelve a abrir la mesa antes de comandar.'
        });
      }
    }

    const itemsNuevos = items.filter(i => !i.historial);
    const expandedItems = await expandPedidoItemsForDb(itemsNuevos);
    const finalEstadoEnsalada = await evaluarEstadoEnsalada(itemsNuevos);

    const pedido = await prisma.pedido.create({
      data: {
        mesaId: parseInt(mesa.id),
        mesero: String(mesero),
        total: parseFloat(total),
        adicional: adicional || false,
        estado: 'Cocina',
        estadoEnsalada: finalEstadoEnsalada,
        items: {
          create: expandedItems.map(i => ({
            productoId: i.productoId,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
            historial: i.historial,
            entregado: i.entregado || false,
            notas: i.notas,
          })),
        },
      },
    });

    // Descontar stock de productos limitados
    for (const item of itemsNuevos) {
      await prisma.producto.updateMany({
        where: { id: parseInt(item.id), tipoStock: 'limitado' },
        data: { stock: { decrement: item.cant } },
      });
    }

    await prisma.mesa.update({
      where: { id: mesa.id },
      data: { estado: 'Cocina' },
    });

    res.json({ ok: true, pedidoId: pedido.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// COCINA — Endpoint unificado (salon + delivery)
// ============================================================

// GET /api/pedidos/cocina → Todos los pedidos en Cocina para el monitor
app.get('/api/pedidos/cocina', async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { estado: 'Cocina' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tipoEntrega: true,
        codigoPedidosYa: true,
        mesero: true,
        adicional: true,
        estadoEnsalada: true,
        createdAt: true,
        mesa: { select: { numero: true } },
        items: {
          select: {
            id: true,
            nombre: true,
            cantidad: true,
            precio: true,
            historial: true,
            notas: true,
            producto: { select: { categoria: true } },
          },
        },
      },
    });

    const formateados = pedidos.map(p => ({
      pedidoId: p.id,
      mesaNum: p.mesa?.numero || null,
      tipoEntrega: p.tipoEntrega,
      codigoPedidosYa: p.codigoPedidosYa,
      mesero: p.mesero,
      adicional: p.adicional,
      estadoEnsalada: p.estadoEnsalada,
      hora: p.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      // Filtrar bebidas: cocina solo ve lo que prepara (excluyendo barra)
      items: p.items
        .filter(i => !i.historial && !isBarraItem(i))
        .map(i => ({
          id: i.id,
          nombre: i.nombre,
          cant: i.cantidad,
          precio: i.precio,
          categoria: i.producto?.categoria || '',
          notas: i.notas || null,
        })),
    })).filter(p => p.items.length > 0); // Ocultar si solo tiene bebidas

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pedidos/barra → Todos los pedidos con bebidas pendientes en Cocina
app.get('/api/pedidos/barra', async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { estado: 'Cocina' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tipoEntrega: true,
        codigoPedidosYa: true,
        mesero: true,
        adicional: true,
        createdAt: true,
        mesa: { select: { numero: true } },
        items: {
          select: {
            nombre: true,
            cantidad: true,
            precio: true,
            historial: true,
            notas: true,
            producto: { select: { categoria: true } },
          },
        },
      },
    });

    const formateados = pedidos.map(p => ({
      pedidoId: p.id,
      mesaNum: p.mesa?.numero || null,
      tipoEntrega: p.tipoEntrega,
      codigoPedidosYa: p.codigoPedidosYa,
      mesero: p.mesero,
      adicional: p.adicional,
      hora: p.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      // Barra solo ve items de barra que no se han despachado (historial === false)
      items: p.items
        .filter(i => !i.historial && isBarraItem(i))
        .map(i => ({
          nombre: i.nombre,
          cant: i.cantidad,
          precio: i.precio,
          categoria: i.producto?.categoria || '',
          notas: i.notas || null,
        })),
    })).filter(p => p.items.length > 0);

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pedidos/ensaladas → Todos los pedidos con ensalada / cremas pendientes
app.get('/api/pedidos/ensaladas', async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        estadoEnsalada: 'Pendiente',
        estado: { in: ['Cocina', 'Servido'] }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: { producto: { select: { requiereGuarnicion: true, categoria: true } } },
        },
        mesa: true,
      },
    });

    const categoriasGuarnicion = ['Pollos', 'Pollos a la Brasa', 'Parrillas y Cortes', 'Parrilladas Mixtas', 'Combos', 'Ensaladas'];

    const formateados = pedidos.map(p => ({
      pedidoId: p.id,
      mesaNum: p.mesa?.numero || null,
      tipoEntrega: p.tipoEntrega,
      codigoPedidosYa: p.codigoPedidosYa,
      mesero: p.mesero,
      adicional: p.adicional,
      estadoCocina: p.estado,
      hora: p.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      items: p.items
        .filter(i => {
          const esBarra = BARRA_CATEGORIAS.includes(i.producto?.categoria);
          const llevaGuarnicion = i.producto?.requiereGuarnicion || (i.producto?.categoria && categoriasGuarnicion.includes(i.producto.categoria));
          
          // Excluir componentes desglosados internos (precio 0 sin notas) e ítems de reporte interno
          const esDesgloseInterno = i.precio === 0 && !i.notas;
          const esReporteInterno = i.entregado === true && i.precio === 0;

          return llevaGuarnicion && !esBarra && !esDesgloseInterno && !esReporteInterno;
        })
        .map(i => ({
          nombre: i.nombre,
          cant: i.cantidad,
          precio: i.precio,
          notas: i.notas || null,
        })),
    }));

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/ensalada-lista → Marcar la ensalada del pedido como lista
app.patch('/api/pedidos/:id/ensalada-lista', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const ped = await prisma.pedido.update({
      where: { id },
      data: { estadoEnsalada: 'Listo' },
    });
    res.json({ ok: true, estadoEnsalada: ped.estadoEnsalada });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/items/:itemId/preparar → Cocinero o Barman marca listo un item de cocina/barra de forma individual
app.patch('/api/pedidos/items/:itemId/preparar', async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    const item = await prisma.itemPedido.update({
      where: { id: itemId },
      data: { historial: true },
      include: { pedido: { include: { items: true } } },
    });

    const todosListos = item.pedido.items.every(i => i.historial === true);
    if (todosListos) {
      const ped = await prisma.pedido.update({
        where: { id: item.pedidoId },
        data: { estado: 'Servido' },
        include: { mesa: true },
      });

      if (ped.mesaId && ped.tipoEntrega === 'salon') {
        const enCocina = await prisma.pedido.count({
          where: { mesaId: ped.mesaId, estado: 'Cocina' },
        });
        if (enCocina === 0) {
          await prisma.mesa.update({
            where: { id: ped.mesaId },
            data: { estado: 'Servido' },
          });
        }
      }
    }

    res.json({ ok: true, todosListos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/preparar → Cocinero o Barman marca listo su sección
app.patch('/api/pedidos/:id/preparar', async (req, res) => {
  const id = parseInt(req.params.id);
  const { seccion } = req.body; // "cocina" o "barra"

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } } },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Filtrar los items que corresponden a la sección
    const itemsAActualizar = pedido.items.filter(i => {
      // Si es delivery/llevar, marcamos todos los items como listos para que no dependa de barra
      if (pedido.tipoEntrega === 'llevar' || pedido.tipoEntrega === 'delivery') return true;

      const esItemBarra = BARRA_CATEGORIAS.includes(i.producto?.categoria);
      if (seccion === 'barra') return esItemBarra;
      if (seccion === 'cocina') return !esItemBarra;
      return false;
    });

    // Marcar items como historial
    await prisma.itemPedido.updateMany({
      where: { id: { in: itemsAActualizar.map(item => item.id) } },
      data: { historial: true },
    });

    // Volver a consultar para validar si todos los items del pedido ya están listos
    const pedidoActualizado = await prisma.pedido.findUnique({
      where: { id },
      include: { items: true },
    });

    const todosListos = pedidoActualizado.items.every(i => i.historial === true);
    if (todosListos) {
      const ped = await prisma.pedido.update({
        where: { id },
        data: { estado: 'Servido' },
        include: { mesa: true },
      });

      // Si es pedido de salón, verificar si la mesa puede pasar a Servido
      if (ped.mesaId && ped.tipoEntrega === 'salon') {
        const enCocina = await prisma.pedido.count({
          where: { mesaId: ped.mesaId, estado: 'Cocina' },
        });
        if (enCocina === 0) {
          await prisma.mesa.update({
            where: { id: ped.mesaId },
            data: { estado: 'Servido' },
          });
        }
      }
    }

    res.json({ ok: true, todosListos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/servir → Cocinero marca como Listo
app.patch('/api/pedidos/:id/servir', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    // Marcar items como historial
    await prisma.itemPedido.updateMany({
      where: { pedidoId: id },
      data: { historial: true },
    });

    const pedido = await prisma.pedido.update({
      where: { id },
      data: { estado: 'Servido' },
      include: { mesa: true },
    });

    // Si es pedido de salón, verificar si la mesa puede pasar a Servido
    if (pedido.mesaId && pedido.tipoEntrega === 'salon') {
      const enCocina = await prisma.pedido.count({
        where: { mesaId: pedido.mesaId, estado: 'Cocina' },
      });
      if (enCocina === 0) {
        await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'Servido' },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/items/:itemId/entregar → Mozo marca un plato de cocina como entregado en la mesa
app.patch('/api/pedidos/items/:itemId/entregar', async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    await prisma.itemPedido.update({
      where: { id: itemId },
      data: { entregado: true },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/entregar-todo → Mozo marca todos los platos listos de cocina del pedido como entregados
app.patch('/api/pedidos/:id/entregar-todo', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: { include: { producto: true } } },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Filtrar items que son de Cocina (no barra) y están listos (historial: true) pero no entregados
    const itemsAActualizar = pedido.items.filter(i =>
      i.historial &&
      !i.entregado &&
      !BARRA_CATEGORIAS.includes(i.producto?.categoria)
    );

    if (itemsAActualizar.length > 0) {
      await prisma.itemPedido.updateMany({
        where: { id: { in: itemsAActualizar.map(item => item.id) } },
        data: { entregado: true },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar notas de un ítem de pedido individual
app.patch('/api/pedidos/items/:id/notas', async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const item = await prisma.itemPedido.update({
      where: { id: parseInt(id) },
      data: { notas: notas || null },
    });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CANCELACIÓN DE PEDIDOS (Solo Mozo, límite 5 min)
// ============================================================

app.patch('/api/pedidos/:id/cancelar', async (req, res) => {
  const id = parseInt(req.params.id);
  const { canceladoPor, motivo, force } = req.body;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        items: { include: { producto: true } },
        mesa: true,
      },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Si no es una cancelación forzada por supervisor, aplicar filtros normales
    if (!force) {
      if (pedido.estado !== 'Cocina') {
        return res.status(400).json({
          error: 'Este pedido ya no puede cancelarse. Solo se cancelan pedidos en estado "Cocina".',
        });
      }
    }

    // Cancelar el pedido
    await prisma.pedido.update({
      where: { id },
      data: {
        estado: 'Cancelado',
        canceladoPor: canceladoPor || 'Sin especificar',
        motivoCancela: motivo || 'Sin motivo',
        canceladoEn: new Date(),
      },
    });

    // Restaurar stock de productos limitados
    for (const item of pedido.items) {
      if (item.producto.tipoStock === 'limitado') {
        await prisma.producto.update({
          where: { id: item.productoId },
          data: { stock: { increment: item.cantidad } },
        });
      }
    }

    let mesaLiberada = false;
    let nuevoEstadoMesa = 'Libre';

    // Liberar mesa si no quedan pedidos activos o actualizar su estado
    if (pedido.mesaId) {
      const activos = await prisma.pedido.findMany({
        where: { mesaId: pedido.mesaId, estado: { in: ['Cocina', 'Servido'] } },
      });

      if (activos.length === 0) {
        const mObj = await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'Libre' },
        });
        if (mObj?.numero) {
          await prisma.mesa.updateMany({
            where: { estado: `Unida a Mesa ${mObj.numero}` },
            data: { estado: 'Libre' },
          });
        }
        mesaLiberada = true;
      } else {
        // Si hay al menos un pedido activo en Cocina, la mesa debe quedarse en Cocina.
        // Si todos los activos están en Servido, pasa a Servido (Azul).
        const hayEnCocina = activos.some(p => p.estado === 'Cocina');
        nuevoEstadoMesa = hayEnCocina ? 'Cocina' : 'Servido';

        await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: nuevoEstadoMesa },
        });
      }
    }

    // 🔔 Registrar alerta de cancelación para cocina (store en memoria)
    const itemsParaCocina = pedido.items.filter(i =>
      !BARRA_CATEGORIAS.includes(i.producto?.categoria || '')
    );
    if (itemsParaCocina.length > 0) {
      cancelacionesCocina.push({
        id: `cancel-${Date.now()}-${pedido.id}`,
        pedidoId: pedido.id,
        items: itemsParaCocina.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio: i.precio,
          notas: i.notas || null,
        })),
        mesaInfo: pedido.mesaId ? `Mesa ${pedido.mesa?.numero || pedido.mesaId}` : (pedido.codigoPedidosYa ? `🛵 ${pedido.codigoPedidosYa}` : 'Para Llevar/Delivery'),
        codigoPedidosYa: pedido.codigoPedidosYa || null,
        canceladoPor: canceladoPor || 'Administrador',
        canceladoEn: new Date().toISOString(),
      });
    }

    // 🔔 Registrar alerta de cancelación para barra (store en memoria)
    const itemsParaBarra = pedido.items.filter(i =>
      BARRA_CATEGORIAS.includes(i.producto?.categoria || '')
    );
    if (itemsParaBarra.length > 0) {
      cancelacionesBarra.push({
        id: `cancel-${Date.now()}-${pedido.id}`,
        pedidoId: pedido.id,
        items: itemsParaBarra.map(i => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio: i.precio,
          notas: i.notas || null,
        })),
        mesaInfo: pedido.mesaId ? `Mesa ${pedido.mesa?.numero || pedido.mesaId}` : (pedido.codigoPedidosYa ? `🛵 ${pedido.codigoPedidosYa}` : 'Para Llevar/Delivery'),
        codigoPedidosYa: pedido.codigoPedidosYa || null,
        canceladoPor: canceladoPor || 'Administrador',
        canceladoEn: new Date().toISOString(),
      });
    }

    res.json({ ok: true, mesaLiberada, nuevoEstadoMesa });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cocina/cancelaciones → Devuelve las alertas de cancelación pendientes de confirmación para Cocina
app.get('/api/cocina/cancelaciones', (req, res) => {
  res.json(cancelacionesCocina);
});

// DELETE /api/cocina/cancelaciones/:id → Cocina confirma que vio la alerta ("Entendido")
app.delete('/api/cocina/cancelaciones/:id', (req, res) => {
  const { id } = req.params;
  cancelacionesCocina = cancelacionesCocina.filter(c => c.id !== id);
  res.json({ ok: true });
});

// GET /api/barra/cancelaciones → Devuelve las alertas de cancelación pendientes de confirmación para Barra
app.get('/api/barra/cancelaciones', (req, res) => {
  res.json(cancelacionesBarra);
});

// DELETE /api/barra/cancelaciones/:id → Barra confirma que vio la alerta ("Entendido")
app.delete('/api/barra/cancelaciones/:id', (req, res) => {
  const { id } = req.params;
  cancelacionesBarra = cancelacionesBarra.filter(c => c.id !== id);
  res.json({ ok: true });
});

app.patch('/api/pedidos/:id/cancelar-item', async (req, res) => {
  const id = parseInt(req.params.id);
  const { productoId, cantidadACancelar, motivo, canceladoPor, force } = req.body;

  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        items: { include: { producto: true } },
        mesa: true,
      },
    });

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Si no es una cancelación forzada por supervisor, aplicar filtros normales
    if (!force) {
      if (pedido.estado !== 'Cocina') {
        return res.status(400).json({
          error: 'Este pedido ya no puede modificarse. Solo se cancelan ítems de pedidos en estado "Cocina".',
        });
      }
    }

    const item = force
      ? pedido.items.find(i => String(i.productoId) === String(productoId))
      : pedido.items.find(i => String(i.productoId) === String(productoId) && !i.historial);

    if (!item) return res.status(404).json({ error: 'El ítem seleccionado no se encuentra en la comanda activa.' });

    if (cantidadACancelar > item.cantidad) {
      return res.status(400).json({ error: 'La cantidad a cancelar supera la cantidad pedida.' });
    }

    // Calcular nueva cantidad
    const nuevaCantidad = item.cantidad - cantidadACancelar;

    // Restaurar stock
    if (item.producto.tipoStock === 'limitado') {
      await prisma.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: cantidadACancelar } },
      });
    }

    const esUltimoItem = pedido.items.length === 1 && cantidadACancelar === item.cantidad;

    // Declarar en el scope externo para que esté disponible en el res.json final
    let itemsRestantes = [];

    if (esUltimoItem) {
      // Treat as a complete cancelation of the comanda!
      await prisma.pedido.update({
        where: { id },
        data: {
          estado: 'Cancelado',
          canceladoPor: canceladoPor || 'Sin especificar',
          motivoCancela: motivo || 'Cancelación completa de ítems',
          canceladoEn: new Date(),
        },
      });
      // itemsRestantes queda [] — el pedido se canceló por completo
    } else {
      if (nuevaCantidad === 0) {
        // Eliminar el ítem del pedido
        await prisma.itemPedido.delete({ where: { id: item.id } });
      } else {
        // Actualizar cantidad
        await prisma.itemPedido.update({
          where: { id: item.id },
          data: { cantidad: nuevaCantidad },
        });
      }

      // Recalcular total del pedido
      itemsRestantes = await prisma.itemPedido.findMany({
        where: { pedidoId: id },
      });

      const nuevoTotal = itemsRestantes.reduce((sum, i) => sum + (i.cantidad * i.precio), 0);

      if (itemsRestantes.length === 0) {
        // Fallback: Si no quedan ítems, cancelamos todo el pedido
        await prisma.pedido.update({
          where: { id },
          data: {
            estado: 'Cancelado',
            canceladoPor: canceladoPor || 'Sin especificar',
            motivoCancela: motivo || 'Cancelación completa de ítems',
            canceladoEn: new Date(),
            total: 0,
          },
        });
      } else {
        // Actualizar total
        await prisma.pedido.update({
          where: { id },
          data: { total: nuevoTotal },
        });
      }
    }

    let mesaLiberada = false;
    let nuevoEstadoMesa = 'Libre';

    if (pedido.mesaId) {
      const activos = await prisma.pedido.findMany({
        where: { mesaId: pedido.mesaId, estado: { in: ['Cocina', 'Servido'] } },
      });

      if (activos.length === 0) {
        const mObj = await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'Libre' },
        });
        // Liberar automáticamente las mesas que estaban unidas a esta
        await prisma.mesa.updateMany({
          where: { estado: `Unida a Mesa ${mObj.numero}` },
          data: { estado: 'Libre' },
        });
        mesaLiberada = true;
      } else {
        const hayEnCocina = activos.some(p => p.estado === 'Cocina');
        nuevoEstadoMesa = hayEnCocina ? 'Cocina' : 'Servido';
        await prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: nuevoEstadoMesa },
        });
      }
    }

    res.json({ ok: true, mesaLiberada, nuevoEstadoMesa, pedidoVacio: itemsRestantes.length === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELIVERY / PEDIDOS YA
// ============================================================

app.post('/api/pedidos/llevar', async (req, res) => {
  const {
    codigoPedidosYa,
    cajero,
    items,
    total,
    tipoDelivery,
    tipoComprobante,
    metodoPago,
    numDocumento,
    nombreCliente,
    clienteDireccion,
    montoDelivery,
    telefono,
    montoEfectivo,
    montoTarjeta,
    montoYape,
    montoCredito,
    clienteCreditoId,
    descuentoPorcentaje,
    descuentoDescripcion
  } = req.body;

  try {
    const isTakeout = tipoDelivery === 'ParaLlevar';
    const isOwnDelivery = tipoDelivery === 'DeliveryPropio';

    const shippingFee = parseFloat(montoDelivery || 0);
    const finalMetodoPago = metodoPago || (tipoDelivery === 'PedidosYa' ? 'PedidosYa' : 'Efectivo');

    // Calcular monto bruto de items y aplicar descuento porcentual una sola vez
    const itemsBruto = (items || []).reduce((acc, item) => acc + (parseFloat(item.precio || 0) * parseInt(item.cant || item.cantidad || 1)), 0);
    const descPct = parseFloat(descuentoPorcentaje || 0);
    const descuentoMonto = (descPct > 0 && itemsBruto > 0) ? parseFloat((itemsBruto * (descPct / 100)).toFixed(2)) : 0;
    const totalConDescuento = Math.max(0, itemsBruto - descuentoMonto);
    let grandTotal = finalMetodoPago === 'Cortesía' ? 0.00 : (totalConDescuento + shippingFee);
    const descuentoFinal = finalMetodoPago === 'Cortesía' ? itemsBruto : descuentoMonto;

    const expandedItems = await expandPedidoItemsForDb(items);
    const finalEstadoEnsalada = await evaluarEstadoEnsalada(items);

    const pedido = await prisma.pedido.create({
      data: {
        mesaId: null,
        mesero: String(cajero),
        total: grandTotal,
        estado: 'Cocina', // Todos van a Cocina primero para que la cocina/barra los prepare
        estadoEnsalada: finalEstadoEnsalada,
        tipoEntrega: isOwnDelivery ? 'delivery' : 'llevar',
        codigoPedidosYa: codigoPedidosYa ? String(codigoPedidosYa) : null,
        items: {
          create: expandedItems.map(i => ({
            productoId: i.productoId,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
            historial: i.historial,
            entregado: i.entregado || false,
            notas: i.notas,
          })),
        },
      },
    });

    // Descontar stock limitado
    for (const item of items) {
      await prisma.producto.updateMany({
        where: { id: parseInt(item.id), tipoStock: 'limitado' },
        data: { stock: { decrement: parseInt(item.cant) } },
      });
    }

    // Registrar venta inmediatamente
    const subtotal = parseFloat((grandTotal / 1.105).toFixed(2));
    const igv = parseFloat((grandTotal - subtotal).toFixed(2));

    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    let finalMontoCredito = 0;

    if (finalMetodoPago === 'Mixto') {
      finalMontoEfectivo = parseFloat(montoEfectivo || 0);
      finalMontoTarjeta = parseFloat(montoTarjeta || 0);
      finalMontoYape = parseFloat(montoYape || 0);
      finalMontoCredito = parseFloat(montoCredito || 0);
    } else if (finalMetodoPago === 'Efectivo') {
      finalMontoEfectivo = grandTotal;
    } else if (finalMetodoPago === 'Tarjeta') {
      finalMontoTarjeta = grandTotal;
    } else if (finalMetodoPago === 'Yape') {
      finalMontoYape = grandTotal;
    } else if (finalMetodoPago === 'Crédito') {
      finalMontoCredito = grandTotal;
    }

    if (finalMontoCredito > 0 && !clienteCreditoId) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente para registrar la venta a crédito.' });
    }

    // Asignar nombres por defecto segun tipo
    let finalNombreCliente = nombreCliente;
    if (!finalNombreCliente) {
      if (tipoDelivery === 'PedidosYa') finalNombreCliente = 'PEDIDOS YA';
      else finalNombreCliente = 'CONSUMIDOR FINAL';
    }

    // Calcular correlativo para apisunat.pe si es Boleta o Factura
    const finalTipoComprobante = tipoComprobante || 'Ticket';
    const { serie, numero } = await obtenerSiguienteSerieYNumero(finalTipoComprobante);

    const initEstadoSunat = (finalTipoComprobante === 'Boleta' || finalTipoComprobante === 'Factura') ? 'PENDIENTE' : 'NO_APLICA';

    let venta = await prisma.venta.create({
      data: {
        pedidoId: pedido.id,
        tipoComprobante: finalTipoComprobante,
        nombreCliente: finalNombreCliente,
        numDocumento: numDocumento || codigoPedidosYa || 'S/D',
        clienteDireccion: clienteDireccion || '',
        total: grandTotal,
        igv,
        subtotal,
        metodoPago: finalMetodoPago,
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape,
        montoCredito: finalMontoCredito,
        clienteCreditoId: clienteCreditoId ? parseInt(clienteCreditoId) : null,
        estadoNubefact: initEstadoSunat,
        estadoSunat: initEstadoSunat,
        serie,
        numero,
        descuentoAplicado: descuentoFinal,
        ofertaDescripcion: descuentoFinal > 0 ? (descuentoDescripcion || `Descuento manual ${descPct}%`) : null,
      },
    });

    let apisunatResponse = null;

    // Si es Boleta o Factura, intentamos enviar a apisunat.pe
    if (finalTipoComprobante === 'Boleta' || finalTipoComprobante === 'Factura') {
      try {
        const mappedItems = items.map(i => ({
          productoId: parseInt(i.id),
          nombre: String(i.nombre),
          precio: parseFloat(i.precio),
          cantidad: parseInt(i.cant),
        }));

        // Agregar cargo por delivery al detalle de items si corresponde para que cuadre el total en SUNAT
        if (shippingFee > 0) {
          mappedItems.push({
            productoId: 9999, // ID ficticio para delivery
            nombre: "SERVICIO DE DELIVERY",
            precio: shippingFee,
            cantidad: 1,
          });
        }

        const response = await enviarAApisunat({ ...venta, clienteDireccion }, mappedItems);

        const mappedData = {
          serie: venta.serie,
          numero: venta.numero,
          key: response.payload?.hash || '',
          enlace_del_pdf: response.payload?.pdf?.ticket || response.payload?.pdf?.a4 || '',
          cadena_para_codigo_qr: `${process.env.RUC_EMPRESA || '10710311191'}|${venta.tipoComprobante === 'Factura' ? '01' : '03'}|${venta.serie}|${String(venta.numero).padStart(4, '0')}|${venta.igv.toFixed(2)}|${venta.total.toFixed(2)}|${new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(venta.createdAt))}|${venta.tipoComprobante === 'Factura' ? '6' : (venta.numDocumento?.length === 8 ? '1' : '0')}|${venta.numDocumento || '00000000'}|${response.payload?.hash || ''}`
        };

        const strAceptado = `ACEPTADO:${JSON.stringify(mappedData)}`;

        venta = await prisma.venta.update({
          where: { id: venta.id },
          data: {
            estadoNubefact: strAceptado,
            estadoSunat: 'ACEPTADO',
            urlPdf: mappedData.enlace_del_pdf,
            urlXml: response.payload?.xml || null,
          },
        });
        apisunatResponse = mappedData;
      } catch (apiErr) {
        console.error("Error al enviar a APISUNAT en pedido directo:", apiErr);
      }
    }

    res.json({
      ok: true,
      pedidoId: pedido.id,
      serie: venta.serie,
      numero: venta.numero,
      contingencia: false,
      estadoNubefact: venta.estadoNubefact,
      venta
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pedidos/llevar → Pedidos de delivery activos para CajaPage
app.get('/api/pedidos/llevar', async (req, res) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { tipoEntrega: { in: ['llevar', 'delivery'] }, estado: { in: ['Cocina', 'Servido'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        Venta: true
      },
    });

    const formateados = pedidos.map(p => ({
      pedidoId: p.id,
      codigoPedidosYa: p.codigoPedidosYa,
      cajero: p.mesero,
      estado: p.estado,
      total: p.total,
      hora: p.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      // Excluir items expandidos con precio 0 para evitar duplicidad al modificar en el frontend
      items: p.items.filter(i => i.precio > 0).map(i => ({
        id: String(i.productoId),
        nombre: i.nombre,
        cant: i.cantidad,
        precio: i.precio,
        notas: i.notas
      })),
      ventaData: p.Venta ? {
        id: p.Venta.id,
        tipoComprobante: p.Venta.tipoComprobante,
        nombreCliente: p.Venta.nombreCliente,
        numDocumento: p.Venta.numDocumento,
        metodoPago: p.Venta.metodoPago,
        montoEfectivo: p.Venta.montoEfectivo,
        montoTarjeta: p.Venta.montoTarjeta,
        montoYape: p.Venta.montoYape
      } : null
    }));

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pedidos/llevar/:id → Modificar un pedido de llevar/delivery activo
app.put('/api/pedidos/llevar/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    codigoPedidosYa,
    cajero,
    items,
    total,
    tipoDelivery,
    montoDelivery,
    telefono,
    nombreCliente,
    clienteDireccion,
    metodoPago,
    numDocumento,
    montoEfectivo,
    montoTarjeta,
    montoYape,
    montoCredito,
    clienteCreditoId,
    descuentoPorcentaje,
    descuentoDescripcion
  } = req.body;

  try {
    const isTakeout = tipoDelivery === 'ParaLlevar';
    const isOwnDelivery = tipoDelivery === 'DeliveryPropio';

    const shippingFee = parseFloat(montoDelivery || 0);
    const finalMetodoPago = metodoPago || (tipoDelivery === 'PedidosYa' ? 'PedidosYa' : 'Efectivo');

    // Calcular monto bruto de items y aplicar descuento porcentual una sola vez
    const itemsBruto = (items || []).reduce((acc, item) => acc + (parseFloat(item.precio || 0) * parseInt(item.cant || item.cantidad || 1)), 0);
    const descPct = parseFloat(descuentoPorcentaje || 0);
    const descuentoMonto = (descPct > 0 && itemsBruto > 0) ? parseFloat((itemsBruto * (descPct / 100)).toFixed(2)) : 0;
    const totalConDescuento = Math.max(0, itemsBruto - descuentoMonto);
    let grandTotal = finalMetodoPago === 'Cortesía' ? 0.00 : (totalConDescuento + shippingFee);
    const descuentoFinal = finalMetodoPago === 'Cortesía' ? itemsBruto : descuentoMonto;

    const expandedItems = await expandPedidoItemsForDb(items);
    const finalEstadoEnsalada = await evaluarEstadoEnsalada(items);

    // 1. Obtener pedido actual
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    if (pedido.estado !== 'Cocina' && pedido.estado !== 'Servido') {
      return res.status(400).json({ error: 'No se puede modificar un pedido que ya fue cobrado o cancelado.' });
    }

    // 2. Ejecutar actualización en una transacción
    await prisma.$transaction(async (tx) => {
      // Devolver stock de productos limitados antiguos para evitar pérdidas/errores
      const oldItems = pedido.items;
      for (const oldItem of oldItems) {
        if (oldItem.productoId) {
          await tx.producto.updateMany({
            where: { id: oldItem.productoId, tipoStock: 'limitado' },
            data: { stock: { increment: oldItem.cantidad } }
          });
        }
      }

      // Eliminar ítems antiguos
      await tx.itemPedido.deleteMany({
        where: { pedidoId: id }
      });

      // Crear nuevos ítems expandidos
      await tx.itemPedido.createMany({
        data: expandedItems.map(i => ({
          pedidoId: id,
          productoId: i.productoId,
          nombre: i.nombre,
          precio: i.precio,
          cantidad: i.cantidad,
          historial: i.historial,
          entregado: i.entregado || false,
          notas: i.notas,
        }))
      });

      // Descontar stock de productos limitados nuevos
      const itemsNuevos = items.filter(i => !i.historial);
      for (const item of itemsNuevos) {
        await tx.producto.updateMany({
          where: { id: parseInt(item.id), tipoStock: 'limitado' },
          data: { stock: { decrement: item.cant || item.cantidad } }
        });
      }

      // Actualizar pedido
      await tx.pedido.update({
        where: { id },
        data: {
          mesero: String(cajero),
          total: grandTotal,
          estado: 'Cocina', // Al modificarlo, debe volver a cocina para preparación/validación
          estadoEnsalada: finalEstadoEnsalada,
          tipoEntrega: isOwnDelivery ? 'delivery' : 'llevar',
          codigoPedidosYa: codigoPedidosYa ? String(codigoPedidosYa) : null
        }
      });

      // Calcular subtotal e IGV para actualizar la Venta asociada
      const subtotal = parseFloat((grandTotal / 1.105).toFixed(2));
      const igv = parseFloat((grandTotal - subtotal).toFixed(2));
      let finalMontoEfectivo = 0;
      let finalMontoTarjeta = 0;
      let finalMontoYape = 0;
      let finalMontoCredito = 0;

      if (finalMetodoPago === 'Mixto') {
        finalMontoEfectivo = parseFloat(montoEfectivo || 0);
        finalMontoTarjeta = parseFloat(montoTarjeta || 0);
        finalMontoYape = parseFloat(montoYape || 0);
        finalMontoCredito = parseFloat(montoCredito || 0);
      } else if (finalMetodoPago === 'Efectivo') {
        finalMontoEfectivo = grandTotal;
      } else if (finalMetodoPago === 'Tarjeta') {
        finalMontoTarjeta = grandTotal;
      } else if (finalMetodoPago === 'Yape') {
        finalMontoYape = grandTotal;
      } else if (finalMetodoPago === 'Crédito') {
        finalMontoCredito = grandTotal;
      }

      if (finalMontoCredito > 0 && !clienteCreditoId) {
        throw new Error('Debe seleccionar un cliente para registrar la venta a crédito.');
      }

      let finalNombreCliente = nombreCliente;
      if (!finalNombreCliente) {
        if (tipoDelivery === 'PedidosYa') finalNombreCliente = 'PEDIDOS YA';
        else finalNombreCliente = 'CONSUMIDOR FINAL';
      }

      await tx.venta.updateMany({
        where: { pedidoId: id },
        data: {
          nombreCliente: finalNombreCliente,
          numDocumento: numDocumento || codigoPedidosYa || 'S/D',
          total: grandTotal,
          subtotal,
          igv,
          metodoPago: finalMetodoPago,
          montoEfectivo: finalMontoEfectivo,
          montoTarjeta: finalMontoTarjeta,
          montoYape: finalMontoYape,
          montoCredito: finalMontoCredito,
          clienteCreditoId: clienteCreditoId ? parseInt(clienteCreditoId) : null,
          descuentoAplicado: descuentoFinal,
          ofertaDescripcion: descuentoFinal > 0 ? (descuentoDescripcion || `Descuento manual ${descPct}%`) : null
        }
      });
    });

    const venta = await prisma.venta.findFirst({
      where: { pedidoId: id }
    });

    res.json({ ok: true, venta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pedidos/:id/entregar → Caja confirma entrega del delivery
app.patch('/api/pedidos/:id/entregar', async (req, res) => {
  try {
    await prisma.pedido.update({
      where: { id: parseInt(req.params.id) },
      data: { estado: 'Cobrado' },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PRODUCTOS (CARTA)
// ============================================================

app.get('/api/productos', async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });

    // Obtener todas las ofertas activas (y que estén en su rango de fecha si se especificó)
    const ahora = new Date();
    const ofertasActivas = await prisma.oferta.findMany({
      where: {
        activa: true,
        OR: [
          { fechaInicio: null },
          { fechaInicio: { lte: ahora } }
        ],
        AND: [
          {
            OR: [
              { fechaFin: null },
              { fechaFin: { gte: ahora } }
            ]
          }
        ]
      }
    });

    // Enriquecer cada producto con precioOferta si hay oferta activa para su categoría
    const productosEnriquecidos = productos.map(p => {
      const oferta = ofertasActivas.find(o => o.categorias.includes(p.categoria));
      if (oferta) {
        let precioOferta;
        if (oferta.tipoDescuento === 'porcentaje') {
          precioOferta = parseFloat((p.precio * (1 - oferta.valorDescuento / 100)).toFixed(2));
        } else {
          precioOferta = parseFloat((p.precio - oferta.valorDescuento).toFixed(2));
        }
        return {
          ...p,
          precioOferta: Math.max(0, precioOferta),
          ofertaNombre: oferta.nombre,
          ofertaTipo: oferta.tipoDescuento,
          ofertaValor: oferta.valorDescuento,
        };
      }
      return { ...p, precioOferta: null, ofertaNombre: null };
    });

    res.json(productosEnriquecidos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/productos', async (req, res) => {
  try {
    const { nombre, categoria, precio, tipoStock, stock } = req.body;
    const categoriasGuarnicion = ['Pollos', 'Pollos a la Brasa', 'Parrillas y Cortes', 'Parrilladas Mixtas', 'Combos', 'Ensaladas'];
    const requiereGuarnicion = categoriasGuarnicion.includes(categoria);

    const prod = await prisma.producto.create({
      data: {
        nombre: String(nombre),
        categoria: String(categoria),
        precio: parseFloat(precio),
        tipoStock: tipoStock ? String(tipoStock) : 'ilimitado',
        stock: stock ? parseInt(stock) : 0,
        requiereGuarnicion: requiereGuarnicion,
      }
    });
    res.json(prod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/productos/:id', async (req, res) => {
  try {
    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.categoria !== undefined) {
      data.categoria = String(req.body.categoria);
      const categoriasGuarnicion = ['Pollos', 'Pollos a la Brasa', 'Parrillas y Cortes', 'Parrilladas Mixtas', 'Combos', 'Ensaladas'];
      data.requiereGuarnicion = categoriasGuarnicion.includes(data.categoria);
    }
    if (req.body.precio !== undefined) data.precio = parseFloat(req.body.precio);
    if (req.body.tipoStock !== undefined) data.tipoStock = String(req.body.tipoStock);
    if (req.body.stock !== undefined) data.stock = parseInt(req.body.stock);
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);

    const prod = await prisma.producto.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json(prod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/productos/:id', async (req, res) => {
  try {
    await prisma.producto.update({
      where: { id: parseInt(req.params.id) },
      data: { activo: false },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// OFERTAS POR TEMPORADA
// ============================================================

// GET /api/ofertas → Listar todas las ofertas
app.get('/api/ofertas', async (req, res) => {
  try {
    const ofertas = await prisma.oferta.findMany({ orderBy: { creadoEn: 'desc' } });
    res.json(ofertas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ofertas → Crear nueva oferta (solo Admin)
app.post('/api/ofertas', async (req, res) => {
  try {
    const { nombre, descripcion, tipoDescuento, valorDescuento, categorias, activa, fechaInicio, fechaFin, creadoPor } = req.body;
    if (!nombre || !tipoDescuento || valorDescuento == null || !categorias || !creadoPor) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, tipoDescuento, valorDescuento, categorias, creadoPor' });
    }
    const oferta = await prisma.oferta.create({
      data: {
        nombre: String(nombre),
        descripcion: descripcion ? String(descripcion) : null,
        tipoDescuento: String(tipoDescuento),
        valorDescuento: parseFloat(valorDescuento),
        categorias: Array.isArray(categorias) ? categorias.map(String) : [],
        activa: Boolean(activa),
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        creadoPor: String(creadoPor),
      }
    });
    res.json(oferta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ofertas/:id → Editar oferta
app.put('/api/ofertas/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.descripcion !== undefined) data.descripcion = req.body.descripcion ? String(req.body.descripcion) : null;
    if (req.body.tipoDescuento !== undefined) data.tipoDescuento = String(req.body.tipoDescuento);
    if (req.body.valorDescuento !== undefined) data.valorDescuento = parseFloat(req.body.valorDescuento);
    if (req.body.categorias !== undefined) data.categorias = Array.isArray(req.body.categorias) ? req.body.categorias.map(String) : [];
    if (req.body.fechaInicio !== undefined) data.fechaInicio = req.body.fechaInicio ? new Date(req.body.fechaInicio) : null;
    if (req.body.fechaFin !== undefined) data.fechaFin = req.body.fechaFin ? new Date(req.body.fechaFin) : null;
    const oferta = await prisma.oferta.update({ where: { id }, data });
    res.json(oferta);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ofertas/:id/activar → Activar o desactivar oferta
app.patch('/api/ofertas/:id/activar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { activa } = req.body;
    const oferta = await prisma.oferta.update({
      where: { id },
      data: { activa: Boolean(activa) }
    });
    res.json({ ok: true, activa: oferta.activa, nombre: oferta.nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ofertas/:id → Eliminar oferta
app.delete('/api/ofertas/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.oferta.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// USUARIOS
// ============================================================

app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({ where: { activo: true } });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/usuarios', async (req, res) => {
  try {
    // Validar PIN único
    const duplicate = await prisma.usuario.findFirst({
      where: { pin: String(req.body.pin), activo: true }
    });
    if (duplicate) {
      return res.status(400).json({ error: 'Este PIN ya está asignado a otro empleado. Elige uno diferente.' });
    }

    const { nombre, rol, pin, permisos } = req.body;
    const user = await prisma.usuario.create({
      data: {
        nombre: String(nombre),
        rol: String(rol),
        pin: String(pin),
        permisos: Array.isArray(permisos) ? permisos.map(String) : [],
      }
    });
    const { pin: userPin, ...seguro } = user;
    res.json(seguro);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
    const isInmutableOriginal = nombresInmutables.includes(target.nombre.toLowerCase().trim());

    if (req.body.pin) {
      const duplicate = await prisma.usuario.findFirst({
        where: { pin: String(req.body.pin), activo: true, id: { not: id } }
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Este PIN ya está asignado a otro empleado. Elige uno diferente.' });
      }
    }

    const data = {};
    if (req.body.nombre !== undefined) data.nombre = String(req.body.nombre);
    if (req.body.rol !== undefined) data.rol = String(req.body.rol);
    if (req.body.pin !== undefined) data.pin = String(req.body.pin);
    if (req.body.permisos !== undefined) data.permisos = Array.isArray(req.body.permisos) ? req.body.permisos.map(String) : [];
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);

    if (isInmutableOriginal) {
      if (req.body.rol !== undefined && req.body.rol !== 'Administrador') {
        return res.status(400).json({ error: '⚠️ No puedes cambiar el rol de este administrador principal.' });
      }
      if (req.body.nombre !== undefined && req.body.nombre.toLowerCase().trim() !== target.nombre.toLowerCase().trim()) {
        return res.status(400).json({ error: '⚠️ No puedes cambiar el nombre de este administrador principal.' });
      }
      if (req.body.activo !== undefined && !req.body.activo) {
        return res.status(400).json({ error: '⚠️ No puedes desactivar a este administrador principal.' });
      }
      // Forzar valores correctos para asegurar la inmutabilidad y permisos de administración completos
      data.rol = 'Administrador';
      data.activo = true;
      data.permisos = ['Dashboard', 'Salon', 'Cocina', 'Barra', 'Caja', 'Reportes', 'Usuarios', 'Ensaladas'];
    }

    const user = await prisma.usuario.update({
      where: { id },
      data
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/usuarios/login', async (req, res) => {
  const { pin } = req.body;
  try {
    const user = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });
    if (!user) {
      return res.status(401).json({ error: 'PIN incorrecto. Inténtalo de nuevo.' });
    }
    const { pin: userPin, ...safeUser } = user;
    safeUser.pinSignature = generarPinSignature(user.pin, user.id);
    res.json({ ok: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/usuarios/validate-auth', async (req, res) => {
  const { pin } = req.body;
  try {
    const user = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });
    if (!user) {
      return res.status(401).json({ error: 'PIN incorrecto.' });
    }
    // Solo Administrador o Cajero pueden autorizar cancelaciones/cortesías
    const rolesAutorizados = ['Administrador', 'Cajero'];
    if (!rolesAutorizados.includes(user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere PIN de Administrador o Cajero.' });
    }
    res.json({ ok: true, nombre: user.nombre, rol: user.rol });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/usuarios/check/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.json({ exists: false });
    const user = await prisma.usuario.findUnique({
      where: { id }
    });
    if (!user || !user.activo) {
      return res.json({ exists: false });
    }
    res.json({
      exists: true,
      activo: user.activo,
      id: user.id,
      nombre: user.nombre,
      rol: user.rol,
      permisos: user.permisos,
      pinSignature: generarPinSignature(user.pin, user.id)
    });
  } catch (err) {
    res.json({ exists: false, error: err.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nombresInmutables = ['admin principal', 'eusebio diaz', 'bruno diaz'];
    const isInmutable = nombresInmutables.includes(target.nombre.toLowerCase().trim());
    if (isInmutable) {
      return res.status(400).json({ error: '⚠️ Este usuario administrador es una cuenta principal del sistema y no puede ser eliminado.' });
    }

    const admins = await prisma.usuario.count({ where: { rol: 'Administrador', activo: true } });
    if (target.rol === 'Administrador' && admins <= 1) {
      return res.status(400).json({ error: '¡No puedes eliminar al único Administrador!' });
    }
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CAJA / VENTAS
// ============================================================

// PATCH /api/ventas/:ventaId/metodo-pago → Corregir método de pago (requiere PIN Administrador)
app.patch('/api/ventas/:ventaId/metodo-pago', async (req, res) => {
  const { ventaId } = req.params;
  const { metodoPago, pin, montoEfectivo, montoTarjeta, montoYape, montoCredito, clienteCreditoId } = req.body;

  const metodosPermitidos = ['Efectivo', 'Tarjeta', 'Yape', 'PedidosYa', 'Consumo', 'Cortesía', 'Mixto', 'Crédito'];
  if (!metodoPago || !metodosPermitidos.includes(metodoPago)) {
    return res.status(400).json({ error: `Método de pago inválido. Opciones: ${metodosPermitidos.join(', ')}` });
  }
  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    // Validar PIN
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede cambiar el método de pago.' });
    }

    // Obtener la venta con su pedido
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: { pedido: { include: { items: true } } }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    const pedido = venta.pedido;
    if (!pedido) return res.status(404).json({ error: 'Pedido asociado no encontrado.' });

    const metodoPagoAnterior = venta.metodoPago;

    // Calcular costo original del pedido
    const baseItemsTotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    let shippingFee = 0;
    if (pedido.tipoEntrega === 'delivery' && pedido.codigoPedidosYa?.startsWith('DELIVERY -')) {
      const matchEnvio = pedido.codigoPedidosYa.match(/\[E:(\d+\.?\d*)\]/);
      if (matchEnvio && matchEnvio[1]) {
        shippingFee = parseFloat(matchEnvio[1]);
      }
    }
    const originalTotal = baseItemsTotal + shippingFee;

    // Si el nuevo método es Cortesía, el total va a 0.00
    const nuevoTotal = metodoPago === 'Cortesía' ? 0.00 : originalTotal;
    const subtotal = parseFloat((nuevoTotal / 1.105).toFixed(2));
    const igv = parseFloat((nuevoTotal - subtotal).toFixed(2));

    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    let finalMontoCredito = 0;

    if (metodoPago === 'Mixto') {
      finalMontoEfectivo = parseFloat(montoEfectivo || 0);
      finalMontoTarjeta = parseFloat(montoTarjeta || 0);
      finalMontoYape = parseFloat(montoYape || 0);
      finalMontoCredito = parseFloat(montoCredito || 0);
    } else if (metodoPago === 'Efectivo') {
      finalMontoEfectivo = nuevoTotal;
    } else if (metodoPago === 'Tarjeta') {
      finalMontoTarjeta = nuevoTotal;
    } else if (metodoPago === 'Yape') {
      finalMontoYape = nuevoTotal;
    } else if (metodoPago === 'Crédito') {
      finalMontoCredito = nuevoTotal;
    }

    if (finalMontoCredito > 0 && !clienteCreditoId) {
      return res.status(400).json({ error: 'Debe seleccionar un cliente para registrar la venta a crédito.' });
    }

    // Actualizar Venta
    const ventaActualizada = await prisma.venta.update({
      where: { id: parseInt(ventaId) },
      data: {
        metodoPago,
        total: nuevoTotal,
        subtotal,
        igv,
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape,
        montoCredito: finalMontoCredito,
        clienteCreditoId: clienteCreditoId ? parseInt(clienteCreditoId) : null
      },
    });

    // Actualizar Pedido
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        total: nuevoTotal
      }
    });

    console.log(`🔄 Método de pago corregido por ${admin.nombre} (${admin.rol}): Venta #${ventaId} → ${metodoPagoAnterior} (S/ ${venta.total.toFixed(2)}) → ${metodoPago} (S/ ${nuevoTotal.toFixed(2)})`);

    res.json({ ok: true, ventaId: ventaActualizada.id, metodoPago: ventaActualizada.metodoPago, cambiadoPor: admin.nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ventas/:ventaId/tipo-entrega → Corregir tipo de entrega (PedidosYa, Para Llevar, Delivery)
app.patch('/api/ventas/:ventaId/tipo-entrega', async (req, res) => {
  const { ventaId } = req.params;
  const {
    tipoEntrega, // "ParaLlevar", "DeliveryPropio", "PedidosYa"
    codigoPedidosYa,
    nombreCliente,
    telefono,
    direccion,
    montoDelivery,
    montoConCuanto,
    metodoPago, // 'Efectivo' | 'Tarjeta' | 'Yape'
    pin
  } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    // Validar PIN
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede cambiar el tipo de entrega.' });
    }

    // Obtener la venta con su pedido
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: { pedido: { include: { items: true } } }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    const pedido = venta.pedido;
    if (!pedido) return res.status(404).json({ error: 'Pedido asociado no encontrado.' });

    // Calcular el costo base de los ítems del pedido
    const baseItemsTotal = pedido.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    let nuevoTotal = baseItemsTotal;
    let finalCodigo = '';
    let finalNombre = nombreCliente || 'CONSUMIDOR FINAL';
    let finalMetodoPago = metodoPago || 'Efectivo';
    let nuevoTipoEntrega = 'llevar';

    if (tipoEntrega === 'PedidosYa') {
      nuevoTipoEntrega = 'llevar';
      finalCodigo = codigoPedidosYa ? String(codigoPedidosYa) : 'S/D';
      finalNombre = 'PEDIDOS YA';
      finalMetodoPago = 'PedidosYa';
    } else if (tipoEntrega === 'ParaLlevar') {
      nuevoTipoEntrega = 'llevar';
      finalCodigo = `LLEVAR - ${finalNombre.toUpperCase()}`;
    } else if (tipoEntrega === 'DeliveryPropio') {
      nuevoTipoEntrega = 'delivery';
      const shippingFee = parseFloat(montoDelivery || 0);
      nuevoTotal = baseItemsTotal + shippingFee;

      const tVal = telefono || 'S/D';
      const dVal = direccion || 'S/D';
      const eVal = shippingFee.toFixed(2);
      const cVal = parseFloat(montoConCuanto || 0).toFixed(2);

      finalCodigo = `DELIVERY - ${finalNombre.toUpperCase()} [T:${tVal}] [D:${dVal}] [E:${eVal}] [C:${cVal}]`;
      finalNombre = `DELIVERY - ${finalNombre.toUpperCase()} [T:${tVal}] [D:${dVal}] [E:${eVal}] [C:${cVal}]`;
    } else {
      return res.status(400).json({ error: 'Tipo de entrega inválido.' });
    }

    const subtotal = parseFloat((nuevoTotal / 1.105).toFixed(2));
    const igv = parseFloat((nuevoTotal - subtotal).toFixed(2));

    // Actualizar Pedido
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        total: nuevoTotal,
        tipoEntrega: nuevoTipoEntrega,
        codigoPedidosYa: finalCodigo,
      }
    });

    // Actualizar Venta
    const ventaActualizada = await prisma.venta.update({
      where: { id: venta.id },
      data: {
        total: nuevoTotal,
        subtotal,
        igv,
        metodoPago: finalMetodoPago,
        nombreCliente: finalNombre,
        numDocumento: tipoEntrega === 'PedidosYa' ? finalCodigo : (venta.numDocumento || 'S/D'),
      }
    });

    console.log(`🔄 Tipo de entrega corregido por ${admin.nombre} (${admin.rol}): Venta #${ventaId} a ${tipoEntrega}`);

    res.json({ ok: true, ventaId: ventaActualizada.id, cambiadoPor: admin.nombre });
  } catch (err) {
    console.error('Error al cambiar tipo de entrega:', err);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

// PATCH /api/ventas/:ventaId/datos-cliente → Corregir datos de facturación / datos de cliente de una venta
app.patch('/api/ventas/:ventaId/datos-cliente', async (req, res) => {
  const { ventaId } = req.params;
  const {
    tipoComprobante, // "Boleta" | "Factura" | "Ticket"
    numDocumento,
    nombreCliente,
    clienteDireccion,
    pin
  } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    // Validar PIN
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede cambiar los datos del cliente.' });
    }

    // Obtener la venta
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    // Validar si ya fue emitida como Boleta o Factura
    if (venta.tipoComprobante === 'Boleta' || venta.tipoComprobante === 'Factura') {
      return res.status(400).json({ error: 'No se pueden corregir datos de una Boleta o Factura ya emitida. Solo se permite actualizar comprobantes de tipo Ticket.' });
    }

    // Actualizar datos
    const ventaActualizada = await prisma.$transaction(async (tx) => {
      let newSerie = venta.serie;
      let newNumero = venta.numero;
      let newEstado = venta.estadoSunat;
      let newEstadoNube = venta.estadoNubefact;

      if (tipoComprobante !== venta.tipoComprobante) {
        if (tipoComprobante === 'Boleta' || tipoComprobante === 'Factura') {
          // Obtener la siguiente serie y correlativo dentro de la transacción
          const isFactura = tipoComprobante === 'Factura';
          const serieDefault = isFactura ? (process.env.SERIE_FACTURA || 'F001') : (process.env.SERIE_BOLETA || 'B001');
          const minCorrelativo = isFactura ? 2 : 0; // Factura inicia en F001-0003, Boleta en B001-0001

          const ultimaVenta = await tx.venta.findFirst({
            where: { tipoComprobante, serie: serieDefault, numero: { not: null } },
            orderBy: { numero: 'desc' }
          });

          const siguienteNumero = ultimaVenta
            ? Math.max(ultimaVenta.numero + 1, minCorrelativo + 1)
            : (minCorrelativo + 1);

          newSerie = serieDefault;
          newNumero = siguienteNumero;
          newEstado = 'PENDIENTE';
          newEstadoNube = 'PENDIENTE';
        } else {
          newSerie = null;
          newNumero = null;
          newEstado = 'NO_APLICA';
          newEstadoNube = 'NO_APLICA';
        }
      }

      return await tx.venta.update({
        where: { id: venta.id },
        data: {
          tipoComprobante,
          numDocumento: numDocumento || null,
          nombreCliente: nombreCliente || null,
          clienteDireccion: clienteDireccion || null,
          serie: newSerie,
          numero: newNumero,
          estadoSunat: newEstado,
          estadoNubefact: newEstadoNube
        }
      });
    });

    console.log(`🔄 Datos de cliente corregidos por ${admin.nombre} (${admin.rol}): Venta #${ventaId}`);

    res.json({ ok: true, venta: ventaActualizada, cambiadoPor: admin.nombre });
  } catch (err) {
    console.error('Error al cambiar datos de cliente:', err);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

// PATCH /api/ventas/:ventaId/anular → Anular / Registrar devolución de un pedido entregado
app.patch('/api/ventas/:ventaId/anular', async (req, res) => {
  const { ventaId } = req.params;
  const { pin, motivo } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN de Administrador.' });
  }

  try {
    const admin = await prisma.usuario.findFirst({ where: { pin, activo: true } });
    if (!admin) return res.status(401).json({ error: 'PIN incorrecto.' });
    if (admin.rol !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede anular o registrar devolución de ventas.' });
    }

    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(ventaId) },
      include: { pedido: true }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    if (venta.anulado || venta.pedido?.estado === 'Cancelado') {
      return res.status(400).json({ error: 'Esta venta ya se encuentra anulada / devuelta.' });
    }

    const motivoFinal = motivo ? String(motivo).trim() : 'Devolución de pedido por cliente';
    const now = new Date();

    const ventaAnulada = await prisma.$transaction(async (tx) => {
      const vUpdated = await tx.venta.update({
        where: { id: venta.id },
        data: {
          anulado: true,
          motivoAnulacion: motivoFinal,
          anuladoPor: admin.nombre,
          anuladoEn: now,
          montoOriginal: venta.montoOriginal || venta.total,
          total: 0.00,
          subtotal: 0.00,
          igv: 0.00,
          montoEfectivo: 0.00,
          montoTarjeta: 0.00,
          montoYape: 0.00,
          montoCredito: 0.00,
          descuentoAplicado: 0.00
        }
      });

      if (venta.pedidoId) {
        await tx.pedido.update({
          where: { id: venta.pedidoId },
          data: {
            estado: 'Cancelado',
            motivoCancela: `[DEVOLUCIÓN CAJA]: ${motivoFinal}`,
            canceladoPor: admin.nombre,
            canceladoEn: now
          }
        });
      }

      return vUpdated;
    });

    console.log(`🚫 Venta #${ventaId} anulada/devuelta por ${admin.nombre}. Motivo: ${motivoFinal}`);

    res.json({
      ok: true,
      venta: ventaAnulada,
      anuladoPor: admin.nombre,
      mensaje: 'Venta anulada y devuelta a S/ 0.00 con éxito.'
    });
  } catch (err) {
    console.error('Error al anular venta:', err);
    res.status(500).json({ error: 'Error al anular venta: ' + err.message });
  }
});

// POST /api/ventas → Cobrar mesa (acepta pedidoIds array o pedidoId simple)
app.post('/api/ventas', async (req, res) => {
  const {
    pedidoId,
    pedidoIds,
    tipoComprobante,
    numDocumento,
    nombreCliente,
    total,
    metodoPago,
    clienteDireccion,
    ofertaDescripcion,
    descuentoAplicado,
    montoEfectivo,
    montoTarjeta,
    montoYape,
    montoCredito,
    clienteCreditoId,
    creditosDetalle,
    cortesiaItemIds
  } = req.body;
  const idsAPagar = pedidoIds || [pedidoId];
  const idPrincipal = idsAPagar[idsAPagar.length - 1]; // El más reciente como venta principal

  try {
    // 1. Validar si ya existe una venta asociada a estos pedidos (evita error de doble cobro por concurrencia)
    const ventaExistente = await prisma.venta.findFirst({
      where: { pedidoId: { in: idsAPagar } },
    });
    if (ventaExistente) {
      return res.json({
        ok: true,
        ventaId: ventaExistente.id,
        estadoNubefact: ventaExistente.estadoSunat,
        serie: ventaExistente.serie,
        numero: ventaExistente.numero,
        yaCobrado: true
      });
    }

    const venta = await prisma.$transaction(async (tx) => {
      // Mover todos los items de los otros pedidos adicionales al pedido principal para que se consoliden en el detalle de la venta
      if (idsAPagar.length > 1) {
        const otrosIds = idsAPagar.filter(id => id !== idPrincipal);
        await tx.itemPedido.updateMany({
          where: { pedidoId: { in: otrosIds } },
          data: { pedidoId: idPrincipal },
        });
      }

      // Procesar cortesías individuales por ítem
      let itemsCortesiaDescuento = 0;
      if (cortesiaItemIds && Array.isArray(cortesiaItemIds) && cortesiaItemIds.length > 0) {
        const itemIds = cortesiaItemIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        const itemsAActualizar = await tx.itemPedido.findMany({
          where: { id: { in: itemIds } }
        });

        for (const item of itemsAActualizar) {
          itemsCortesiaDescuento += item.precio * item.cantidad;
          let nuevaNota = item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]';
          await tx.itemPedido.update({
            where: { id: item.id },
            data: {
              precio: 0.00,
              notas: nuevaNota
            }
          });
        }
      }

      // Recalcular el total consolidado del pedido principal en la DB
      const todosLosItemsPrincipal = await tx.itemPedido.findMany({
        where: { pedidoId: idPrincipal }
      });
      const nuevoTotalPedido = todosLosItemsPrincipal.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

      await tx.pedido.update({
        where: { id: idPrincipal },
        data: { total: nuevoTotalPedido }
      });

      const finalTotal = metodoPago === 'Cortesía' ? 0.00 : nuevoTotalPedido;
      const subtotal = parseFloat((finalTotal / 1.105).toFixed(2));
      const igv = parseFloat((finalTotal - subtotal).toFixed(2));

      let finalMontoEfectivo = 0;
      let finalMontoTarjeta = 0;
      let finalMontoYape = 0;
      let finalMontoCredito = 0;
      let finalClienteCreditoId = clienteCreditoId ? parseInt(clienteCreditoId) : null;
      let validCreditosSplits = [];

      if ((metodoPago === 'Crédito' || metodoPago === 'Mixto') && creditosDetalle && Array.isArray(creditosDetalle) && creditosDetalle.length > 0) {
        validCreditosSplits = creditosDetalle
          .map(c => ({
            clienteId: parseInt(c.clienteId || c.id),
            nombre: String(c.nombre || '').trim(),
            monto: parseFloat(c.monto || 0)
          }))
          .filter(c => !isNaN(c.clienteId) && c.clienteId > 0 && c.monto > 0);
      }

      if (metodoPago === 'Mixto') {
        finalMontoEfectivo = parseFloat(montoEfectivo || 0);
        finalMontoTarjeta = parseFloat(montoTarjeta || 0);
        finalMontoYape = parseFloat(montoYape || 0);
        if (validCreditosSplits.length > 0) {
          finalMontoCredito = validCreditosSplits.reduce((s, c) => s + c.monto, 0);
          finalClienteCreditoId = validCreditosSplits[0].clienteId;
        } else {
          finalMontoCredito = parseFloat(montoCredito || 0);
          finalClienteCreditoId = finalMontoCredito > 0 ? (clienteCreditoId ? parseInt(clienteCreditoId) : null) : null;
        }
      } else if (metodoPago === 'Efectivo') {
        finalMontoEfectivo = finalTotal;
        finalMontoTarjeta = 0;
        finalMontoYape = 0;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      } else if (metodoPago === 'Tarjeta') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = finalTotal;
        finalMontoYape = 0;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      } else if (metodoPago === 'Yape') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = 0;
        finalMontoYape = finalTotal;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      } else if (metodoPago === 'Crédito') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = 0;
        finalMontoYape = 0;
        if (validCreditosSplits.length > 0) {
          finalMontoCredito = validCreditosSplits.reduce((s, c) => s + c.monto, 0);
          finalClienteCreditoId = validCreditosSplits[0].clienteId;
        } else {
          finalMontoCredito = finalTotal;
          finalClienteCreditoId = clienteCreditoId ? parseInt(clienteCreditoId) : null;
        }
      } else if (metodoPago === 'Cortesía' || metodoPago === 'Consumo') {
        finalMontoEfectivo = 0;
        finalMontoTarjeta = 0;
        finalMontoYape = 0;
        finalMontoCredito = 0;
        finalClienteCreditoId = null;
        validCreditosSplits = [];
      }

      if (finalMontoCredito > 0 && !finalClienteCreditoId) {
        throw new Error('Debe seleccionar al menos un cliente para registrar la venta a crédito.');
      }

      // Calcular correlativo para apisunat.pe si es Boleta o Factura
      const { serie, numero } = await obtenerSiguienteSerieYNumero(tipoComprobante, tx);

      // Crear Venta principal (inicialmente PENDIENTE si es factura/boleta)
      const initEstadoSunat = (tipoComprobante === 'Boleta' || tipoComprobante === 'Factura') ? 'PENDIENTE' : 'NO_APLICA';

      let descAplicado = descuentoAplicado ? parseFloat(descuentoAplicado) : 0;
      let descDescrip = ofertaDescripcion ? String(ofertaDescripcion) : null;
      if (metodoPago === 'Cortesía' || metodoPago === 'Consumo') {
        descAplicado = nuevoTotalPedido;
        descDescrip = metodoPago === 'Cortesía' ? 'Cortesía total del pedido' : 'Consumo de personal';
      } else if (itemsCortesiaDescuento > 0) {
        descAplicado += itemsCortesiaDescuento;
        descDescrip = descDescrip ? `${descDescrip} + Cortesía de ítems` : 'Cortesía de ítems';
      }

      // Si hay splits múltiples de crédito, anexar la etiqueta a ofertaDescripcion solo si aplica
      if ((metodoPago === 'Crédito' || (metodoPago === 'Mixto' && finalMontoCredito > 0)) && validCreditosSplits.length > 0) {
        const splitTag = `[CREDITO_SPLIT:${JSON.stringify(validCreditosSplits)}]`;
        descDescrip = descDescrip ? `${descDescrip} ${splitTag}` : splitTag;
      }

      const ventaCreada = await tx.venta.create({
        data: {
          pedidoId: idPrincipal,
          tipoComprobante,
          numDocumento,
          nombreCliente: (metodoPago === 'Cortesía' || metodoPago === 'Consumo') 
            ? (nombreCliente || 'CONSUMO PERSONAL / CORTESÍA') 
            : ((!nombreCliente || nombreCliente === 'PÚBLICO GENERAL') && validCreditosSplits.length > 0)
              ? validCreditosSplits.map(c => c.nombre).filter(Boolean).join(', ') || 'PÚBLICO GENERAL'
              : (nombreCliente || 'PÚBLICO GENERAL'),
          clienteDireccion: clienteDireccion || '',
          total: finalTotal,
          igv,
          subtotal,
          metodoPago,
          montoEfectivo: finalMontoEfectivo,
          montoTarjeta: finalMontoTarjeta,
          montoYape: finalMontoYape,
          montoCredito: finalMontoCredito,
          clienteCreditoId: finalClienteCreditoId,
          estadoNubefact: initEstadoSunat,
          estadoSunat: initEstadoSunat,
          serie,
          numero,
          ofertaDescripcion: descDescrip,
          descuentoAplicado: descAplicado,
        },
      });

      // Marcar TODOS los pedidos de la mesa como Cobrado
      await tx.pedido.updateMany({
        where: { id: { in: idsAPagar } },
        data: { estado: 'Cobrado' },
      });

      // Liberar la mesa
      const pedidoPrincipal = await tx.pedido.findUnique({ where: { id: idsAPagar[0] } });
      if (pedidoPrincipal?.mesaId) {
        const mObj = await tx.mesa.update({
          where: { id: pedidoPrincipal.mesaId },
          data: { estado: 'Libre' },
        });
        // Liberar automáticamente las mesas que estaban unidas a esta
        await tx.mesa.updateMany({
          where: { estado: `Unida a Mesa ${mObj.numero}` },
          data: { estado: 'Libre' },
        });
      }

      return ventaCreada;
    });

    // Si es Boleta o Factura, intentamos enviar a apisunat.pe
    if (tipoComprobante === 'Boleta' || tipoComprobante === 'Factura') {
      try {
        const pedidoConItems = await prisma.pedido.findUnique({
          where: { id: idPrincipal },
          include: { items: true }
        });

        // Llamar a apisunat.pe
        const response = await enviarAApisunat({ ...venta, clienteDireccion }, pedidoConItems.items);

        // Mapear respuesta para compatibilidad con el front
        const mappedData = {
          serie: venta.serie,
          numero: venta.numero,
          key: response.payload?.hash || '',
          enlace_del_pdf: response.payload?.pdf?.ticket || response.payload?.pdf?.a4 || '',
          cadena_para_codigo_qr: `${process.env.RUC_EMPRESA || '10710311191'}|${venta.tipoComprobante === 'Factura' ? '01' : '03'}|${venta.serie}|${String(venta.numero).padStart(4, '0')}|${venta.igv.toFixed(2)}|${venta.total.toFixed(2)}|${new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(venta.createdAt))}|${venta.tipoComprobante === 'Factura' ? '6' : (venta.numDocumento?.length === 8 ? '1' : '0')}|${venta.numDocumento || '00000000'}|${response.payload?.hash || ''}`
        };

        const strAceptado = `ACEPTADO:${JSON.stringify(mappedData)}`;

        // Si tiene éxito, actualizamos a ACEPTADO y guardamos la respuesta
        const ventaActualizada = await prisma.venta.update({
          where: { id: venta.id },
          data: {
            estadoNubefact: strAceptado,
            estadoSunat: strAceptado,
            urlPdf: mappedData.enlace_del_pdf,
            urlXml: response.payload?.xml || null
          }
        });

        return res.json({
          ok: true,
          ventaId: venta.id,
          estadoNubefact: ventaActualizada.estadoSunat,
          serie: venta.serie,
          numero: venta.numero
        });
      } catch (sunatErr) {
        console.error("⚠️ Error al facturar con apisunat.pe. Entrando en modo contingencia (Offline-First):", sunatErr.message);

        // Guardar estado de contingencia
        const ventaActualizada = await prisma.venta.update({
          where: { id: venta.id },
          data: {
            estadoNubefact: 'PENDIENTE_REINTENTO',
            estadoSunat: 'PENDIENTE_REINTENTO'
          }
        });

        // Retornamos éxito al POS para liberar la mesa sin trabas e indicando contingencia
        return res.json({
          ok: true,
          ventaId: venta.id,
          estadoNubefact: ventaActualizada.estadoSunat,
          serie: venta.serie,
          numero: venta.numero,
          contingencia: true,
          mensaje: "Comprobante emitido en contingencia. El envío a la SUNAT se completará automáticamente en segundo plano."
        });
      }
    }

    res.json({ ok: true, ventaId: venta.id, estadoNubefact: venta.estadoSunat, serie: venta.serie || null, numero: venta.numero || null });
  } catch (err) {
    console.error('Error al procesar cobro:', err);
    if (err.code === 'P2002' || (err.message && err.message.includes('pedidoId'))) {
      const ventaExistente = await prisma.venta.findFirst({
        where: { pedidoId: { in: idsAPagar } },
      });
      if (ventaExistente) {
        return res.json({
          ok: true,
          ventaId: ventaExistente.id,
          estadoNubefact: ventaExistente.estadoSunat,
          serie: ventaExistente.serie,
          numero: ventaExistente.numero,
          yaCobrado: true
        });
      }
    }
    res.status(500).json({ error: err.message });
  }
});


// GET /api/ventas → Historial detallado de las ventas del día o rango de fechas (hora Perú)
app.get('/api/ventas', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const ayerPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      ayerPeru.setDate(ayerPeru.getDate() - 1);
      ayerPeru.setHours(3, 0, 0, 0);
      const inicioUTC = new Date(ayerPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const ventas = await prisma.venta.findMany({
      where: {
        createdAt: filtroFecha
      },
      include: {
        pedido: {
          include: {
            items: true,
            mesa: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formateadas = ventas.map(v => ({
      id: v.id,
      pedidoId: v.pedidoId,
      tipoComprobante: v.tipoComprobante,
      numDocumento: v.numDocumento,
      nombreCliente: v.nombreCliente,
      clienteDireccion: v.clienteDireccion || '',
      total: v.total,
      igv: v.igv,
      subtotal: v.subtotal,
      metodoPago: v.metodoPago,
      montoEfectivo: v.montoEfectivo,
      montoTarjeta: v.montoTarjeta,
      montoYape: v.montoYape,
      montoCredito: v.montoCredito || 0,
      clienteCreditoId: v.clienteCreditoId || null,
      ofertaDescripcion: v.ofertaDescripcion || null,
      descuentoAplicado: v.descuentoAplicado || 0,
      creditoSplit: parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, v.montoCredito || (v.metodoPago === 'Crédito' ? v.total : 0)),
      anulado: v.anulado || v.pedido?.estado === 'Cancelado',
      motivoAnulacion: v.motivoAnulacion || v.pedido?.motivoCancela || null,
      anuladoPor: v.anuladoPor || v.pedido?.canceladoPor || null,
      anuladoEn: v.anuladoEn || v.pedido?.canceladoEn || null,
      montoOriginal: v.montoOriginal || null,
      hora: v.createdAt.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      mesaNum: v.pedido?.mesa?.numero || null,
      mesero: v.pedido?.mesero || null,
      codigoPedidosYa: v.pedido?.codigoPedidosYa || null,
      tipoEntrega: v.pedido?.tipoEntrega || 'salon',
      estadoPedido: v.pedido?.estado || null,
      createdAt: v.createdAt.toISOString(),
      estadoNubefact: v.estadoNubefact,
      serie: v.serie,
      numero: v.numero,
      itemsResumen: v.pedido?.items
        ?.filter(i => i.precio > 0 || BARRA_CATEGORIAS.includes(i.producto?.categoria) || i.notas?.includes('CORTESÍA') || i.nombre?.includes('CORTESÍA'))
        ?.map(i => `${i.cantidad}x ${i.nombre}`).join(', ') || '',

      items: v.pedido?.items
        ?.filter(i => i.precio > 0 || BARRA_CATEGORIAS.includes(i.producto?.categoria) || i.notas?.includes('CORTESÍA') || i.nombre?.includes('CORTESÍA'))
        ?.map(i => ({
          nombre: i.nombre,
          cant: i.cantidad,
          precio: i.precio
        })) || [],
    }));

    res.json(formateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ventas/resumen → Estadísticas del día (hora Perú)
app.get('/api/ventas/resumen', async (req, res) => {
  try {
    const { desde } = req.query;
    let filterDate;
    if (desde) {
      filterDate = new Date(desde);
    } else {
      // Inicio del día operativo a las 3:00 AM en UTC-5
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      if (hoyPeru.getHours() < 3) {
        hoyPeru.setDate(hoyPeru.getDate() - 1);
      }
      hoyPeru.setHours(3, 0, 0, 0);
      filterDate = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
    }

    const [ventas, abonos, clientes] = await Promise.all([
      prisma.venta.findMany({
        where: {
          createdAt: { gte: filterDate },
          pedido: { estado: { not: 'Cancelado' } }
        },
      }),
      prisma.abonoCredito.findMany({
        where: {
          creadoEn: { gte: filterDate }
        }
      }),
      prisma.cliente.findMany()
    ]);

    const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
    const totalIGVVentas = ventas.reduce((s, v) => s + v.igv, 0);
    const atendidas = ventas.length;

    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalYape = 0;

    ventas.forEach(v => {
      const { efec, tarj, yape } = obtenerMontosVenta(v);
      totalEfectivo += efec;
      totalTarjeta += tarj;
      totalYape += yape;
    });

    // Sumar abonos a la caja física
    abonos.forEach(a => {
      totalEfectivo += a.montoEfectivo || 0;
      totalTarjeta += a.montoTarjeta || 0;
      totalYape += a.montoYape || 0;
    });

    const ingresosCaja = totalEfectivo + totalTarjeta + totalYape;
    const ingresosPedidosYa = ventas
      .filter(v => v.metodoPago === 'PedidosYa')
      .reduce((s, v) => s + v.total, 0);

    const clienteMap = new Map(clientes.map(c => [c.id, c.esTrabajador]));
    let consumoClientes = 0;
    let consumoPlanilla = 0;

    ventas.forEach(v => {
      if (v.metodoPago === 'Consumo') {
        consumoPlanilla += (v.descuentoAplicado || v.total);
      } else {
        const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
        if (splits.length > 0) {
          splits.forEach(s => {
            const esTrab = clienteMap.get(s.clienteId) || false;
            if (esTrab) {
              consumoPlanilla += s.monto;
            } else {
              consumoClientes += s.monto;
            }
          });
        } else if (v.metodoPago === 'Crédito') {
          consumoClientes += v.total;
        } else if (parseFloat(v.montoCredito || 0) > 0) {
          consumoClientes += parseFloat(v.montoCredito);
        }
      }
    });

    const totalCortesias = ventas
      .filter(v => v.metodoPago === 'Cortesía')
      .reduce((s, v) => s + (v.descuentoAplicado || v.total), 0);

    const porMetodoPago = {
      Efectivo: totalEfectivo,
      Tarjeta: totalTarjeta,
      Yape: totalYape,
      PedidosYa: ingresosPedidosYa,
      ConsumoPlanilla: consumoPlanilla,
      ConsumoClientes: consumoClientes,
      Cortesía: totalCortesias,
    };

    res.json({
      atendidas,
      ingresos: totalVentas,
      ingresosCaja,
      ingresosPedidosYa,
      consumoPlanilla,
      consumoClientes,
      totalCortesias,
      porMetodoPago,
      igvVentas: totalIGVVentas,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// COMPRAS (RCE)
// ============================================================

app.get('/api/compras', async (req, res) => {
  const { desde, hasta, categoria, metodoPago, busqueda } = req.query;
  try {
    let whereClause = {};

    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      whereClause.creadoEn = {
        gte: new Date(desde + 'T00:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else if (desde) {
      whereClause.creadoEn = {
        gte: new Date(desde + 'T00:00:00.000-05:00')
      };
    } else {
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      whereClause.creadoEn = { gte: inicioMes };
    }

    if (categoria && categoria !== 'Todas') {
      whereClause.categoria = categoria;
    }

    if (metodoPago && metodoPago !== 'Todos') {
      whereClause.metodoPago = metodoPago;
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim();
      whereClause.OR = [
        { proveedor: { contains: q, mode: 'insensitive' } },
        { ruc: { contains: q, mode: 'insensitive' } },
        { serieNumero: { contains: q, mode: 'insensitive' } },
      ];
    }

    const compras = await prisma.compra.findMany({
      where: whereClause,
      orderBy: { creadoEn: 'desc' },
    });
    res.json(compras);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/compras/stats → KPIs del mes actual
app.get('/api/compras/stats', async (req, res) => {
  try {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const compras = await prisma.compra.findMany({
      where: { creadoEn: { gte: inicioMes } },
    });

    const totalGastado = compras.reduce((s, c) => s + c.total, 0);
    const totalIGV = compras.reduce((s, c) => s + c.igv, 0);
    const numFacturas = compras.length;

    // Top proveedor
    const porProveedor = {};
    compras.forEach(c => {
      porProveedor[c.proveedor] = (porProveedor[c.proveedor] || 0) + c.total;
    });
    const topProveedor = Object.entries(porProveedor).sort((a, b) => b[1] - a[1])[0];

    // Breakdown por categoría
    const porCategoria = {};
    compras.forEach(c => {
      const cat = c.categoria || 'Sin Categoría';
      porCategoria[cat] = (porCategoria[cat] || 0) + c.total;
    });

    res.json({
      totalGastado,
      totalIGV,
      numFacturas,
      topProveedor: topProveedor ? { nombre: topProveedor[0], total: topProveedor[1] } : null,
      porCategoria,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compras/sincronizar-sunat → Proxy seguro a apisunat.pe
// Modo demo: si APISUNAT_TOKEN no está configurado, retorna datos de ejemplo reales.
app.post('/api/compras/sincronizar-sunat', async (req, res) => {
  const { periodo, fechaInicio, fechaFin } = req.body;
  const token = process.env.APISUNAT_TOKEN;
  const MODO_DEMO = !token || token.includes('tu_token') || token === '';

  // Datos de demo basados en la respuesta real de la documentación oficial de apisunat.pe
  const DEMO_ITEMS = [
    {
      emisor: { ruc: '10061488176', razon_social: 'AGUILA ULLOA EFRAIN VICTOR' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'E001', numero: '88', fecha_emision: '2025-12-01', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '438.98', total_igv: '79.02', monto_total_general: '518.00' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/10061488176-01-E001-88',
        xml: 'https://apisunat.pe/rce/document/xml/10061488176-01-E001-88',
      },
    },
    {
      emisor: { ruc: '10080275973', razon_social: 'REYES MARIÑOS DE ZEGARRA YSABEL' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'FF01', numero: '693', fecha_emision: '2025-12-01', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '667.46', total_igv: '120.14', monto_total_general: '787.60' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/10080275973-01-FF01-693',
        xml: 'https://apisunat.pe/rce/document/xml/10080275973-01-FF01-693',
      },
    },
    {
      emisor: { ruc: '20601245789', razon_social: 'DISTRIBUIDORA ALIMENTOS & INSUMOS S.A.C.' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'F001', numero: '2145', fecha_emision: '2025-12-03', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '1186.44', total_igv: '213.56', monto_total_general: '1400.00' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/20601245789-01-F001-2145',
        xml: 'https://apisunat.pe/rce/document/xml/20601245789-01-F001-2145',
      },
    },
    {
      emisor: { ruc: '20100128056', razon_social: 'BACKUS Y JOHNSTON S.A.A.' },
      detalle: {
        tipo_comprobante: '01', nombre_comprobante: 'Factura Electrónica',
        serie: 'F001', numero: '98443', fecha_emision: '2025-12-05', estado_comprobante: 'Aceptado',
      },
      totales: { total_grav_oner: '423.73', total_igv: '76.27', monto_total_general: '500.00' },
      url_descarga: {
        pdf: 'https://apisunat.pe/rce/document/pdf/20100128056-01-F001-98443',
        xml: 'https://apisunat.pe/rce/document/xml/20100128056-01-F001-98443',
      },
    },
  ];

  try {
    let itemsParaProcesar = [];

    if (MODO_DEMO) {
      itemsParaProcesar = DEMO_ITEMS;
    } else {
      // Llamada real a apisunat.pe con paginación
      const params = new URLSearchParams();
      if (periodo) params.set('period', periodo);
      if (fechaInicio) params.set('start_date', fechaInicio);
      if (fechaFin) params.set('end_date', fechaFin);
      params.set('page', '1');

      const resp = await fetch(`https://dev.apisunat.pe/api/v1/sunat/rce?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(resp.status).json({ error: `apisunat.pe respondió con ${resp.status}: ${txt}` });
      }

      const data = await resp.json();
      itemsParaProcesar = (data.payload?.items) || [];
    }

    // Mapear tipo_comprobante a nombre legible
    const TIPOS = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de Crédito', '08': 'Nota de Débito' };

    let importadas = 0;
    let duplicadas = 0;

    for (const item of itemsParaProcesar) {
      const serieNumero = `${item.detalle.serie}-${item.detalle.numero}`;

      // Verificar duplicado por serieNumero + RUC del emisor
      const existe = await prisma.compra.findFirst({
        where: { serieNumero, ruc: item.emisor.ruc },
      });

      if (existe) {
        duplicadas++;
        continue;
      }

      const baseImponible = parseFloat(item.totales.total_grav_oner || 0);
      const igv = parseFloat(item.totales.total_igv || 0);
      const total = parseFloat(item.totales.monto_total_general || 0);
      const tipoDoc = TIPOS[item.detalle.tipo_comprobante] || 'Factura';
      const fechaEmision = item.detalle.fecha_emision ? new Date(item.detalle.fecha_emision + 'T00:00:00.000-05:00') : null;

      await prisma.compra.create({
        data: {
          proveedor: item.emisor.razon_social,
          ruc: item.emisor.ruc,
          tipoDocumento: tipoDoc,
          serieNumero,
          baseImponible,
          igv,
          total,
          origenCarga: MODO_DEMO ? 'demo' : 'sunat',
          fechaEmision,
          urlPdf: item.url_descarga?.pdf || null,
          urlXml: item.url_descarga?.xml || null,
        },
      });

      importadas++;
    }

    res.json({
      ok: true,
      modoDemo: MODO_DEMO,
      importadas,
      duplicadas,
      total: importadas + duplicadas,
      mensaje: MODO_DEMO
        ? `✅ MODO DEMO: ${importadas} facturas de ejemplo importadas desde la documentación de apisunat.pe. (${duplicadas} ya existían)`
        : `✅ ${importadas} facturas importadas desde SUNAT. (${duplicadas} ya existían)`,
    });
  } catch (err) {
    console.error('[Sync SUNAT]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/compras', async (req, res) => {
  try {
    const { proveedor, ruc, tipoDocumento, serieNumero, baseImponible, igv, total, xmlData, origenCarga, categoria, fechaEmision, metodoPago } = req.body;
    const compra = await prisma.compra.create({
      data: {
        proveedor: String(proveedor),
        ruc: ruc ? String(ruc) : null,
        tipoDocumento: tipoDocumento ? String(tipoDocumento) : 'Factura',
        serieNumero: serieNumero ? String(serieNumero) : null,
        baseImponible: parseFloat(baseImponible),
        igv: parseFloat(igv),
        total: parseFloat(total),
        xmlData: xmlData ? String(xmlData) : null,
        origenCarga: origenCarga ? String(origenCarga) : 'manual',
        categoria: categoria ? String(categoria) : null,
        fechaEmision: fechaEmision ? new Date(fechaEmision) : null,
        metodoPago: metodoPago ? String(metodoPago) : 'Efectivo',
      }
    });
    res.json(compra);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/compras/:id/categoria → Actualizar categoría de una compra
app.patch('/api/compras/:id/categoria', async (req, res) => {
  const { id } = req.params;
  const { categoria } = req.body;
  try {
    const compra = await prisma.compra.update({
      where: { id: parseInt(id) },
      data: { categoria: categoria ? String(categoria) : null },
    });
    res.json(compra);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/compras/:id → Editar todos los datos de una compra/gasto
app.put('/api/compras/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { proveedor, ruc, tipoDocumento, serieNumero, baseImponible, igv, total, categoria, fechaEmision, metodoPago } = req.body;
  try {
    const data = {};
    if (proveedor !== undefined) data.proveedor = String(proveedor);
    if (ruc !== undefined) data.ruc = ruc ? String(ruc) : null;
    if (tipoDocumento !== undefined) data.tipoDocumento = String(tipoDocumento);
    if (serieNumero !== undefined) data.serieNumero = serieNumero ? String(serieNumero) : null;
    if (baseImponible !== undefined) data.baseImponible = parseFloat(baseImponible) || 0;
    if (igv !== undefined) data.igv = parseFloat(igv) || 0;
    if (total !== undefined) data.total = parseFloat(total) || 0;
    if (categoria !== undefined) data.categoria = categoria ? String(categoria) : null;
    if (fechaEmision !== undefined) data.fechaEmision = fechaEmision ? new Date(fechaEmision) : null;
    if (metodoPago !== undefined) data.metodoPago = String(metodoPago);

    const compra = await prisma.compra.update({
      where: { id },
      data,
    });
    res.json(compra);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/compras/:id → Eliminar una compra o gasto
app.delete('/api/compras/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.compra.delete({
      where: { id },
    });
    res.json({ ok: true, mensaje: 'Gasto/Compra eliminada exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REPORTES
// ============================================================

// GET /api/reportes/cancelaciones → Pedidos cancelados del día o rango de fechas
app.get('/api/reportes/cancelaciones', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      hoyPeru.setHours(0, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        OR: [
          { estado: 'Cancelado' },
          { Venta: { anulado: true } }
        ],
        createdAt: filtroFecha
      },
      include: { items: true, mesa: true, Venta: true },
      orderBy: { createdAt: 'desc' },
    });

    const formateados = pedidos.map(p => ({
      id: p.id,
      hora: (p.canceladoEn || p.updatedAt || p.createdAt)?.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }),
      fecha: (p.canceladoEn || p.updatedAt || p.createdAt)?.toLocaleDateString('es-PE'),
      mesa: p.mesa?.numero || null,
      codigoPedidosYa: p.codigoPedidosYa,
      canceladoPor: p.canceladoPor || p.Venta?.anuladoPor || 'Admin',
      motivoCancela: p.motivoCancela || p.Venta?.motivoAnulacion || 'Devolución en Caja',
      total: p.Venta?.montoOriginal || p.total,
      resumenItems: p.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', '),
    }));

    res.json(formateados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/mozos → Estadísticas por mozo por rango de fechas
app.get('/api/reportes/mozos', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      hoyPeru.setHours(0, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        createdAt: filtroFecha,
        tipoEntrega: 'salon',
        estado: { not: 'Cancelado' },
      },
      select: { mesero: true, estado: true },
    });

    const mozos = {};
    for (const p of pedidos) {
      if (!mozos[p.mesero]) mozos[p.mesero] = { activas: 0, atendidas: 0 };
      if (p.estado === 'Cocina' || p.estado === 'Servido') mozos[p.mesero].activas++;
      if (p.estado === 'Cobrado') mozos[p.mesero].atendidas++;
    }

    const resultado = Object.entries(mozos).map(([nombre, stats]) => ({
      nombre,
      mesasActivas: stats.activas,
      mesasAtendidas: stats.atendidas,
    })).sort((a, b) => b.mesasAtendidas - a.mesasAtendidas);

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/contable → Ventas y compras por rango de fechas
app.get('/api/reportes/contable', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      filtroFecha = {
        gte: new Date(desde + 'T03:00:00.000-05:00'),
        lte: new Date(nextDayStr + 'T02:59:59.999-05:00')
      };
    } else {
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      filtroFecha = { gte: inicioMes };
    }

    const [ventas, compras, abonos, clientes] = await Promise.all([
      prisma.venta.findMany({
        where: {
          createdAt: filtroFecha,
          pedido: { estado: { not: 'Cancelado' } }
        }
      }),
      prisma.compra.findMany({ where: { creadoEn: filtroFecha } }),
      prisma.abonoCredito.findMany({ where: { creadoEn: filtroFecha } }),
      prisma.cliente.findMany()
    ]);

    const ventasTotal = ventas.reduce((s, v) => s + v.total, 0);
    const ventasIGV = ventas.reduce((s, v) => s + v.igv, 0);
    const ventasBase = ventas.reduce((s, v) => s + v.subtotal, 0);
    const comprasTotal = compras.reduce((s, c) => s + c.total, 0);
    const comprasIGV = compras.reduce((s, c) => s + c.igv, 0);
    const comprasBase = compras.reduce((s, c) => s + c.baseImponible, 0);

    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalYape = 0;

    ventas.forEach(v => {
      const { efec, tarj, yape } = obtenerMontosVenta(v);
      totalEfectivo += efec;
      totalTarjeta += tarj;
      totalYape += yape;
    });

    // Sumar abonos a la caja física
    abonos.forEach(a => {
      totalEfectivo += a.montoEfectivo || 0;
      totalTarjeta += a.montoTarjeta || 0;
      totalYape += a.montoYape || 0;
    });

    const clienteMap = new Map(clientes.map(c => [c.id, c.esTrabajador]));
    let consumoClientes = 0;
    let consumoPlanilla = 0;

    ventas.forEach(v => {
      if (v.metodoPago === 'Consumo') {
        consumoPlanilla += (v.descuentoAplicado || v.total);
      } else {
        const splits = parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
        if (splits.length > 0) {
          splits.forEach(s => {
            const esTrab = clienteMap.get(s.clienteId) || false;
            if (esTrab) {
              consumoPlanilla += s.monto;
            } else {
              consumoClientes += s.monto;
            }
          });
        } else if (v.metodoPago === 'Crédito') {
          consumoClientes += v.total;
        } else if (parseFloat(v.montoCredito || 0) > 0) {
          consumoClientes += parseFloat(v.montoCredito);
        }
      }
    });

    res.json({
      ventasTotal, ventasIGV, ventasBase,
      comprasTotal, comprasIGV, comprasBase,
      igvAPagar: ventasIGV - comprasIGV,
      desgloseCaja: {
        efectivo: totalEfectivo,
        tarjeta: totalTarjeta,
        yape: totalYape,
        pedidosYa: ventas.filter(v => v.metodoPago === 'PedidosYa').reduce((s, v) => s + v.total, 0),
        consumos: consumoPlanilla,
        consumoPlanilla,
        credito: consumoClientes,
        consumoClientes,
        cortesias: ventas.filter(v => v.metodoPago === 'Cortesía').reduce((s, v) => s + (v.descuentoAplicado || v.total), 0),
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/pollos → Reporte de pollos vendidos e inventario con conversión fraccionada
app.get('/api/reportes/pollos', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const gteDate = desde.length === 10 ? new Date(desde + 'T03:00:00.000-05:00') : new Date(desde);
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      const lteDate = hasta.length === 10 ? new Date(nextDayStr + 'T02:59:59.999-05:00') : new Date(hasta);
      filtroFecha = { gte: gteDate, lte: lteDate };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      if (hoyPeru.getHours() < 3) {
        hoyPeru.setDate(hoyPeru.getDate() - 1);
      }
      hoyPeru.setHours(3, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    // Obtener TODOS los pedidos cobrados (incluyendo items con precio 0 que son componentes de combos)
    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: 'Cobrado',
        createdAt: filtroFecha
      },
      include: {
        items: {
          include: { producto: true }
        }
      }
    });

    // Tabla de conversión de fracciones de pollo a unidades enteras
    const FRACCIONES = {
      '1/8': 0.125,
      '1/4': 0.25,
      '1/2': 0.5,
      '1': 1.0,
    };

    // Determinar la fracción de un item basado en nombre o categoría
    const obtenerFraccion = (nombre, categoria) => {
      const n = (nombre || '').toLowerCase();
      // Verificar si es un producto de pollo (nombre contiene pollo o categoría es pollos)
      const esPollo = n.includes('pollo') || (categoria || '').includes('Pollos') || ['Pollos a la Brasa', 'Piqueo', 'Parrillada Mixta', 'Piqueo Fogón Dorado'].some(c => (categoria || '').includes(c));
      if (!esPollo) return 0;

      // Detectar fracción en el nombre
      if (n.includes('1/8') || n.includes('octavo')) return FRACCIONES['1/8'];
      if (n.includes('1/4') || n.includes('cuarto')) return FRACCIONES['1/4'];
      if (n.includes('1/2') || n.includes('medio')) return FRACCIONES['1/2'];
      if (n.includes('1 pollo') || n.startsWith('1 pollo') || n.includes('pollo entero') || n.includes('un pollo')) return FRACCIONES['1'];

      // Fallback: si tiene "pollo" pero no fracción específica, asumir 1 entero
      return n.includes('pollo') ? FRACCIONES['1'] : 0;
    };

    // Acumulación por producto
    const productos = {};
    let totalOctavos = 0, totalCuartos = 0, totalMedios = 0, totalEnteros = 0;
    let unidadesTotales = 0;
    let ventasConPollo = 0;

    for (const p of pedidos) {
      for (const item of p.items) {
        const fraccion = obtenerFraccion(item.nombre, item.producto?.categoria);
        if (fraccion > 0) {
          const prodId = item.productoId;
          if (!productos[prodId]) {
            productos[prodId] = {
              id: prodId,
              nombre: item.nombre,
              categoria: item.producto?.categoria || 'Sin categoría',
              cantidadVendida: 0,
              unidadesEquivalentes: 0,
              stockActual: item.producto?.stock || 0,
            };
          }
          const unidades = fraccion * item.cantidad;
          productos[prodId].cantidadVendida += item.cantidad;
          productos[prodId].unidadesEquivalentes += unidades;
          unidadesTotales += unidades;
          ventasConPollo++;

          if (fraccion === FRACCIONES['1/8']) totalOctavos += item.cantidad;
          else if (fraccion === FRACCIONES['1/4']) totalCuartos += item.cantidad;
          else if (fraccion === FRACCIONES['1/2']) totalMedios += item.cantidad;
          else if (fraccion === FRACCIONES['1']) totalEnteros += item.cantidad;
        }
      }
    }

    // Calcular total de pollos vendidos con la fórmula: Σ (Octavos × 0.125 + Cuartos × 0.25 + Medios × 0.50 + Enteros × 1.0)
    const totalFormula = (totalOctavos * FRACCIONES['1/8']) + (totalCuartos * FRACCIONES['1/4']) + (totalMedios * FRACCIONES['1/2']) + (totalEnteros * FRACCIONES['1']);

    // Stock inicial configurable: usar el mayor stock de los productos de pollo registrado, o 0 si no hay
    const productosPollo = await prisma.producto.findMany({
      where: { categoria: { in: ['Pollos a la Brasa', 'Piqueo', 'Piqueos'] } }
    });
    const stockInicial = productosPollo.reduce((max, p) => Math.max(max, p.stock || 0), 50) || 50; // Default 50 si no hay stock
    const porcentajeRotacion = stockInicial > 0 ? parseFloat(((totalFormula / stockInicial) * 100).toFixed(1)) : 0;

    res.json({
      totalOctavos,
      totalCuartos,
      totalMedios,
      totalEnteros,
      totalVentasConPollo: ventasConPollo,
      totalUnidadesEquivalentes: parseFloat(totalFormula.toFixed(2)),
      stockInicial,
      porcentajeRotacion,
      detalles: Object.values(productos).sort((a, b) => b.unidadesEquivalentes - a.unidadesEquivalentes),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/rotacion → Cantidad vendida de cada producto por rango de fechas
app.get('/api/reportes/rotacion', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let filtroFecha = {};
    if (desde && hasta) {
      const gteDate = desde.length === 10 ? new Date(desde + 'T03:00:00.000-05:00') : new Date(desde);
      const nextDay = new Date(hasta + 'T00:00:00.000-05:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      const lteDate = hasta.length === 10 ? new Date(nextDayStr + 'T02:59:59.999-05:00') : new Date(hasta);
      filtroFecha = { gte: gteDate, lte: lteDate };
    } else if (desde) {
      const gteDate = desde.length === 10 ? new Date(desde + 'T03:00:00.000-05:00') : new Date(desde);
      filtroFecha = { gte: gteDate };
    } else {
      const ahora = new Date();
      const hoyPeru = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }));
      if (hoyPeru.getHours() < 3) {
        hoyPeru.setDate(hoyPeru.getDate() - 1);
      }
      hoyPeru.setHours(3, 0, 0, 0);
      const inicioUTC = new Date(hoyPeru.getTime() + 5 * 60 * 60 * 1000);
      filtroFecha = { gte: inicioUTC };
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: 'Cobrado',
        createdAt: filtroFecha
      },
      include: {
        items: {
          include: {
            producto: true
          }
        }
      }
    });

    const rotacion = {};
    for (const p of pedidos) {
      for (const item of p.items) {
        const prodId = item.productoId;
        if (!rotacion[prodId]) {
          rotacion[prodId] = {
            id: prodId,
            nombre: item.nombre,
            categoria: item.producto?.categoria || 'Sin categoría',
            cantidad: 0,
            precio: item.precio,
            total: 0
          };
        }
        rotacion[prodId].cantidad += item.cantidad;
        rotacion[prodId].total += item.cantidad * item.precio;
      }
    }

    const resultado = Object.values(rotacion).sort((a, b) => b.cantidad - a.cantidad);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
// INICIO DEL SERVIDOR (DESACOPLADO DE TAREAS PESADAS DE MIGRACIÓN)
// ============================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Backend Fogón Dorado v3 corriendo en http://localhost:${PORT}`);
  console.log(`ℹ️ Para ejecutar tareas de mantenimiento/reparación de datos: npm run db:repair`);
});


// HELPERS E INTEGRACIÓN APISUNAT.PE (SUNAT PSE)
// ============================================================

async function obtenerSiguienteSerieYNumero(tipoComprobante, txPrisma = prisma) {
  if (tipoComprobante !== 'Boleta' && tipoComprobante !== 'Factura') {
    return { serie: null, numero: null };
  }

  const isFactura = tipoComprobante === 'Factura';
  const serieDefault = isFactura ? (process.env.SERIE_FACTURA || 'F001') : (process.env.SERIE_BOLETA || 'B001');
  const minCorrelativo = isFactura
    ? parseInt(process.env.ULTIMO_CORRELATIVO_FACTURA || '2')
    : parseInt(process.env.ULTIMO_CORRELATIVO_BOLETA || '0');

  const ultimaVenta = await txPrisma.venta.findFirst({
    where: { tipoComprobante, serie: serieDefault, numero: { not: null } },
    orderBy: { numero: 'desc' }
  });

  const siguienteNumero = ultimaVenta
    ? Math.max(ultimaVenta.numero + 1, minCorrelativo + 1)
    : (minCorrelativo + 1);

  return {
    serie: serieDefault,
    numero: siguienteNumero
  };
}

async function enviarAApisunat(venta, itemsRaw) {
  // Filtrar los items para excluir componentes de combos de precio 0 que no son barra
  const items = itemsRaw.filter(i => {
    const isBar = BARRA_CATEGORIAS.includes(i.categoria) || (i.producto?.categoria && BARRA_CATEGORIAS.includes(i.producto?.categoria));
    return i.precio > 0 || isBar;
  });

  // Simular caída de red si está activa la variable de entorno
  if (process.env.APISUNAT_SIMULATE_OUTAGE === 'true') {
    throw new Error('Outage Simulator Active: apisunat.pe server is simulated down.');
  }

  const token = process.env.APISUNAT_TOKEN;
  const url = process.env.APISUNAT_API_URL || 'https://sandbox.apisunat.pe/api/v3/documents';
  const MODO_DEMO = !token || token.includes('tu_token') || token === '';

  const serie = venta.serie || (venta.tipoComprobante === 'Factura' ? (process.env.SERIE_FACTURA || 'F001') : (process.env.SERIE_BOLETA || 'B001'));

  // Identificación del cliente (1 = DNI, 6 = RUC, 0 = Sin Documento)
  let clienteTipoDoc = "1";
  let clienteNumDoc = venta.numDocumento || "00000000";
  let clienteDenominacion = venta.nombreCliente || "PÚBLICO GENERAL";

  if (venta.numDocumento && venta.numDocumento.length === 11) {
    clienteTipoDoc = "6";
  } else if (!venta.numDocumento || venta.numDocumento === '00000000' || venta.numDocumento === '0') {
    clienteTipoDoc = "0";
    clienteNumDoc = "00000000";
    clienteDenominacion = "PÚBLICO GENERAL";
  }

  // En MODO DEMO simulamos una respuesta exitosa localmente
  if (MODO_DEMO) {
    const rucEmpresa = "20496009259";
    const numeroStr = String(venta.numero || 1);
    const tipoCompNum = venta.tipoComprobante === 'Factura' ? '01' : '03';
    return {
      success: true,
      message: "El comprobante fue enviado y aceptado por SUNAT (DEMO).",
      payload: {
        estado: "ACEPTADO",
        hash: "demo_hash_" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        xml: `https://apisunat.pe/${rucEmpresa}-${tipoCompNum}-${serie}-${numeroStr}.xml`,
        cdr: `https://apisunat.pe/R-${rucEmpresa}-${tipoCompNum}-${serie}-${numeroStr}.xml`,
        pdf: {
          ticket: `https://apisunat.pe/pdf/ticket/${rucEmpresa}-${tipoCompNum}-${serie}-${numeroStr}`,
          a4: `https://apisunat.pe/pdf/a4/${rucEmpresa}-${tipoCompNum}-${serie}-${numeroStr}`
        }
      }
    };
  }

  // Formatear items para apisunat.pe
  const formattedItems = items.map((item) => {
    const totalItem = item.precio * item.cantidad;
    const subtotalItem = totalItem / 1.105;

    return {
      unidad_de_medida: "NIU",
      descripcion: item.nombre,
      cantidad: String(item.cantidad),
      valor_unitario: (subtotalItem / item.cantidad).toFixed(6), // Recomienda 6 decimales
      porcentaje_igv: "10.5",
      codigo_tipo_afectacion_igv: "10", // Gravado - Operación Onerosa
      nombre_tributo: "IGV"
    };
  });

  const payload = {
    documento: venta.tipoComprobante === 'Factura' ? 'factura' : 'boleta',
    serie: serie,
    numero: venta.numero, // Debe ser entero
    fecha_de_emision: (() => {
      const dateLima = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const [day, month, year] = dateLima.split('/');
      return `${year}-${month}-${day}`;
    })(),
    moneda: "PEN",
    tipo_operacion: "0101",
    cliente_tipo_de_documento: clienteTipoDoc,
    cliente_numero_de_documento: clienteNumDoc,
    cliente_denominacion: clienteDenominacion,
    cliente_direccion: (venta.clienteDireccion && venta.clienteDireccion.trim()) || "-",
    items: formattedItems,
    total: venta.total.toFixed(2)
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch (e) { }
    const errMsg = parsedError?.message || errorText;
    throw new Error(`apisunat.pe Error (${response.status}): ${errMsg}`);
  }

  const resData = await response.json();
  if (resData.success && resData.payload?.estado === 'RECHAZADO') {
    throw new Error(`SUNAT rechazó el comprobante: ${resData.message || 'Datos incorrectos'}`);
  }
  return resData;
}


// ============================================================
// APISUNAT — ENDPOINTS DE DIAGNÓSTICO Y REINTENTO MANUAL
// ============================================================

// GET /api/sunat/pendientes → Ver todas las ventas con problemas
app.get('/api/sunat/pendientes', async (req, res) => {
  try {
    const pendientes = await prisma.venta.findMany({
      where: {
        OR: [
          { estadoSunat: { startsWith: 'PENDIENTE' } },
          { estadoSunat: { startsWith: 'ERROR' } },
        ],
        tipoComprobante: { in: ['Boleta', 'Factura'] }
      },
      select: {
        id: true,
        createdAt: true,
        tipoComprobante: true,
        total: true,
        nombreCliente: true,
        numDocumento: true,
        estadoSunat: true,
        pedidoId: true,
        serie: true,
        numero: true
      },
      orderBy: { createdAt: 'desc' }
    });
    // Mapeamos temporalmente estadoSunat como estadoNubefact para compatibilidad con el front
    const mapped = pendientes.map(p => ({
      ...p,
      estadoNubefact: p.estadoSunat
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sunat/reintentar/:id → Forzar reintento manual de una venta específica
app.post('/api/sunat/reintentar/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { pedido: { include: { items: true } } }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });

    console.log(`[SUNAT Manual] 🔄 Reintento manual forzado para Venta #${id}...`);

    // Asignar o curar serie y correlativo si no coincide con la configurada y no está aceptada por SUNAT
    const isFactura = venta.tipoComprobante === 'Factura';
    const serieDefault = isFactura ? (process.env.SERIE_FACTURA || 'F001') : (process.env.SERIE_BOLETA || 'B001');
    const noAceptado = !venta.estadoSunat || !venta.estadoSunat.startsWith('ACEPTADO:');

    if (!venta.serie || !venta.numero || (noAceptado && venta.serie !== serieDefault)) {
      const datosSerie = await obtenerSiguienteSerieYNumero(venta.tipoComprobante);
      venta.serie = datosSerie.serie;
      venta.numero = datosSerie.numero;

      await prisma.venta.update({
        where: { id: venta.id },
        data: { serie: venta.serie, numero: venta.numero }
      });
    }

    const response = await enviarAApisunat(venta, venta.pedido.items);

    const mappedData = {
      serie: venta.serie,
      numero: venta.numero,
      key: response.payload?.hash || '',
      enlace_del_pdf: response.payload?.pdf?.ticket || response.payload?.pdf?.a4 || '',
      cadena_para_codigo_qr: `${process.env.RUC_EMPRESA || '10710311191'}|${venta.tipoComprobante === 'Factura' ? '01' : '03'}|${venta.serie}|${String(venta.numero).padStart(4, '0')}|${venta.igv.toFixed(2)}|${venta.total.toFixed(2)}|${new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(venta.createdAt))}|${venta.tipoComprobante === 'Factura' ? '6' : (venta.numDocumento?.length === 8 ? '1' : '0')}|${venta.numDocumento || '00000000'}|${response.payload?.hash || ''}`
    };

    const updated = await prisma.venta.update({
      where: { id },
      data: {
        estadoSunat: `ACEPTADO:${JSON.stringify(mappedData)}`,
        urlPdf: mappedData.enlace_del_pdf,
        urlXml: response.payload?.xml || null
      }
    });

    console.log(`[SUNAT Manual] ✅ Venta #${id} ACEPTADA por apisunat.pe.`);
    res.json({ ok: true, estadoNubefact: updated.estadoSunat }); // Retornamos mapeado como estadoNubefact para el front
  } catch (err) {
    const errorMsg = err.message.substring(0, 500);
    await prisma.venta.update({
      where: { id },
      data: { estadoSunat: `ERROR:${errorMsg}` }
    }).catch(() => { });

    console.error(`[SUNAT Manual] ❌ Fallo reintento manual Venta #${id}:`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/sunat/reintentar-todos → Forzar reintento de TODAS las ventas pendientes
app.post('/api/sunat/reintentar-todos', async (req, res) => {
  try {
    await procesarVentasPendientes();
    res.json({ ok: true, mensaje: 'Reintento masivo ejecutado. Revisa los logs de SUNAT.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================
// WORKER DE REINTENTO AUTOMÁTICO (OFFLINE CONTINGENCY)
// ============================================================

async function procesarVentasPendientes() {
  try {
    const pendientes = await prisma.venta.findMany({
      where: {
        estadoSunat: 'PENDIENTE_REINTENTO',
        tipoComprobante: { in: ['Boleta', 'Factura'] }
      },
      include: {
        pedido: {
          include: { items: true }
        }
      }
    });

    if (pendientes.length === 0) return;

    console.log(`[Worker SUNAT] 🔍 Se encontraron ${pendientes.length} ventas en contingencia por reintentar.`);

    for (const venta of pendientes) {
      try {
        console.log(`[Worker SUNAT] 🔄 Reintentando envío de Venta #${venta.id}...`);

        // Asignar o curar serie y correlativo si no coincide con la configurada y no está aceptada por SUNAT
        const isFactura = venta.tipoComprobante === 'Factura';
        const serieDefault = isFactura ? (process.env.SERIE_FACTURA || 'F001') : (process.env.SERIE_BOLETA || 'B001');
        const noAceptado = !venta.estadoSunat || !venta.estadoSunat.startsWith('ACEPTADO:');

        if (!venta.serie || !venta.numero || (noAceptado && venta.serie !== serieDefault)) {
          const datosSerie = await obtenerSiguienteSerieYNumero(venta.tipoComprobante);
          venta.serie = datosSerie.serie;
          venta.numero = datosSerie.numero;

          await prisma.venta.update({
            where: { id: venta.id },
            data: { serie: venta.serie, numero: venta.numero }
          });
        }

        const response = await enviarAApisunat(venta, venta.pedido.items);

        const mappedData = {
          serie: venta.serie,
          numero: venta.numero,
          key: response.payload?.hash || '',
          enlace_del_pdf: response.payload?.pdf?.ticket || response.payload?.pdf?.a4 || '',
          cadena_para_codigo_qr: `${process.env.RUC_EMPRESA || '10710311191'}|${venta.tipoComprobante === 'Factura' ? '01' : '03'}|${venta.serie}|${String(venta.numero).padStart(4, '0')}|${venta.igv.toFixed(2)}|${venta.total.toFixed(2)}|${new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(venta.createdAt))}|${venta.tipoComprobante === 'Factura' ? '6' : (venta.numDocumento?.length === 8 ? '1' : '0')}|${venta.numDocumento || '00000000'}|${response.payload?.hash || ''}`
        };

        await prisma.venta.update({
          where: { id: venta.id },
          data: {
            estadoSunat: `ACEPTADO:${JSON.stringify(mappedData)}`,
            urlPdf: mappedData.enlace_del_pdf,
            urlXml: response.payload?.xml || null
          }
        });

        console.log(`[Worker SUNAT] ✅ Venta #${venta.id} enviada y ACEPTADA por apisunat.pe.`);
      } catch (err) {
        const errorMsg = err.message.substring(0, 500);
        await prisma.venta.update({
          where: { id: venta.id },
          data: { estadoSunat: `ERROR:${errorMsg}` }
        }).catch(() => { });

        console.error(`[Worker SUNAT] ❌ Intento fallido para Venta #${venta.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[Worker SUNAT] ❌ Error crítico en el worker:", err.message);
  }
}

// Iniciar worker de reintentos cada 5 minutos (300000ms)
setInterval(procesarVentasPendientes, 300000);

