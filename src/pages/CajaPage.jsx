import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Receipt, X, Banknote, Search, CheckCircle, Clock, Sparkles, CreditCard, Wallet, Truck, PackageCheck, Plus, Calculator, Printer, Gift, Tag, Percent, Check, Users, Layers, Ban, AlertTriangle, Trash2, Lock, KeyRound } from 'lucide-react';

import { api } from '../api';

// Helper para parsear la distribución de crédito en ventas con múltiples clientes
const parsearCreditoSplit = (ofertaDescripcion, defaultClienteId, defaultMonto) => {
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
};

// Helper seguro para parsear montos ingresados por el usuario
const parseMonto = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
};

// Componente Selector de Cliente con Buscador Integrado y Card de Saldo
function SelectorClienteCreditoCombobox({
  clientes = [],
  clienteSeleccionado,
  onSelectCliente,
  label = "Cliente para Crédito:",
  placeholder = "Buscar por nombre, DNI o RUC..."
}) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);

  const filtrados = (clientes || []).filter(c => {
    if (!busqueda.trim()) return true;
    const term = busqueda.toLowerCase().trim();
    const nom = (c.nombre || '').toLowerCase();
    const doc = (c.numDoc || '').toLowerCase();
    return nom.includes(term) || doc.includes(term);
  });

  return (
    <div className="space-y-1 relative">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase">{label}</label>
          {clienteSeleccionado && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
              (clienteSeleccionado.saldo || 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {(clienteSeleccionado.saldo || 0) > 0 ? `Debe S/ ${(clienteSeleccionado.saldo || 0).toFixed(2)}` : 'Al día'}
            </span>
          )}
        </div>
      )}

      {clienteSeleccionado ? (
        <div className="bg-amber-50/60 border-2 border-amber-300 rounded-xl p-2 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              clienteSeleccionado.esTrabajador ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black text-slate-900 uppercase truncate leading-tight">
                  {clienteSeleccionado.nombre}
                </p>
                <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded shrink-0 ${
                  clienteSeleccionado.esTrabajador ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {clienteSeleccionado.esTrabajador ? 'STAFF' : 'CLIENTE'}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500 truncate">
                {clienteSeleccionado.tipoDoc || 'DOC'}: {clienteSeleccionado.numDoc || 'S/D'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectCliente(null);
              setBusqueda('');
              setAbierto(true);
            }}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 shrink-0"
            title="Cambiar cliente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={placeholder}
              value={busqueda}
              onFocus={() => setAbierto(true)}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAbierto(true);
              }}
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 shadow-sm"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {abierto && (
            <>
              <div 
                className="fixed inset-0 z-[120]" 
                onClick={() => setAbierto(false)} 
              />
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-[130] max-h-48 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {filtrados.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-bold">
                    No se encontraron clientes
                  </div>
                ) : (
                  filtrados.map(c => {
                    const debe = (c.saldo || 0) > 0;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCliente(c);
                          setAbierto(false);
                          setBusqueda('');
                        }}
                        className="w-full text-left p-1.5 rounded-xl hover:bg-amber-50/80 transition-colors flex items-center justify-between gap-2 border border-transparent hover:border-amber-200"
                      >
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 uppercase truncate">
                              {c.nombre}
                            </span>
                            <span className={`text-[8px] font-black uppercase px-1 py-0.2 rounded ${
                              c.esTrabajador ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {c.esTrabajador ? 'STAFF' : 'CLIENTE'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {c.tipoDoc || 'DOC'}: {c.numDoc || 'S/D'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                            debe ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {debe ? `Debe S/ ${(c.saldo).toFixed(2)}` : 'S/ 0.00'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PRODUCT_OPTIONS_CONFIG = {
  "Combo Criollo (Almuerzo)": {
    fondoOptions: [
      "Saltado (pollo o carne)",
      "Tallarin saltado (pollo o carne)",
      "Chaufa (pollo o carne)",
      "Trucha Frita",
      "Alitas Fritas",
      "Milanesa de Pollo",
      "Chicharron de pollo"
    ]
  },
  "Combo Parrillero (Almuerzo)": {
    fondoOptions: [
      "Chuleta de cerdo",
      "Filete de pollo",
      "Churrasco",
      "Pechuga"
    ]
  },
  "Combo Tallarines Verdes (Almuerzo)": {
    fondoOptions: [
      "Con Pollo Frito",
      "Con Bisteck",
      "Con Pechuga",
      "Con Chuleta",
      "Con Pollo Deshuesado"
    ]
  },
  "Combo Junior": {
    fondoOptions: [
      "3 unds. de chicharrones de pollo",
      "1/8 pollo a la brasa",
      "3 alitas fritas (+ ensalada fruta)"
    ]
  }
};

const getComboConfig = (nombre) => {
  if (!nombre) return null;
  const key = Object.keys(PRODUCT_OPTIONS_CONFIG).find(k => k.toLowerCase() === nombre.toLowerCase());
  return key ? { config: PRODUCT_OPTIONS_CONFIG[key], key } : null;
};

const SINONIMOS = {
  gaseosa: ['cola', 'inca', 'coca', 'refresco', 'sprite', 'fanta', 'gaseosa'],
  bebida: ['chicha', 'limonada', 'gaseosa', 'cerveza', 'pisco', 'trago', 'coctel', 'jugo', 'agua'],
  chela: ['cerveza', 'cristal', 'pilsen', 'cusquena'],
  papas: ['papa', 'patata', 'fritas'],
  carne: ['lomo', 'bife', 'parrilla', 'anticucho', 'res', 'corte'],
  pollo: ['brasa', 'broaster', 'alitas', 'pechuga'],
  piqueo: ['entrada', 'porcion', 'tequenos', 'salchipapa'],
  "1/8": ['octavo', 'octavos', '1/8', 'un octavo'],
  "1/4": ['cuarto', 'cuartos', '1/4', 'un cuarto'],
  "1/2": ['medio', 'medios', '1/2', 'un medio', 'mitad'],
  entero: ['entero', 'completo', 'pollo entero', '1', 'uno']
};

const BARRA_CATEGORIAS = [
  'Bebidas y Refrescos',
  'Bebidas',
  'Cervezas',
  'Bar y Cocteles',
  'Postres',
];

const normalizePhonetic = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // eliminar acentos
    .replace(/[^a-z0-9]/g, " ")      // remover caracteres especiales
    .replace(/ch/g, "x")            // ch -> x
    .replace(/ll/g, "y")            // ll -> y
    .replace(/z/g, "s")             // z -> s
    .replace(/c([ei])/g, "s$1")      // ce, ci -> se, si
    .replace(/h/g, "")              // h muda
    .replace(/b/g, "v")              // b -> v equivalencia
    .replace(/k/g, "c")              // k -> c
    .replace(/q/g, "c")              // q -> c
    .trim();
};

const parseDeliveryInfo = (code) => {
  if (!code || !code.startsWith('DELIVERY -')) return null;
  const parts = code.split(' | ');
  const namePart = parts[0] ? parts[0].replace('DELIVERY - ', '') : '';
  const telPart = parts[1] ? parts[1].replace('TEL: ', '') : '';
  const dirPart = parts[2] ? parts[2].replace('DIR: ', '') : '';
  const pagaPart = parts[3] ? parts[3].replace('PAGA: ', '') : '';
  const vueltoPart = parts[4] ? parts[4].replace('VUELTO: ', '') : '';
  
  return {
    nombre: namePart,
    telefono: telPart,
    direccion: dirPart,
    conCuanto: pagaPart,
    vuelto: vueltoPart,
  };
};

const matchProductSemantic = (prod, query) => {
  if (!query) return true;
  const cleanQuery = query.toLowerCase().trim();
  const queryTokens = cleanQuery.split(/\s+/);
  
  const cleanProdName = (prod.nombre || '').toLowerCase();
  const cleanProdCat = (prod.categoria || '').toLowerCase();
  
  const phoneticName = normalizePhonetic(prod.nombre);
  const phoneticCat = normalizePhonetic(prod.categoria);
  
  return queryTokens.every(qToken => {
    if (cleanProdName.includes(qToken) || cleanProdCat.includes(qToken)) return true;
    const phoneticToken = normalizePhonetic(qToken);
    if (phoneticName.includes(phoneticToken) || phoneticCat.includes(phoneticToken)) return true;
    for (const [key, syns] of Object.entries(SINONIMOS)) {
      const tokenMatchesSyn = (key === qToken) || syns.some(syn => syn === qToken || normalizePhonetic(syn) === phoneticToken);
      if (tokenMatchesSyn) {
        const prodHasKeyOrSyn = cleanProdName.includes(key) || syns.some(syn => cleanProdName.includes(syn));
        if (prodHasKeyOrSyn) {
          return true;
        }
      }
    }
    return false;
  });
};

const agruparProductos = (items) => {
  const list = [];
  const tallarines = items.filter(p => p.categoria === 'Tallarines Verdes');
  const otros = items.filter(p => p.categoria !== 'Tallarines Verdes');
  
  if (tallarines.length > 0) {
    const ordenados = [...tallarines].sort((a, b) => a.precio - b.precio);
    list.push({
      id: 'group_tallarines_verdes',
      nombre: 'Tallarines Verdes',
      categoria: 'Tallarines Verdes',
      precioMin: ordenados[0].precio,
      precioMax: ordenados[ordenados.length - 1].precio,
      esAgrupado: true,
      variantes: tallarines,
      tipoStock: 'ilimitado',
      stock: 0,
      activo: true
    });
  }
  
  return [...list, ...otros];
};

export default function CajaPage({ currentUser }) {
  const [mesas, setMesas] = useState([]);
  const [pedidosLlevar, setPedidosLlevar] = useState([]);
  const [stats, setStats] = useState({ atendidas: 0, ingresos: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [tipoComprobante, setTipoComprobante] = useState('Boleta');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [mixtoEfectivo, setMixtoEfectivo] = useState('');
  const [mixtoTarjeta, setMixtoTarjeta] = useState('');
  const [mixtoYape, setMixtoYape] = useState('');
  const [numDocumento, setNumDocumento] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [isBuscando, setIsBuscando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [activeComprobante, setActiveComprobante] = useState(null);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);
  const [cortesiaItemIds, setCortesiaItemIds] = useState([]);
  const [modalConfirmarCobro, setModalConfirmarCobro] = useState(false);
  const [datosConfirmacionCobro, setDatosConfirmacionCobro] = useState(null);

  // Campos para Delivery Propio y Para Llevar en modal
  const [deliveryTelefono, setDeliveryTelefono] = useState('');
  const [deliveryDireccion, setDeliveryDireccion] = useState('');
  const [deliveryMontoEnvio, setDeliveryMontoEnvio] = useState('');
  const [deliveryConCuanto, setDeliveryConCuanto] = useState('');
  const [deliveryTipoComprobante, setDeliveryTipoComprobante] = useState('Ticket');
  const [deliveryMetodoPago, setDeliveryMetodoPago] = useState('Efectivo');
  const [deliveryMixtoEfectivo, setDeliveryMixtoEfectivo] = useState('');
  const [deliveryMixtoTarjeta, setDeliveryMixtoTarjeta] = useState('');
  const [deliveryMixtoYape, setDeliveryMixtoYape] = useState('');
  const [deliveryClienteNombre, setDeliveryClienteNombre] = useState('');
  const [deliveryNumDocumento, setDeliveryNumDocumento] = useState('');

  // Campos para Corregir Datos de Cliente / Facturación en Historial
  const [editClienteVenta, setEditClienteVenta] = useState(null);
  const [editClienteTipoComprobante, setEditClienteTipoComprobante] = useState('Ticket');
  const [editClienteNumDoc, setEditClienteNumDoc] = useState('');
  const [editClienteNombre, setEditClienteNombre] = useState('');
  const [editClienteDireccion, setEditClienteDireccion] = useState('');
  const [editClientePin, setEditClientePin] = useState('');
  const [editClienteError, setEditClienteError] = useState('');
  const [editClienteCargando, setEditClienteCargando] = useState(false);

  // Modal Anular / Registrar Devolución de Venta Entregada
  const [anularVentaModal, setAnularVentaModal] = useState(false);
  const [ventaAAnular, setVentaAAnular] = useState(null);
  const [anularPin, setAnularPin] = useState('');
  const [anularMotivo, setAnularMotivo] = useState('');
  const [anularError, setAnularError] = useState('');
  const [anularCargando, setAnularCargando] = useState(false);

  // Historial de Ventas y Arqueo/Cierre de Caja
  const [ventas, setVentas] = useState([]);
  const [cierreModalOpen, setCierreModalOpen] = useState(false);
  const [ultimoCierre, setUltimoCierre] = useState(() => {
    const stored = localStorage.getItem('ultimoCierre');
    if (stored) return stored;
    const d = new Date();
    if (d.getHours() < 3) {
      d.setDate(d.getDate() - 1);
    }
    d.setHours(3, 0, 0, 0);
    return d.toISOString();
  });
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('Todos');
  const [consumoPin, setConsumoPin] = useState('');
  const [consumoPinError, setConsumoPinError] = useState('');

  // Créditos y Clientes
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [clienteCreditoSeleccionado, setClienteCreditoSeleccionado] = useState(null);
  const [clientesCreditoMixto, setClientesCreditoMixto] = useState([{ clienteId: '', monto: '', nombre: '' }]);
  const [incluirCreditoMixto, setIncluirCreditoMixto] = useState(false);
  const [montoCreditoMixto, setMontoCreditoMixto] = useState('');
  const [deliveryMontoCredito, setDeliveryMontoCredito] = useState('');
  const [deliveryClienteCreditoSeleccionado, setDeliveryClienteCreditoSeleccionado] = useState(null);
  const [deliveryDescuentoPorcentaje, setDeliveryDescuentoPorcentaje] = useState('');
  // Búsqueda de clientes en selectores de crédito
  const [busquedaClienteCredito, setBusquedaClienteCredito] = useState('');
  const [busquedaClienteCreditoDelivery, setBusquedaClienteCreditoDelivery] = useState('');
  const [pagaConEfectivoMesa, setPagaConEfectivoMesa] = useState('');


  // Modal cambiar método de pago
  const [cambioMetodoModal, setCambioMetodoModal] = useState(false);
  const [ventaACambiar, setVentaACambiar] = useState(null);
  const [cambioPin, setCambioPin] = useState('');
  const [cambioNuevoMetodo, setCambioNuevoMetodo] = useState('Efectivo');
  const [cambiando, setCambiando] = useState(false);
  const [cambioError, setCambioError] = useState('');

  // Modal cambiar tipo de entrega
  const [cambioTipoEntregaModal, setCambioTipoEntregaModal] = useState(false);
  const [ventaATipoCambiar, setVentaATipoCambiar] = useState(null);
  const [cambioNuevoTipo, setCambioNuevoTipo] = useState('ParaLlevar');
  const [cambioCodigoPY, setCambioCodigoPY] = useState('');
  const [cambioNombreCliente, setCambioNombreCliente] = useState('');
  const [cambioTelefono, setCambioTelefono] = useState('');
  const [cambioDireccion, setCambioDireccion] = useState('');
  const [cambioMontoDelivery, setCambioMontoDelivery] = useState('');
  const [cambioMontoConCuanto, setCambioMontoConCuanto] = useState('');
  const [cambioMetodoPago, setCambioMetodoPago] = useState('Efectivo');
  const [cambioMixtoEfectivo, setCambioMixtoEfectivo] = useState('');
  const [cambioMixtoTarjeta, setCambioMixtoTarjeta] = useState('');
  const [cambioMixtoYape, setCambioMixtoYape] = useState('');
  const [cambioTipoPin, setCambioTipoPin] = useState('');
  const [cambioTipoError, setCambioTipoError] = useState('');
  const [cambioTipoCambiando, setCambioTipoCambiando] = useState(false);

  // Mostrar todas las ventas del día ignorando el Cierre de Turno por defecto
  const [mostrarTodoElDia, setMostrarTodoElDia] = useState(true);
  const [historialColapsado, setHistorialColapsado] = useState(false);

  // PIN y Cortesías en modal de Delivery/Para Llevar
  const [pinAdminDelivery, setPinAdminDelivery] = useState('');
  const [cortesiaDeliveryIndices, setCortesiaDeliveryIndices] = useState([]);

  // Modal de autorización de cancelación para Llevar/Delivery
  const [cancelLlevarModalOpen, setCancelLlevarModalOpen] = useState(false);
  const [pedidoACancelarLlevar, setPedidoACancelarLlevar] = useState(null);
  const [pinCancelLlevar, setPinCancelLlevar] = useState('');
  const [errorCancelLlevar, setErrorCancelLlevar] = useState('');

  // Modal PedidosYa y Para Llevar
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [codigoPY, setCodigoPY] = useState('');
  const [cajeroNombre, setCajeroNombre] = useState(currentUser?.nombre || 'María');

  useEffect(() => {
    if (currentUser?.nombre) {
      setCajeroNombre(currentUser.nombre);
    }
  }, [currentUser]);

  const [deliverySearchQuery, setDeliverySearchQuery] = useState('');
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selections, setSelections] = useState({});
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [productosMenu, setProductosMenu] = useState([]);
  const [itemsDelivery, setItemsDelivery] = useState([]);
  const [editingPedidoId, setEditingPedidoId] = useState(null);
  const [enviandoDelivery, setEnviandoDelivery] = useState(false);
  const [tipoDelivery, setTipoDelivery] = useState('PedidosYa'); // 'PedidosYa' | 'ParaLlevar'
  const [toasts, setToasts] = useState([]);
  const addToast = (mensaje, tipo = 'info') => {
    const toastId = Date.now() + Math.random();
    setToasts(prev => [...prev, { id: toastId, mensaje, tipo }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 5000);
  };
  const prevPedidosLlevarRef = useRef([]);
  const historialScrollRef = useRef(null);


  // Campana de Restaurante Premium (G5 -> C6)
  const playChimeNotification = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0.15, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playTone(784, audioCtx.currentTime, 0.6);
      playTone(1046.5, audioCtx.currentTime + 0.12, 0.8);
    } catch (e) {
      console.error('AudioContext no soportado:', e);
    }
  };

  const fetchCajaData = useCallback(async () => {
    try {
      const [mesasData, resumenData, llevarData, ventasData, prods, clientsList, abonosList] = await Promise.all([
        api.getMesas(),
        api.getResumenVentas(),
        api.getPedidosLlevar(),
        api.getHistorialVentas(),
        api.getProductos(), // <-- Recargar productos dinámicamente para ofertas en vivo
        api.getClientes().catch(() => []),
        api.getAbonos().catch(() => []),
      ]);
      setMesas(mesasData);
      setPedidosLlevar(llevarData);
      setStats({ atendidas: resumenData.atendidas || 0, ingresos: resumenData.ingresos || 0 });
      setVentas(ventasData || []);
      setProductosMenu(prods); // <-- Actualizar el menú con precios de oferta en vivo
      setClientes(clientsList || []);
      setAbonos(abonosList || []);
    } catch (err) {
      console.error('Error cargando datos de caja:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCajaData();
    const interval = setInterval(() => {
      if (!modalOpen && !deliveryModal && !cierreModalOpen) fetchCajaData();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchCajaData, modalOpen, deliveryModal, cierreModalOpen]);

  // Alerta sonora y visual en tiempo real al estar listos
  useEffect(() => {
    if (pedidosLlevar.length === 0) {
      if (prevPedidosLlevarRef.current.length === 0) prevPedidosLlevarRef.current = pedidosLlevar;
      return;
    }
    if (prevPedidosLlevarRef.current.length > 0) {
      pedidosLlevar.forEach(p => {
        const ant = prevPedidosLlevarRef.current.find(prev => prev.pedidoId === p.pedidoId);
        if (ant && ant.estado === 'Cocina' && p.estado === 'Servido') {
          playChimeNotification();
          const toastId = Date.now() + Math.random();
          setToasts(prev => [...prev, { id: toastId, mensaje: `🛎️ ¡Pedido "${p.codigoPedidosYa}" está LISTO para entregar!` }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 9000);
        }
      });
    }
    prevPedidosLlevarRef.current = pedidosLlevar;
  }, [pedidosLlevar]);

  const mesasPendientes = mesas.filter(m => m.estado !== 'Libre' && m.pedidoData);

  const numeroALetras = (num) => {
    const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
    const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
    const especiales = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
    const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

    let entero = Math.floor(num);
    let decimales = Math.round((num - entero) * 100);
    let decimalStr = decimales < 10 ? "0" + decimales : decimales;

    if (entero === 0) return "CERO CON " + decimalStr + "/100 SOLES";
    if (entero === 100) return "CIEN CON " + decimalStr + "/100 SOLES";

    let letras = "";

    if (entero >= 100) {
      let c = Math.floor(entero / 100);
      letras += centenas[c] + " ";
      entero %= 100;
    }

    if (entero >= 10 && entero <= 19) {
      letras += especiales[entero - 10] + " ";
    } else if (entero >= 20 || entero > 0) {
      let d = Math.floor(entero / 10);
      let u = entero % 10;
      if (d > 0) {
        letras += decenas[d];
        if (u > 0) letras += " Y ";
      }
      if (u > 0) {
        letras += unidades[u];
      }
      letras += " ";
    }

    return letras.trim() + " CON " + decimalStr + "/100 SOLES";
  };

  const handleDocumentoChange = (val) => {
    setNumDocumento(val);
    const cleaned = val.trim();
    if (cleaned === '20613857321') {
      setClienteNombre('FIRST FISH S.A.C.');
      setClienteDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setTipoComprobante('Factura');
    } else if (cleaned === '10404040404') {
      setClienteNombre('JUAN PEREZ SOTO');
      setClienteDireccion('CALLE SAN MARTÍN 109');
      setTipoComprobante('Boleta');
    }
  };

  const buscarCliente = async () => {
    if (!numDocumento) return;
    setIsBuscando(true);
    const doc = numDocumento.trim();
    
    // Fallbacks locales rápidos de prueba en desarrollo
    if (doc === '20613857321') {
      setClienteNombre('FIRST FISH S.A.C.');
      setClienteDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setTipoComprobante('Factura');
      setIsBuscando(false);
      return;
    } else if (doc === '10404040404') {
      setClienteNombre('JUAN PEREZ SOTO');
      setClienteDireccion('CALLE SAN MARTÍN 109');
      setTipoComprobante('Boleta');
      setIsBuscando(false);
      return;
    }

    try {
      const data = await api.consultarCliente(doc);
      const isRUC = doc.length === 11;
      if (isRUC) {
        setClienteNombre(data.razonSocial || '');
        setClienteDireccion(data.direccion || '');
        setTipoComprobante('Factura');
      } else {
        setClienteNombre(data.nombre || '');
        setClienteDireccion(data.direccion || '');
        setTipoComprobante('Boleta');
      }
    } catch (err) {
      console.error("Error consultando API de DNI/RUC:", err);
      // Mantener campos vacíos en caso de error para permitir escritura manual limpia
      setClienteNombre('');
      setClienteDireccion('');
    }
 finally {
      setIsBuscando(false);
    }
  };

  const buscarClienteDelivery = async () => {
    if (!deliveryNumDocumento) return;
    setIsBuscando(true);
    const doc = deliveryNumDocumento.trim();
    
    if (doc === '20613857321') {
      setDeliveryClienteNombre('FIRST FISH S.A.C.');
      setDeliveryDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setIsBuscando(false);
      return;
    } else if (doc === '10404040404') {
      setDeliveryClienteNombre('JUAN PEREZ SOTO');
      setDeliveryDireccion('CALLE SAN MARTÍN 109');
      setIsBuscando(false);
      return;
    }

    try {
      const data = await api.consultarCliente(doc);
      const isRUC = doc.length === 11;
      if (isRUC) {
        setDeliveryClienteNombre(data.razonSocial || '');
        setDeliveryDireccion(data.direccion || '');
      } else {
        setDeliveryClienteNombre(data.nombre || '');
        if (data.direccion) setDeliveryDireccion(data.direccion);
      }
    } catch (err) {
      console.error("Error consultando API de DNI/RUC en delivery:", err);
      alert("No se encontró el cliente o error en la consulta.");
    } finally {
      setIsBuscando(false);
    }
  };


  const reimprimirComprobante = (v) => {
    if (!v) return;
    const rucEmpresa = "R.U.C. N° 10710311191";
    
    let serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : (v.tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
    let correlativoStr = String(v.numero || (v.id % 10000)).padStart(4, '0');
    let qrData = `${rucEmpresa}|${v.tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${v.igv.toFixed(2)}|${v.total.toFixed(2)}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':(v.numDocumento?.length === 8 ? '1' : '0')}|${v.numDocumento || '00000000'}`;
    let hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    let enlacePdf = null;
    let contingencia = v.estadoNubefact === 'PENDIENTE_REINTENTO';


    if (v.estadoNubefact && v.estadoNubefact.startsWith('ACEPTADO:')) {
      try {
        const responseData = JSON.parse(v.estadoNubefact.substring(9));
        serie = responseData.serie || serie;
        correlativoStr = String(responseData.numero || correlativoStr).padStart(4, '0');
        if (responseData.cadena_para_codigo_qr) {
          qrData = responseData.cadena_para_codigo_qr;
        }
        if (responseData.key) {
          hashResumen = responseData.key;
        }
        enlacePdf = responseData.enlace_del_pdf || null;
      } catch (err) {
        console.error("Error parsing Nubefact response:", err);
      }
    }

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrData)}`;
    const totalLetras = numeroALetras(v.total);

    // Reconstruir items si vienen del backend o parsear de itemsResumen
    let items = v.items || [];
    if (items.length === 0 && v.itemsResumen) {
      items = v.itemsResumen.split(', ').map(str => {
        const match = str.match(/^(\d+)x\s+(.+)$/);
        if (match) {
          const cant = parseInt(match[1]);
          const nombre = match[2];
          const precio = v.total / cant; // fallback estimate
          return { cant, nombre, precio };
        }
        return { cant: 1, nombre: str, precio: v.total };
      });
    }

    const parsedDelivery = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
    const cleanDoc = (() => {
      if (v.numDocumento && v.numDocumento.startsWith('DELIVERY -')) return 'S/D';
      return v.numDocumento || 'S/D';
    })();
    const cleanNombre = (() => {
      if (parsedDelivery) return parsedDelivery.nombre;
      if (v.nombreCliente && v.nombreCliente.startsWith('DELIVERY -')) {
        return v.nombreCliente.replace('DELIVERY - ', '');
      }
      return v.nombreCliente || 'Consumidor Final';
    })();

    // Sumar items y agregar servicio de delivery si hay descuadre
    const sumItems = items.reduce((s, i) => s + (i.cant * i.precio), 0);
    const diff = v.total - sumItems;
    if (diff > 0.05 && (v.codigoPedidosYa?.startsWith('DELIVERY -') || v.nombreCliente?.startsWith('DELIVERY -'))) {
      items = [...items, { cant: 1, nombre: 'Servicio de Delivery', precio: diff }];
    }

    setActiveComprobante({
      tipo: v.tipoComprobante,
      serie,
      correlativo: correlativoStr,
      fecha: v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE'),
      hora: v.hora,
      mesaNum: v.mesaNum || (parsedDelivery ? 'Delivery' : 'Llevar'),
      clienteNombre: cleanNombre,
      clienteDoc: cleanDoc,
      clienteDireccion: parsedDelivery ? parsedDelivery.direccion : (v.clienteDireccion || ''),
      items,
      subtotal: v.subtotal,
      igv: v.igv,
      total: v.total,
      descuentoAplicado: v.descuentoAplicado || 0,
      ofertaDescripcion: v.ofertaDescripcion || null,
      totalLetras,
      hashResumen,
      metodoPago: v.metodoPago,
      montoEfectivo: v.montoEfectivo || 0,
      montoTarjeta: v.montoTarjeta || 0,
      montoYape: v.montoYape || 0,
      qrImageUrl,
      enlacePdf,
      contingencia,
      deliveryInfo: parsedDelivery,
      shouldAutoPrint: true,
    });

    setSunatModalOpen(true);
  };



  const enviarPorWhatsApp = (v) => {
    if (!v) return;
    const telefono = prompt("Ingresa el número de WhatsApp del cliente (Ej. 999888777):");
    if (!telefono) return;
    
    // Validar formato básico peruano (9 dígitos)
    const cleanedPhone = telefono.replace(/\D/g, '');
    if (cleanedPhone.length !== 9) {
      alert("Por favor, ingresa un número de celular válido de 9 dígitos.");
      return;
    }
    
    let serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    let correlativoStr = String(v.id % 10000).padStart(4, '0');
    let enlace = 'https://www.sunat.gob.pe';

    if (v.estadoNubefact && v.estadoNubefact.startsWith('ACEPTADO:')) {
      try {
        const responseData = JSON.parse(v.estadoNubefact.substring(9));
        serie = responseData.serie || serie;
        correlativoStr = String(responseData.numero || correlativoStr).padStart(4, '0');
        enlace = responseData.enlace_del_pdf || responseData.enlace || enlace;
      } catch (err) {
        console.error("Error parsing Nubefact response for WhatsApp:", err);
      }
    }
    
    const mensaje = `Estimado cliente *${v.nombreCliente || 'Consumidor Final'}*, le hacemos entrega de su comprobante electrónico *${v.tipoComprobante === 'Factura' ? 'FACTURA' : 'BOLETA'} ${serie}-${correlativoStr}* por un monto total de *S/ ${v.total.toFixed(2)}*.\n\nPuede consultar y descargar su documento oficial desde aquí:\n${enlace}\n\n¡Gracias por su preferencia en *Pollería El Fogón Dorado*!`;
    
    const waURL = `https://api.whatsapp.com/send?phone=51${cleanedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(waURL, '_blank');
  };






  const handleComprobanteChange = (val) => {
    setTipoComprobante(val);
    setNumDocumento('');
    setClienteNombre('');
    setClienteDireccion('');
  };

  const procesarCobroYFacturar = async () => {
    if (cobrando) return;
    if (!mesaSeleccionada || !mesaSeleccionada.pedidoData) return;
    if (tipoComprobante === 'Factura') {
      if (!numDocumento || numDocumento.trim().length !== 11) {
        alert('Para emitir Factura, el RUC debe tener 11 dígitos.');
        return;
      }
      if (!clienteNombre || !clienteNombre.trim()) {
        alert('Por favor, busca y valida el RUC del cliente antes de cobrar.');
        return;
      }
      if (!clienteDireccion || !clienteDireccion.trim()) {
        alert('La Dirección fiscal del cliente es obligatoria para emitir una Factura. Por favor, ingrésala.');
        return;
      }
    }

    const items = mesaSeleccionada.pedidoData.items || [];
    const itemsNormales = items.filter(i => !cortesiaItemIds.includes(i.itemId));
    const total = itemsNormales.reduce((s, i) => s + (i.cant * i.precio), 0);
    const tieneCortesiasIndividuales = cortesiaItemIds.length > 0;

    // Si es Consumo o Cortesía (total o individual), requerir PIN de supervisor/cajero en el modal
    if (metodoPago === 'Consumo' || metodoPago === 'Cortesía' || tieneCortesiasIndividuales) {
      if (!consumoPin.trim()) {
        setConsumoPinError(`El PIN es requerido para autorizar la Cortesía / Consumo.`);
        return;
      }
      
      try {
        const auth = await api.validateAuth(consumoPin.trim());
        if (auth.error) throw new Error(auth.error);
      } catch (err) {
        setConsumoPinError("PIN de autorización incorrecto o no autorizado.");
        return;
      }
    }

    if (metodoPago === 'Crédito') {
      if (!clienteCreditoSeleccionado) {
        alert('Debe seleccionar un cliente con línea de crédito para continuar.');
        return;
      }
    }

    // Validar y calcular montos
    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    let finalMontoCredito = 0;
    let finalCreditosDetalle = [];
    let finalClienteCreditoId = null;

    if (metodoPago === 'Efectivo') {
      finalMontoEfectivo = total;
    } else if (metodoPago === 'Tarjeta') {
      finalMontoTarjeta = total;
    } else if (metodoPago === 'Yape') {
      finalMontoYape = total;
    } else if (metodoPago === 'Mixto') {
      const efecVal = parseMonto(mixtoEfectivo);
      const tarjVal = parseMonto(mixtoTarjeta);
      const yapeVal = parseMonto(mixtoYape);
      
      let credVal = 0;
      if (incluirCreditoMixto) {
        const validos = (clientesCreditoMixto || []).filter(c => c.clienteId && parseMonto(c.monto) > 0);
        if (validos.length === 0) {
          alert('⚠️ Has marcado la opción de incluir crédito en Pago Mixto. Debes seleccionar al menos un cliente de crédito e ingresar su monto.');
          return;
        }

        credVal = validos.reduce((s, c) => s + parseMonto(c.monto), 0);
        finalCreditosDetalle = validos.map(c => {
          const found = clientes.find(cli => String(cli.id) === String(c.clienteId));
          return {
            clienteId: parseInt(c.clienteId),
            nombre: found?.nombre || c.nombre || '',
            monto: parseMonto(c.monto)
          };
        });
        finalClienteCreditoId = finalCreditosDetalle[0].clienteId;
      }

      if (tarjVal + yapeVal + credVal > (total + 0.01)) {
        alert('⚠️ La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar. El vuelto solo aplica sobre Efectivo.');
        return;
      }

      const restante = Math.max(0, total - (tarjVal + yapeVal + credVal));
      if (efecVal < (restante - 0.01)) {
        const faltante = Math.max(0, total - (efecVal + tarjVal + yapeVal + credVal));
        alert(`⚠️ Monto insuficiente. Debes cubrir el total de S/ ${total.toFixed(2)}.\nFaltan S/ ${faltante.toFixed(2)}`);
        return;
      }

      finalMontoEfectivo = restante;
      finalMontoTarjeta = tarjVal;
      finalMontoYape = yapeVal;
      finalMontoCredito = credVal;
    } else if (metodoPago === 'Crédito') {
      finalCreditosDetalle = [{
        clienteId: clienteCreditoSeleccionado.id,
        nombre: clienteCreditoSeleccionado.nombre,
        monto: total
      }];
      finalClienteCreditoId = clienteCreditoSeleccionado.id;
      finalMontoCredito = total;
    }

    const pagaConNum = parseMonto(pagaConEfectivoMesa) || total;
    const vueltoNum = metodoPago === 'Efectivo' && pagaConNum > total ? (pagaConNum - total) : 0;

    // Guardar los datos preparados para la confirmación
    setDatosConfirmacionCobro({
      mesaNum: mesaSeleccionada.num,
      esDelivery: mesaSeleccionada.num === 'DELIVERY',
      tipoComprobante,
      nombreCliente: clienteNombre || 'PÚBLICO GENERAL',
      numDocumento: numDocumento || null,
      clienteDireccion: clienteDireccion || '',
      metodoPago,
      total,
      pagaCon: pagaConNum,
      vuelto: vueltoNum,
      finalMontoEfectivo,
      finalMontoTarjeta,
      finalMontoYape,
      finalMontoCredito,
      finalClienteCreditoId,
      finalCreditosDetalle,
      cortesiaItemIds,
      itemsParaImpresion: items,
      payload: {
        pedidoIds: mesaSeleccionada.pedidoData.pedidoIds,
        tipoComprobante,
        numDocumento: numDocumento || null,
        nombreCliente: clienteNombre || 'PÚBLICO GENERAL',
        total,
        metodoPago,
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape,
        montoCredito: finalMontoCredito,
        clienteCreditoId: finalClienteCreditoId,
        creditosDetalle: finalCreditosDetalle,
        clienteDireccion: clienteDireccion || '',
        cortesiaItemIds: cortesiaItemIds
      }
    });

    // Abrir modal de confirmación antes de ejecutar la transacción
    setModalConfirmarCobro(true);
  };

  const ejecutarCobroFinal = async () => {
    if (cobrando || !datosConfirmacionCobro) return;
    setCobrando(true);
    try {
      const { payload, total, itemsParaImpresion, mesaNum, tipoComprobante: tComp, numDocumento: nDoc, nombreCliente: nomCli, clienteDireccion: dirCli, metodoPago: mPago } = datosConfirmacionCobro;

      const response = await api.cobrar(payload);

      setModalConfirmarCobro(false);
      setDatosConfirmacionCobro(null);
      setPagaConEfectivoMesa('');
      setModalOpen(false);
      setNumDocumento('');
      setClienteNombre('');
      setClienteDireccion('');
      setConsumoPin('');
      setConsumoPinError('');
      setMixtoEfectivo('');
      setMixtoTarjeta('');
      setMixtoYape('');
      setMontoCreditoMixto('');
      setClienteCreditoSeleccionado(null);
      setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
      setIncluirCreditoMixto(false);
      setCortesiaItemIds([]);

      // Desencadenar la visualización e impresión del comprobante (solo si no es Consumo Personal)
      if (mPago !== 'Consumo') {
        const itemsCortesiaDescuento = (itemsParaImpresion || [])
          .filter(item => payload.cortesiaItemIds?.includes(item.itemId))
          .reduce((sum, item) => sum + (parseFloat(item.precio || 0) * parseInt(item.cant || 1)), 0);

        const itemsFormat = (itemsParaImpresion || []).map(item => {
          if (payload.cortesiaItemIds?.includes(item.itemId)) {
            return {
              ...item,
              precio: 0,
              notas: item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]'
            };
          }
          return item;
        });

        abrirTicketImpresionDirecto(
          total,
          response,
          tComp,
          nDoc || null,
          nomCli || 'Consumidor Final',
          dirCli || '',
          itemsFormat,
          mesaNum,
          null,
          itemsCortesiaDescuento,
          itemsCortesiaDescuento > 0 ? 'Cortesía de ítems' : (mPago === 'Cortesía' ? 'Cortesía total' : null)
        );
      } else {
        alert(`✅ Consumo Personal registrado. Mesa liberada.`);
      }

      await fetchCajaData();
    } catch (err) {
      alert('Error al procesar cobro: ' + err.message);
    } finally {
      setCobrando(false);
    }
  };




  const confirmarEntregaDelivery = async (pedidoId, codigo) => {
    if (!confirm(`¿Confirmas la entrega del pedido ${codigo}?`)) return;
    try {
      await api.confirmarEntrega(pedidoId);
      await fetchCajaData();
      alert(`✅ Entrega del pedido ${codigo} confirmada.`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // --- Cambiar método de pago de una venta existente ---
  const handleCambiarMetodoPago = async () => {
    if (!cambioPin.trim()) { setCambioError('Ingresa el PIN de Administrador.'); return; }
    if (!cambioNuevoMetodo) { setCambioError('Selecciona el nuevo método de pago.'); return; }
    
    let finalMontoEfectivo = 0;
    let finalMontoTarjeta = 0;
    let finalMontoYape = 0;
    const total = ventaACambiar.total;

    if (cambioNuevoMetodo === 'Mixto') {
      const efecVal = parseFloat(cambioMixtoEfectivo || 0);
      const tarjVal = parseFloat(cambioMixtoTarjeta || 0);
      const yapeVal = parseFloat(cambioMixtoYape || 0);

      if (efecVal < 0 || tarjVal < 0 || yapeVal < 0) {
        setCambioError('Los montos de pago no pueden ser valores negativos.');
        return;
      }

      if (tarjVal + yapeVal > total) {
        setCambioError('La suma de Tarjeta y Yape / Plin no puede superar el total a pagar.');
        return;
      }

      const restante = total - (tarjVal + yapeVal);
      if (efecVal < restante) {
        setCambioError(`Monto insuficiente. Debes cubrir el total de S/ ${total.toFixed(2)}. Faltan S/ ${(restante - efecVal).toFixed(2)}`);
        return;
      }

      finalMontoEfectivo = restante;
      finalMontoTarjeta = tarjVal;
      finalMontoYape = yapeVal;
    }

    setCambiando(true);
    setCambioError('');
    try {
      const res = await api.cambiarMetodoPago(ventaACambiar.id, cambioNuevoMetodo, cambioPin.trim(), {
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape
      });
      if (res.error) { setCambioError(res.error); return; }
      // Actualizar el estado local de ventas sin recargar
      setVentas(prev => prev.map(v => v.id === ventaACambiar.id ? { 
        ...v, 
        metodoPago: cambioNuevoMetodo,
        montoEfectivo: finalMontoEfectivo,
        montoTarjeta: finalMontoTarjeta,
        montoYape: finalMontoYape 
      } : v));
      setCambioMetodoModal(false);
      setVentaACambiar(null);
      setCambioPin('');
      setCambioNuevoMetodo('Efectivo');
      setCambioMixtoEfectivo('');
      setCambioMixtoTarjeta('');
      setCambioMixtoYape('');
      await fetchCajaData();
    } catch (err) {
      setCambioError('Error de conexión: ' + err.message);
    } finally {
      setCambiando(false);
    }
  };

  // --- Cambiar tipo de entrega de una venta existente ---
  const abrirCambioTipoEntregaModal = (v) => {
    setVentaATipoCambiar(v);
    setCambioTipoPin('');
    setCambioTipoError('');
    
    let currentType = 'ParaLlevar';
    let currentCodePY = '';
    let currentName = '';
    let currentPhone = '';
    let currentDir = '';
    let currentFee = '';
    let currentPayWith = '';
    let currentMethod = v.metodoPago || 'Efectivo';

    if (v.codigoPedidosYa) {
      if (v.codigoPedidosYa.startsWith('DELIVERY -')) {
        currentType = 'DeliveryPropio';
        const parsed = parseDeliveryInfo(v.codigoPedidosYa);
        if (parsed) {
          currentName = parsed.nombre;
          currentPhone = parsed.telefono;
          currentDir = parsed.direccion;
          currentFee = parsed.montoDelivery || '';
          currentPayWith = parsed.conCuanto || '';
        }
      } else if (v.codigoPedidosYa.startsWith('LLEVAR -')) {
        currentType = 'ParaLlevar';
        currentName = v.codigoPedidosYa.replace('LLEVAR - ', '');
      } else {
        currentType = 'PedidosYa';
        currentCodePY = v.codigoPedidosYa;
        currentName = 'PEDIDOS YA';
        currentMethod = 'PedidosYa';
      }
    }

    setCambioNuevoTipo(currentType);
    setCambioCodigoPY(currentCodePY);
    setCambioNombreCliente(currentName);
    setCambioTelefono(currentPhone);
    setCambioDireccion(currentDir);
    setCambioMontoDelivery(currentFee);
    setCambioMontoConCuanto(currentPayWith);
    setCambioMetodoPago(currentMethod === 'PedidosYa' ? 'Efectivo' : currentMethod);
    setCambioTipoEntregaModal(true);
  };

  const handleCambiarTipoEntrega = async () => {
    if (!cambioTipoPin.trim()) { setCambioTipoError('Ingresa el PIN de Administrador.'); return; }
    
    if (cambioNuevoTipo === 'PedidosYa' && !cambioCodigoPY.trim()) {
      setCambioTipoError('Ingresa el Código de PedidosYa.');
      return;
    }
    if ((cambioNuevoTipo === 'ParaLlevar' || cambioNuevoTipo === 'DeliveryPropio') && !cambioNombreCliente.trim()) {
      setCambioTipoError('Ingresa el nombre del cliente.');
      return;
    }
    if (cambioNuevoTipo === 'DeliveryPropio' && !cambioDireccion.trim()) {
      setCambioTipoError('Ingresa la dirección de envío.');
      return;
    }

    setCambioTipoCambiando(true);
    setCambioTipoError('');

    try {
      const res = await api.cambiarTipoEntrega(ventaATipoCambiar.id, {
        tipoEntrega: cambioNuevoTipo,
        codigoPedidosYa: cambioCodigoPY.trim(),
        nombreCliente: cambioNombreCliente.trim(),
        telefono: cambioTelefono.trim(),
        direccion: cambioDireccion.trim(),
        montoDelivery: parseFloat(cambioMontoDelivery || 0),
        montoConCuanto: parseFloat(cambioMontoConCuanto || 0),
        metodoPago: cambioMetodoPago,
        pin: cambioTipoPin.trim()
      });

      if (res.error) {
        setCambioTipoError(res.error);
        return;
      }

      await fetchCajaData();
      setCambioTipoEntregaModal(false);
      setVentaATipoCambiar(null);
      setCambioTipoPin('');
      alert('✅ Tipo de entrega corregido exitosamente.');
    } catch (err) {
      setCambioTipoError('Error de conexión: ' + err.message);
    } finally {
      setCambioTipoCambiando(false);
    }
  };

  // --- Corregir Datos de Cliente / Facturación en Historial ---
  const abrirModalEditarClienteVenta = (v) => {
    setEditClienteVenta(v);
    setEditClienteTipoComprobante(v.tipoComprobante || 'Ticket');
    setEditClienteNumDoc(v.numDocumento || '');
    setEditClienteNombre(v.nombreCliente || '');
    setEditClienteDireccion(v.clienteDireccion || '');
    setEditClientePin('');
    setEditClienteError('');
    setEditClienteCargando(false);
  };

  const buscarClienteEdicion = async () => {
    if (!editClienteNumDoc) return;
    setIsBuscando(true);
    setEditClienteError('');
    const doc = editClienteNumDoc.trim();
    
    // Fallbacks locales rápidos de prueba en desarrollo
    if (doc === '20613857321') {
      setEditClienteNombre('FIRST FISH S.A.C.');
      setEditClienteDireccion('LT. 05 DPTO. LIMA MZ. J COOP. CAJABAMBA - LIMA LIMA LOS OLIVOS');
      setEditClienteTipoComprobante('Factura');
      setIsBuscando(false);
      return;
    } else if (doc === '10404040404') {
      setEditClienteNombre('JUAN PEREZ SOTO');
      setEditClienteDireccion('CALLE SAN MARTÍN 109');
      setEditClienteTipoComprobante('Boleta');
      setIsBuscando(false);
      return;
    }

    try {
      const data = await api.consultarCliente(doc);
      const isRUC = doc.length === 11;
      if (isRUC) {
        setEditClienteNombre(data.razonSocial || '');
        setEditClienteDireccion(data.direccion || '');
        setEditClienteTipoComprobante('Factura');
      } else {
        setEditClienteNombre(data.nombre || '');
        setEditClienteDireccion(data.direccion || '');
        setEditClienteTipoComprobante('Boleta');
      }
    } catch (err) {
      console.error("Error consultando API de DNI/RUC en edición:", err);
      setEditClienteError('No se encontró el documento en SUNAT/RENIEC.');
    } finally {
      setIsBuscando(false);
    }
  };

  const handleGuardarClienteVenta = async () => {
    if (!editClientePin.trim()) {
      setEditClienteError('Ingresa el PIN de Administrador.');
      return;
    }

    if (editClienteTipoComprobante === 'Factura') {
      if (!editClienteNumDoc || editClienteNumDoc.trim().length !== 11) {
        setEditClienteError('Para Factura, el RUC debe tener 11 dígitos.');
        return;
      }
      if (!editClienteNombre || !editClienteNombre.trim()) {
        setEditClienteError('La Razón Social del cliente es obligatoria.');
        return;
      }
      if (!editClienteDireccion || !editClienteDireccion.trim()) {
        setEditClienteError('La Dirección fiscal del cliente es obligatoria.');
        return;
      }
    }

    setEditClienteCargando(true);
    setEditClienteError('');

    try {
      const res = await api.actualizarClienteVenta(editClienteVenta.id, {
        tipoComprobante: editClienteTipoComprobante,
        numDocumento: editClienteNumDoc.trim() || null,
        nombreCliente: editClienteNombre.trim() || null,
        clienteDireccion: editClienteDireccion.trim() || null,
        pin: editClientePin.trim()
      });

      if (res.error) {
        setEditClienteError(res.error);
        return;
      }

      await fetchCajaData();
      setEditClienteVenta(null);
      setEditClientePin('');
      alert('✅ Datos de facturación del cliente actualizados correctamente.');
    } catch (err) {
      setEditClienteError('Error al guardar datos: ' + err.message);
    } finally {
      setEditClienteCargando(false);
    }
  };

  const reintentarVentaIndividual = async (ventaId) => {
    try {
      const res = await api.reintentarNubefact(ventaId);
      if (res.error) {
        alert(`❌ Error al enviar a SUNAT: ${res.error}`);
        return;
      }
      await fetchCajaData();
      alert(`✅ Comprobante enviado y aceptado por SUNAT.`);
    } catch (err) {
      alert(`❌ Error al conectar con el servidor: ${err.message}`);
    }
  };

  const abrirAnularVentaModal = (v) => {
    setVentaAAnular(v);
    setAnularPin('');
    setAnularMotivo('');
    setAnularError('');
    setAnularCargando(false);
    setAnularVentaModal(true);
  };

  const procesarAnulacionVenta = async () => {
    if (!anularPin) {
      setAnularError('Por favor ingresa el PIN de Administrador.');
      return;
    }
    if (!anularMotivo.trim()) {
      setAnularError('Por favor ingresa el motivo de la devolución / anulación.');
      return;
    }
    setAnularCargando(true);
    setAnularError('');
    try {
      const res = await api.anularVenta(ventaAAnular.id, anularPin, anularMotivo);
      if (res.error) {
        setAnularError(res.error);
        return;
      }
      setAnularVentaModal(false);
      setVentaAAnular(null);
      setAnularPin('');
      setAnularMotivo('');
      await fetchCajaData();
      alert('✅ Devolución / Anulación registrada con éxito. La venta ha sido ajustada a S/ 0.00 en caja.');
    } catch (err) {
      setAnularError('Error al procesar devolución: ' + err.message);
    } finally {
      setAnularCargando(false);
    }
  };

  // --- Modal PedidosYa ---
  const abrirDeliveryModal = async () => {
    if (productosMenu.length === 0) {
      const prods = await api.getProductos();
      setProductosMenu(prods);
    }
    setEditingPedidoId(null);
    setItemsDelivery([]);
    setCodigoPY('');
    setDeliverySearchQuery('');
    setDeliveryTelefono('');
    setDeliveryDireccion('');
    setDeliveryMontoEnvio('');
    setDeliveryConCuanto('');
    setDeliveryTipoComprobante('Ticket');
    setDeliveryMetodoPago('Efectivo');
    setDeliveryClienteNombre('');
    setDeliveryNumDocumento('');
    setTipoDelivery('PedidosYa');
    setPinAdminDelivery('');
    setCortesiaDeliveryIndices([]);
    setDeliveryModal(true);
  };

  const iniciarModificarDelivery = async (p) => {
    if (productosMenu.length === 0) {
      const prods = await api.getProductos();
      setProductosMenu(prods);
    }
    setEditingPedidoId(p.pedidoId);
    setItemsDelivery(p.items || []);
    setDeliverySearchQuery('');
    
    // Identificar el tipo de delivery
    let calculatedTipo = 'PedidosYa';
    let codePY = p.codigoPedidosYa || '';
    if (p.codigoPedidosYa?.startsWith('DELIVERY -')) {
      calculatedTipo = 'DeliveryPropio';
    } else if (p.codigoPedidosYa?.startsWith('LLEVAR -')) {
      calculatedTipo = 'ParaLlevar';
    }
    setTipoDelivery(calculatedTipo);

    // Poblar campos según tipo
    if (calculatedTipo === 'DeliveryPropio') {
      const parsed = parseDeliveryInfo(p.codigoPedidosYa);
      if (parsed) {
        setDeliveryClienteNombre(parsed.nombre);
        setDeliveryTelefono(parsed.telefono);
        setDeliveryDireccion(parsed.direccion);
        setDeliveryConCuanto(parsed.conCuanto || '');
      } else {
        setDeliveryClienteNombre(p.codigoPedidosYa.replace('DELIVERY - ', ''));
        setDeliveryTelefono('');
        setDeliveryDireccion('');
        setDeliveryConCuanto('');
      }
      setCodigoPY('');
    } else if (calculatedTipo === 'ParaLlevar') {
      setCodigoPY(p.codigoPedidosYa.replace('LLEVAR - ', ''));
      setDeliveryClienteNombre(p.codigoPedidosYa.replace('LLEVAR - ', ''));
      setDeliveryTelefono('');
      setDeliveryDireccion('');
      setDeliveryConCuanto('');
    } else {
      setCodigoPY(codePY);
      setDeliveryClienteNombre('PEDIDOS YA');
      setDeliveryTelefono('');
      setDeliveryDireccion('');
      setDeliveryConCuanto('');
    }

    // Costo de delivery
    const itemsTotal = (p.items || []).reduce((s, i) => s + i.cant * i.precio, 0);
    const shippingFee = Math.max(0, p.total - itemsTotal);
    setDeliveryMontoEnvio(shippingFee > 0 ? String(shippingFee) : '');

    // Métodos de pago y comprobantes
    if (p.ventaData) {
      setDeliveryTipoComprobante(p.ventaData.tipoComprobante || 'Ticket');
      setDeliveryMetodoPago(p.ventaData.metodoPago || 'Efectivo');
      setDeliveryNumDocumento(p.ventaData.numDocumento || '');
      if (p.ventaData.metodoPago === 'Mixto') {
        setDeliveryMixtoEfectivo(p.ventaData.montoEfectivo ? String(p.ventaData.montoEfectivo) : '');
        setDeliveryMixtoTarjeta(p.ventaData.montoTarjeta ? String(p.ventaData.montoTarjeta) : '');
        setDeliveryMixtoYape(p.ventaData.montoYape ? String(p.ventaData.montoYape) : '');
      } else {
        setDeliveryMixtoEfectivo('');
        setDeliveryMixtoTarjeta('');
        setDeliveryMixtoYape('');
      }
    } else {
      setDeliveryTipoComprobante('Ticket');
      setDeliveryMetodoPago(calculatedTipo === 'PedidosYa' ? 'PedidosYa' : 'Efectivo');
      setDeliveryNumDocumento('');
      setDeliveryMixtoEfectivo('');
      setDeliveryMixtoTarjeta('');
      setDeliveryMixtoYape('');
    }

    setPinAdminDelivery('');
    setCortesiaDeliveryIndices([]);
    setDeliveryModal(true);
  };

  const getProductSteps = (prod, currentSelections = {}) => {
    const steps = getProductStepsBase(prod, currentSelections);
    const nameNorm = (prod && prod.nombre || '').toLowerCase();
    const isCuartoOOctavo = 
      nameNorm.includes('1/4') || nameNorm.includes('cuarto') || 
      nameNorm.includes('1/8') || nameNorm.includes('octavo');

    if (prod && prod.requiereGuarnicion && !isCuartoOOctavo) {
      steps.push({
        name: "Cantidad de Ensaladas",
        key: "cantidad_ensaladas",
        options: [
          { label: "Sin Ensalada", value: "Sin Ensalada" },
          { label: "1 Ensalada", value: "1 Ensalada" },
          { label: "2 Ensaladas", value: "2 Ensaladas" },
          { label: "3 Ensaladas", value: "3 Ensaladas" },
          { label: "4 Ensaladas", value: "4 Ensaladas" },
          { label: "5 Ensaladas", value: "5 Ensaladas" },
          { label: "6 Ensaladas", value: "6 Ensaladas" },
          { label: "7 Ensaladas", value: "7 Ensaladas" },
          { label: "8 Ensaladas", value: "8 Ensaladas" },
          { label: "9 Ensaladas", value: "9 Ensaladas" },
          { label: "10 Ensaladas", value: "10 Ensaladas" }
        ]
      });
    }
    return steps;
  };

  const getProductStepsBase = (prod, currentSelections = {}) => {
    if (!prod) return [];
    
    // 1. Variantes de Tallarines Verdes
    if (prod.esAgrupado) {
      const todasLasVariantes = productosMenu.filter(p => p.categoria === 'Tallarines Verdes' && p.activo);
      return [{
        name: "Elige la Variante de Carne",
        key: "producto_variante",
        options: todasLasVariantes.map(v => ({
          label: `${v.nombre.replace('Tallarines Verdes con ', 'Con ').replace('Tallarines Verdes Con ', 'Con ')} (S/ ${v.precio.toFixed(2)})`,
          value: v
        }))
      }];
    }

    // 2. Nueva categoría Menú
    if (prod.categoria === 'Menú') {
      return [
        {
          name: "Elige la Guarnición",
          key: "guarnicion_menu",
          options: [
            { label: "Papa Frita", value: "Papa Frita" },
            { label: "Papa Sancochada", value: "Papa Sancochada" },
            { label: "Menestra", value: "Menestra" },
            { label: "Omitir (Sin Guarnición)", value: "Sin Guarnición" }
          ]
        },
        {
          name: "Elige la Entrada",
          key: "entrada_menu",
          options: [
            { label: "Sopa", value: "Sopa" },
            { label: "Ensalada", value: "Ensalada" },
            { label: "Omitir (Sin Entrada)", value: "Sin Entrada" }
          ]
        },
        {
          name: "Elige la Bebida",
          key: "bebida",
          options: [
            { label: "Chicha Morada - Vaso", value: "Chicha Morada - Vaso" },
            { label: "Limonada - Vaso", value: "Limonada - Vaso" },
            { label: "Gaseosa Chiki", value: "Gaseosa Mediana" },
            { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
          ]
        }
      ];
    }
    
    // 3. Combos configurados
    const combo = getComboConfig(prod.nombre);
    if (combo) {
      const baseSteps = [];
      const config = combo.config;
      const fondoOptions = config.fondoOptions || [];
      
      // Paso 1: Plato de Fondo (primero)
      baseSteps.push({
        name: "Plato de Fondo",
        key: "fondo",
        options: fondoOptions.map(opt => ({ label: opt, value: opt }))
      });
      
      // Si el plato de fondo seleccionado requiere proteína
      const selectedFondo = currentSelections["fondo"];
      if (selectedFondo && selectedFondo.toLowerCase().includes("pollo o carne")) {
        baseSteps.push({
          name: "Elige Proteína",
          key: "proteina",
          options: [
            { label: "Pollo", value: "Pollo" },
            { label: "Carne", value: "Carne" }
          ]
        });
      }
      
      // Paso 2: Entrada (Sopa o Ensalada)
      baseSteps.push({
        name: "Sopa o Ensalada",
        key: "entrada",
        options: ["Sopa", "Ensalada"].map(opt => ({ label: opt, value: opt }))
      });

      // Paso 3: Bebida
      baseSteps.push({
        name: "Elige la Bebida",
        key: "bebida",
        options: [
          { label: "Chicha Morada - Vaso", value: "Chicha Morada - Vaso" },
          { label: "Limonada - Vaso", value: "Limonada - Vaso" },
          { label: "Gaseosa Chiki", value: "Gaseosa Mediana" },
          { label: "Omitir (Sin Bebida)", value: "Sin Bebida" }
        ]
      });
      
      return baseSteps;
    }
    
    // 4. Parrilladas y Piqueos Mix con Opciones de Bebidas
    const prodId = parseInt(prod.id);
    const isParrillaPersonal = prodId === 48 || prodId === 52;
    const isParrilla2P = prodId === 49 || prodId === 53;
    const isParrilla3P = prodId === 50 || prodId === 54;
    const isParrillaFina = prodId === 51 || prodId === 55 || prodId === 56;

    if (isParrillaPersonal) {
      return [
        {
          name: "Elige el Acompañamiento",
          key: "guarnicion",
          options: [
            { label: "Papas Fritas", value: "Papas Fritas" },
            { label: "Arroz", value: "Arroz" },
            { label: "Papa Sancochada", value: "Papa Sancochada" },
            { label: "Choclo Sancochado", value: "Choclo Sancochado" },
            { label: "Ensalada", value: "Ensalada" },
            { label: "Omitir (Sin Acompañamiento)", value: "Sin Acompañamiento" }
          ]
        },
        {
          name: "Elige la Bebida",
          key: "bebida_personal",
          options: [
            { label: "Copa de Vino Tabernero", value: "Vino Tabernero (Copa)" },
            { label: "Vaso de Chicha Morada", value: "Chicha Morada - Vaso" },
            { label: "Gaseosa Chiki", value: "Gaseosa Mediana" }
          ]
        }
      ];
    }

    if (isParrilla2P) {
      return [
        {
          name: "Elige el Acompañamiento",
          key: "guarnicion",
          options: [
            { label: "Papas Fritas", value: "Papas Fritas" },
            { label: "Arroz", value: "Arroz" },
            { label: "Papa Sancochada", value: "Papa Sancochada" },
            { label: "Choclo Sancochado", value: "Choclo Sancochado" },
            { label: "Ensalada", value: "Ensalada" },
            { label: "Omitir (Sin Acompañamiento)", value: "Sin Acompañamiento" }
          ]
        },
        {
          name: "Elige Bebida 1 (Medio Litro)",
          key: "bebida_1",
          options: [
            { label: "Sangría 1/2 Litro", value: "Sangría Española o Hawaiana 1/2 Lt" },
            { label: "Gaseosa 1/2 Litro", value: "Gaseosa 1/2 Lt" },
            { label: "Chicha Morada 1/2 Litro", value: "Chicha Morada - 1/2 Lt" }
          ]
        },
        {
          name: "Elige Bebida 2 (Medio Litro)",
          key: "bebida_2",
          options: [
            { label: "Sangría 1/2 Litro", value: "Sangría Española o Hawaiana 1/2 Lt" },
            { label: "Gaseosa 1/2 Litro", value: "Gaseosa 1/2 Lt" },
            { label: "Chicha Morada 1/2 Litro", value: "Chicha Morada - 1/2 Lt" }
          ]
        }
      ];
    }

    if (isParrilla3P) {
      return [
        {
          name: "Elige el Acompañamiento",
          key: "guarnicion",
          options: [
            { label: "Papas Fritas", value: "Papas Fritas" },
            { label: "Arroz", value: "Arroz" },
            { label: "Papa Sancochada", value: "Papa Sancochada" },
            { label: "Choclo Sancochado", value: "Choclo Sancochado" },
            { label: "Ensalada", value: "Ensalada" },
            { label: "Omitir (Sin Acompañamiento)", value: "Sin Acompañamiento" }
          ]
        },
        {
          name: "Elige la Bebida",
          key: "bebida_familia",
          options: [
            { label: "Vino Tabernero 750 ML", value: "Vino Tabernero (Botella)" },
            { label: "Sangría 1 Litro", value: "Sangría Española o Hawaiana 1 Lt" },
            { label: "Gaseosa 1 Litro", value: "Gaseosa 1 Lt" },
            { label: "Chicha Morada 1 Litro", value: "Chicha Morada - 1 Lt" }
          ]
        }
      ];
    }

    if (isParrillaFina) {
      return [
        {
          name: "Elige el Acompañamiento",
          key: "guarnicion",
          options: [
            { label: "Papas Fritas", value: "Papas Fritas" },
            { label: "Arroz", value: "Arroz" },
            { label: "Papa Sancochada", value: "Papa Sancochada" },
            { label: "Choclo Sancochado", value: "Choclo Sancochado" },
            { label: "Ensalada", value: "Ensalada" },
            { label: "Omitir (Sin Acompañamiento)", value: "Sin Acompañamiento" }
          ]
        },
        {
          name: "Elige la Bebida",
          key: "bebida_familia",
          options: [
            { label: "Vino Tabernero 750 ML", value: "Vino Tabernero (Botella)" },
            { label: "Sangría 1 Litro", value: "Sangría Española o Hawaiana 1 Lt" },
            { label: "Gaseosa 1.5 Litros", value: "Gaseosa 1 1/2 Lt" },
            { label: "Chicha Morada 1.5 Litros", value: "Chicha Morada - 1 1/2 Lt" },
            { label: "Gaseosa 3 Litros", value: "Gaseosa 3 Lt" }
          ]
        }
      ];
    }

    // 4.5. Pollos a la Brasa (Enteros y Medios que no sean "Solo")
    const isPolloEntero = prodId === 1 || prodId === 10 || prodId === 16;
    const isMedioPollo = prodId === 2 || prodId === 11 || prodId === 17;

    if (isPolloEntero) {
      return [];
    }

    if (isMedioPollo) {
      return [];
    }

    // 5. Guarniciones genéricas para carnes y pollos (SIN Pollos a la Brasa)
    const requiereGuarnicion = 
      ['Parrillas y Cortes', 'Parrilladas Mixtas', 'Porciones y Piqueos'].includes(prod.categoria) && 
      !prod.nombre.toLowerCase().includes('solo');
      
    if (requiereGuarnicion) {
      return [{
        name: "Elige el Acompañamiento",
        key: "guarnicion",
        options: [
          { label: "Papas Fritas", value: "Papas Fritas" },
          { label: "Arroz", value: "Arroz" },
          { label: "Papa Sancochada", value: "Papa Sancochada" },
          { label: "Choclo Sancochado", value: "Choclo Sancochado" },
          { label: "Ensalada", value: "Ensalada" },
          { label: "Omitir (Sin Acompañamiento)", value: "Sin Acompañamiento" }
        ]
      }];
    }
    
    return [];
  };

  const agregarItemDelivery = (prod) => {
    const isMenuCategory = prod.categoria === 'Menú';
    const hasComboConfig = !!getComboConfig(prod.nombre);
    const isVirtualGroup = prod.esAgrupado;
    const requiereGuarnicion = 
      ['Parrillas y Cortes', 'Parrilladas Mixtas', 'Porciones y Piqueos'].includes(prod.categoria) && 
      !prod.nombre.toLowerCase().includes('solo');

    const prodId = parseInt(prod.id);
    const isPolloEntero = prodId === 1 || prodId === 10 || prodId === 16;
    const isMedioPollo = prodId === 2 || prodId === 11 || prodId === 17;

    const nameNorm = (prod.nombre || '').toLowerCase();
    const isCuartoOOctavo = 
      nameNorm.includes('1/4') || nameNorm.includes('cuarto') || 
      nameNorm.includes('1/8') || nameNorm.includes('octavo');

    if (hasComboConfig || isVirtualGroup || requiereGuarnicion || isMenuCategory || isPolloEntero || isMedioPollo || (prod.requiereGuarnicion && !isCuartoOOctavo)) {
      setSelectedProduct(prod);
      setSelections({});
      setCurrentStepIdx(0);
      setAdditionalNotes('');
      setOptionsModalOpen(true);
    } else {
      agregarItemDeliveryDirecto(prod, isCuartoOOctavo ? '1 Ensalada' : null);
    }
  };

  const agregarItemDeliveryDirecto = (prod, notas = null) => {
    const idx = itemsDelivery.findIndex(i => i.id === String(prod.id) && i.notas === notas);
    const cantEnTicket = idx >= 0 ? itemsDelivery[idx].cant : 0;
    
    // Validar stock si es limitado
    if (prod.tipoStock === 'limitado' && cantEnTicket >= prod.stock) {
      alert(`⚠️ Stock agotado. Solo quedan ${prod.stock} unidades de "${prod.nombre}".`);
      return;
    }

    const precioFinal = prod.precioOferta !== null && prod.precioOferta !== undefined ? prod.precioOferta : prod.precio;

    if (idx >= 0) {
      const nuevo = [...itemsDelivery];
      nuevo[idx] = { ...nuevo[idx], cant: nuevo[idx].cant + 1 };
      setItemsDelivery(nuevo);
    } else {
      setItemsDelivery([...itemsDelivery, { 
        id: String(prod.id), 
        nombre: prod.nombre, 
        precio: precioFinal, 
        cant: 1,
        ofertaNombre: prod.ofertaNombre,
        precioOriginal: prod.precio,
        notas: notas
      }]);
    }
  };

  const alterarItemDelivery = (idx, op) => {
    const nuevo = [...itemsDelivery];
    if (op === '+') {
      const prodOriginal = productosMenu.find(p => String(p.id) === String(nuevo[idx].id));
      if (prodOriginal && prodOriginal.tipoStock === 'limitado' && nuevo[idx].cant >= prodOriginal.stock) {
        alert(`⚠️ Stock agotado. Solo quedan ${prodOriginal.stock} unidades de "${prodOriginal.nombre}".`);
        return;
      }
      nuevo[idx] = { ...nuevo[idx], cant: nuevo[idx].cant + 1 };
    } else {
      const nuevaCant = nuevo[idx].cant - 1;
      if (nuevaCant <= 0) {
        nuevo.splice(idx, 1);
      } else {
        nuevo[idx] = { ...nuevo[idx], cant: nuevaCant };
      }
    }
    setItemsDelivery(nuevo);
  };

  const alterarNotasDelivery = (idx, value) => {
    const nuevo = [...itemsDelivery];
    nuevo[idx] = { ...nuevo[idx], notas: value };
    setItemsDelivery(nuevo);
  };

  const handleExecuteCancelLlevar = async () => {
    if (!pinCancelLlevar.trim()) {
      setErrorCancelLlevar('El PIN es obligatorio.');
      return;
    }
    try {
      const auth = await api.validateAuth(pinCancelLlevar.trim());
      if (!auth || !auth.ok) {
        setErrorCancelLlevar('PIN incorrecto. Autorización denegada.');
        return;
      }
      const res = await api.cancelarPedido(pedidoACancelarLlevar.pedidoId, {
        canceladoPor: cajeroNombre,
        motivo: 'Cancelado por cajero (error en pedido)',
        force: true,
      });
      if (res.ok) {
        addToast('Pedido cancelado. Cocina ha sido notificada.', 'success');
        setCancelLlevarModalOpen(false);
        setPedidoACancelarLlevar(null);
        fetchCajaData();
      } else {
        setErrorCancelLlevar(res.error || 'No se pudo cancelar el pedido.');
      }
    } catch (err) {
      setErrorCancelLlevar('Error de conexión con el servidor.');
    }
  };

  const abrirTicketImpresionDirecto = (total, response, tipoComprobante, numDocumento, clienteNombre, clienteDireccion, items, mesaNum = 'Delivery', deliveryInfo = null, descuentoAplicado = 0, ofertaDescripcion = null) => {
    if (!response) response = {};
    const fecha = new Date().toLocaleDateString('es-PE');
    const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    
    let serie = response.serie || (tipoComprobante === 'Factura' ? 'F001' : (tipoComprobante === 'Ticket' ? 'T001' : 'B001'));
    let correlativoStr = String(response.numero || 1).padStart(4, '0');
    let subtotal = total / 1.105;
    let igv = total - subtotal;
    let totalLetras = numeroALetras(total);
    let hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    const rucEmpresa = "R.U.C. N° 10710311191";
    let qrData = `${rucEmpresa}|${tipoComprobante === 'Factura' ? '01' : '03'}|${serie}|${correlativoStr}|${igv.toFixed(2)}|${total.toFixed(2)}|${fecha}|${tipoComprobante === 'Factura' ? '6' : (numDocumento?.length === 8 ? '1' : '0')}|${numDocumento || '00000000'}`;
    let enlacePdf = null;

    let contingencia = response.contingencia || false;

    // Extraer datos oficiales devueltos por la API de Nubefact
    if (response.estadoNubefact && response.estadoNubefact.startsWith('ACEPTADO:')) {
      try {
        const responseData = JSON.parse(response.estadoNubefact.substring(9));
        serie = responseData.serie || serie;
        correlativoStr = String(responseData.numero || correlativoStr).padStart(4, '0');
        if (responseData.cadena_para_codigo_qr) {
          qrData = responseData.cadena_para_codigo_qr;
        }
        if (responseData.key) {
          hashResumen = responseData.key;
        }
        enlacePdf = responseData.enlace_del_pdf || null;
      } catch (err) {
        console.error("Error parsing Nubefact response:", err);
      }
    }

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrData)}`;

    setActiveComprobante({
      tipo: tipoComprobante,
      serie,
      correlativo: correlativoStr,
      fecha,
      hora,
      mesaNum,
      clienteNombre: clienteNombre || 'Consumidor Final',
      clienteDoc: numDocumento || 'S/D',
      clienteDireccion: clienteDireccion || '',
      items: items.map(i => ({ cant: i.cant, nombre: i.nombre, precio: i.precio, notas: i.notas, categoria: i.categoria || '' })),
      subtotal,
      igv,
      total,
      descuentoAplicado: descuentoAplicado || response.descuentoAplicado || 0,
      ofertaDescripcion: ofertaDescripcion || response.ofertaDescripcion || null,
      totalLetras,
      hashResumen,
      metodoPago: response.metodoPago || metodoPago,
      montoEfectivo: response.montoEfectivo || 0,
      montoTarjeta: response.montoTarjeta || 0,
      montoYape: response.montoYape || 0,
      qrImageUrl,
      enlacePdf,
      contingencia,
      deliveryInfo,
      shouldAutoPrint: true,
    });

    setSunatModalOpen(true);
  };

  const enviarDeliveryACocina = async () => {
    if (itemsDelivery.length === 0) { alert('Debes agregar al menos un producto.'); return; }
    
    // Validar datos según el canal seleccionado
    if (tipoDelivery === 'PedidosYa') {
      if (!codigoPY.trim()) {
        alert('El código de PedidosYa es obligatorio.');
        return;
      }
    } else if (tipoDelivery === 'ParaLlevar') {
      if (!codigoPY.trim()) {
        alert('El nombre del cliente o número de ticket es obligatorio.');
        return;
      }
      if (deliveryTipoComprobante === 'Factura') {
        if (!deliveryNumDocumento || deliveryNumDocumento.length !== 11) {
          alert('Para emitir Factura, el RUC debe tener 11 dígitos.');
          return;
        }
        if (!deliveryClienteNombre.trim()) {
          alert('Para emitir Factura, la Razón Social del cliente es obligatoria.');
          return;
        }
        if (!deliveryDireccion.trim()) {
          alert('Para emitir Factura, la Dirección fiscal del cliente es obligatoria. Por favor, ingrésala.');
          return;
        }
      }
    } else if (tipoDelivery === 'DeliveryPropio') {
      if (!deliveryClienteNombre.trim()) {
        alert('El nombre del cliente es obligatorio.');
        return;
      }
      if (!deliveryDireccion.trim()) {
        alert('La dirección del cliente es obligatoria.');
        return;
      }
      if (!deliveryTelefono.trim()) {
        alert('El teléfono del cliente es obligatorio.');
        return;
      }
      if (deliveryTipoComprobante === 'Factura') {
        if (!deliveryNumDocumento || deliveryNumDocumento.length !== 11) {
          alert('Para emitir Factura, el RUC debe tener 11 dígitos.');
          return;
        }
      }
    }

    // Validar PIN de administrador si el método de pago es Consumo o Cortesía, o si hay ítems de cortesía
    const tieneCortesias = deliveryMetodoPago === 'Consumo' || deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.length > 0;
    if (tieneCortesias) {
      if (!pinAdminDelivery.trim()) {
        alert(`⚠️ Debes ingresar el PIN del administrador/cajero para autorizar ${deliveryMetodoPago === 'Consumo' ? 'un Consumo de Personal' : 'la Cortesía'}.`);
        return;
      }
      const authResult = await api.validateAuth(pinAdminDelivery.trim());
      if (!authResult || !authResult.ok) {
        alert(`❌ PIN incorrecto. Solo el administrador/cajero puede autorizar ${deliveryMetodoPago === 'Consumo' ? 'un Consumo de Personal' : 'la Cortesía'}.`);
        setPinAdminDelivery('');
        return;
      }
    }

    if (tipoDelivery !== 'PedidosYa' && deliveryMetodoPago === 'Crédito') {
      if (!deliveryClienteCreditoSeleccionado) {
        alert('Debe seleccionar un cliente con línea de crédito para continuar.');
        return;
      }
    }

    // Mapear items finales marcando a S/ 0.00 los que sean de cortesía
    const itemsFinales = itemsDelivery.map((item, idx) => {
      const esCortesia = deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.includes(idx);
      if (esCortesia) {
        return {
          ...item,
          precio: 0,
          notas: item.notas ? `${item.notas} [CORTESÍA]` : '[CORTESÍA]'
        };
      }
      return item;
    });

    // Validar y calcular montos si es Pago Mixto
    let deliveryFinalMontoEfectivo = 0;
    let deliveryFinalMontoTarjeta = 0;
    let deliveryFinalMontoYape = 0;
    let deliveryFinalMontoCredito = 0;
    
    const itemsTotal = itemsFinales.reduce((s, i) => s + i.cant * i.precio, 0);
    const shippingFee = (tipoDelivery === 'DeliveryPropio' && deliveryMetodoPago !== 'Cortesía') ? parseFloat(deliveryMontoEnvio || 0) : 0;

    // Descuento porcentual para llevar/delivery
    const descPct = parseFloat(deliveryDescuentoPorcentaje || 0);
    const descuentoMonto = (descPct > 0 && itemsTotal > 0) ? parseFloat((itemsTotal * (descPct / 100)).toFixed(2)) : 0;
    const totalConDescuento = Math.max(0, itemsTotal - descuentoMonto);
    const grandTotal = deliveryMetodoPago === 'Cortesía' ? 0.00 : (totalConDescuento + shippingFee);
    const descuentoFinal = descPct > 0 ? descuentoMonto : 0;

    if (tipoDelivery !== 'PedidosYa' && deliveryMetodoPago === 'Mixto') {
      const efecVal = parseFloat(deliveryMixtoEfectivo || 0);
      const tarjVal = parseFloat(deliveryMixtoTarjeta || 0);
      const yapeVal = parseFloat(deliveryMixtoYape || 0);
      const credVal = parseFloat(deliveryMontoCredito || 0);

      if (efecVal < 0 || tarjVal < 0 || yapeVal < 0 || credVal < 0) {
        alert('Los montos de pago no pueden ser valores negativos.');
        return;
      }

      if (credVal > 0 && !deliveryClienteCreditoSeleccionado) {
        alert('Debe seleccionar un cliente para la porción de pago a crédito.');
        return;
      }

      if (tarjVal + yapeVal + credVal > grandTotal) {
        alert('La suma de Tarjeta, Yape / Plin y Crédito no puede superar el total a pagar.');
        return;
      }

      const restante = grandTotal - (tarjVal + yapeVal + credVal);
      if (efecVal < restante) {
        alert(`Monto insuficiente. Debes cubrir el total de S/ ${grandTotal.toFixed(2)}.\nFaltan S/ ${(restante - efecVal).toFixed(2)}`);
        return;
      }

      deliveryFinalMontoEfectivo = restante;
      deliveryFinalMontoTarjeta = tarjVal;
      deliveryFinalMontoYape = yapeVal;
      deliveryFinalMontoCredito = credVal;
    }

    setEnviandoDelivery(true);
    try {
      let codigoFormateado = '';
      const vueltoVal = (() => {
        const conC = parseFloat(deliveryConCuanto);
        return (!isNaN(conC) && conC >= grandTotal) ? (conC - grandTotal).toFixed(2) : '0.00';
      })();

      if (tipoDelivery === 'PedidosYa') {
        codigoFormateado = codigoPY.trim().toUpperCase();
      } else if (tipoDelivery === 'ParaLlevar') {
        codigoFormateado = `LLEVAR - ${codigoPY.trim().toUpperCase()}`;
      } else if (tipoDelivery === 'DeliveryPropio') {
        codigoFormateado = `DELIVERY - ${deliveryClienteNombre.trim().toUpperCase()} | TEL: ${deliveryTelefono.trim()} | DIR: ${deliveryDireccion.trim()} | PAGA: ${deliveryConCuanto || '0.00'} | VUELTO: ${vueltoVal}`;
      }

      const payload = {
        codigoPedidosYa: codigoFormateado,
        cajero: cajeroNombre,
        items: itemsFinales,
        total: grandTotal,
        tipoDelivery,
        tipoComprobante: tipoDelivery === 'PedidosYa' ? 'Ticket' : deliveryTipoComprobante,
        metodoPago: tipoDelivery === 'PedidosYa' ? 'PedidosYa' : deliveryMetodoPago,
        montoEfectivo: deliveryFinalMontoEfectivo,
        montoTarjeta: deliveryFinalMontoTarjeta,
        montoYape: deliveryFinalMontoYape,
        montoCredito: deliveryMetodoPago === 'Crédito' ? grandTotal : deliveryFinalMontoCredito,
        clienteCreditoId: deliveryClienteCreditoSeleccionado?.id || null,
        numDocumento: tipoDelivery === 'PedidosYa' ? codigoFormateado : (deliveryNumDocumento || 'S/D'),
        nombreCliente: tipoDelivery === 'PedidosYa' ? 'PEDIDOS YA' : (deliveryClienteNombre || 'Consumidor Final'),
        clienteDireccion: tipoDelivery === 'DeliveryPropio' ? deliveryDireccion : (deliveryDireccion || ''),
        montoDelivery: shippingFee,
        telefono: deliveryTelefono || null,
        descuentoPorcentaje: descPct,
        descuentoDescripcion: descuentoFinal > 0 ? `Descuento manual ${descPct}%` : null,
      };

      const result = editingPedidoId 
        ? await api.actualizarDelivery(editingPedidoId, payload)
        : await api.crearPedidoLlevar(payload);

      if (result.error) throw new Error(result.error);

      // Cerrar modal y recargar datos de Caja
      setDeliveryModal(false);
      setEditingPedidoId(null);
      setDeliveryMixtoEfectivo('');
      setDeliveryMixtoTarjeta('');
      setDeliveryMixtoYape('');
      setDeliveryMontoCredito('');
      setDeliveryClienteCreditoSeleccionado(null);
      setDeliveryDescuentoPorcentaje('');
      setPinAdminDelivery('');
      setCortesiaDeliveryIndices([]);
      await fetchCajaData();
      
      // Si es Para Llevar o Delivery Propio con comprobante Boleta o Factura (o Ticket), activamos el ticket de impresión
      if (tipoDelivery !== 'PedidosYa') {
        // Para que en la impresión figuren los items reales del ticket
        const itemsImpresion = [...itemsFinales];
        if (shippingFee > 0) {
          itemsImpresion.push({
            id: '9999',
            nombre: 'Servicio de Delivery',
            precio: shippingFee,
            cant: 1
          });
        }
        
        const deliveryInfo = tipoDelivery === 'DeliveryPropio' ? {
          nombre: deliveryClienteNombre,
          telefono: deliveryTelefono,
          direccion: deliveryDireccion,
          montoDelivery: shippingFee,
          conCuanto: deliveryConCuanto || '0.00',
          vuelto: vueltoVal,
        } : null;

        abrirTicketImpresionDirecto(
          grandTotal, 
          result.venta, 
          tipoDelivery === 'PedidosYa' ? 'Ticket' : deliveryTipoComprobante, 
          tipoDelivery === 'PedidosYa' ? null : (deliveryNumDocumento || null), 
          tipoDelivery === 'PedidosYa' ? 'PEDIDOS YA' : (deliveryClienteNombre || 'Consumidor Final'), 
          tipoDelivery === 'DeliveryPropio' ? deliveryDireccion : '', 
          itemsImpresion, 
          tipoDelivery === 'DeliveryPropio' ? 'Delivery' : 'Llevar',
          deliveryInfo,
          descuentoFinal,
          descuentoFinal > 0 ? `Descuento ${descPct}%` : null
        );
      } else {
        alert(`✅ Pedido ${codigoPY.toUpperCase()} enviado a Cocina. Venta registrada.`);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setEnviandoDelivery(false);
    }
  };

  const cortesiaDeliveryItemsTotal = itemsDelivery.reduce((s, i, idx) => {
    if (deliveryMetodoPago === 'Cortesía' || cortesiaDeliveryIndices.includes(idx)) return s;
    return s + i.cant * i.precio;
  }, 0);
  const totalDelivery = deliveryMetodoPago === 'Cortesía' ? 0 : cortesiaDeliveryItemsTotal;
  const deliveryDescPct = parseFloat(deliveryDescuentoPorcentaje || 0);
  const deliveryDescuentoMonto = (deliveryDescPct > 0 && totalDelivery > 0) ? parseFloat((totalDelivery * (deliveryDescPct / 100)).toFixed(2)) : 0;
  const deliveryTotalConDescuento = Math.max(0, totalDelivery - deliveryDescuentoMonto);
  const deliveryShippingFee = (tipoDelivery === 'DeliveryPropio' && deliveryMetodoPago !== 'Cortesía') ? parseFloat(deliveryMontoEnvio || 0) : 0;
  const grandTotalDelivery = deliveryMetodoPago === 'Cortesía' ? 0 : (deliveryTotalConDescuento + deliveryShippingFee);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando cuentas de caja...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50">
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Caja y Facturación</h1>
          <p className="text-xs md:text-sm text-slate-500">Cierre de mesas, pedidos de delivery y control del turno.</p>
        </div>
        <button
          onClick={abrirDeliveryModal}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <Truck className="w-4 h-4" />
          Pedidos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">

          {/* MESAS DEL SALÓN */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-500" /> Mesas Pendientes por Cobrar
              </h2>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                {mesasPendientes.length} Mesa{mesasPendientes.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Mesa</th>
                    <th className="px-6 py-4">Mesero / Hora</th>
                    <th className="px-6 py-4">Consumo</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm bg-white">
                  {mesasPendientes.length > 0 ? mesasPendientes.map(m => (
                    <tr key={m.num} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-900 text-amber-400 rounded-xl flex items-center justify-center font-black shadow-sm">{m.num}</div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800 uppercase tracking-tight">Mesa {m.num}</span>
                            {m.pedidoData?.estadoEnsalada === 'Pendiente' && (
                              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-250 px-1.5 py-0.5 rounded mt-0.5 uppercase w-fit animate-pulse">
                                🥗 Ens. Pendiente
                              </span>
                            )}
                            {m.pedidoData?.estadoEnsalada === 'Listo' && (
                              <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-250 px-1.5 py-0.5 rounded mt-0.5 uppercase w-fit">
                                🥗 Ens. Lista
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-sm">{m.pedidoData?.mesero}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {m.pedidoData?.hora}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">
                        <div className="flex flex-col gap-1 max-w-xs max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                          {m.pedidoData?.items
                            ?.filter(item => item && (item.precio > 0 || (item.categoria && BARRA_CATEGORIAS.includes(item.categoria)) || (item.notas && item.notas.includes('CORTESÍA')) || (item.nombre && item.nombre.includes('CORTESÍA'))))
                            ?.map((item, idx) => (
                              <span key={idx} className="bg-slate-100/90 px-2 py-0.5 rounded text-[10px] text-slate-700 leading-tight block w-fit border border-slate-200/40">
                                {item.cant}x {item.nombre}
                              </span>
                            )) || 'Sin consumos'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {m.estado === 'Servido'
                          ? <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 w-max">
                              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>
                              Listo p/ Cobrar
                            </span>
                          : <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 w-max">
                              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span></span>
                              En Preparación
                            </span>
                        }
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-lg md:text-xl tracking-tight">
                        S/ {m.pedidoData?.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setMesaSeleccionada(m);
                            setCortesiaItemIds([]);
                            setClienteCreditoSeleccionado(null);
                            setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
                            setIncluirCreditoMixto(false);
                            setMontoCreditoMixto('');
                            setMixtoEfectivo('');
                            setMixtoTarjeta('');
                            setMixtoYape('');
                            setModalOpen(true);
                          }}
                          className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md group-hover:scale-105 active:scale-95 group-hover:bg-amber-500 group-hover:text-slate-900"
                        >Cobrar</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">No hay mesas pendientes por cobrar.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PEDIDOS DE DELIVERY */}
          {pedidosLlevar.length > 0 && (
            <div className="bg-white rounded-3xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-blue-100 bg-blue-50 flex justify-between items-center">
                <h2 className="font-black text-blue-700 uppercase text-xs tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" /> Pedidos Para Llevar y Delivery (POS / PedidosYa)
                </h2>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {pedidosLlevar.length} Pedido{pedidosLlevar.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Código</th>
                      <th className="px-6 py-4">Cajero / Hora</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white">
                    {pedidosLlevar.map(p => (
                      <tr key={p.pedidoId} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {p.codigoPedidosYa?.startsWith('DELIVERY -') ? (
                              <>
                                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black shadow-sm text-xs shrink-0 font-bold">DEL</div>
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-800 tracking-tight">
                                    {(() => {
                                      const parsed = parseDeliveryInfo(p.codigoPedidosYa);
                                      return parsed ? parsed.nombre : p.codigoPedidosYa.replace('DELIVERY - ', '');
                                    })()}
                                  </span>
                                  {(() => {
                                    const parsed = parseDeliveryInfo(p.codigoPedidosYa);
                                    if (!parsed) return null;
                                    return (
                                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 leading-none block">
                                        📞 {parsed.telefono} · 📍 {parsed.direccion.substring(0, 25)}{parsed.direccion.length > 25 ? '...' : ''}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </>
                            ) : p.codigoPedidosYa?.startsWith('LLEVAR -') ? (
                              <>
                                <div className="w-10 h-10 bg-amber-500 text-slate-900 rounded-xl flex items-center justify-center font-black shadow-sm text-xs shrink-0 font-bold">RET</div>
                                <span className="font-black text-slate-800 tracking-tight">{p.codigoPedidosYa.replace('LLEVAR - ', '')}</span>
                              </>
                            ) : (
                              <>
                                <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black shadow-sm text-xs shrink-0">PY</div>
                                <span className="font-black text-blue-800 tracking-tight font-mono">{p.codigoPedidosYa}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-700 text-sm block">{p.cajero}</span>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" />{p.hora}</span>
                        </td>
                        <td className="px-6 py-4">
                          {(p.estado === 'Servido' || (p.estado && p.estado.toUpperCase().includes('LISTO')) || (p.estado && p.estado.toUpperCase().includes('SERVIDO')))
                            ? <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 text-[10px] font-black uppercase flex items-center gap-1.5 w-max">
                                <PackageCheck className="w-3.5 h-3.5" /> Listo p/ Entregar
                              </span>
                            : <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px] font-black uppercase flex items-center gap-1.5 w-max">
                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span></span>
                                En Cocina
                              </span>
                          }
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-lg">
                          S/ {p.total.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1.5 justify-center">
                            {(p.estado === 'Servido' || (p.estado && p.estado.toUpperCase().includes('LISTO')) || (p.estado && p.estado.toUpperCase().includes('SERVIDO'))) ? (
                              <button
                                onClick={() => confirmarEntregaDelivery(p.pedidoId, p.codigoPedidosYa)}
                                className="w-full max-w-[130px] px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md hover:bg-blue-700 active:scale-95 animate-pulse"
                              >Confirmar Entrega</button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">En cocina...</span>
                            )}
                            
                            <div className="flex gap-1.5 mt-0.5">
                              <button
                                onClick={() => iniciarModificarDelivery(p)}
                                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-300 hover:border-amber-500 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                              >
                                ✏️ Modificar
                              </button>
                              
                              <button
                                onClick={() => {
                                  setPedidoACancelarLlevar(p);
                                  setPinCancelLlevar('');
                                  setErrorCancelLlevar('');
                                  setCancelLlevarModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-red-100 hover:bg-red-655 text-red-700 hover:text-white border border-red-300 hover:border-red-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                              >
                                🗑 Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HISTORIAL DE VENTAS DEL DÍA */}
          {(() => {
            let ventasFiltradas = (ultimoCierre && !mostrarTodoElDia)
              ? ventas.filter(v => new Date(v.createdAt) > new Date(ultimoCierre))
              : ventas;

            if (filtroMetodoPago !== 'Todos') {
              ventasFiltradas = ventasFiltradas.filter(v => {
                let method = v.metodoPago;
                if (method === 'PedidosYa' && v.codigoPedidosYa) {
                  if (v.codigoPedidosYa.startsWith('DELIVERY -') || v.codigoPedidosYa.startsWith('LLEVAR -')) {
                    method = 'Efectivo';
                  }
                }
                return method === filtroMetodoPago;
              });
            }

            return (
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm" style={{ overflow: 'clip' }}>
                <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-500" />
                      <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider">Historial de Ventas del Día</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHistorialColapsado(prev => !prev)}
                      className={`text-[9px] font-black px-2 py-1 rounded-xl uppercase tracking-widest transition-all whitespace-nowrap ${
                        historialColapsado 
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300' 
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-600 border border-slate-300'
                      }`}
                    >
                      {historialColapsado ? '👁️ MOSTRAR VENTAS' : '👁️ OCULTAR VENTAS'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                    {ultimoCierre && (
                      <button
                        type="button"
                        onClick={() => setMostrarTodoElDia(prev => !prev)}
                        className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl uppercase tracking-wider transition-all border shadow-sm whitespace-nowrap ${
                          !mostrarTodoElDia
                            ? 'bg-amber-500 border-amber-600 text-slate-950 hover:bg-amber-600'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-350'
                        }`}
                        title={mostrarTodoElDia ? "Ocultar ventas de turnos ya cerrados" : "Mostrar todas las ventas del día"}
                      >
                        {mostrarTodoElDia ? '👁️ Ver Turno Activo' : '👁️ Ver Todo el Día'}
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm">
                      <span className="text-[9px] font-black uppercase text-slate-400">Filtrar:</span>
                      <select
                        value={filtroMetodoPago}
                        onChange={(e) => setFiltroMetodoPago(e.target.value)}
                        className="bg-transparent text-xs font-black uppercase text-slate-750 focus:outline-none"
                      >
                        <option value="Todos">Todos</option>
                        <option value="Efectivo">💵 Efectivo</option>
                        <option value="Tarjeta">💳 Tarjeta</option>
                        <option value="Yape">📱 Yape / Plin</option>
                        <option value="PedidosYa">🛵 PedidosYa</option>
                        <option value="Consumo">👤 Consumo Personal</option>
                        <option value="Cortesía">🎁 Cortesías</option>
                      </select>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                      {ventasFiltradas.length} Venta{ventasFiltradas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {/* Botones de navegación horizontal */}
                <div className="flex justify-end gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <button
                    onClick={() => historialScrollRef.current && (historialScrollRef.current.scrollLeft -= 200)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all flex items-center justify-center text-sm font-black shadow-sm active:scale-95"
                    title="Desplazar izquierda"
                  >◀</button>
                  <button
                    onClick={() => historialScrollRef.current && (historialScrollRef.current.scrollLeft += 200)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all flex items-center justify-center text-sm font-black shadow-sm active:scale-95"
                    title="Desplazar derecha"
                  >▶</button>
                </div>
                {!historialColapsado ? (
                  <div ref={historialScrollRef} className="table-scroll pb-1">
                  <table className="w-full text-left min-w-[650px]">
                    <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">ID / Hora</th>
                        <th className="px-6 py-4">Comprobante / Cliente</th>
                        <th className="px-6 py-4">Origen / Mesa</th>
                        <th className="px-6 py-4">Método de Pago</th>
                        <th className="px-6 py-4">Detalle</th>
                        <th className="px-6 py-4 text-right">Total</th>
                        <th className="px-6 py-4 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm bg-white">
                      {ventasFiltradas.length > 0 ? ventasFiltradas.map(v => (
                        <tr key={v.id} className={`hover:bg-slate-50/80 transition-colors ${v.anulado ? 'bg-red-50/60' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-black text-slate-900">#VT-{v.id}</span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">{v.hora}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-800 text-xs">
                                    {v.tipoComprobante} {v.serie ? `${v.serie}-${String(v.numero).padStart(4, '0')}` : `#${v.id}`}
                                  </span>
                                  {v.anulado ? (
                                    <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-1 shrink-0">
                                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></span> 🚫 DEVUELTO
                                    </span>
                                  ) : (
                                    <>
                                      {v.descuentoAplicado > 0 && (
                                        <span className="bg-blue-50 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1 shrink-0">
                                          🏷️ {v.ofertaDescripcion || `Desc: -S/ ${v.descuentoAplicado.toFixed(2)}`}
                                        </span>
                                      )}
                                      {v.metodoPago === 'Cortesía' && (
                                        <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1 shrink-0 animate-pulse">
                                          🎁 CORTESÍA TOTAL
                                        </span>
                                      )}
                                      {v.itemsResumen?.includes('CORTESÍA') && v.metodoPago !== 'Cortesía' && (
                                        <span className="bg-emerald-50 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shrink-0">
                                          🎁 CON CORTESÍA
                                        </span>
                                      )}
                                      {v.tipoComprobante === 'Ticket' && (
                                        <button
                                          title="Corregir datos de facturación (requiere PIN)"
                                          onClick={() => abrirModalEditarClienteVenta(v)}
                                          className="p-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 border border-slate-200 hover:border-amber-300 transition-all shrink-0"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                        </button>
                                      )}
                                      {v.estadoNubefact === 'PENDIENTE_REINTENTO' ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-200 animate-pulse flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> ⚠️ CONTINGENCIA
                                          </span>
                                          <button
                                            onClick={() => reintentarVentaIndividual(v.id)}
                                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded border border-amber-600 flex items-center gap-1 active:scale-95 transition-all shadow-sm shrink-0"
                                            title="Reintentar envío a SUNAT ahora mismo"
                                          >
                                            Reintentar
                                          </button>
                                        </div>
                                      ) : (v.tipoComprobante === 'Boleta' || v.tipoComprobante === 'Factura') && (!v.estadoNubefact || !v.estadoNubefact.startsWith('ACEPTADO:')) ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> ⏳ NO ENVIADO
                                          </span>
                                          <button
                                            onClick={() => reintentarVentaIndividual(v.id)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black px-2 py-0.5 rounded border border-blue-600 flex items-center gap-1 active:scale-95 transition-all shadow-sm shrink-0"
                                            title="Enviar comprobante a SUNAT"
                                          >
                                            Enviar
                                          </button>
                                        </div>
                                      ) : v.estadoNubefact && v.estadoNubefact.startsWith('ACEPTADO:') ? (
                                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> ✅ ENVIADO
                                        </span>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                                {v.anulado && v.motivoAnulacion && (
                                  <span className="text-[9px] text-red-600 font-medium block leading-none mt-1">
                                    Motivo: {v.motivoAnulacion} ({v.anuladoPor || 'Admin'})
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 uppercase tracking-tight font-medium mt-0.5">
                                  {(() => {
                                    if (v.codigoPedidosYa?.startsWith('DELIVERY -')) {
                                      const parsed = parseDeliveryInfo(v.codigoPedidosYa);
                                      return parsed ? parsed.nombre : v.nombreCliente;
                                    }
                                    if (v.nombreCliente && v.nombreCliente.startsWith('DELIVERY -')) {
                                      const parsed = parseDeliveryInfo(v.nombreCliente);
                                      return parsed ? parsed.nombre : v.nombreCliente.replace('DELIVERY - ', '');
                                    }
                                    return v.nombreCliente || 'Consumidor Final';
                                  })()}
                                </span>
                                {(() => {
                                  const parsed = parseDeliveryInfo(v.codigoPedidosYa) || parseDeliveryInfo(v.nombreCliente);
                                  if (!parsed) return null;
                                  return (
                                    <span className="text-[9px] text-slate-400 font-mono mt-0.5 block leading-none">
                                      📞 {parsed.telefono} · 📍 {parsed.direccion.substring(0, 20)}{parsed.direccion.length > 20 ? '...' : ''}
                                    </span>
                                  );
                                })()}
                              </div>
                           </td>
                           <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 justify-start">
                              {v.codigoPedidosYa ? (
                                <>
                                  {v.codigoPedidosYa.startsWith('DELIVERY -') ? (
                                    <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md whitespace-nowrap">
                                      🛵 DEL: {(() => {
                                        const parsed = parseDeliveryInfo(v.codigoPedidosYa);
                                        const name = parsed ? parsed.nombre : v.codigoPedidosYa.replace('DELIVERY - ', '');
                                        const first = name.split(/\s+/)[0] || '';
                                        return first.substring(0, 10);
                                      })()}
                                    </span>
                                  ) : v.codigoPedidosYa.startsWith('LLEVAR -') ? (
                                    <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md whitespace-nowrap">
                                      🛍️ LLEVAR: {(() => {
                                        const name = v.codigoPedidosYa.replace('LLEVAR - ', '');
                                        const first = name.split(/\s+/)[0] || '';
                                        return first.substring(0, 10);
                                      })()}
                                    </span>
                                  ) : (
                                    <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md font-mono whitespace-nowrap">
                                      🛵 PY: {v.codigoPedidosYa}
                                    </span>
                                  )}
                                  <button
                                    title="Corregir tipo de entrega (requiere PIN Administrador)"
                                    onClick={() => abrirCambioTipoEntregaModal(v)}
                                    className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-150 text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 transition-all shrink-0"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                  </button>
                                </>
                              ) : (
                                <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md whitespace-nowrap">
                                  🍽️ Mesa {v.mesaNum}
                                </span>
                              )}
                            </div>
                           </td>
                          <td className="px-6 py-4">
                            {v.anulado ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-100 border border-red-200 text-red-700 whitespace-nowrap">
                                🚫 CANCELADO
                              </span>
                            ) : (() => {
                              let method = v.metodoPago;
                              const editable = true;
                              return (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                      method === 'Efectivo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                      method === 'Tarjeta' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                      method === 'Yape' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                                      method === 'Cortesía' ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse' :
                                      method === 'Consumo' ? 'bg-violet-100 border-violet-300 text-violet-700' :
                                      method === 'Mixto' ? 'bg-amber-100 border-amber-250 text-amber-900 font-black' :
                                      'bg-indigo-50 border-indigo-200 text-indigo-700'
                                    }`}>{method}</span>
                                    {editable && (
                                      <button
                                        title="Corregir método de pago (requiere PIN Administrador)"
                                        onClick={() => {
                                          setVentaACambiar(v);
                                          setCambioNuevoMetodo(v.metodoPago);
                                          setCambioPin('');
                                          setCambioError('');
                                          setCambioMetodoModal(true);
                                        }}
                                        className="p-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 border border-slate-200 hover:border-amber-300 transition-all"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                      </button>
                                    )}
                                  </div>
                                  {method === 'Mixto' && (
                                    <div className="text-[9px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-150 space-y-0.5 mt-0.5 leading-none shadow-sm min-w-[100px]">
                                      {(v.montoEfectivo || 0) > 0 && <div className="flex justify-between gap-2"><span>💵 Efec:</span><span className="font-bold">S/ {v.montoEfectivo.toFixed(2)}</span></div>}
                                      {(v.montoTarjeta || 0) > 0 && <div className="flex justify-between gap-2"><span>💳 Tarj:</span><span className="font-bold">S/ {v.montoTarjeta.toFixed(2)}</span></div>}
                                      {(v.montoYape || 0) > 0 && <div className="flex justify-between gap-2"><span>📱 Yape:</span><span className="font-bold">S/ {v.montoYape.toFixed(2)}</span></div>}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">
                             <div className="flex flex-col gap-1 max-w-xs">
                               {v.itemsResumen ? v.itemsResumen.split(', ').map((it, idx) => (
                                 <span key={idx} className="bg-slate-100/80 px-2 py-0.5 rounded text-[10px] text-slate-700 leading-tight block w-fit border border-slate-200/40">
                                   {it}
                                 </span>
                               )) : 'Sin ítems'}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-base">
                            {v.anulado ? (
                              <div className="flex flex-col items-end leading-none">
                                <span className="text-red-600 font-black">S/ 0.00</span>
                                <span className="line-through text-slate-400 font-bold text-xs mt-1">
                                  S/ {(v.montoOriginal ?? v.total ?? 0).toFixed(2)}
                                </span>
                              </div>
                            ) : v.descuentoAplicado > 0 ? (
                              <div className="flex flex-col items-end leading-tight">
                                <span className="text-slate-400 font-bold text-[10px] line-through font-mono">
                                  S/ {(parseFloat(v.total || 0) + parseFloat(v.descuentoAplicado || 0)).toFixed(2)}
                                </span>
                                <span className="font-black text-slate-900 text-base font-mono">
                                  S/ {(v.total ?? 0).toFixed(2)}
                                </span>
                                <span className="text-[9px] font-black text-blue-600 font-mono">
                                  -S/ {parseFloat(v.descuentoAplicado).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              `S/ ${(v.total ?? 0).toFixed(2)}`
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {v.anulado ? (
                                <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-[10px] font-black uppercase border border-red-200 flex items-center justify-center gap-1">
                                  🚫 VENTA DEVUELTA (S/ 0.00)
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => reimprimirComprobante(v)}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                    title="Reimprimir Comprobante Susii 80mm"
                                  >
                                    <Printer className="w-3.5 h-3.5" /> Reimprimir
                                  </button>
                                  <button
                                    onClick={() => enviarPorWhatsApp(v)}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                                    title="Enviar Comprobante por WhatsApp"
                                  >
                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.161.001 6.136 1.23 8.375 3.466 2.238 2.237 3.467 5.21 3.466 8.373-.003 6.535-5.328 11.86-11.859 11.86-2.007-.001-3.98-.51-5.753-1.48L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.269 0 9.557-4.287 9.559-9.556.001-2.553-.99-4.955-2.792-6.758-1.802-1.802-4.199-2.793-6.753-2.794-5.27 0-9.559 4.287-9.56 9.559-.001 1.625.434 3.208 1.262 4.622L1.51 21.054l4.137-1.9zm12.135-6.843c-.268-.134-1.583-.78-1.828-.87-.247-.09-.427-.134-.607.134-.18.267-.697.87-.852 1.047-.156.178-.311.201-.579.067-.268-.134-1.132-.418-2.156-1.332-.796-.71-1.335-1.586-1.492-1.853-.156-.268-.017-.413.117-.547.12-.12.268-.312.401-.468.134-.156.179-.268.268-.446.09-.178.045-.335-.022-.469-.067-.134-.607-1.462-.832-2.002-.22-.53-.442-.457-.607-.466-.156-.008-.337-.008-.518-.008-.18 0-.473.067-.72.337-.247.268-.943.922-.943 2.248s.965 2.604 1.1 2.784c.134.18 1.9 2.901 4.6 4.068.643.277 1.143.443 1.534.568.646.205 1.233.176 1.697.107.518-.077 1.583-.647 1.807-1.272.223-.624.223-1.159.156-1.272-.069-.112-.249-.18-.517-.313z" />
                                    </svg> WhatsApp
                                  </button>
                                  <button
                                    onClick={() => abrirAnularVentaModal(v)}
                                    className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 border border-red-200 shadow-sm active:scale-95 shrink-0"
                                    title="Registrar Devolución de Pedido (requiere PIN Administrador)"
                                  >
                                    <Ban className="w-3.5 h-3.5" /> Devolución
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>


                      )) : (
                        <tr>
                          <td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider text-xs">
                            Aún no se han registrado ventas hoy en este turno.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                ) : (
                  <div className="p-12 text-center bg-slate-50 border-t border-slate-100 flex flex-col items-center justify-center gap-3">
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px] tracking-widest">
                      🔒 El historial de ventas está oculto para maximizar la visibilidad del resumen.
                    </p>
                    <button
                      type="button"
                      onClick={() => setHistorialColapsado(false)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                    >
                      🔓 Mostrar Historial de Ventas
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* RESUMEN LATERAL */}
        {(() => {
          const obtenerMontosVentaFrontend = (v) => {
            if (!v || v.anulado || v.estadoPedido === 'Cancelado') return { efec: 0, tarj: 0, yape: 0 };
            if (v.metodoPago === 'Cortesía' || v.metodoPago === 'Consumo' || v.metodoPago === 'PedidosYa' || v.metodoPago === 'Crédito') return { efec: 0, tarj: 0, yape: 0 };

            let efec = parseFloat(v.montoEfectivo || 0);
            let tarj = parseFloat(v.montoTarjeta || 0);
            let yape = parseFloat(v.montoYape || 0);
            const total = parseFloat(v.total || 0);

            if (total <= 0) return { efec: 0, tarj: 0, yape: 0 };
            if (v.metodoPago === 'Efectivo') return { efec: total, tarj: 0, yape: 0 };
            if (v.metodoPago === 'Tarjeta') return { efec: 0, tarj: total, yape: 0 };
            if (v.metodoPago === 'Yape') return { efec: 0, tarj: 0, yape: total };

            // Restar la parte a crédito si es mixto
            const creditAmount = parseFloat(v.montoCredito || 0);
            const totalFisico = Math.max(0, total - creditAmount);
            const suma = efec + tarj + yape;
            if (Math.abs(suma - totalFisico) > 0.01) {
              if (suma === 0) efec = totalFisico;
              else if (totalFisico > suma) efec += (totalFisico - suma);
            }
            return { efec, tarj, yape };
          };

          const ventasFiltradas = ultimoCierre
            ? ventas.filter(v => new Date(v.createdAt) > new Date(ultimoCierre))
            : ventas;
          const abonosFiltrados = ultimoCierre
            ? abonos.filter(a => new Date(a.creadoEn) > new Date(ultimoCierre))
            : abonos;
          const activeAtendidas = ventasFiltradas.length;

          let activeEfectivo = 0;
          let activeTarjeta = 0;
          let activeYape = 0;

          ventasFiltradas.forEach(v => {
            const { efec, tarj, yape } = obtenerMontosVentaFrontend(v);
            activeEfectivo += efec;
            activeTarjeta += tarj;
            activeYape += yape;
          });

          // Sumar abonos a la caja real
          abonosFiltrados.forEach(a => {
            activeEfectivo += a.montoEfectivo || 0;
            activeTarjeta += a.montoTarjeta || 0;
            activeYape += a.montoYape || 0;
          });

          const activeIngresosCaja = activeEfectivo + activeTarjeta + activeYape;
          const activeIngresosPedidosYa = ventasFiltradas
            .filter(v => v.metodoPago === 'PedidosYa')
            .reduce((s, v) => s + v.total, 0);
          const activeCortesias = ventasFiltradas
            .filter(v => v.metodoPago === 'Cortesía')
            .reduce((sum, v) => {
              const itemsVal = v.items?.reduce((s, i) => s + (i.cant * i.precio), 0) || 0;
              return sum + itemsVal;
            }, 0);

          const clienteMap = new Map(clientes.map(c => [c.id, c.esTrabajador]));
          let activeConsumoPlanilla = 0;
          let activeConsumoClientes = 0;

          ventasFiltradas.forEach(v => {
            if (v.anulado || v.estadoPedido === 'Cancelado') return;
            if (v.metodoPago === 'Consumo') {
              activeConsumoPlanilla += (v.descuentoAplicado || v.total || 0);
            } else {
              const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
              if (splits.length > 0) {
                splits.forEach(s => {
                  const esTrab = clienteMap.get(s.clienteId) || false;
                  if (esTrab) {
                    activeConsumoPlanilla += s.monto;
                  } else {
                    activeConsumoClientes += s.monto;
                  }
                });
              } else if (v.metodoPago === 'Crédito') {
                activeConsumoClientes += (v.total || 0);
              } else if (parseFloat(v.montoCredito || 0) > 0) {
                activeConsumoClientes += parseFloat(v.montoCredito);
              }
            }
          });

          const totalCreditosTurno = activeConsumoClientes + activeConsumoPlanilla;

          return (
            <div className="bg-slate-900 rounded-3xl shadow-xl p-5 text-white flex flex-col sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
              <div className="flex flex-col gap-3 mb-4 border-b border-slate-800 pb-4">
                <h2 className="font-black uppercase text-xs tracking-widest text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" /> Resumen del Turno
                </h2>
                <button
                  type="button"
                  onClick={() => setCierreModalOpen(true)}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 border border-purple-500/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  Cerrar Caja (Turno)
                </button>
              </div>
              <div className="space-y-3 flex-1">
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Mesas Atendidas Hoy</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-2xl font-black">{activeAtendidas}</p>
                  </div>
                </div>
                <div className="bg-blue-800/80 p-4 rounded-2xl border border-blue-700">
                  <p className="text-xs text-blue-300 font-black uppercase tracking-widest">Delivery Activos</p>
                  <p className="text-2xl font-black mt-1.5">{pedidosLlevar.length}</p>
                </div>
                {/* Tarjeta: Ingresos Reales en Caja */}
                <div className="bg-gradient-to-br from-emerald-600 to-green-600 p-4 rounded-2xl relative overflow-hidden text-white shadow-lg shadow-emerald-500/20">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white rounded-full opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-wider opacity-90">💵 Ingresos en Caja</p>
                  <p className="text-[9px] font-bold opacity-60 mt-0.5">Efectivo · Tarjeta · Yape</p>
                  <div className="flex items-center gap-2.5 mt-1.5 relative z-10">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><Banknote className="w-4.5 h-4.5" /></div>
                    <p className="text-2xl lg:text-3xl font-black font-mono tracking-tighter">S/ {activeIngresosCaja.toFixed(2)}</p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/20 grid grid-cols-3 gap-1 text-[9px] font-bold text-emerald-100">
                    <div className="flex flex-col">
                      <span className="opacity-85 text-[8px] uppercase tracking-wider">Efectivo</span>
                      <span className="font-mono text-xs text-white">S/ {activeEfectivo.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-l border-white/10 pl-1.5">
                      <span className="opacity-85 text-[8px] uppercase tracking-wider">Tarjeta</span>
                      <span className="font-mono text-xs text-white">S/ {activeTarjeta.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-l border-white/10 pl-1.5">
                      <span className="opacity-85 text-[8px] uppercase tracking-wider">Yape</span>
                      <span className="font-mono text-xs text-white">S/ {activeYape.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Tarjeta: PedidosYa — separado */}
                <div className={`p-4 rounded-2xl relative overflow-hidden border shadow-md transition-all ${
                  activeIngresosPedidosYa > 0
                    ? 'bg-gradient-to-br from-blue-900 to-indigo-900 border-blue-700 text-blue-100'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}>
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-white rounded-full opacity-10" />
                  <p className={`text-[10px] font-black uppercase tracking-wider ${activeIngresosPedidosYa > 0 ? 'text-blue-300' : 'text-slate-500'}`}>🛵 PedidosYa</p>
                  <p className={`text-[9px] font-bold mt-0.5 ${activeIngresosPedidosYa > 0 ? 'text-blue-400 opacity-80' : 'text-slate-600'}`}>Cobro semanal · no incluir en cuadre</p>
                  <div className="flex items-center gap-3 mt-1.5 relative z-10">
                    <p className={`text-2xl font-black font-mono tracking-tighter ${activeIngresosPedidosYa > 0 ? 'text-white' : 'text-slate-600'}`}>S/ {activeIngresosPedidosYa.toFixed(2)}</p>
                  </div>
                </div>

                {/* Tarjeta Siempre Visible: Créditos y Consumos del Turno */}
                <div className="bg-gradient-to-br from-teal-900/90 via-slate-900 to-indigo-950 p-4 rounded-2xl relative overflow-hidden text-teal-200 border border-teal-800/60 shadow-lg">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-teal-500 rounded-full opacity-10" />
                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-teal-400" /> Créditos del Turno
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">Comerciales + Descuento Planilla</p>
                    </div>
                    <span className="font-mono text-xs font-black text-white bg-teal-950/80 px-2 py-0.5 rounded-lg border border-teal-800">
                      S/ {totalCreditosTurno.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-teal-800/40 text-[9px] font-bold">
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-teal-900/50 flex flex-col justify-between">
                      <span className="text-teal-400 text-[8px] uppercase tracking-wider block">👥 Clientes</span>
                      <span className="font-mono text-sm text-white font-black block mt-1">S/ {activeConsumoClientes.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-violet-900/50 flex flex-col justify-between">
                      <span className="text-violet-300 text-[8px] uppercase tracking-wider block">👤 Planilla</span>
                      <span className="font-mono text-sm text-white font-black block mt-1">S/ {activeConsumoPlanilla.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Tarjeta: Cortesías — solo si hay */}
                {activeCortesias > 0 && (
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-2xl relative overflow-hidden text-slate-300 border border-slate-700 shadow-md">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-white rounded-full opacity-5" />
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-90 text-slate-400">🎁 Cortesías (Valor)</p>
                    <p className="text-[9px] font-bold opacity-60 mt-0.5">Valor referencial · sin cobro</p>
                    <div className="flex items-center gap-3 mt-1.5 relative z-10">
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center"><Gift className="w-4 h-4 text-slate-400" /></div>
                      <p className="text-2xl font-black font-mono tracking-tighter text-white">S/ {activeCortesias.toFixed(2)}</p>
                    </div>
                  </div>
                )}


              </div>
            </div>
          );
        })()}
      </div>

      {/* MODAL DE COBRO (MESAS) */}
      {modalOpen && mesaSeleccionada && (() => {
        const totalConCortesias = (mesaSeleccionada.pedidoData.items || [])
          .filter(i => !cortesiaItemIds.includes(i.itemId))
          .reduce((s, i) => s + (i.cant * i.precio), 0);
        const subtotalConCortesias = parseFloat((totalConCortesias / 1.105).toFixed(2));
        const igvConCortesias = parseFloat((totalConCortesias - subtotalConCortesias).toFixed(2));
        const tieneCortesiasIndividuales = cortesiaItemIds.length > 0;

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white w-full h-[95vh] md:h-auto md:max-h-[95vh] max-w-3xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-4 md:p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-900"><Banknote className="w-5 h-5" /></div>
                <div>
                  <h2 className="font-black text-lg uppercase tracking-tight leading-none">Cobro Mesa <span className="text-emerald-400">{mesaSeleccionada.num}</span></h2>
                  <p className="text-xs text-slate-400">Emisión de Facturación Electrónica</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50 flex-1 grid md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-slate-500 font-bold mb-2 text-[10px] tracking-widest uppercase">Tipo de Comprobante:</label>
                  <select 
                    value={tipoComprobante} 
                    onChange={(e) => handleComprobanteChange(e.target.value)} 
                    disabled={metodoPago === 'Consumo'}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 font-bold text-slate-800 transition-all text-sm disabled:opacity-60"
                  >
                    {metodoPago === 'Consumo' ? (
                      <option value="Ticket">👤 Consumo Personal (Descuento Planilla)</option>
                    ) : (
                      <>
                        <option value="Boleta">Boleta Electrónica (DNI)</option>
                        <option value="Factura">Factura Electrónica (RUC)</option>
                        <option value="Ticket">Ticket Interno (Simple)</option>
                      </>
                    )}
                  </select>
                </div>
                {metodoPago !== 'Consumo' && (tipoComprobante === 'Boleta' || tipoComprobante === 'Factura') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                    <div>
                      <label className="block text-slate-500 font-bold mb-2 text-[10px] tracking-widest uppercase">{tipoComprobante === 'Factura' ? 'RUC del Cliente' : 'DNI del Cliente'}:</label>
                      <div className="flex gap-2">
                        <input type="text" value={numDocumento} onChange={(e) => handleDocumentoChange(e.target.value)} placeholder={tipoComprobante === 'Factura' ? 'Ej. 10710311191' : 'Ej. 70443322'} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono" />

                        <button onClick={buscarCliente} disabled={!numDocumento || isBuscando} className="bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-amber-500 hover:text-slate-900 transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 shadow-md">
                          {isBuscando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Search className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold mb-1 text-[10px] tracking-widest uppercase">Razón Social / Nombres:</label>
                      <input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Consumidor Final" className="w-full bg-white border border-slate-200 text-slate-700 font-bold rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold mb-1 text-[10px] tracking-widest uppercase">Dirección del Cliente:</label>
                      <input type="text" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} placeholder="Opcional (Ej. Av. Hoyos Rubio Nro. 338)" className="w-full bg-white border border-slate-200 text-slate-700 font-bold rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-slate-500 font-bold mb-2 text-[10px] tracking-widest uppercase">Método de Pago:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { id: 'Efectivo', icon: Banknote, label: 'Efectivo' }, 
                      { id: 'Tarjeta', icon: CreditCard, label: 'Tarjeta' }, 
                      { id: 'Yape', icon: Wallet, label: 'Yape / Plin' },
                      { id: 'Crédito', icon: Users, label: '💳 Crédito' },
                      { id: 'Cortesía', icon: Gift, label: '🎁 Cortesía' },
                      { id: 'Mixto', icon: Layers, label: '➕ Mixto' }
                    ].map(item => {
                      const IconComp = item.icon;
                      const active = metodoPago === item.id;
                      return (
                        <button 
                          key={item.id} 
                          type="button"
                          onClick={() => {
                            setMetodoPago(item.id);
                            if (item.id === 'Crédito' || item.id === 'Cortesía') {
                              setTipoComprobante('Ticket');
                            }
                          }} 
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${active ? 'bg-amber-500/10 border-amber-500 text-amber-700 font-black' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                          <IconComp className="w-5 h-5 mb-1 shrink-0" />
                          <span className="text-[10px] uppercase font-bold tracking-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FORMATO 1: PAGO EN EFECTIVO CON CALCULADORA Y VUELTO */}
                {metodoPago === 'Efectivo' && (() => {
                  const total = totalConCortesias;
                  const pagaCon = parseFloat(pagaConEfectivoMesa || 0);
                  const vuelto = (pagaCon >= total && pagaCon > 0) ? (pagaCon - total) : 0;
                  const faltante = (pagaCon > 0 && pagaCon < total) ? (total - pagaCon) : 0;

                  return (
                    <div className="bg-emerald-500/5 border border-emerald-500/25 p-4 rounded-3xl space-y-3 animate-fade-in shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-emerald-600" />
                          Cobro en Efectivo
                        </span>
                        <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                          Total: S/ {total.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1 text-[10px] tracking-wider uppercase">
                            Paga con (S/):
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={pagaConEfectivoMesa}
                            onChange={(e) => setPagaConEfectivoMesa(e.target.value)}
                            placeholder={`S/ ${total.toFixed(2)}`}
                            className="w-full bg-white border-2 border-emerald-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-base font-mono font-black text-slate-900 focus:outline-none shadow-inner"
                          />
                        </div>

                        <div className="flex flex-col justify-end bg-white border border-emerald-200/80 rounded-xl px-3.5 py-2 shadow-xs">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                            {faltante > 0 ? 'Falta Pagar:' : 'Vuelto al Cliente:'}
                          </span>
                          <span className={`font-mono font-black text-xl leading-tight ${faltante > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            S/ {faltante > 0 ? faltante.toFixed(2) : vuelto.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de billetes y montos rápidos */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Billetes:</span>
                        <button
                          type="button"
                          onClick={() => setPagaConEfectivoMesa(total.toFixed(2))}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 shadow-xs"
                        >
                          Exacto S/ {total.toFixed(2)}
                        </button>
                        {[10, 20, 50, 100, 200].map(monto => (
                          <button
                            key={monto}
                            type="button"
                            onClick={() => setPagaConEfectivoMesa(monto.toFixed(2))}
                            className="px-2.5 py-1 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 font-bold rounded-lg text-[10px] transition-all active:scale-95 shadow-xs font-mono"
                          >
                            S/ {monto}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* FORMATO 2: PAGO CON TARJETA */}
                {metodoPago === 'Tarjeta' && (
                  <div className="bg-blue-500/5 border border-blue-500/25 p-4 rounded-3xl space-y-2 animate-fade-in shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        Cobro con Tarjeta (POS)
                      </span>
                      <span className="text-xs font-black font-mono text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
                        Total: S/ {totalConCortesias.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                      El monto total de <strong className="font-mono text-blue-700 font-black">S/ {totalConCortesias.toFixed(2)}</strong> se registrará pagado íntegramente mediante tarjeta (Visa, Mastercard u otro POS).
                    </p>
                  </div>
                )}

                {/* FORMATO 3: PAGO CON YAPE / PLIN */}
                {metodoPago === 'Yape' && (
                  <div className="bg-purple-500/5 border border-purple-500/25 p-4 rounded-3xl space-y-2 animate-fade-in shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-purple-600" />
                        Cobro con Yape / Plin
                      </span>
                      <span className="text-xs font-black font-mono text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-lg border border-purple-200">
                        Total: S/ {totalConCortesias.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                      El monto total de <strong className="font-mono text-purple-700 font-black">S/ {totalConCortesias.toFixed(2)}</strong> se registrará pagado íntegramente mediante billetera digital (QR / Número celular).
                    </p>
                  </div>
                )}

                {metodoPago === 'Crédito' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-2">
                    <SelectorClienteCreditoCombobox
                      clientes={clientes}
                      clienteSeleccionado={clienteCreditoSeleccionado}
                      onSelectCliente={(c) => {
                        setClienteCreditoSeleccionado(c);
                        if (c) {
                          setClienteNombre(c.nombre);
                          setNumDocumento(c.numDoc || '');
                          setClienteDireccion(c.direccion || '');
                        }
                      }}
                      label="Seleccionar Cliente de Crédito:"
                    />
                  </div>
                )}

                {metodoPago === 'Mixto' && (() => {
                  const total = totalConCortesias;
                  const efecVal = parseMonto(mixtoEfectivo);
                  const tarjVal = parseMonto(mixtoTarjeta);
                  const yapeVal = parseMonto(mixtoYape);

                  // Crédito calculado de las filas de clientes si el checkbox está activo
                  const credVal = incluirCreditoMixto 
                    ? (clientesCreditoMixto || []).reduce((s, c) => s + parseMonto(c.monto), 0)
                    : 0;

                  const totalIngresado = efecVal + tarjVal + yapeVal + credVal;
                  const restanteFisico = Math.max(0, total - (tarjVal + yapeVal + credVal));
                  const vuelto = efecVal > restanteFisico ? efecVal - restanteFisico : 0;
                  const faltante = Math.max(0, total - (Math.min(efecVal, restanteFisico) + tarjVal + yapeVal + credVal));
                  const cuadraExacto = faltante <= 0.01 && (tarjVal + yapeVal + credVal) <= (total + 0.01);

                  // Porcentajes para barra visual
                  const pctEfec = total > 0 ? Math.min(100, (Math.min(efecVal, restanteFisico) / total) * 100) : 0;
                  const pctTarj = total > 0 ? Math.min(100, (tarjVal / total) * 100) : 0;
                  const pctYape = total > 0 ? Math.min(100, (yapeVal / total) * 100) : 0;
                  const pctCred = total > 0 ? Math.min(100, (credVal / total) * 100) : 0;
                  const noEfectivoExcedido = (tarjVal + yapeVal + credVal) > (total + 0.01);

                  return (
                    <div className="bg-slate-900/5 border border-slate-200 p-4 rounded-3xl shadow-sm space-y-4">
                      {/* Header y Barra Visual */}
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-black uppercase tracking-wider">
                          <span className="text-slate-800 flex items-center gap-1.5">
                            <Calculator className="w-4 h-4 text-amber-500" /> Desglose de Pago Mixto
                          </span>
                          <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 text-[11px] font-black">
                            Total a Cobrar: S/ {total.toFixed(2)}
                          </span>
                        </div>

                        {/* Barra de Progreso Multicolor */}
                        <div className="h-3.5 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                          {pctEfec > 0 && (
                            <div style={{ width: `${pctEfec}%` }} className="bg-emerald-500 h-full transition-all duration-300" title={`Efectivo: S/ ${efecVal.toFixed(2)}`} />
                          )}
                          {pctTarj > 0 && (
                            <div style={{ width: `${pctTarj}%` }} className="bg-blue-500 h-full transition-all duration-300" title={`Tarjeta: S/ ${tarjVal.toFixed(2)}`} />
                          )}
                          {pctYape > 0 && (
                            <div style={{ width: `${pctYape}%` }} className="bg-purple-500 h-full transition-all duration-300" title={`Yape/Plin: S/ ${yapeVal.toFixed(2)}`} />
                          )}
                          {pctCred > 0 && (
                            <div style={{ width: `${pctCred}%` }} className="bg-teal-500 h-full transition-all duration-300" title={`Crédito: S/ ${credVal.toFixed(2)}`} />
                          )}
                        </div>

                        {/* Leyenda interactiva de la barra */}
                        <div className="flex flex-wrap gap-2.5 text-[9px] font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Efectivo</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Tarjeta</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Yape/Plin</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block" /> Crédito</span>
                        </div>
                      </div>

                      {/* Alerta de exceso de métodos no efectivo */}
                      {noEfectivoExcedido && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-[10px] font-bold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Tarjeta, Yape y Crédito suman S/ {(tarjVal + yapeVal + credVal).toFixed(2)}, lo cual supera el total de la cuenta (S/ {total.toFixed(2)}). El vuelto solo se genera con pago en Efectivo.</span>
                        </div>
                      )}

                      {/* Grid de Inputs de Métodos de Pago: 3 Métodos Directos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* 1. EFECTIVO */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-slate-700 font-black text-[11px] tracking-wider uppercase flex items-center gap-1">
                                💵 Efectivo
                              </label>
                              {efecVal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setMixtoEfectivo('')}
                                  className="text-[9px] font-bold text-slate-400 hover:text-rose-600"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-black text-sm">S/</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={mixtoEfectivo}
                                onChange={(e) => setMixtoEfectivo(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 font-mono font-black text-slate-900 text-base focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                              />
                            </div>
                          </div>
                          {/* Chips de billetes */}
                          <div className="flex gap-1 mt-2.5">
                            {[10, 20, 50, 100].map(billete => (
                              <button
                                key={billete}
                                type="button"
                                onClick={() => {
                                  const actual = parseMonto(mixtoEfectivo);
                                  setMixtoEfectivo((actual + billete).toFixed(2));
                                }}
                                className="flex-1 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-600 font-mono font-bold text-[9px] rounded-lg transition-all active:scale-95"
                              >
                                +{billete}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. TARJETA */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-slate-700 font-black text-[11px] tracking-wider uppercase flex items-center gap-1">
                                💳 Tarjeta
                              </label>
                              {tarjVal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setMixtoTarjeta('')}
                                  className="text-[9px] font-bold text-slate-400 hover:text-rose-600"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-black text-sm">S/</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={mixtoTarjeta}
                                onChange={(e) => setMixtoTarjeta(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 font-mono font-black text-slate-900 text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                              />
                            </div>
                          </div>
                          <div className="mt-2.5 flex justify-end">
                            <span className="text-[10px] text-slate-400 font-medium">Pago POS / Tarjeta</span>
                          </div>
                        </div>

                        {/* 3. YAPE / PLIN */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:border-purple-400 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-slate-700 font-black text-[11px] tracking-wider uppercase flex items-center gap-1">
                                📱 Yape / Plin
                              </label>
                              {yapeVal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setMixtoYape('')}
                                  className="text-[9px] font-bold text-slate-400 hover:text-rose-600"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-black text-sm">S/</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={mixtoYape}
                                onChange={(e) => setMixtoYape(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 font-mono font-black text-slate-900 text-base focus:outline-none focus:border-purple-500 focus:bg-white transition-all"
                              />
                            </div>
                          </div>
                          <div className="mt-2.5 flex justify-end">
                            <span className="text-[10px] text-slate-400 font-medium">Billetera Digital</span>
                          </div>
                        </div>
                      </div>

                      {/* CHECKBOX PARA HABILITAR PAGO A CRÉDITO */}
                      <div 
                        onClick={() => {
                          const nextState = !incluirCreditoMixto;
                          setIncluirCreditoMixto(nextState);
                          if (!nextState) {
                            setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
                          }
                        }}
                        className={`border-2 rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-between shadow-sm select-none ${
                          incluirCreditoMixto 
                            ? 'bg-teal-500/10 border-teal-500 text-teal-950' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={incluirCreditoMixto}
                            onChange={(e) => {
                              setIncluirCreditoMixto(e.target.checked);
                              if (!e.target.checked) {
                                setClientesCreditoMixto([{ clienteId: '', monto: '', nombre: '' }]);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                          <div>
                            <p className="font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-teal-600" /> ¿Incluir Pago con Crédito a Clientes?
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {incluirCreditoMixto 
                                ? 'Sección de crédito activada. Asigna el monto a cada cliente deudor a continuación.' 
                                : 'Marca esta casilla para seleccionar uno o varios clientes y asignarles monto a crédito.'}
                            </p>
                          </div>
                        </div>
                        {incluirCreditoMixto && (
                          <span className="font-mono font-black text-sm text-teal-900 bg-teal-100 px-3 py-1 rounded-xl border border-teal-200">
                            Total Crédito: S/ {credVal.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* SECCIÓN DESPLEGABLE: ASIGNACIÓN DE CLIENTES A CRÉDITO */}
                      {incluirCreditoMixto && (
                        <div className="bg-teal-500/5 border-2 border-teal-500/30 rounded-3xl p-4 space-y-3.5 shadow-sm animate-fade-in">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/80 pb-3">
                            <div>
                              <h4 className="text-xs font-black uppercase text-teal-900 flex items-center gap-2">
                                <Users className="w-4 h-4 text-teal-700" />
                                Clientes Deudores Asignados al Crédito
                              </h4>
                              <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                Selecciona al cliente e ingresa el monto que se cargará a su cuenta de crédito.
                              </p>
                            </div>
                            <span className="text-[10px] font-black px-3 py-1 rounded-full border shadow-sm bg-teal-100 text-teal-900 border-teal-300">
                              Suma Crédito: S/ {credVal.toFixed(2)}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {(clientesCreditoMixto || []).map((row, idx) => {
                              const currentClient = clientes.find(c => String(c.id) === String(row.clienteId));
                              const filaSinCliente = !row.clienteId && parseMonto(row.monto) > 0;

                              return (
                                <div key={idx} className={`bg-white border rounded-2xl p-3.5 space-y-2.5 shadow-sm transition-all ${
                                  filaSinCliente ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                                      <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[9px] font-black">
                                        {idx + 1}
                                      </span>
                                      Cliente de Crédito
                                    </span>
                                    {clientesCreditoMixto.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setClientesCreditoMixto(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                                        title="Eliminar cliente"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  <SelectorClienteCreditoCombobox
                                    clientes={clientes}
                                    clienteSeleccionado={currentClient}
                                    onSelectCliente={(c) => {
                                      setClientesCreditoMixto(prev => {
                                        const next = [...prev];
                                        next[idx] = {
                                          ...next[idx],
                                          clienteId: c ? c.id : '',
                                          nombre: c ? c.nombre : ''
                                        };
                                        return next;
                                      });
                                    }}
                                    label=""
                                    placeholder="Buscar por nombre, DNI o RUC..."
                                  />

                                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] font-black text-slate-600 uppercase shrink-0">Monto a cargar a este cliente:</span>
                                    <div className="relative flex-1">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs">S/</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={row.monto}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setClientesCreditoMixto(prev => {
                                            const next = [...prev];
                                            next[idx] = { ...next[idx], monto: val };
                                            return next;
                                          });
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2.5 py-1.5 font-mono font-black text-slate-800 text-sm focus:outline-none focus:border-teal-500 focus:bg-white"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setClientesCreditoMixto(prev => [...prev, { clienteId: '', monto: '', nombre: '' }]);
                            }}
                            className="w-full py-2.5 bg-white hover:bg-teal-50 text-teal-800 font-black text-xs uppercase rounded-2xl border-2 border-dashed border-teal-300 hover:border-teal-500 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                          >
                            <Plus className="w-4 h-4" />
                            Dividir crédito con otro cliente
                          </button>
                        </div>
                      )}

                      {/* RESUMEN FINAL DEL PAGO MIXTO */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-600 font-medium">
                          <span>Total de la Cuenta:</span>
                          <span className="font-mono font-black text-slate-900 text-sm">S/ {total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 font-medium">
                          <span>Total Ingresado (Efectivo + Tarjeta + Yape + Crédito):</span>
                          <span className="font-mono font-black text-slate-900 text-sm">S/ {totalIngresado.toFixed(2)}</span>
                        </div>
                        
                        {faltante > 0.01 && (
                          <div className="flex justify-between items-center text-amber-700 bg-amber-50 p-2.5 rounded-xl font-bold border border-amber-200">
                            <span>⏳ Saldo Faltante por Cubrir:</span>
                            <span className="font-mono font-black text-sm">S/ {faltante.toFixed(2)}</span>
                          </div>
                        )}

                        {vuelto > 0 && (
                          <div className="flex justify-between items-center text-emerald-800 bg-emerald-50 p-2.5 rounded-xl font-bold border border-emerald-200">
                            <span>💸 Vuelto a Entregar al Cliente:</span>
                            <span className="font-mono font-black text-base">S/ {vuelto.toFixed(2)}</span>
                          </div>
                        )}

                        {cuadraExacto && (
                          <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 p-2 rounded-xl font-black text-[11px] border border-emerald-200">
                            <span>✓ Cuenta completamente cubierta</span>
                            <span>S/ {total.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {(metodoPago === 'Consumo' || metodoPago === 'Cortesía' || tieneCortesiasIndividuales) && (
                  <div className="space-y-3 bg-amber-500/10 border-2 border-amber-500/30 p-4 rounded-3xl shadow-sm animate-fade-in">
                    {tieneCortesiasIndividuales && (
                      <div className="bg-white/80 border border-emerald-500/30 p-3 rounded-2xl text-[11px] text-emerald-900 font-bold flex items-start gap-2.5 shadow-sm">
                        <Gift className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black uppercase tracking-wider mb-0.5 text-emerald-700">🎁 Cortesía de Ítems Seleccionada</p>
                          <p className="text-slate-600 font-medium leading-tight">Se ha(n) marcado {cortesiaItemIds.length} producto(s) a S/ 0.00. Ingresa el PIN de Administrador / Cajero para autorizar el cobro.</p>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="block text-slate-700 font-black text-[11px] tracking-wider uppercase flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        PIN DE AUTORIZACIÓN (ADMINISTRADOR / CAJERO):
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={consumoPin}
                          onChange={(e) => {
                            setConsumoPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                            setConsumoPinError('');
                          }}
                          placeholder="INGRESA PIN DE ADMIN"
                          className="w-full bg-white border-2 border-amber-300 focus:border-amber-500 rounded-2xl px-4 py-3 text-center text-xl font-mono font-black tracking-[0.4em] text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner"
                          autoComplete="off"
                          name="consumo-pin-auth"
                        />
                      </div>
                      {consumoPinError && (
                        <p className="text-rose-600 text-xs font-black bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-center">
                          ⚠️ {consumoPinError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between">
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm max-h-[220px] overflow-y-auto custom-scrollbar flex-1 mb-4">
                  <h3 className="text-slate-400 font-black uppercase text-[10px] tracking-wider mb-2 border-b border-slate-100 pb-1 flex justify-between items-center">
                    <span>Detalle del Consumo</span>
                    <span className="text-slate-500">Mesa {mesaSeleccionada.num}</span>
                  </h3>
                  <ul className="space-y-1.5">
                    {mesaSeleccionada.pedidoData?.items
                      ?.filter(item => item && (item.precio > 0 || (item.categoria && BARRA_CATEGORIAS.includes(item.categoria)) || (item.notas && item.notas.includes('CORTESÍA')) || (item.nombre && item.nombre.includes('CORTESÍA'))))
                      ?.map((item, idx) => {
                      const prodOriginal = productosMenu && productosMenu.find(p => p && String(p.id) === String(item.id));
                      const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;
                      return (
                        <li key={idx} className="flex flex-col border-b border-dashed border-slate-100 pb-1.5 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-800 font-medium flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={cortesiaItemIds.includes(item.itemId)}
                                onChange={() => {
                                  if (cortesiaItemIds.includes(item.itemId)) {
                                    setCortesiaItemIds(prev => prev.filter(id => id !== item.itemId));
                                  } else {
                                    setCortesiaItemIds(prev => [...prev, item.itemId]);
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-slate-350 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                title="Marcar como Cortesía (S/ 0.00)"
                              />
                              <span className="font-black text-slate-900 mr-1.5">{item.cant}x</span>
                              <span className={`uppercase ${cortesiaItemIds.includes(item.itemId) ? 'line-through text-slate-400' : ''}`}>{item.nombre}</span>
                            </span>
                            <span className="font-mono text-slate-600 font-bold shrink-0 flex items-center gap-1.5">
                              {cortesiaItemIds.includes(item.itemId) ? (
                                <span className="text-emerald-600 font-black uppercase text-[10px] tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-250">🎁 Cortesía</span>
                              ) : (
                                <>
                                  {tieneDescuento && (
                                    <span className="line-through text-slate-400 font-semibold text-[10px]">S/ {(item.cant * prodOriginal.precio).toFixed(2)}</span>
                                  )}
                                  <span>S/ {(item.cant * item.precio).toFixed(2)}</span>
                                </>
                              )}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider shrink-0">📋 NOTA:</span>
                            <input 
                              type="text" 
                              placeholder="Ej: Coca Cola helada..." 
                              value={item.notas || item.notes || ''} 
                              onChange={(e) => {
                                setMesaSeleccionada(prev => {
                                  if (!prev || !prev.pedidoData) return prev;
                                  const nuevosItems = [...prev.pedidoData.items];
                                  const originalIdx = prev.pedidoData.items.findIndex(x => x.itemId === item.itemId);
                                  if (originalIdx >= 0) {
                                    nuevosItems[originalIdx].notas = e.target.value;
                                  }
                                  return {
                                    ...prev,
                                    pedidoData: {
                                      ...prev.pedidoData,
                                      items: nuevosItems
                                    }
                                  };
                                });
                              }}
                              onBlur={async (e) => {
                                if (item.itemId) {
                                  try {
                                    await api.updateItemNotas(item.itemId, e.target.value);
                                  } catch (err) {
                                    console.error("Error al actualizar nota en caja:", err);
                                  }
                                }
                              }}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-none focus:border-indigo-400 focus:bg-white"
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
                  <div className="space-y-2 mb-4 border-b border-slate-800 pb-4">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Subtotal (Sin IGV)</span>
                      <span className="font-mono">S/ {subtotalConCortesias.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>IGV (10.5%)</span>
                      <span className="font-mono">S/ {igvConCortesias.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-1">Monto Total</p>
                      <p className="text-slate-400 text-xs font-medium">Comprobante: {tipoComprobante}</p>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-white font-mono tracking-tighter text-right">
                        <span className="text-lg text-slate-500 mr-1 font-sans">S/</span>{totalConCortesias.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
              {(metodoPago === 'Consumo' || metodoPago === 'Cortesía' || tieneCortesiasIndividuales) && !consumoPin.trim() && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Se requiere ingresar el PIN de autorización para poder emitir el cobro.</span>
                </div>
              )}
              <button onClick={procesarCobroYFacturar} disabled={cobrando} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black uppercase tracking-widest rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2 disabled:opacity-50">
                {cobrando ? <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span> : <><CheckCircle className="w-5 h-5" /> Emitir {tipoComprobante} y Liberar Mesa</>}
              </button>
            </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE CONFIRMACIÓN DE COBRO */}
      {modalConfirmarCobro && datosConfirmacionCobro && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in border border-slate-200">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase tracking-tight">Confirmar Cobro</h3>
                  <p className="text-xs text-slate-400">Verifica los datos del pago</p>
                </div>
              </div>
              <button
                onClick={() => setModalConfirmarCobro(false)}
                disabled={cobrando}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Resumen */}
            <div className="p-6 space-y-4 bg-slate-50">
              
              {/* Tarjeta de información */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Origen / Mesa</span>
                  <span className="text-sm font-black text-slate-900">
                    {datosConfirmacionCobro.esDelivery ? '🛵 Para Llevar / Delivery' : `🍽️ Mesa ${datosConfirmacionCobro.mesaNum}`}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Comprobante</span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                    {datosConfirmacionCobro.tipoComprobante}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Cliente</span>
                  <span className="text-xs font-bold text-slate-800 text-right max-w-[200px] truncate">
                    {datosConfirmacionCobro.nombreCliente}
                    {datosConfirmacionCobro.numDocumento && ` (${datosConfirmacionCobro.numDocumento})`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Medio de Pago</span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 uppercase">
                    {datosConfirmacionCobro.metodoPago}
                  </span>
                </div>
              </div>

              {/* Total y Vuelto */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Total a Cobrar</span>
                  <span className="text-3xl font-black font-mono tracking-tight text-white">
                    S/ {datosConfirmacionCobro.total.toFixed(2)}
                  </span>
                </div>

                {datosConfirmacionCobro.metodoPago === 'Efectivo' && datosConfirmacionCobro.pagaCon > datosConfirmacionCobro.total && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400">Paga con: S/ {datosConfirmacionCobro.pagaCon.toFixed(2)}</span>
                    <span className="text-emerald-400 font-mono font-black text-sm">Vuelto: S/ {datosConfirmacionCobro.vuelto.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={() => setModalConfirmarCobro(false)}
                disabled={cobrando}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarCobroFinal}
                disabled={cobrando}
                className="flex-[2] py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {cobrando ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></span>
                    <span>Procesando Cobro...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmar y Cobrar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEDIDOS YA */}
      {deliveryModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full h-[95vh] md:h-auto md:max-h-[95vh] max-w-4xl rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-4 md:p-5 bg-blue-700 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center"><Truck className="w-5 h-5" /></div>
                <div>
                  <h2 className="font-black text-lg uppercase tracking-tight leading-none">
                    {editingPedidoId ? 'Modificar Pedido Llevar / Delivery' : 'Nuevo Pedido para Llevar / Delivery'}
                  </h2>
                  <p className="text-xs text-blue-200">
                    {editingPedidoId ? 'Actualizar detalles y productos de la comanda' : 'Registrar comanda de venta directa o canal externo'}
                  </p>
                </div>
              </div>
              <button onClick={() => { setDeliveryModal(false); setCodigoPY(''); setItemsDelivery([]); setEditingPedidoId(null); }} className="bg-blue-800 p-2 rounded-xl hover:bg-blue-900 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 min-h-0">
              {/* Productos */}
              <div className="w-full md:w-3/5 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50">
                <div className="p-4 border-b border-slate-200 bg-white shrink-0 flex flex-col gap-4">
                  {/* Selector de Tipo */}
                  <div>
                    <label className="block text-slate-500 font-bold text-[10px] tracking-widest uppercase mb-1.5">Origen / Tipo de Pedido:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        type="button" 
                        onClick={() => { setTipoDelivery('PedidosYa'); setCodigoPY(''); setDeliveryMontoEnvio(''); }}
                        className={`py-2 px-1 text-[10px] md:text-xs font-black uppercase rounded-xl border-2 transition-all text-center ${tipoDelivery === 'PedidosYa' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}
                      >
                        🛵 PedidosYa
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setTipoDelivery('ParaLlevar'); setCodigoPY(''); setDeliveryMontoEnvio(''); }}
                        className={`py-2 px-1 text-[10px] md:text-xs font-black uppercase rounded-xl border-2 transition-all text-center ${tipoDelivery === 'ParaLlevar' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}
                      >
                        🛍️ Para Llevar
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setTipoDelivery('DeliveryPropio'); setCodigoPY(''); }}
                        className={`py-2 px-1 text-[10px] md:text-xs font-black uppercase rounded-xl border-2 transition-all text-center ${tipoDelivery === 'DeliveryPropio' ? 'bg-indigo-50 border-indigo-500 text-indigo-750' : 'bg-white border-slate-200 text-slate-500'}`}
                      >
                        📞 Delivery Fogon
                      </button>
                    </div>
                  </div>

                  {tipoDelivery !== 'DeliveryPropio' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-500 font-bold text-[10px] tracking-widest uppercase mb-1">
                          {tipoDelivery === 'PedidosYa' ? 'Código PedidosYa:' : 'Nombre del Cliente / Ticket:'}
                        </label>
                        <input
                          type="text"
                          value={codigoPY}
                          onChange={(e) => setCodigoPY(e.target.value)}
                          placeholder={tipoDelivery === 'PedidosYa' ? 'Ej: FG-4821' : 'Ej: PEDRO o T-12'}
                          className="w-full bg-slate-50 border-2 border-blue-300 focus:border-blue-500 rounded-xl px-3 py-2 font-mono font-black text-slate-900 text-sm focus:outline-none uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold text-[10px] tracking-widest uppercase mb-1">Cajero:</label>
                        <div className="w-full bg-slate-150 border border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800 text-sm uppercase">
                          {cajeroNombre}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                      <div className="col-span-2">
                        <label className="block text-slate-550 font-bold text-[9px] tracking-widest uppercase mb-1">Nombre Cliente:</label>
                        <input 
                          type="text" 
                          value={deliveryClienteNombre} 
                          onChange={(e) => setDeliveryClienteNombre(e.target.value)} 
                          placeholder="Ej: Juan Pérez"
                          className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-550 font-bold text-[9px] tracking-widest uppercase mb-1">Teléfono:</label>
                        <input 
                          type="text" 
                          value={deliveryTelefono} 
                          onChange={(e) => setDeliveryTelefono(e.target.value)} 
                          placeholder="Ej: 999888777"
                          className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-550 font-bold text-[9px] tracking-widest uppercase mb-1">Envío (S/):</label>
                        <input 
                          type="number" 
                          value={deliveryMontoEnvio} 
                          onChange={(e) => setDeliveryMontoEnvio(e.target.value)} 
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-slate-550 font-bold text-[9px] tracking-widest uppercase mb-1">Dirección de Entrega:</label>
                        <input 
                          type="text" 
                          value={deliveryDireccion} 
                          onChange={(e) => setDeliveryDireccion(e.target.value)} 
                          placeholder="Ej: Av. Hoyos Rubio Nro. 338"
                          className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Buscador inteligente */}
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Buscar plato (ej: 'cuarto de pollo', 'octavo', 'medio', 'chela')..." 
                      value={deliverySearchQuery}
                      onChange={(e) => setDeliverySearchQuery(e.target.value)}
                      className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-sm focus:outline-none focus:bg-white font-bold text-slate-800"
                    />
                    {deliverySearchQuery && (
                      <button 
                        type="button"
                        onClick={() => setDeliverySearchQuery('')} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 overflow-y-auto custom-scrollbar content-start flex-1">
                  {(() => {
                    const menuFiltradoPre = productosMenu.filter(p => matchProductSemantic(p, deliverySearchQuery) && p.activo);
                    const menuFiltrado = agruparProductos(menuFiltradoPre);
                    
                    if (menuFiltrado.length === 0) {
                      return <div className="col-span-full text-center text-slate-400 font-medium py-12 text-sm">No se encontraron productos coincidentes.</div>;
                    }
                    
                    return menuFiltrado.map(prod => {
                      const isGroup = prod.esAgrupado;
                      const cantEnTicket = isGroup 
                        ? 0 
                        : itemsDelivery.filter(i => String(i.id) === String(prod.id)).reduce((sum, item) => sum + item.cant, 0);
                      const stockDisponible = prod.tipoStock === 'limitado' ? prod.stock - cantEnTicket : Infinity;
                      const agotado = prod.tipoStock === 'limitado' && stockDisponible <= 0;

                      return (
                        <div 
                          key={prod.id} 
                          onClick={() => !agotado && agregarItemDelivery(prod)} 
                          className={`bg-white border rounded-xl p-3 flex flex-col justify-between shadow-sm relative overflow-hidden h-24 transition-all ${
                            agotado 
                              ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed bg-slate-50' 
                              : 'cursor-pointer hover:border-blue-400 hover:-translate-y-0.5 active:bg-slate-50'
                          }`}
                        >
                          {prod.precioOferta !== null && prod.precioOferta !== undefined && !agotado && !isGroup && (
                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-0.5 animate-pulse z-15">
                              <Tag className="w-2 h-2" />
                              {prod.ofertaValor}% OFF
                            </div>
                          )}
                          <div className="z-10 flex flex-col justify-between h-full w-full">
                            <div>
                              <p className="font-bold text-slate-800 text-[10px] uppercase leading-tight pr-4">{prod.nombre}</p>
                              {isGroup && (
                                <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1.5 bg-blue-100 text-blue-700">
                                  OPCIONES DE CARNE
                                </span>
                              )}
                              {prod.tipoStock === 'limitado' && !isGroup && (
                                <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded mt-1.5 ${
                                  agotado ? 'bg-red-100 text-red-650' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {agotado ? 'AGOTADO' : `STOCK: ${stockDisponible}`}
                                </span>
                              )}
                            </div>
                            {isGroup ? (
                              <p className="font-black font-mono text-blue-600 text-xs md:text-sm">
                                Desde S/ {prod.precioMin.toFixed(2)}
                              </p>
                            ) : (
                              prod.precioOferta !== null && prod.precioOferta !== undefined ? (
                                <div className="flex flex-col items-start leading-none">
                                  <span className="font-black font-mono text-blue-600 text-sm">S/ {prod.precioOferta.toFixed(2)}</span>
                                  <span className="line-through text-slate-400 font-semibold text-[10px] mt-0.5">S/ {prod.precio.toFixed(2)}</span>
                                </div>
                              ) : (
                                <p className="font-black font-mono text-blue-600 text-sm">S/ {prod.precio.toFixed(2)}</p>
                              )
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Ticket delivery */}
              <div className="w-full md:w-2/5 bg-white flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-blue-50 shrink-0">
                  <h3 className="font-black text-blue-700 uppercase text-xs flex items-center gap-2"><Truck className="w-4 h-4" /> Detalle del Pedido</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {itemsDelivery.length === 0
                    ? <p className="text-center text-slate-400 text-xs font-medium py-8">Toca un producto para agregarlo</p>
                    : itemsDelivery.map((item, idx) => {
                        const prodOriginal = productosMenu.find(p => String(p.id) === String(item.id));
                        const esCortesiaItem = cortesiaDeliveryIndices.includes(idx) || deliveryMetodoPago === 'Cortesía';
                        const tieneDescuento = prodOriginal && prodOriginal.precio > item.precio;

                        return (
                          <div key={idx} className={`py-2.5 px-2 border-b border-dashed last:border-0 rounded-xl transition-all ${
                            esCortesiaItem ? 'bg-emerald-50/70 border-emerald-200' : 'border-slate-100'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={`font-bold text-xs uppercase leading-tight ${esCortesiaItem ? 'text-emerald-950 line-through' : 'text-slate-800'}`}>
                                    {item.nombre}
                                  </p>
                                  {esCortesiaItem && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-0.5">
                                      <Gift className="w-2.5 h-2.5" /> Cortesía
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                  {esCortesiaItem ? (
                                    <>
                                      <span className="line-through text-slate-400 font-semibold text-xs font-mono">
                                        S/ {(item.cant * item.precio).toFixed(2)}
                                      </span>
                                      <span className="font-mono text-emerald-700 font-black text-sm">
                                        S/ 0.00
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      {tieneDescuento && (
                                        <span className="line-through text-slate-400 font-semibold text-xs font-mono">
                                          S/ {(item.cant * prodOriginal.precio).toFixed(2)}
                                        </span>
                                      )}
                                      <span className="font-mono text-blue-600 font-bold text-sm">
                                        S/ {(item.cant * item.precio).toFixed(2)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Botón individual de cortesía (si el método global no es Cortesía) */}
                                {deliveryMetodoPago !== 'Cortesía' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (cortesiaDeliveryIndices.includes(idx)) {
                                        setCortesiaDeliveryIndices(prev => prev.filter(i => i !== idx));
                                      } else {
                                        setCortesiaDeliveryIndices(prev => [...prev, idx]);
                                      }
                                    }}
                                    className={`p-1.5 rounded-lg border text-[9px] font-black uppercase transition-all flex items-center gap-1 ${
                                      cortesiaDeliveryIndices.includes(idx)
                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                                        : 'bg-white text-slate-400 border-slate-200 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                                    }`}
                                    title={cortesiaDeliveryIndices.includes(idx) ? 'Quitar cortesía' : 'Marcar este producto como Cortesía (S/ 0.00)'}
                                  >
                                    <Gift className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                                  <button type="button" onClick={() => alterarItemDelivery(idx, '-')} className="w-7 h-7 bg-white rounded-md shadow-sm font-black text-slate-600 text-lg leading-none">-</button>
                                  <span className="font-bold text-slate-900 w-5 text-center text-sm">{item.cant}</span>
                                  <button type="button" onClick={() => alterarItemDelivery(idx, '+')} className="w-7 h-7 bg-white rounded-md shadow-sm font-black text-slate-600 text-lg leading-none">+</button>
                                </div>
                              </div>
                            </div>
                            {/* Campo de especificaciones por ítem */}
                            <input
                              type="text"
                              placeholder="Especificaciones (ej: sin cebolla)..."
                              value={item.notas || ''}
                              onChange={(e) => alterarNotasDelivery(idx, e.target.value)}
                              className="w-full mt-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:bg-amber-50/30"
                            />
                          </div>
                        );
                      })
                  }
                </div>

                {itemsDelivery.length > 0 && (
                  <div className="p-3 bg-blue-500/5 border-t border-dashed border-slate-200 flex justify-between items-center gap-3 shrink-0">
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Descuento (%)</span>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      placeholder="0"
                      value={deliveryDescuentoPorcentaje} 
                      onChange={(e) => setDeliveryDescuentoPorcentaje(e.target.value)}
                      className="w-20 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-center font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Formulario de Facturación / Pago para Para Llevar y Delivery Propio */}
                {(tipoDelivery === 'ParaLlevar' || tipoDelivery === 'DeliveryPropio') && (
                  <div className="p-4 bg-slate-50 border-t border-b border-slate-200 space-y-4 shrink-0">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      Facturación y Cobro
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase mb-1">Comprobante:</label>
                        <select 
                          value={(deliveryMetodoPago === 'Crédito' || deliveryMetodoPago === 'Cortesía' || deliveryMetodoPago === 'Consumo') ? 'Ticket' : deliveryTipoComprobante} 
                          onChange={(e) => {
                            setDeliveryTipoComprobante(e.target.value);
                            setDeliveryNumDocumento('');
                            setDeliveryClienteNombre('');
                          }} 
                          disabled={deliveryMetodoPago === 'Crédito' || deliveryMetodoPago === 'Cortesía' || deliveryMetodoPago === 'Consumo'}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-bold text-slate-800 text-xs focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="Ticket">{(deliveryMetodoPago === 'Crédito' || deliveryMetodoPago === 'Cortesía' || deliveryMetodoPago === 'Consumo') ? 'Ticket Interno (forzado)' : 'Ticket Interno'}</option>
                          {deliveryMetodoPago !== 'Crédito' && deliveryMetodoPago !== 'Cortesía' && deliveryMetodoPago !== 'Consumo' && <option value="Boleta">Boleta (DNI)</option>}
                          {deliveryMetodoPago !== 'Crédito' && deliveryMetodoPago !== 'Cortesía' && deliveryMetodoPago !== 'Consumo' && <option value="Factura">Factura (RUC)</option>}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase mb-1">Método Pago:</label>
                        <select 
                          value={deliveryMetodoPago} 
                          onChange={(e) => {
                            setDeliveryMetodoPago(e.target.value);
                            if (e.target.value === 'Crédito' || e.target.value === 'Cortesía' || e.target.value === 'Consumo') {
                              setDeliveryTipoComprobante('Ticket');
                              setDeliveryNumDocumento('');
                            }
                          }} 
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 font-bold text-slate-800 text-xs focus:outline-none"
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="Tarjeta">Tarjeta (Visa/MC)</option>
                          <option value="Yape">Yape / Plin</option>
                          <option value="Crédito">💳 Crédito</option>
                          <option value="Cortesía">🎁 Cortesía Total</option>
                          <option value="Consumo">👤 Consumo Personal</option>
                          <option value="Mixto">➕ Mixto</option>
                        </select>
                      </div>
                    </div>

                    {/* PIN DE AUTORIZACIÓN PARA CORTESÍA / CONSUMO EN LLEVAR/DELIVERY */}
                    {(deliveryMetodoPago === 'Cortesía' || deliveryMetodoPago === 'Consumo' || cortesiaDeliveryIndices.length > 0) && (
                      <div className="space-y-2 bg-amber-500/10 border-2 border-amber-500/30 p-3.5 rounded-2xl shadow-sm animate-fade-in">
                        <label className="block text-slate-800 font-black text-[10px] tracking-wider uppercase flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          PIN DE AUTORIZACIÓN (ADMINISTRADOR / CAJERO):
                        </label>
                        <p className="text-[10px] text-slate-600 font-medium leading-tight">
                          {deliveryMetodoPago === 'Cortesía' 
                            ? '🎁 Has seleccionado Cortesía total (S/ 0.00). Ingresa el PIN para autorizar el pedido.' 
                            : deliveryMetodoPago === 'Consumo'
                              ? '👤 Has seleccionado Consumo de Personal. Ingresa el PIN para autorizar el pedido.'
                              : `🎁 Se ha(n) marcado ${cortesiaDeliveryIndices.length} producto(s) como Cortesía (S/ 0.00). Ingresa el PIN para autorizar.`}
                        </p>
                        <div className="relative">
                          <input
                            type="password"
                            value={pinAdminDelivery}
                            onChange={(e) => setPinAdminDelivery(e.target.value)}
                            placeholder="Ingresa PIN de autorización"
                            maxLength={10}
                            autoComplete="off"
                            className="w-full bg-white border-2 border-amber-300 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-center text-sm font-black tracking-widest text-slate-900 focus:outline-none transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 placeholder:text-xs"
                          />
                          <KeyRound className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    )}

                    {deliveryMetodoPago === 'Crédito' && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mt-2">
                        <label className="block text-slate-500 font-bold mb-1 text-[9px] tracking-widest uppercase">Seleccionar Cliente de Crédito:</label>
                        <select 
                          value={deliveryClienteCreditoSeleccionado?.id || ''} 
                          onChange={(e) => {
                            const client = clientes.find(c => String(c.id) === String(e.target.value));
                            setDeliveryClienteCreditoSeleccionado(client || null);
                            if (client) {
                              setDeliveryClienteNombre(client.nombre);
                              setDeliveryNumDocumento(client.numDoc || '');
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-bold text-slate-800 text-xs"
                        >
                          <option value="">-- Seleccionar Cliente --</option>
                          {clientes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} {c.esTrabajador ? '(STAFF)' : `(${c.tipoDoc}: ${c.numDoc || 'S/D'})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Pago Mixto para Delivery */}
                    {deliveryMetodoPago === 'Mixto' && (() => {
                      const total = grandTotalDelivery;

                      const efecVal = parseFloat(deliveryMixtoEfectivo || 0);
                      const tarjVal = parseFloat(deliveryMixtoTarjeta || 0);
                      const yapeVal = parseFloat(deliveryMixtoYape || 0);
                      const credVal = parseFloat(deliveryMontoCredito || 0);
                      const ingresado = efecVal + tarjVal + yapeVal + credVal;
                      const restante = Math.max(0, total - (tarjVal + yapeVal + credVal));
                      const vuelto = efecVal > restante ? efecVal - restante : 0;
                      const diferencia = total - ingresado;

                      return (
                        <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-2xl shadow-sm space-y-3">
                          <h4 className="text-[9px] font-black uppercase tracking-wider text-amber-600 flex justify-between">
                            <span>Desglose de Pago Mixto</span>
                            <span>Total: S/ {total.toFixed(2)}</span>
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <div className="flex justify-between items-center mb-0.5">
                                <label className="block text-slate-500 font-bold text-[8px] tracking-wider uppercase">💵 Efec.</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const resto = Math.max(0, total - (tarjVal + yapeVal + credVal));
                                    setDeliveryMixtoEfectivo(resto > 0 ? resto.toFixed(2) : '');
                                  }}
                                  className="text-[8px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-1 py-0.2 rounded cursor-pointer transition-all active:scale-95"
                                  title="Completar el saldo restante"
                                >
                                  Completar
                                </button>
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={deliveryMixtoEfectivo}
                                onChange={(e) => setDeliveryMixtoEfectivo(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-0.5">
                                <label className="block text-slate-500 font-bold text-[8px] tracking-wider uppercase">💳 Tarj.</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const resto = Math.max(0, total - (efecVal + yapeVal + credVal));
                                    setDeliveryMixtoTarjeta(resto > 0 ? resto.toFixed(2) : '');
                                  }}
                                  className="text-[8px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-1 py-0.2 rounded cursor-pointer transition-all active:scale-95"
                                  title="Completar el saldo restante"
                                >
                                  Completar
                                </button>
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={deliveryMixtoTarjeta}
                                onChange={(e) => setDeliveryMixtoTarjeta(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-0.5">
                                <label className="block text-slate-500 font-bold text-[8px] tracking-wider uppercase">📱 Yape</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const resto = Math.max(0, total - (efecVal + tarjVal + credVal));
                                    setDeliveryMixtoYape(resto > 0 ? resto.toFixed(2) : '');
                                  }}
                                  className="text-[8px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-1 py-0.2 rounded cursor-pointer transition-all active:scale-95"
                                  title="Completar el saldo restante"
                                >
                                  Completar
                                </button>
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={deliveryMixtoYape}
                                onChange={(e) => setDeliveryMixtoYape(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-0.5">
                                <label className="block text-slate-500 font-bold text-[8px] tracking-wider uppercase">👥 Créd.</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const resto = Math.max(0, total - (efecVal + tarjVal + yapeVal));
                                    setDeliveryMontoCredito(resto > 0 ? resto.toFixed(2) : '');
                                  }}
                                  className="text-[8px] font-black text-amber-600 hover:text-amber-700 bg-amber-50 px-1 py-0.2 rounded cursor-pointer transition-all active:scale-95"
                                  title="Completar el saldo restante"
                                >
                                  Completar
                                </button>
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={deliveryMontoCredito}
                                onChange={(e) => setDeliveryMontoCredito(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          {credVal > 0 && (
                            <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                              <label className="block text-slate-500 font-bold mb-1 text-[8px] tracking-widest uppercase">Cliente para Crédito:</label>
                              <input
                                type="text"
                                placeholder="Buscar por nombre o doc..."
                                value={busquedaClienteCreditoDelivery}
                                onChange={e => setBusquedaClienteCreditoDelivery(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500"
                              />
                              <select
                                value={deliveryClienteCreditoSeleccionado?.id || ''}
                                onChange={(e) => {
                                  const client = clientes.find(c => String(c.id) === String(e.target.value));
                                  setDeliveryClienteCreditoSeleccionado(client || null);
                                }}
                                size={Math.min(4, clientes.filter(c =>
                                  !busquedaClienteCreditoDelivery ||
                                  (c.nombre || '').toLowerCase().includes(busquedaClienteCreditoDelivery.toLowerCase()) ||
                                  (c.numDoc || '').includes(busquedaClienteCreditoDelivery)
                                ).length + 1)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 focus:outline-none focus:border-amber-500 font-bold text-slate-800 text-xs"
                              >
                                <option value="">-- Seleccionar --</option>
                                {clientes
                                  .filter(c =>
                                    !busquedaClienteCreditoDelivery ||
                                    (c.nombre || '').toLowerCase().includes(busquedaClienteCreditoDelivery.toLowerCase()) ||
                                    (c.numDoc || '').includes(busquedaClienteCreditoDelivery)
                                  )
                                  .map(c => (
                                    <option key={c.id} value={c.id}>
                                      {c.nombre} {c.esTrabajador ? '(STAFF)' : `(${c.tipoDoc}: ${c.numDoc || 'S/D'})`} {(c.saldo || 0) > 0 ? `· Debe S/${(c.saldo).toFixed(2)}` : ''}
                                    </option>
                                  ))
                                }
                              </select>
                              {deliveryClienteCreditoSeleccionado && (
                                <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${(deliveryClienteCreditoSeleccionado.saldo || 0) > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  Saldo actual: S/ {(deliveryClienteCreditoSeleccionado.saldo || 0).toFixed(2)}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="bg-white/80 p-2 rounded-lg border border-slate-100 grid grid-cols-2 gap-1 text-[9px] font-bold text-slate-500">
                            <div className="flex justify-between">
                              <span>Ingresado:</span>
                              <span className="font-mono text-slate-700">S/ {ingresado.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Faltante:</span>
                              <span className={`font-mono ${diferencia > 0 ? 'text-red-650' : 'text-emerald-600'}`}>
                                S/ {Math.max(0, diferencia).toFixed(2)}
                              </span>
                            </div>
                            {vuelto > 0 && (
                              <div className="flex justify-between col-span-2 border-t border-slate-100 pt-1 mt-0.5 text-[10px] text-emerald-700 font-black">
                                <span>💸 Vuelto:</span>
                                <span className="font-mono">S/ {vuelto.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {(deliveryTipoComprobante === 'Boleta' || deliveryTipoComprobante === 'Factura') && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase mb-1">
                              {deliveryTipoComprobante === 'Factura' ? 'RUC del Cliente:' : 'DNI del Cliente:'}
                            </label>
                            <div className="flex gap-1.5">
                              <input 
                                type="text" 
                                value={deliveryNumDocumento} 
                                onChange={(e) => setDeliveryNumDocumento(e.target.value)} 
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarClienteDelivery(); } }}
                                placeholder={deliveryTipoComprobante === 'Factura' ? '11 dígitos' : '8 dígitos'}
                                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={buscarClienteDelivery}
                                disabled={isBuscando}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-2.5 rounded-xl text-xs font-black flex items-center justify-center transition-colors shrink-0"
                              >
                                {isBuscando ? (
                                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                  <Search className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase mb-1">
                              {deliveryTipoComprobante === 'Factura' ? 'Razón Social:' : 'Nombre Cliente:'}
                            </label>
                            <input 
                              type="text" 
                              value={deliveryClienteNombre} 
                              onChange={(e) => setDeliveryClienteNombre(e.target.value)} 
                              placeholder="Nombre/Razón Social"
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>
                        {deliveryTipoComprobante === 'Factura' && tipoDelivery !== 'DeliveryPropio' && (
                          <div>
                            <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase mb-1">
                              Dirección Fiscal:
                            </label>
                            <input 
                              type="text" 
                              value={deliveryDireccion} 
                              onChange={(e) => setDeliveryDireccion(e.target.value)} 
                              placeholder="Obligatorio (Ej. Av. Hoyos Rubio Nro. 338)" 
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500" 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vuelto / Cancelación en Efectivo */}
                    {deliveryMetodoPago === 'Efectivo' && (
                      <div className="grid grid-cols-2 gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-inner">
                        <div>
                          <label className="block text-slate-500 font-bold text-[9px] tracking-widest uppercase mb-1">Paga Con (S/):</label>
                          <input 
                            type="number" 
                            value={deliveryConCuanto} 
                            onChange={(e) => setDeliveryConCuanto(e.target.value)} 
                            placeholder="0.00"
                            className="w-full bg-slate-50 border border-slate-250 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs font-mono font-black text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col justify-end">
                          <span className="text-slate-400 font-bold text-[9px] uppercase tracking-widest leading-none">Vuelto:</span>
                          <span className="font-mono font-black text-sm text-emerald-600 mt-1">
                            S/ {(() => {
                              const conC = parseFloat(deliveryConCuanto);
                              return (!isNaN(conC) && conC >= grandTotalDelivery) ? (conC - grandTotalDelivery).toFixed(2) : '0.00';
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    {deliveryMetodoPago === 'Tarjeta' && (
                      <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-center justify-between text-xs animate-fade-in shadow-xs">
                        <span className="font-bold text-blue-900 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-blue-600" /> Cobro con Tarjeta (POS)
                        </span>
                        <span className="font-mono font-black text-blue-700">S/ {grandTotalDelivery.toFixed(2)}</span>
                      </div>
                    )}

                    {deliveryMetodoPago === 'Yape' && (
                      <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl flex items-center justify-between text-xs animate-fade-in shadow-xs">
                        <span className="font-bold text-purple-900 flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-purple-600" /> Cobro con Yape / Plin
                        </span>
                        <span className="font-mono font-black text-purple-700">S/ {grandTotalDelivery.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                  <div className="space-y-1.5 mb-4 border-b border-dashed border-slate-100 pb-3 px-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Subtotal Productos</span>
                      <span className="font-mono">S/ {totalDelivery.toFixed(2)}</span>
                    </div>
                    {deliveryDescuentoMonto > 0 && (
                      <div className="flex justify-between text-xs text-rose-600 font-bold">
                        <span>Descuento ({deliveryDescPct}%)</span>
                        <span className="font-mono">- S/ {deliveryDescuentoMonto.toFixed(2)}</span>
                      </div>
                    )}
                    {tipoDelivery === 'DeliveryPropio' && (
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Costo de Envío</span>
                        <span className="font-mono">S/ {deliveryShippingFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-end pt-1">
                      <span className="font-black text-slate-500 uppercase text-[10px] tracking-widest">Total a Pagar</span>
                      <span className="font-black font-mono text-2xl text-blue-700">
                        S/ {grandTotalDelivery.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Banner de advertencia si falta PIN de autorización */}
                  {(deliveryMetodoPago === 'Cortesía' || deliveryMetodoPago === 'Consumo' || cortesiaDeliveryIndices.length > 0) && !pinAdminDelivery.trim() && (
                    <div className="mb-3 bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center gap-2 text-[10px] font-bold text-amber-900 animate-pulse">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Debes ingresar el PIN de autorización para registrar la cortesía / consumo.</span>
                    </div>
                  )}

                  <button
                    onClick={enviarDeliveryACocina}
                    disabled={enviandoDelivery}
                    className={`w-full py-4 text-white font-black uppercase tracking-widest rounded-2xl text-sm transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 ${
                      editingPedidoId 
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                        : tipoDelivery === 'ParaLlevar' 
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
                          : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                    }`}
                  >
                    {enviandoDelivery ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        {tipoDelivery === 'ParaLlevar' ? <Banknote className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                        {editingPedidoId 
                          ? 'Actualizar y Enviar a Cocina'
                          : tipoDelivery === 'ParaLlevar' 
                            ? 'Cobrar y Enviar a Cocina' 
                            : 'Registrar y Enviar a Cocina'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SELECCIÓN DE OPCIONES Y COMBOS (INTERACTIVO PARA DELIVERY) */}
      {optionsModalOpen && selectedProduct && (() => {
        const steps = getProductSteps(selectedProduct, selections);
        if (steps.length === 0) return null;
        
        const currentStep = steps[currentStepIdx];
        const esUltimoPaso = currentStepIdx === steps.length - 1;
        const seleccionActual = selections[currentStep.key];
        
        const handleSelectOption = (val) => {
          setSelections(prev => ({ ...prev, [currentStep.key]: val }));
          
          if (!esUltimoPaso) {
            setTimeout(() => {
              setCurrentStepIdx(prev => prev + 1);
            }, 150);
          }
        };
        
        const handleConfirm = () => {
          if (selectedProduct.esAgrupado) {
            const prodVariante = selections["producto_variante"];
            if (!prodVariante) {
              alert("Por favor, selecciona una opción.");
              return;
            }
            agregarItemDeliveryDirecto(prodVariante, additionalNotes);
          } else if (selectedProduct.categoria === 'Menú') {
            const notesArray = [];
            const guarn = selections["guarnicion_menu"];
            const entr = selections["entrada_menu"];
            
            if (guarn) notesArray.push(`[Guarnición: ${guarn}]`);
            if (entr) notesArray.push(`[Entrada: ${entr}]`);
            
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            agregarItemDeliveryDirecto(selectedProduct, finalNotes);
          } else if (getComboConfig(selectedProduct.nombre)) {
            const notesArray = [];
            const fondo = selections["fondo"];
            const proteina = selections["proteina"];
            const entrada = selections["entrada"];
            const bebida = selections["bebida"];
            
            if (fondo) {
              if (proteina) {
                const cleanFondoName = fondo.replace(' (pollo o carne)', '');
                notesArray.push(`Fondo: ${cleanFondoName} de ${proteina}`);
              } else {
                notesArray.push(`Fondo: ${fondo}`);
              }
            }
            if (entrada) {
              notesArray.push(`Entrada: ${entrada}`);
            }
            
            // Refresco y Postre automáticos (más cortos)
            notesArray.push(`+ Refresco + Postre`);

            if (bebida && !bebida.toLowerCase().includes('sin bebida') && !bebida.toLowerCase().includes('omitir')) {
              notesArray.push(`Bebida: ${bebida}`);
            }

            const cantidadEnsaladas = selections["cantidad_ensaladas"];
            if (cantidadEnsaladas && !cantidadEnsaladas.toLowerCase().includes('sin ensalada')) {
              notesArray.push(cantidadEnsaladas);
            }
            
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            agregarItemDeliveryDirecto(selectedProduct, finalNotes);
          } else {
            const notesArray = [];
            steps.forEach(step => {
              const val = selections[step.key];
              if (val) {
                const valLower = val.toLowerCase();
                if (valLower.includes('sin bebida') || valLower.includes('sin ensalada') || valLower.includes('omitir') || valLower.includes('sin acompañamiento') || valLower.includes('sin guarnicion')) {
                  return;
                }
                const stepLower = step.name.toLowerCase();
                if (stepLower.includes('bebida')) {
                  notesArray.push(`Bebida: ${val}`);
                } else if (stepLower.includes('ensalada')) {
                  notesArray.push(val);
                } else if (stepLower.includes('guarnicion') || stepLower.includes('acompañamiento')) {
                  notesArray.push(`Guarnición: ${val}`);
                } else if (stepLower.includes('fondo')) {
                  notesArray.push(`Fondo: ${val}`);
                } else if (stepLower.includes('entrada')) {
                  notesArray.push(`Entrada: ${val}`);
                } else {
                  notesArray.push(`${step.name}: ${val}`);
                }
              }
            });
            if (additionalNotes.trim()) {
              notesArray.push(`(Nota: ${additionalNotes.trim()})`);
            }
            const finalNotes = notesArray.join(' · ');
            agregarItemDeliveryDirecto(selectedProduct, finalNotes);
          }
          
          setOptionsModalOpen(false);
          setSelectedProduct(null);
        };
        
        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center md:p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-lg md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[100vh] md:h-auto md:max-h-[90vh] animate-slide-up">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div>
                  <h3 className="text-white font-black text-base uppercase tracking-tight leading-none">
                    {selectedProduct.esAgrupado ? "Seleccionar Variante" : "Personalizar Plato"}
                  </h3>
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-1">
                    {selectedProduct.nombre}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setOptionsModalOpen(false);
                    setSelectedProduct(null);
                  }}
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                {steps.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Paso {currentStepIdx + 1} de {steps.length}</span>
                      <span className="text-amber-400">{currentStep.name}</span>
                    </div>
                    <div className="h-1.5 bg-slate-850 rounded-full overflow-hidden flex border border-slate-800">
                      {steps.map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`h-full flex-1 border-r border-slate-900 last:border-0 transition-all ${
                            idx <= currentStepIdx ? 'bg-amber-500' : 'bg-slate-800'
                          }`}
                        ></div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    {currentStep.name}:
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {currentStep.options.map((opt, oIdx) => {
                      const isSelected = selectedProduct.esAgrupado 
                        ? (seleccionActual && seleccionActual.id === opt.value.id)
                        : (seleccionActual === opt.value);
                        
                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleSelectOption(opt.value)}
                          className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all group relative overflow-hidden min-h-[75px] ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-[0.98]'
                              : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-750 hover:border-slate-600'
                          }`}
                        >
                          <span className="font-black text-xs leading-snug pr-6 uppercase">{opt.label}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-slate-950 absolute top-4 right-4 stroke-[3px]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {esUltimoPaso && (
                  <div className="border-t border-slate-800 pt-5 space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Especificaciones Especiales / Notas
                    </label>
                    <textarea
                      placeholder="Ejemplo: sin cebolla, papas bien doradas, etc."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl p-4 text-xs font-bold text-slate-100 focus:outline-none focus:bg-slate-950 custom-scrollbar h-20 resize-none"
                    ></textarea>
                  </div>
                )}
              </div>
              
              <div className="p-5 border-t border-slate-800 bg-slate-950/40 flex justify-between gap-3 shrink-0">
                <button
                  onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
                  disabled={currentStepIdx === 0}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    currentStepIdx === 0
                      ? 'bg-slate-850 text-slate-600 border border-slate-850 opacity-40 cursor-not-allowed shadow-none'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                  }`}
                >
                  Atrás
                </button>
                
                {esUltimoPaso ? (
                  <button
                    onClick={handleConfirm}
                    disabled={currentStep.key === 'producto_variante' && !seleccionActual}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg ${
                      (currentStep.key !== 'producto_variante' || seleccionActual)
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-emerald-500/20'
                        : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none'
                    }`}
                  >
                    Agregar Pedido
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStepIdx(prev => prev + 1)}
                    disabled={currentStep.key === 'producto_variante' && !seleccionActual}
                    className={`px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg ${
                      (currentStep.key !== 'producto_variante' || seleccionActual)
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        : 'bg-slate-850 text-slate-600 border border-slate-800 cursor-not-allowed shadow-none'
                    }`}
                  >
                    Siguiente
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE CIERRE DE CAJA (ARQUEO DE TURNO) */}
      {cierreModalOpen && (() => {
        // Consolidación reactiva de montos del turno actual
        const ventasFiltradas = (ultimoCierre 
          ? ventas.filter(v => new Date(v.createdAt) > new Date(ultimoCierre))
          : ventas).filter(v => v.estadoPedido !== 'Cancelado');

        const abonosFiltrados = ultimoCierre
          ? abonos.filter(a => new Date(a.creadoEn) > new Date(ultimoCierre))
          : abonos;

        const obtenerMontosVentaFrontend = (v) => {
          if (!v || v.anulado || v.estadoPedido === 'Cancelado') return { efec: 0, tarj: 0, yape: 0 };
          if (v.metodoPago === 'Cortesía' || v.metodoPago === 'Consumo' || v.metodoPago === 'PedidosYa' || v.metodoPago === 'Crédito') return { efec: 0, tarj: 0, yape: 0 };

          let efec = parseFloat(v.montoEfectivo || 0);
          let tarj = parseFloat(v.montoTarjeta || 0);
          let yape = parseFloat(v.montoYape || 0);
          const total = parseFloat(v.total || 0);

          if (total <= 0) return { efec: 0, tarj: 0, yape: 0 };
          if (v.metodoPago === 'Efectivo') return { efec: total, tarj: 0, yape: 0 };
          if (v.metodoPago === 'Tarjeta') return { efec: 0, tarj: total, yape: 0 };
          if (v.metodoPago === 'Yape') return { efec: 0, tarj: 0, yape: total };

          // Restar la parte a crédito si es mixto
          const creditAmount = parseFloat(v.montoCredito || 0);
          const totalFisico = Math.max(0, total - creditAmount);
          const suma = efec + tarj + yape;
          if (Math.abs(suma - totalFisico) > 0.01) {
            if (suma === 0) efec = totalFisico;
            else if (totalFisico > suma) efec += (totalFisico - suma);
          }
          return { efec, tarj, yape };
        };

        let totalEfectivo = 0;
        let totalTarjeta = 0;
        let totalYape = 0;

        ventasFiltradas.forEach(v => {
          const { efec, tarj, yape } = obtenerMontosVentaFrontend(v);
          totalEfectivo += efec;
          totalTarjeta += tarj;
          totalYape += yape;
        });

        // Sumar abonos a la caja real
        abonosFiltrados.forEach(a => {
          totalEfectivo += a.montoEfectivo || 0;
          totalTarjeta += a.montoTarjeta || 0;
          totalYape += a.montoYape || 0;
        });

        const totalPedidosYa = ventasFiltradas
          .filter(v => v.metodoPago === 'PedidosYa')
          .reduce((s, v) => s + (v.total || 0), 0);

        const clienteMap = new Map(clientes.map(c => [c.id, c.esTrabajador]));
        let totalConsumoPlanilla = 0;
        let totalConsumoClientes = 0;

        ventasFiltradas.forEach(v => {
          if (v.anulado || v.estadoPedido === 'Cancelado') return;
          if (v.metodoPago === 'Consumo') {
            totalConsumoPlanilla += (v.descuentoAplicado || v.total || 0);
          } else {
            const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
            if (splits.length > 0) {
              splits.forEach(s => {
                const esTrab = clienteMap.get(s.clienteId) || false;
                if (esTrab) {
                  totalConsumoPlanilla += s.monto;
                } else {
                  totalConsumoClientes += s.monto;
                }
              });
            } else if (v.metodoPago === 'Crédito') {
              totalConsumoClientes += (v.total || 0);
            } else if (parseFloat(v.montoCredito || 0) > 0) {
              totalConsumoClientes += parseFloat(v.montoCredito);
            }
          }
        });

        // Total Caja = ingresos reales cobrados en caja (efectivo + tarjeta + yape)
        const totalCalculado = totalEfectivo + totalTarjeta + totalYape;

        // Cortesías: solo las ventas con metodoPago === 'Cortesía' o descuentoAplicado parcial
        const totalCortesias = ventasFiltradas
          .filter(v => v.metodoPago === 'Cortesía')
          .reduce((s, v) => s + (v.descuentoAplicado || v.total || 0), 0);

        return (
          <div id="modal-cierre" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up relative">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Calculator className="w-6 h-6 shrink-0" />
                  <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">Arqueo y Cierre</h3>
                </div>
                <button onClick={() => setCierreModalOpen(false)} className="text-slate-400 hover:text-slate-900 p-1 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"><X className="w-5 h-5" /></button>
              </div>
 
              {/* Vista del ticket térmico */}
              <div id="cierre-imprimible" className="bg-amber-50/70 border-2 border-dashed border-amber-200 rounded-2xl p-5 font-mono text-slate-800 text-xs shadow-sm mb-6 flex flex-col">
                <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4">
                  <h4 className="font-black text-sm text-slate-900 uppercase">NUEVO FOGÓN DORADO E.I.R.L.</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Jr. Amalia Puga 821 · RUC: 10710311191</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">CIERRE DE TURNO · ARQUEO DIARIO</p>
                </div>

                <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-4 text-slate-600 font-bold">
                  <div className="flex justify-between"><span>FECHA:</span><span>{new Date().toLocaleDateString('es-PE')}</span></div>
                  <div className="flex justify-between"><span>HORA IMP:</span><span>{new Date().toLocaleTimeString('es-PE')}</span></div>
                  <div className="flex justify-between"><span>CAJERO:</span><span className="uppercase">{cajeroNombre}</span></div>
                  <div className="flex justify-between"><span>ESTADO:</span><span className="text-emerald-700">DESPACHADO</span></div>
                </div>

                <div className="space-y-3 mb-4 border-b border-dashed border-slate-300 pb-3">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>💵 EFECTIVO:</span>
                    <span className="font-black text-slate-900">S/ {totalEfectivo.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>💳 TARJETA POS:</span>
                    <span className="font-black text-slate-900">S/ {totalTarjeta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>📱 YAPE / PLIN:</span>
                    <span className="font-black text-slate-900">S/ {totalYape.toFixed(2)}</span>
                  </div>
                  {abonosFiltrados.length > 0 && (
                    <div className="border-t border-dashed border-slate-200 pt-2 pb-1 text-slate-650 font-bold text-[10px]">
                      <span className="text-[9px] text-slate-400">DETALLE DE ABONOS RECIBIDOS:</span>
                      <div className="flex justify-between pl-2">
                        <span>Abonos Efec:</span>
                        <span>S/ {abonosFiltrados.reduce((s, a) => s + (a.montoEfectivo || 0), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>Abonos Tarj:</span>
                        <span>S/ {abonosFiltrados.reduce((s, a) => s + (a.montoTarjeta || 0), 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>Abonos Yape:</span>
                        <span>S/ {abonosFiltrados.reduce((s, a) => s + (a.montoYape || 0), 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  {totalConsumoClientes > 0 && (
                    <div className="flex justify-between font-bold text-emerald-700 border-t border-dashed border-slate-205 pt-2">
                      <span>👥 CRÉDITO CLIENTES:</span>
                      <span className="font-black text-emerald-800">S/ {totalConsumoClientes.toFixed(2)}</span>
                    </div>
                  )}
                  {totalConsumoPlanilla > 0 && (
                    <div className="flex justify-between font-bold text-violet-700 border-t border-dashed border-slate-205 pt-2">
                      <span>👤 CONSUMO PLANILLA:</span>
                      <span className="font-black text-violet-800">S/ {totalConsumoPlanilla.toFixed(2)}</span>
                    </div>
                  )}
                  {totalCortesias > 0 && (
                    <div className="flex justify-between font-bold text-amber-700 border-t border-dashed border-amber-200 pt-2">
                      <span>🎁 CORTESÍAS (VALOR):</span>
                      <span className="font-black text-amber-900">S/ {totalCortesias.toFixed(2)}</span>
                    </div>
                  )}
                  {totalPedidosYa > 0 && (
                    <div className="flex justify-between font-bold text-blue-700 border-t border-dashed border-blue-200 pt-2">
                      <span>🛵 PEDIDOS YA <span className="font-normal text-[9px]">(cobro semanal)</span>:</span>
                      <span className="font-black text-blue-800">S/ {totalPedidosYa.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center text-sm font-black text-slate-900 uppercase">
                  <span>💰 TOTAL EN CAJA:</span>
                  <span className="text-base text-emerald-700">S/ {totalCalculado.toFixed(2)}</span>
                </div>
                {totalPedidosYa > 0 && (
                  <div className="mt-1 text-[9px] text-blue-600 font-bold text-right">
                    + S/ {totalPedidosYa.toFixed(2)} PedidosYa (no incluir en cuadre físico)
                  </div>
                )}

                <div className="text-center text-[9px] text-slate-400 font-bold mt-6 border-t border-dashed border-slate-200 pt-3">
                  *** Fin del Reporte de Turno ***
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest transition-colors flex justify-center items-center gap-1.5"
                >
                  Imprimir Ticket
                </button>
                <button
                  onClick={() => {
                    const pendientes = mesas.filter(m => m.estado !== 'Libre' && m.pedidoData);
                    if (pendientes.length > 0) {
                      const nombresMesas = pendientes.map(m => `Mesa ${m.num}`).join(', ');
                      alert(`⚠️ No se puede realizar el cierre de turno.\n\nAún quedan mesas activas o pendientes de cobración:\n👉 ${nombresMesas}\n\nPor favor, cobre o libere estas mesas antes de cerrar caja.`);
                      return;
                    }

                    const maxSaleTime = ventasFiltradas.length > 0
                      ? Math.max(...ventasFiltradas.map(v => new Date(v.createdAt).getTime()))
                      : new Date().getTime();
                    const newCierreISO = new Date(maxSaleTime + 1000).toISOString();

                    localStorage.setItem('ultimoCierre', newCierreISO);
                    setUltimoCierre(newCierreISO);
                    setMostrarTodoElDia(false);
                    alert(`✅ ¡Cierre de Turno exitoso!\n\nTotal en Caja (real): S/ ${totalCalculado.toFixed(2)}\n${totalPedidosYa > 0 ? `PedidosYa (cobro semanal): S/ ${totalPedidosYa.toFixed(2)}\n` : ''}El turno ha sido archivado e inicializado.`);
                    setCierreModalOpen(false);
                  }}
                  className="py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-900 font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                >
                  Cerrar Turno
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Corregir Método de Pago */}
      {cambioMetodoModal && ventaACambiar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-slate-950 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Corregir Método de Pago
                </h3>
                <p className="text-xs font-bold opacity-80 mt-0.5">Venta #{ventaACambiar.id} · S/ {ventaACambiar.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setCambioMetodoModal(false); setCambioPin(''); setCambioError(''); }} className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Método anterior */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Método actual</p>
                <p className="font-black text-slate-800 uppercase text-sm">{ventaACambiar.metodoPago}</p>
              </div>

              {/* Nuevo método */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Nuevo Método de Pago</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['Efectivo', 'Tarjeta', 'Yape', 'PedidosYa', 'Consumo', 'Cortesía', 'Mixto'].map(mp => (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => setCambioNuevoMetodo(mp)}
                      className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${
                        cambioNuevoMetodo === mp
                          ? mp === 'Efectivo' ? 'bg-emerald-500 border-emerald-600 text-white' :
                            mp === 'Tarjeta' ? 'bg-blue-500 border-blue-600 text-white' :
                            mp === 'Yape' ? 'bg-purple-500 border-purple-600 text-white' :
                            mp === 'Consumo' ? 'bg-slate-700 border-slate-800 text-white' :
                            mp === 'Cortesía' ? 'bg-amber-500 border-amber-600 text-slate-950' :
                            mp === 'Mixto' ? 'bg-orange-500 border-orange-600 text-white' :
                            'bg-indigo-500 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {mp === 'Efectivo' ? '💵' : mp === 'Tarjeta' ? '💳' : mp === 'Yape' ? '📱' : mp === 'Consumo' ? '👤' : mp === 'Cortesía' ? '🎁' : mp === 'Mixto' ? '➕' : '🛵'} {mp === 'Consumo' ? 'Consumo' : mp === 'Cortesía' ? 'Corte.' : mp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pago Mixto para Corrección */}
              {cambioNuevoMetodo === 'Mixto' && (() => {
                const total = ventaACambiar.total;
                const efecVal = parseFloat(cambioMixtoEfectivo || 0);
                const tarjVal = parseFloat(cambioMixtoTarjeta || 0);
                const yapeVal = parseFloat(cambioMixtoYape || 0);
                const ingresado = efecVal + tarjVal + yapeVal;
                const restante = Math.max(0, total - (tarjVal + yapeVal));
                const vuelto = efecVal > restante ? efecVal - restante : 0;
                const diferencia = total - ingresado;

                return (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-2xl shadow-sm space-y-3">
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-amber-600 flex justify-between">
                      <span>Desglose de Pago Mixto</span>
                      <span>Total: S/ {total.toFixed(2)}</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">💵 Efec. (S/)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cambioMixtoEfectivo}
                          onChange={(e) => setCambioMixtoEfectivo(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">💳 Tarj. (S/)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cambioMixtoTarjeta}
                          onChange={(e) => setCambioMixtoTarjeta(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5 text-[8px] tracking-wider uppercase">📱 Yape (S/)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cambioMixtoYape}
                          onChange={(e) => setCambioMixtoYape(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-100 grid grid-cols-2 gap-1 text-[9px] font-bold text-slate-500">
                      <div className="flex justify-between">
                        <span>Ingresado:</span>
                        <span className="font-mono text-slate-700">S/ {ingresado.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Faltante:</span>
                        <span className={`font-mono ${diferencia > 0 ? 'text-red-650' : 'text-emerald-600'}`}>
                          S/ {Math.max(0, diferencia).toFixed(2)}
                        </span>
                      </div>
                      {vuelto > 0 && (
                        <div className="flex justify-between col-span-2 border-t border-slate-100 pt-1 mt-0.5 text-[10px] text-emerald-700 font-black">
                          <span>💸 Vuelto:</span>
                          <span className="font-mono">S/ {vuelto.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* PIN Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN de Administrador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={cambioPin}
                  onChange={e => { setCambioPin(e.target.value); setCambioError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCambiarMetodoPago()}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:bg-white rounded-2xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                  name="cambio-pin-auth"
                  autoFocus
                />
              </div>

              {/* Error */}
              {cambioError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {cambioError}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setCambioMetodoModal(false); setCambioPin(''); setCambioError(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCambiarMetodoPago}
                  disabled={cambiando || !cambioPin.trim()}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {cambiando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> : null}
                  {cambiando ? 'Guardando...' : 'Confirmar Cambio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Corregir Tipo de Entrega */}
      {cambioTipoEntregaModal && ventaATipoCambiar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-blue-500 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Corregir Tipo de Entrega
                </h3>
                <p className="text-xs font-bold opacity-80 mt-0.5">Venta #{ventaATipoCambiar.id} · S/ {ventaATipoCambiar.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setCambioTipoEntregaModal(false); setCambioTipoPin(''); setCambioTipoError(''); }} className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {/* Selector de Nuevo Tipo */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Nuevo Tipo de Entrega</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'ParaLlevar', label: '🛍️ Llevar' },
                    { type: 'DeliveryPropio', label: '🛵 Delivery' },
                    { type: 'PedidosYa', label: '🛵 PedidosYa' }
                  ].map(item => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setCambioNuevoTipo(item.type)}
                      className={`py-3 px-2 rounded-2xl text-xs font-black uppercase border-2 transition-all ${
                        cambioNuevoTipo === item.type
                          ? 'bg-indigo-500 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos dinámicos según el tipo de entrega */}
              {cambioNuevoTipo === 'PedidosYa' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Código PedidosYa</label>
                    <input
                      type="text"
                      value={cambioCodigoPY}
                      onChange={e => setCambioCodigoPY(e.target.value)}
                      placeholder="Ej. FG-4821"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                    />
                  </div>
                </div>
              )}

              {cambioNuevoTipo === 'ParaLlevar' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nombre del Cliente</label>
                    <input
                      type="text"
                      value={cambioNombreCliente}
                      onChange={e => setCambioNombreCliente(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Efectivo', 'Tarjeta', 'Yape'].map(mp => (
                        <button
                          key={mp}
                          type="button"
                          onClick={() => setCambioMetodoPago(mp)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border transition-all ${
                            cambioMetodoPago === mp
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {mp}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {cambioNuevoTipo === 'DeliveryPropio' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nombre del Cliente</label>
                    <input
                      type="text"
                      value={cambioNombreCliente}
                      onChange={e => setCambioNombreCliente(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={cambioTelefono}
                        onChange={e => setCambioTelefono(e.target.value)}
                        placeholder="Ej. 999888777"
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Costo Delivery (S/)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cambioMontoDelivery}
                        onChange={e => setCambioMontoDelivery(e.target.value)}
                        placeholder="Ej. 5.00"
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Dirección de Envío</label>
                    <input
                      type="text"
                      value={cambioDireccion}
                      onChange={e => setCambioDireccion(e.target.value)}
                      placeholder="Ej. Av. Larco 123"
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Paga Con (S/)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cambioMontoConCuanto}
                        onChange={e => setCambioMontoConCuanto(e.target.value)}
                        placeholder="Ej. 100.00"
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-350 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['Efectivo', 'Tarjeta', 'Yape'].map(mp => (
                          <button
                            key={mp}
                            type="button"
                            onClick={() => setCambioMetodoPago(mp)}
                            className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase border transition-all ${
                              cambioMetodoPago === mp
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {mp}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PIN Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN de Administrador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={cambioTipoPin}
                  onChange={e => { setCambioTipoPin(e.target.value); setCambioTipoError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCambiarTipoEntrega()}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-2.5 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                  name="cambio-tipo-pin-auth"
                />
              </div>

              {/* Error */}
              {cambioTipoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {cambioTipoError}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setCambioTipoEntregaModal(false); setCambioTipoPin(''); setCambioTipoError(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCambiarTipoEntrega}
                  disabled={cambioTipoCambiando || !cambioTipoPin.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {cambioTipoCambiando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {cambioTipoCambiando ? 'Guardando...' : 'Confirmar Cambio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Corregir Datos de Facturación / Cliente */}
      {editClienteVenta && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Corregir Datos del Cliente
                </h3>
                <p className="text-xs font-bold opacity-80 mt-0.5">Venta #{editClienteVenta.id} · S/ {editClienteVenta.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setEditClienteVenta(null); setEditClientePin(''); setEditClienteError(''); }} className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {/* Tipo de Comprobante */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">Tipo de Comprobante</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Ticket', 'Boleta', 'Factura'].map(tc => (
                    <button
                      key={tc}
                      type="button"
                      onClick={() => {
                        setEditClienteTipoComprobante(tc);
                        setEditClienteError('');
                      }}
                      className={`py-3 px-2 rounded-2xl text-xs font-black uppercase border-2 transition-all ${
                        editClienteTipoComprobante === tc
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {tc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos del Documento */}
              {(editClienteTipoComprobante === 'Boleta' || editClienteTipoComprobante === 'Factura') && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      {editClienteTipoComprobante === 'Factura' ? 'RUC del Cliente:' : 'DNI del Cliente:'}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={editClienteNumDoc}
                        onChange={e => setEditClienteNumDoc(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarClienteEdicion(); } }}
                        placeholder={editClienteTipoComprobante === 'Factura' ? '11 dígitos' : '8 dígitos'}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={buscarClienteEdicion}
                        disabled={isBuscando}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-2.5 rounded-xl text-xs font-black flex items-center justify-center transition-colors shrink-0 shadow-sm"
                      >
                        {isBuscando ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      {editClienteTipoComprobante === 'Factura' ? 'Razón Social:' : 'Nombres del Cliente:'}
                    </label>
                    <input
                      type="text"
                      value={editClienteNombre}
                      onChange={e => setEditClienteNombre(e.target.value)}
                      placeholder="Nombre / Razón Social"
                      className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none transition-all uppercase"
                    />
                  </div>
                  {editClienteTipoComprobante === 'Factura' && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Dirección Fiscal:
                      </label>
                      <input
                        type="text"
                        value={editClienteDireccion}
                        onChange={e => setEditClienteDireccion(e.target.value)}
                        placeholder="Ej. Jr. Amalia Puga 821"
                        className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none transition-all uppercase"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* PIN Autorización */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN de Autorización (Administrador)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={editClientePin}
                  onChange={e => { setEditClientePin(e.target.value); setEditClienteError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleGuardarClienteVenta()}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl px-4 py-2.5 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                  name="edit-cliente-pin-auth"
                />
              </div>

              {/* Mensaje de Error */}
              {editClienteError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {editClienteError}
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { setEditClienteVenta(null); setEditClientePin(''); setEditClienteError(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarClienteVenta}
                  disabled={editClienteCargando || !editClientePin.trim()}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {editClienteCargando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {editClienteCargando ? 'Guardando...' : 'Guardar y Recalcular'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Autorizar Cancelación de Llevar/Delivery */}
      {cancelLlevarModalOpen && pedidoACancelarLlevar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Autorizar Cancelación
                </h3>
                <p className="text-xs font-bold opacity-90 mt-0.5">Pedido: {pedidoACancelarLlevar.codigoPedidosYa || `ID: ${pedidoACancelarLlevar.pedidoId}`} · Total: S/ {pedidoACancelarLlevar.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setCancelLlevarModalOpen(false); setPedidoACancelarLlevar(null); setPinCancelLlevar(''); setErrorCancelLlevar(''); }} className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="bg-red-50 rounded-2xl p-3 border border-red-100 text-slate-800 text-xs font-semibold leading-relaxed">
                ⚠️ <strong className="font-black text-red-700">Atención:</strong> Esta acción cancelará la orden del cliente de forma permanente y enviará una alerta en tiempo real a cocina/barra.
              </div>

              {/* Detalle de ítems del pedido */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Detalle del Pedido a Cancelar:</p>
                <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                  {pedidoACancelarLlevar.items && pedidoACancelarLlevar.items.length > 0 ? (
                    pedidoACancelarLlevar.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1.5 text-xs text-slate-800 font-bold uppercase">
                        <span>{item.cant}× {item.nombre}</span>
                        <span className="font-mono text-slate-600">S/ {(item.cant * item.precio).toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Sin productos registrados</p>
                  )}
                </div>
              </div>

              {/* PIN Admin */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-2">🔐 PIN del Administrador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinCancelLlevar}
                  onChange={e => { setPinCancelLlevar(e.target.value); setErrorCancelLlevar(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleExecuteCancelLlevar()}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 focus:bg-white rounded-2xl px-4 py-3 text-center text-xl font-black tracking-[0.5em] text-slate-800 placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none transition-all"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                  name="cancel-pin-auth"
                  autoFocus
                />
              </div>

              {/* Error */}
              {errorCancelLlevar && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2.5 rounded-2xl uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {errorCancelLlevar}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { setCancelLlevarModalOpen(false); setPedidoACancelarLlevar(null); setPinCancelLlevar(''); setErrorCancelLlevar(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Regresar
                </button>
                <button
                  onClick={handleExecuteCancelLlevar}
                  disabled={!pinCancelLlevar.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-2xl transition-all disabled:opacity-50 shadow-md shadow-red-500/20"
                >
                  ✓ Cancelar Orden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sunatModalOpen && activeComprobante && (
        <div id="modal-comprobante-sunat-print-container" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
            <div className="bg-slate-950 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black text-xs uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" /> {
                  activeComprobante.metodoPago === 'Consumo' ? '👤 CONSUMO PERSONAL 👤' :
                  activeComprobante.metodoPago === 'Cortesía' ? '🎁 TICKET DE CORTESÍA 🎁' :
                  activeComprobante.tipo === 'Factura' ? 'FACTURA ELECTRÓNICA' :
                  activeComprobante.tipo === 'Ticket' ? 'TICKET DE VENTA' : 'BOLETA ELECTRÓNICA'
                }
              </h3>
              <button onClick={() => setSunatModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div id="comprobante-sunat-ticket-print" className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 font-mono text-xs leading-relaxed">
              {activeComprobante.contingencia && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="bg-amber-100 text-amber-900 border-2 border-dashed border-amber-400 p-2 rounded-lg text-center mb-3 font-bold text-[9px] uppercase tracking-tight no-print">
                  ⚠️ TICKET DE CONTROL INTERNO<br />
                  Emisión electrónica pendiente por contingencia
                </div>
              )}
              
              <div className="text-center font-bold" style={{ fontSize: '14px', marginBottom: '2px' }}>Nuevo Fogón Dorado E.I.R.L.</div>
              <div className="text-center text-[10px] leading-tight mb-2">
                Jr. Amalia Puga 821, Cajamarca<br />
                R.U.C. N° 10710311191
              </div>
              
              <div className="text-center font-bold mb-1" style={{ fontSize: '11px' }}>{
                activeComprobante.metodoPago === 'Consumo' ? '👤 VALE DE CONSUMO PERSONAL' :
                activeComprobante.metodoPago === 'Cortesía' ? '🎁 CORTESÍA / CONSUMO INTERNO' :
                activeComprobante.tipo === 'Factura' ? 'FACTURA ELECTRÓNICA' :
                activeComprobante.tipo === 'Ticket' ? 'TICKET DE VENTA' : 'BOLETA ELECTRÓNICA'
              }</div>
              <div className="text-center font-bold mb-3" style={{ fontSize: '13px' }}>{
                activeComprobante.metodoPago === 'Consumo' ? `CONS-00${activeComprobante.mesaNum || 'SM'}-${activeComprobante.correlativo}` :
                activeComprobante.metodoPago === 'Cortesía' ? `COR-00${activeComprobante.mesaNum || 'SM'}` :
                `${activeComprobante.serie}-${activeComprobante.correlativo}`
              }</div>
              
              <div className="flex justify-between border-t border-b border-dashed border-slate-300 py-1.5 mb-2 font-bold">
                <span>{activeComprobante.fecha} {activeComprobante.hora}</span>
                <span>Mesa {activeComprobante.mesaNum}</span>
              </div>
              
              <div className="space-y-1 mb-3">
                <div><strong>Cliente:</strong> <span className="uppercase">{activeComprobante.clienteNombre}</span></div>
                {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                  <div><strong>{activeComprobante.tipo === 'Factura' ? 'RUC' : 'DNI'}:</strong> <span>{activeComprobante.clienteDoc}</span></div>
                )}
                {activeComprobante.clienteDireccion && (
                  <div><strong>Dirección:</strong> <span className="uppercase text-[9px] leading-none block mt-0.5">{activeComprobante.clienteDireccion}</span></div>
                )}
                <div><strong>Items:</strong> <span>{activeComprobante.items.length}</span></div>
              </div>

              {/* Box de Datos de Despacho para Delivery */}
              {activeComprobante.deliveryInfo && (
                <div style={{ border: '1px dashed black', padding: '6px', margin: '8px 0', fontSize: '10px', lineHeight: '1.3' }} className="space-y-1 bg-slate-50 rounded-lg">
                  <div className="text-center font-bold uppercase mb-1" style={{ fontSize: '11px' }}>🛵 DATOS DE DESPACHO / DELIVERY 🛵</div>
                  <div><strong>DIRECCIÓN:</strong> <span className="uppercase font-bold">{activeComprobante.deliveryInfo.direccion}</span></div>
                  <div className="flex justify-between">
                    <div><strong>TELÉFONO:</strong> <span>{activeComprobante.deliveryInfo.telefono}</span></div>
                    <div><strong>ENVÍO:</strong> <span>S/ {parseFloat(activeComprobante.deliveryInfo.montoDelivery || 0).toFixed(2)}</span></div>
                  </div>
                  {activeComprobante.deliveryInfo.conCuanto && parseFloat(activeComprobante.deliveryInfo.conCuanto) > 0 && (
                    <div className="border-t border-slate-300 pt-1 mt-1 flex justify-between font-bold">
                      <div><strong>PAGA CON:</strong> <span>S/ {parseFloat(activeComprobante.deliveryInfo.conCuanto).toFixed(2)}</span></div>
                      <div><strong>VUELTO:</strong> <span className="text-emerald-700">S/ {parseFloat(activeComprobante.deliveryInfo.vuelto).toFixed(2)}</span></div>
                    </div>
                  )}
                </div>
              )}
              
              <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
              
              {/* Items Table Header */}
              <div className="flex font-bold border-b border-dashed border-slate-350 pb-1 mb-1">
                <span className="w-8 shrink-0">Cant</span>
                <span className="flex-1 pl-1">DESCRIPCIÓN</span>
                <span className="w-14 text-right shrink-0">P.Unit</span>
                <span className="w-18 text-right shrink-0">TOTAL</span>
              </div>
              
              {activeComprobante.items
                .filter(item => item && (item.precio > 0 || (item.categoria && BARRA_CATEGORIAS.includes(item.categoria)) || (item.notas && item.notas.includes('CORTESÍA')) || (item.nombre && item.nombre.includes('CORTESÍA'))))
                .map((item, idx) => {
                const subTotalItem = item.cant * item.precio;
                const cantStr = item.cant % 1 === 0 ? item.cant.toFixed(0) : item.cant.toFixed(2);
                return (
                  <div key={idx} className="flex flex-col mb-1.5">
                    <div className="flex items-start">
                      <span className="w-8 shrink-0 font-bold">{cantStr}x</span>
                      <span className="flex-1 uppercase pl-1">{item.nombre}</span>
                      <span className="w-14 text-right shrink-0">{item.precio.toFixed(2)}</span>
                      <span className="w-18 text-right shrink-0">{subTotalItem.toFixed(2)}</span>
                    </div>
                    {item.notas && (
                      <div className="pl-8 text-[9px] text-slate-500 font-bold leading-tight uppercase text-left break-all">
                        {item.notas}
                      </div>
                    )}
                  </div>
                );
              })}
              
              <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
              
              <div className="space-y-1 text-right font-bold" style={{ fontSize: '11px' }}>
                {activeComprobante.descuentoAplicado > 0 && (
                  <>
                    <div className="flex justify-between text-slate-700">
                      <span>IMPORTE BRUTO</span> 
                      <span>S/ {(activeComprobante.total + activeComprobante.descuentoAplicado).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900">
                      <span>{activeComprobante.ofertaDescripcion ? activeComprobante.ofertaDescripcion.toUpperCase() : 'DESCUENTO'}</span> 
                      <span>- S/ {activeComprobante.descuentoAplicado.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between"><span>SUBTOTAL</span> <span>S/ {activeComprobante.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>I.G.V (10.5%)</span> <span>S/ {activeComprobante.igv.toFixed(2)}</span></div>
                <div className="flex justify-between" style={{ fontSize: '12px', fontWeight: '900' }}><span>TOTAL</span> <span>S/ {activeComprobante.total.toFixed(2)}</span></div>
              </div>
              
              <hr style={{ border: '0', borderTop: '1px dashed black', margin: '10px 0' }} />
              
              {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="mb-4">
                  <strong className="block text-[10px]">IMPORTE EN LETRAS:</strong>
                  <span className="uppercase text-[10px] leading-tight block">{activeComprobante.totalLetras}</span>
                </div>
              )}
              
              {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && activeComprobante.hashResumen && (
                <div className="mb-3">
                  <strong>CÓDIGO HASH:</strong> <span className="font-mono text-[10px]">{activeComprobante.hashResumen}</span>
                </div>
              )}
              
              <div>
                <strong>FORMA DE PAGO:</strong> <span className="uppercase">{
                  activeComprobante.metodoPago === 'Consumo' ? 'DESCUENTO PLANILLA (PERSONAL)' :
                  activeComprobante.metodoPago === 'Cortesía' ? 'CORTESÍA / CONSUMO INTERNO' :
                  activeComprobante.metodoPago === 'Mixto' ? 'PAGO MIXTO' :
                  activeComprobante.metodoPago === 'Efectivo' ? 'CONTADO' : 'CONTADO (' + activeComprobante.metodoPago + ')'
                }</span>
              </div>
              
              {activeComprobante.metodoPago === 'Mixto' && (
                <div className="mt-1.5 border-t border-dashed border-black pt-1.5 space-y-0.5 text-[10px]">
                  {activeComprobante.montoEfectivo > 0 && (
                    <div className="flex justify-between"><span>- EFECTIVO:</span> <span>S/ {activeComprobante.montoEfectivo.toFixed(2)}</span></div>
                  )}
                  {activeComprobante.montoTarjeta > 0 && (
                    <div className="flex justify-between"><span>- TARJETA:</span> <span>S/ {activeComprobante.montoTarjeta.toFixed(2)}</span></div>
                  )}
                  {activeComprobante.montoYape > 0 && (
                    <div className="flex justify-between"><span>- YAPE/PLIN:</span> <span>S/ {activeComprobante.montoYape.toFixed(2)}</span></div>
                  )}
                </div>
              )}
              
              {activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' ? (
                <div className="flex justify-center my-5">
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
                    style={{ width: '120px', height: '120px' }} 
                    className="border p-1 bg-white"
                    onLoad={() => {
                      if (activeComprobante.shouldAutoPrint) {
                        setTimeout(() => {
                          window.print();
                        }, 200);
                        activeComprobante.shouldAutoPrint = false; // Evitar disparar de nuevo al recargar
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'none' }}>
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
                    onLoad={() => {
                      if (activeComprobante.shouldAutoPrint) {
                        setTimeout(() => {
                          window.print();
                        }, 200);
                        activeComprobante.shouldAutoPrint = false; // Evitar disparar de nuevo al recargar
                      }
                    }}
                  />
                </div>
              )}

              {(activeComprobante.metodoPago === 'Consumo' || activeComprobante.metodoPago === 'Cortesía') && (
                <div className="mt-8 mb-4 border-t border-slate-400 pt-6 text-center">
                  <p className="border-t border-dashed border-slate-350 mx-auto w-3/4 mb-1"></p>
                  <p className="text-[10px] font-black uppercase tracking-wider">FIRMA COLABORADOR</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 font-medium">{activeComprobante.clienteNombre}</p>
                </div>
              )}
              
              <div className="text-center font-bold mt-4" style={{ fontSize: '10px' }}>¡Gracias por su preferencia!</div>
              <div className="text-center text-[9px] leading-tight text-slate-500 mt-1">
                {
                  activeComprobante.metodoPago === 'Consumo' ? 'VALE INTERNO AUTORIZADO DE COLABORADOR' :
                  activeComprobante.metodoPago === 'Cortesía' ? 'TICKET DE CONSUMO INTERNO AUTORIZADO' :
                  'Representación impresa del comprobante electrónico. Consulte su validez en el portal de la SUNAT.'
                }
              </div>

              {activeComprobante.enlacePdf && activeComprobante.metodoPago !== 'Cortesía' && activeComprobante.metodoPago !== 'Consumo' && (
                <div className="text-center text-[10px] mt-4 font-bold no-print pt-2 border-t border-slate-100">
                  <a href={activeComprobante.enlacePdf} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 flex items-center justify-center gap-1.5">
                    📄 Descargar Comprobante SUNAT (PDF)
                  </a>
                </div>
              )}
            </div>

            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
              <button onClick={() => window.print()} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-widest rounded-xl text-xs flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20">
                <Receipt className="w-4 h-4" /> Imprimir 80mm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Anular / Registrar Devolución de Venta */}
      {anularVentaModal && ventaAAnular && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[260] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-rose-700 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <Ban className="w-5 h-5 animate-pulse" />
                  Registrar Devolución
                </h3>
                <p className="text-xs font-bold opacity-90 mt-0.5">
                  Venta #{ventaAAnular.id} ({ventaAAnular.tipoComprobante}) · Original: S/ {(ventaAAnular.montoOriginal || ventaAAnular.total).toFixed(2)}
                </p>
              </div>
              <button 
                onClick={() => { setAnularVentaModal(false); setVentaAAnular(null); setAnularError(''); }}
                className="bg-black/20 hover:bg-black/30 p-2 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 p-3 rounded-2xl text-red-900 text-xs font-medium space-y-1">
                <div className="font-black flex items-center gap-1.5 text-red-700 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  Atención sobre Devoluciones
                </div>
                <p className="text-[11px] text-red-800 leading-snug">
                  Esta venta <strong>permanecerá en el historial</strong> para auditoría, pero su monto cambiará a <strong>S/ 0.00</strong> para que no afecte el arqueo de caja.
                </p>
              </div>

              {/* Motivo de Devolución */}
              <div>
                <label className="block text-slate-600 font-black text-xs uppercase tracking-wider mb-1">
                  Motivo de Devolución / Anulación:
                </label>
                <textarea
                  value={anularMotivo}
                  onChange={(e) => setAnularMotivo(e.target.value)}
                  placeholder="Ej: Cliente devolvió pedido por demora / Pedido equivocado / Cancelación..."
                  rows={2}
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 rounded-xl p-2.5 font-medium text-slate-800 text-xs focus:outline-none resize-none"
                />
              </div>

              {/* PIN de Administrador */}
              <div>
                <label className="block text-slate-600 font-black text-xs uppercase tracking-wider mb-1">
                  PIN de Autorización (Administrador):
                </label>
                <input
                  type="password"
                  value={anularPin}
                  onChange={(e) => setAnularPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-500 rounded-xl px-4 py-2.5 text-center font-mono font-black text-slate-900 tracking-[0.5em] text-lg focus:outline-none"
                  style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                  autoComplete="off"
                />
              </div>

              {/* Error */}
              {anularError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-2">
                  <X className="w-4 h-4 shrink-0" />
                  {anularError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setAnularVentaModal(false); setVentaAAnular(null); setAnularError(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={procesarAnulacionVenta}
                  disabled={anularCargando || !anularPin.trim() || !anularMotivo.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                >
                  {anularCargando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {anularCargando ? 'Procesando...' : 'Confirmar Devolución'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @page {
          size: auto;
          margin: 0mm;
        }
        @media print {
          /* Ocultar elementos de navegación y fondos */
          aside, header, #sidebar-menu, #sidebar-backdrop, button, nav, .shrink-0 {
            display: none !important;
          }
          /* Ocultar el resto del contenido de la página excepto el modal a imprimir */
          main > *:not(section),
          section > *:not(#modal-comprobante-sunat-print-container):not(#modal-cierre) {
            display: none !important;
          }
          /* Garantizar que el body y contenedores no tengan alturas fijas o desbordamientos */
          html, body, #root, main, section {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: auto !important;
          }
          /* Formatear el contenedor del ticket en 74mm en la esquina superior izquierda */
          #modal-comprobante-sunat-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 74mm !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-comprobante-sunat-print-container > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-comprobante-sunat-print-container div.bg-slate-950, 
          #modal-comprobante-sunat-print-container div.shrink-0 {
            display: none !important;
          }
          #comprobante-sunat-ticket-print {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #comprobante-sunat-ticket-print * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #comprobante-sunat-ticket-print div,
          #comprobante-sunat-ticket-print blockquote {
            page-break-inside: avoid !important;
          }
          
          /* Cierre de Caja en impresión */
          #modal-cierre {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 74mm !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-cierre > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 74mm !important;
            width: 74mm !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #modal-cierre div.bg-slate-950, 
          #modal-cierre div.shrink-0 {
            display: none !important;
          }
          #cierre-imprimible {
            width: 74mm !important;
            padding: 6px !important;
            margin: 0 !important;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible * {
            color: #000000 !important;
            font-weight: 850 !important;
          }
          #cierre-imprimible div {
            page-break-inside: avoid !important;
          }
        }
      `}</style>


      {/* FLOATING TOASTS NOTIFICATIONS SYSTEM FOR CAJA */}
      <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const isError = t.tipo === 'error';
          const isSuccess = t.tipo === 'success';
          const borderClass = isError ? 'border-red-500/20' : (isSuccess ? 'border-emerald-500/20' : 'border-blue-500/20');
          const gradientClass = isError ? 'from-red-500/10' : (isSuccess ? 'from-emerald-500/10' : 'from-blue-500/10');
          const bgClass = isError ? 'bg-red-500 shadow-red-500/20' : (isSuccess ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-500 shadow-blue-500/20');
          const icon = isError ? '🗑️' : (isSuccess ? '✅' : '🛎️');
          const textTitle = isError ? 'Pedido Cancelado' : (isSuccess ? 'Operación Exitosa' : '¡Pedido Listo!');
          const titleColor = isError ? 'text-red-400' : (isSuccess ? 'text-emerald-400' : 'text-blue-400');
          return (
            <div key={t.id} className={`pointer-events-auto bg-slate-900 border ${borderClass} text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-slide-up relative overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-r ${gradientClass} to-transparent`}></div>
              <div className={`w-10 h-10 ${bgClass} rounded-xl flex items-center justify-center font-bold text-lg animate-bounce shrink-0 shadow-lg`}>
                {icon}
              </div>
              <div className="flex-1 pr-2 relative z-10">
                <h4 className={`font-black text-xs ${titleColor} uppercase tracking-widest leading-none mb-1`}>{textTitle}</h4>
                <p className="font-bold text-sm text-slate-100">{t.mensaje}</p>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors relative z-10 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

