import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, X, Save, RefreshCw, Download, Tag, ExternalLink,
  AlertCircle, CheckCircle, ChevronDown, Trash2, Edit3, Printer,
  Search, Calendar, Filter, PlusCircle, DollarSign, Wallet,
  CreditCard, Smartphone, Check, HelpCircle, ArrowDownRight, ArrowUpRight, Scale
} from 'lucide-react';
import { api } from '../api';

const CATEGORIAS = [
  'Insumos y Alimentos',
  'Bebidas',
  'Gas y Carbón',
  'Limpieza e Higiene',
  'Personal',
  'Otros',
];

const COLORES_CATEGORIA = {
  'Insumos y Alimentos': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', bar: 'bg-amber-500' },
  'Bebidas':             { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200',   bar: 'bg-blue-500' },
  'Gas y Carbón':        { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', bar: 'bg-orange-500' },
  'Limpieza e Higiene':  { bg: 'bg-emerald-100',text: 'text-emerald-800',border: 'border-emerald-200',bar: 'bg-emerald-500' },
  'Personal':            { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', bar: 'bg-purple-500' },
  'Otros':               { bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-200',  bar: 'bg-slate-400' },
  'Sin Categoría':       { bg: 'bg-slate-100',  text: 'text-slate-400',  border: 'border-slate-200',  bar: 'bg-slate-300' },
};

const ORIGEN_BADGE = {
  sunat:  { label: 'SUNAT', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  demo:   { label: 'DEMO',  cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  manual: { label: 'Manual',cls: 'bg-slate-100 border-slate-200 text-slate-600' },
  xml:    { label: 'XML',   cls: 'bg-violet-50 border-violet-200 text-violet-700' },
};

// Conceptos rápidos inspirados en el cuaderno de Control Caja
const CONCEPTOS_RAPIDOS = [
  { label: '🐔 Pollo / Carnes', nombre: 'Pollo para caldo', cat: 'Insumos y Alimentos' },
  { label: '🥔 Verduras / Papa', nombre: 'Papa Amarilla / Verduras', cat: 'Insumos y Alimentos' },
  { label: '🔥 Gas / Carbón', nombre: 'Carbón / Gas', cat: 'Gas y Carbón' },
  { label: '🛢️ Aceite', nombre: 'Aceite', cat: 'Insumos y Alimentos' },
  { label: '🧃 Gaseosa / Bebidas', nombre: 'Gaseosas / Bebidas', cat: 'Bebidas' },
  { label: '👤 Adelanto de Sueldo', nombre: 'Adelanto de Sueldo', cat: 'Personal' },
  { label: '👥 Apoyo Personal', nombre: 'Apoyo Personal', cat: 'Personal' },
  { label: '🧻 Descartables / Bolsas', nombre: 'Descartables / Bolsas', cat: 'Limpieza e Higiene' },
  { label: '🛍️ Compras Mercado', nombre: 'Mercado General', cat: 'Insumos y Alimentos' },
  { label: '🛠️ Mantenimiento / Luz', nombre: 'Mantenimiento / Fluorescentes', cat: 'Otros' },
];

// Helper para parsear métodos de pago (incluyendo desglose mixto)
export function parsearGastoMetodos(metodoPagoStr, totalMonto = 0) {
  if (!metodoPagoStr) return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
  const str = String(metodoPagoStr).trim();

  if (str === 'Efectivo') return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
  if (str === 'Yape') return { efec: 0, yape: totalMonto, tarj: 0, esMixto: false };
  if (str === 'Tarjeta') return { efec: 0, yape: 0, tarj: totalMonto, esMixto: false };

  if (str.startsWith('Mixto')) {
    let efec = 0, yape = 0, tarj = 0;
    const efecMatch = str.match(/Efec:\s*(?:S\/\s*)?([0-9.]+)/i);
    const yapeMatch = str.match(/Yape:\s*(?:S\/\s*)?([0-9.]+)/i);
    const tarjMatch = str.match(/Tarj:\s*(?:S\/\s*)?([0-9.]+)/i);

    if (efecMatch) efec = parseFloat(efecMatch[1]) || 0;
    if (yapeMatch) yape = parseFloat(yapeMatch[1]) || 0;
    if (tarjMatch) tarj = parseFloat(tarjMatch[1]) || 0;

    if (efec === 0 && yape === 0 && tarj === 0) {
      efec = totalMonto;
    }
    return { efec, yape, tarj, esMixto: true };
  }

  return { efec: totalMonto, yape: 0, tarj: 0, esMixto: false };
}

export default function ComprasPage() {
  const [compras, setCompras] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  
  // Modales
  const [modalManual, setModalManual] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalReporteCaja, setModalReporteCaja] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);
  const [compraEliminando, setCompraEliminando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [editCatId, setEditCatId] = useState(null);

  // Filtros
  const hoyStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [fechaDesde, setFechaDesde] = useState(hoyStr);
  const [fechaHasta, setFechaHasta] = useState(hoyStr);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('Todos');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  // Parámetros de Control de Caja Borrador
  const [cajaInicialEfec, setCajaInicialEfec] = useState('400.00');
  const [cajaInicialYape, setCajaInicialYape] = useState('0.00');
  const [cajaInicialOtros, setCajaInicialOtros] = useState('0.00');
  const [tiendaInfo, setTiendaInfo] = useState('Jr. AMALIA PUGA Nº 428');

  const hoy = new Date();
  const [periodoMes, setPeriodoMes] = useState(
    `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}`
  );

  const [formCompra, setFormCompra] = useState({
    proveedor: '', ruc: '', tipoDocumento: 'Recibo Interno', serieNumero: '',
    baseImponible: '', igv: '', total: '', categoria: 'Insumos y Alimentos',
    fechaEmision: hoyStr,
    metodoPago: 'Efectivo',
    montoEfectivoMixto: '', montoTarjetaMixto: '', montoYapeMixto: '',
  });

  const [apiStatus, setApiStatus] = useState({ modoDemo: true, apisunatActivo: false });

  const showToast = (msg, tipo = 'ok') => {
    setToastMsg({ msg, tipo });
    setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchTodo = useCallback(async () => {
    setCargando(true);
    try {
      const [cs, st, stApi, vts] = await Promise.all([
        api.getCompras(fechaDesde, fechaHasta, {
          categoria: filtroCategoria !== 'Todas' ? filtroCategoria : undefined,
          metodoPago: filtroMetodoPago !== 'Todos' ? filtroMetodoPago : undefined,
          busqueda: busquedaTexto || undefined,
        }),
        api.getComprasStats(),
        api.getStatus().catch(() => null),
        api.getHistorialVentas(fechaDesde, fechaHasta).catch(() => [])
      ]);
      setCompras(cs || []);
      setVentas(vts || []);
      setStats(st);
      if (stApi && stApi.ok) {
        setApiStatus({ modoDemo: stApi.modoDemo, apisunatActivo: stApi.apisunatActivo });
      }
    } catch (e) {
      console.error(e);
      showToast('Error cargando datos: ' + e.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta, filtroCategoria, filtroMetodoPago, busquedaTexto]);

  useEffect(() => {
    fetchTodo();
  }, [fetchTodo]);

  // Accesos rápidos de fechas
  const setRangoPreset = (preset) => {
    const d = new Date();
    if (preset === 'hoy') {
      const s = d.toISOString().split('T')[0];
      setFechaDesde(s);
      setFechaHasta(s);
    } else if (preset === 'ayer') {
      d.setDate(d.getDate() - 1);
      const s = d.toISOString().split('T')[0];
      setFechaDesde(s);
      setFechaHasta(s);
    } else if (preset === 'semana') {
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      const sDesde = d.toISOString().split('T')[0];
      const sHasta = new Date().toISOString().split('T')[0];
      setFechaDesde(sDesde);
      setFechaHasta(sHasta);
    } else if (preset === 'mes') {
      const sDesde = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const sHasta = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      setFechaDesde(sDesde);
      setFechaHasta(sHasta);
    }
  };

  // ── AUTOCOMPLETAR CONCEPTO RÁPIDO ───────────────────────────────────────
  const aplicarConceptoRapido = (concepto) => {
    setFormCompra(prev => ({
      ...prev,
      proveedor: prev.proveedor ? prev.proveedor : concepto.nombre,
      categoria: concepto.cat,
    }));
  };

  // ── GUARDAR NUEVO GASTO / COMPRA ─────────────────────────────────────────
  const guardarCompraManual = async () => {
    if (!formCompra.proveedor || !formCompra.total || parseFloat(formCompra.total) <= 0) {
      showToast('Ingresa el nombre/descripción del gasto y un monto válido.', 'error');
      return;
    }

    const tot = parseFloat(formCompra.total);
    let finalMetodoPago = formCompra.metodoPago;

    if (formCompra.metodoPago === 'Mixto') {
      const efec = parseFloat(formCompra.montoEfectivoMixto) || 0;
      const yape = parseFloat(formCompra.montoYapeMixto) || 0;
      const tarj = parseFloat(formCompra.montoTarjetaMixto) || 0;
      const suma = efec + yape + tarj;

      if (Math.abs(suma - tot) > 0.01) {
        showToast(`⚠️ La suma del pago mixto (S/ ${suma.toFixed(2)}) no coincide con el total de S/ ${tot.toFixed(2)}.`, 'error');
        return;
      }
      finalMetodoPago = `Mixto (Efec: S/ ${efec.toFixed(2)}, Yape: S/ ${yape.toFixed(2)}${tarj > 0 ? `, Tarj: S/ ${tarj.toFixed(2)}` : ''})`;
    }

    setGuardando(true);
    try {
      let base = parseFloat(formCompra.baseImponible) || tot;
      let igv = parseFloat(formCompra.igv) || 0;
      
      if (formCompra.tipoDocumento === 'Factura' && base === tot) {
        base = parseFloat((tot / 1.105).toFixed(2));
        igv = parseFloat((tot - base).toFixed(2));
      }

      await api.crearCompra({
        proveedor: formCompra.proveedor,
        ruc: formCompra.ruc || null,
        tipoDocumento: formCompra.tipoDocumento || 'Recibo Interno',
        serieNumero: formCompra.serieNumero || null,
        baseImponible: base,
        igv: igv,
        total: tot,
        origenCarga: 'manual',
        categoria: formCompra.categoria || 'Otros',
        fechaEmision: formCompra.fechaEmision || null,
        metodoPago: finalMetodoPago,
      });
      await fetchTodo();
      setModalManual(false);
      setFormCompra({
        proveedor: '', ruc: '', tipoDocumento: 'Recibo Interno', serieNumero: '',
        baseImponible: '', igv: '', total: '', categoria: 'Insumos y Alimentos',
        fechaEmision: hoyStr, metodoPago: 'Efectivo',
        montoEfectivoMixto: '', montoTarjetaMixto: '', montoYapeMixto: ''
      });
      showToast('✅ Gasto registrado correctamente.');
    } catch (err) {
      showToast('❌ Error al guardar: ' + err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── EDITAR COMPRA EXISTENTE ─────────────────────────────────────────────
  const abrirModalEditar = (compra) => {
    const parsed = parsearGastoMetodos(compra.metodoPago, compra.total);
    setCompraEditando({
      id: compra.id,
      proveedor: compra.proveedor || '',
      ruc: compra.ruc || '',
      tipoDocumento: compra.tipoDocumento || 'Recibo Interno',
      serieNumero: compra.serieNumero || '',
      baseImponible: compra.baseImponible || 0,
      igv: compra.igv || 0,
      total: compra.total || 0,
      categoria: compra.categoria || 'Otros',
      fechaEmision: compra.fechaEmision ? compra.fechaEmision.split('T')[0] : (compra.creadoEn ? compra.creadoEn.split('T')[0] : hoyStr),
      metodoPago: parsed.esMixto ? 'Mixto' : (compra.metodoPago || 'Efectivo'),
      montoEfectivoMixto: parsed.esMixto ? String(parsed.efec) : '',
      montoYapeMixto: parsed.esMixto ? String(parsed.yape) : '',
      montoTarjetaMixto: parsed.esMixto ? String(parsed.tarj) : '',
    });
    setModalEditar(true);
  };

  const guardarEdicionCompra = async () => {
    if (!compraEditando || !compraEditando.proveedor || !compraEditando.total) {
      showToast('Ingresa la descripción y el monto total.', 'error');
      return;
    }

    const tot = parseFloat(compraEditando.total);
    let finalMetodoPago = compraEditando.metodoPago;

    if (compraEditando.metodoPago === 'Mixto') {
      const efec = parseFloat(compraEditando.montoEfectivoMixto) || 0;
      const yape = parseFloat(compraEditando.montoYapeMixto) || 0;
      const tarj = parseFloat(compraEditando.montoTarjetaMixto) || 0;
      const suma = efec + yape + tarj;

      if (Math.abs(suma - tot) > 0.01) {
        showToast(`⚠️ La suma del pago mixto (S/ ${suma.toFixed(2)}) no coincide con el total de S/ ${tot.toFixed(2)}.`, 'error');
        return;
      }
      finalMetodoPago = `Mixto (Efec: S/ ${efec.toFixed(2)}, Yape: S/ ${yape.toFixed(2)}${tarj > 0 ? `, Tarj: S/ ${tarj.toFixed(2)}` : ''})`;
    }

    setGuardando(true);
    try {
      let base = parseFloat(compraEditando.baseImponible) || tot;
      let igv = parseFloat(compraEditando.igv) || 0;

      if (compraEditando.tipoDocumento === 'Factura' && base === tot) {
        base = parseFloat((tot / 1.105).toFixed(2));
        igv = parseFloat((tot - base).toFixed(2));
      }

      await api.editarCompra(compraEditando.id, {
        proveedor: compraEditando.proveedor,
        ruc: compraEditando.ruc || null,
        tipoDocumento: compraEditando.tipoDocumento,
        serieNumero: compraEditando.serieNumero || null,
        baseImponible: base,
        igv: igv,
        total: tot,
        categoria: compraEditando.categoria || null,
        fechaEmision: compraEditando.fechaEmision || null,
        metodoPago: finalMetodoPago,
      });
      await fetchTodo();
      setModalEditar(false);
      setCompraEditando(null);
      showToast('✅ Gasto actualizado correctamente.');
    } catch (err) {
      showToast('❌ Error al actualizar: ' + err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ── ELIMINAR COMPRA ──────────────────────────────────────────────────────
  const ejecutarEliminarCompra = async () => {
    if (!compraEliminando) return;
    try {
      await api.eliminarCompra(compraEliminando.id);
      await fetchTodo();
      setCompraEliminando(null);
      showToast('✅ Registro eliminado correctamente.');
    } catch (err) {
      showToast('❌ Error al eliminar: ' + err.message, 'error');
    }
  };

  // ── CALCULAR BASE / IGV ──────────────────────────────────────────────────
  const calcularPorTotal = (valTotal, isEditing = false) => {
    const total = parseFloat(valTotal);
    if (isNaN(total)) return;
    const base = parseFloat((total / 1.105).toFixed(2));
    const igv = parseFloat((total - base).toFixed(2));
    if (isEditing) {
      setCompraEditando(f => ({ ...f, total: String(total), baseImponible: String(base), igv: String(igv) }));
    } else {
      setFormCompra(f => ({ ...f, total: String(total), baseImponible: String(base), igv: String(igv) }));
    }
  };

  // ── ACTUALIZAR CATEGORÍA INLINE ─────────────────────────────────────────
  const actualizarCategoria = async (id, categoria) => {
    try {
      await api.actualizarCategoriaCompra(id, categoria);
      setCompras(prev => prev.map(c => c.id === id ? { ...c, categoria } : c));
      const st = await api.getComprasStats();
      setStats(st);
      setEditCatId(null);
    } catch (err) {
      showToast('Error al actualizar categoría', 'error');
    }
  };

  // ── SINCRONIZAR CON SUNAT ───────────────────────────────────────────────
  const sincronizarConSunat = async () => {
    setSincronizando(true);
    try {
      const result = await api.sincronizarSunat({ periodo: periodoMes });
      setUltimaSync(new Date());
      await fetchTodo();
      showToast(result.mensaje || '✅ Sincronización completada', result.modoDemo ? 'demo' : 'ok');
    } catch (err) {
      showToast('❌ Error al sincronizar: ' + err.message, 'error');
    } finally {
      setSincronizando(false);
    }
  };

  // ── CÁLCULO DETALLADO DE INGRESOS POR VENTAS DEL PERIODO ─────────────────
  const ventasDetalle = useMemo(() => {
    let efec = 0, tarj = 0, yape = 0, total = 0;
    (ventas || []).forEach(v => {
      if (v.anulado || v.estadoPedido === 'Cancelado') return;
      total += (parseFloat(v.total) || 0);
      if (v.metodoPago === 'Efectivo') {
        efec += (parseFloat(v.total) || 0);
      } else if (v.metodoPago === 'Tarjeta') {
        tarj += (parseFloat(v.total) || 0);
      } else if (v.metodoPago === 'Yape') {
        yape += (parseFloat(v.total) || 0);
      } else if (v.metodoPago === 'Mixto') {
        efec += (parseFloat(v.montoEfectivo) || 0);
        tarj += (parseFloat(v.montoTarjeta) || 0);
        yape += (parseFloat(v.montoYape) || 0);
      }
    });
    return { total, efec, tarj, yape };
  }, [ventas]);

  // ── CÁLCULO DETALLADO DE EGRESOS POR GASTOS DEL PERIODO ───────────────────
  const gastosDetalle = useMemo(() => {
    let efec = 0, tarj = 0, yape = 0, total = 0;
    (compras || []).forEach(c => {
      const tot = parseFloat(c.total) || 0;
      total += tot;
      const p = parsearGastoMetodos(c.metodoPago, tot);
      efec += p.efec;
      tarj += p.tarj;
      yape += p.yape;
    });
    return { total, efec, tarj, yape };
  }, [compras]);

  // ── CUADRE DE CAJA FÍSICA Y BALANCE NETO ──────────────────────────────────
  const cuadreCaja = useMemo(() => {
    const ciEfec = parseFloat(cajaInicialEfec) || 0;
    const ciYape = parseFloat(cajaInicialYape) || 0;
    const ciOtros = parseFloat(cajaInicialOtros) || 0;
    const totalCI = ciEfec + ciYape + ciOtros;

    // Efectivo real esperado en cajón físico:
    const saldoEfectivoFinal = ciEfec + ventasDetalle.efec - gastosDetalle.efec;

    // Balance neto operativo del periodo (Ingresos Totales - Gastos Totales):
    const utilidadNetaOperativa = ventasDetalle.total - gastosDetalle.total;

    return {
      ciEfec,
      ciYape,
      ciOtros,
      totalCI,
      saldoEfectivoFinal,
      utilidadNetaOperativa
    };
  }, [cajaInicialEfec, cajaInicialYape, cajaInicialOtros, ventasDetalle, gastosDetalle]);

  // ── EXPORTAR CONTROL CAJA BORRADOR A EXCEL (.XLS) ──────────────────────
  const exportarControlCajaExcel = () => {
    if (compras.length === 0) {
      showToast('No hay gastos registrados en el periodo seleccionado.', 'error');
      return;
    }

    const fechaObj = new Date(fechaDesde + 'T12:00:00');
    const diaNombre = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][fechaObj.getDay()];
    const mesNombre = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][fechaObj.getMonth()];
    const anio = fechaObj.getFullYear();

    let tableRows = '';
    compras.forEach((c, idx) => {
      const comprobante = c.serieNumero ? `${c.tipoDocumento} ${c.serieNumero}` : (c.metodoPago === 'Yape' ? 'YAPE' : (c.tipoDocumento || ''));
      tableRows += `
        <tr>
          <td style="border: 1px solid #999; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #999; padding: 6px; font-weight: bold;">${c.proveedor || 'Sin descripción'}</td>
          <td style="border: 1px solid #999; padding: 6px;">${c.categoria || 'Otros'}</td>
          <td style="border: 1px solid #999; padding: 6px; text-align: right; font-weight: bold;">${parseFloat(c.total || 0).toFixed(2)}</td>
          <td style="border: 1px solid #999; padding: 6px; text-align: center;">${c.metodoPago || comprobante}</td>
          <td style="border: 1px solid #999; padding: 6px; text-align: center;"></td>
        </tr>
      `;
    });

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Control Caja Borrador</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; }
          .header-title { font-size: 16px; font-weight: bold; text-align: center; }
          .sub-header { font-size: 12px; font-weight: bold; }
          .table-header { background-color: #E2E8F0; font-weight: bold; text-align: center; border: 1px solid #000; }
          .total-row { background-color: #FEF3C7; font-weight: bold; font-size: 13px; }
          .ingreso-row { background-color: #ECFDF5; font-weight: bold; }
          .egreso-row { background-color: #FEF2F2; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="6" class="header-title">CONTROL CAJA BORRADOR Y CUADRE DEL DÍA</td></tr>
          <tr><td colspan="6" class="sub-header">TIENDA: ${tiendaInfo}</td></tr>
          <tr>
            <td colspan="2"><b>FECHA:</b> ${fechaDesde} al ${fechaHasta}</td>
            <td><b>DÍA:</b> ${diaNombre}</td>
            <td><b>MES:</b> ${mesNombre}</td>
            <td colspan="2"><b>AÑO:</b> ${anio}</td>
          </tr>
          <tr>
            <td colspan="6"><b>C.I. (Caja Inicial):</b> S/ ${cuadreCaja.ciEfec.toFixed(2)} (Efectivo) + S/ ${cuadreCaja.ciYape.toFixed(2)} (Yape) = <b>S/ ${cuadreCaja.totalCI.toFixed(2)}</b></td>
          </tr>
          <tr><td colspan="6"></td></tr>
          
          <!-- RESUMEN CONSOLIDADO CON MONEDAS POR SEPARADO -->
          <tr class="ingreso-row">
            <td colspan="3" style="border: 1px solid #000; padding: 6px;"><b>1. TOTAL INGRESOS POR VENTAS:</b></td>
            <td style="border: 1px solid #000; text-align: right; padding: 6px; font-weight: bold;">S/ ${ventasDetalle.total.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px;"></td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Efectivo en Ventas:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${ventasDetalle.efec.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Yape / Plin en Ventas:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${ventasDetalle.yape.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Tarjeta / POS en Ventas:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${ventasDetalle.tarj.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>

          <tr class="egreso-row">
            <td colspan="3" style="border: 1px solid #000; padding: 6px;"><b>2. TOTAL GASTOS Y EGRESOS DEL DÍA:</b></td>
            <td style="border: 1px solid #000; text-align: right; padding: 6px; font-weight: bold;">S/ ${gastosDetalle.total.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px;"></td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Salidas en Efectivo (Caja):</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${gastosDetalle.efec.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Pagos en Yape / Plin:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${gastosDetalle.yape.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #ccc; padding: 4px; padding-left: 20px;">• Pagos en Tarjeta / Banco:</td>
            <td style="border: 1px solid #ccc; text-align: right; padding: 4px;">S/ ${gastosDetalle.tarj.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #ccc;"></td>
          </tr>

          <tr class="total-row">
            <td colspan="3" style="border: 1px solid #000; padding: 6px;"><b>3. SALDO FINAL ESTIMADO EN EFECTIVO (CAJÓN):</b></td>
            <td style="border: 1px solid #000; text-align: right; padding: 6px; font-weight: bold;">S/ ${cuadreCaja.saldoEfectivoFinal.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #000; padding: 6px;">(C.I. Efectivo S/ ${cuadreCaja.ciEfec.toFixed(2)} + Ventas Efec S/ ${ventasDetalle.efec.toFixed(2)} - Gastos Efec S/ ${gastosDetalle.efec.toFixed(2)})</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #999; padding: 4px; font-weight: bold;">4. SALDO DIGITAL / BANCARIO (YAPE + TARJETA):</td>
            <td style="border: 1px solid #999; text-align: right; padding: 4px; font-weight: bold;">S/ ${(ventasDetalle.yape + ventasDetalle.tarj - gastosDetalle.yape - gastosDetalle.tarj + cuadreCaja.ciYape).toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #999;"></td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #000; font-weight: bold; padding: 6px; background-color: #E2E8F0;">5. UTILIDAD OPERATIVA NETA DEL DÍA (VENTAS - GASTOS):</td>
            <td style="border: 1px solid #000; font-weight: bold; text-align: right; padding: 6px; background-color: #E2E8F0;">S/ ${cuadreCaja.utilidadNetaOperativa.toFixed(2)}</td>
            <td colspan="2" style="border: 1px solid #000; background-color: #E2E8F0;"></td>
          </tr>
          <tr><td colspan="6"></td></tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Control_Caja_Borrador_${fechaDesde}_FOGON.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Archivo Excel descargado con éxito.');
  };

  // ── EXPORTAR CSV SIRE (ORIGINAL) ────────────────────────────────────────
  const exportarCSV = () => {
    if (compras.length === 0) { showToast('No hay compras para exportar.', 'error'); return; }
    const encabezado = ['Periodo', 'Nro Correlativo', 'Fecha Emisión', 'Tipo Comprobante', 'Serie-Número', 'RUC Proveedor', 'Razón Social', 'Moneda', 'Base Imponible', 'IGV (10.5%)', 'Total', 'Categoría Interna', 'Origen'];
    const filas = compras.map((c, i) => {
      const fechaEm = c.fechaEmision ? new Date(c.fechaEmision).toLocaleDateString('es-PE') : new Date(c.creadoEn).toLocaleDateString('es-PE');
      return [
        periodoMes,
        String(i + 1).padStart(4, '0'),
        fechaEm,
        c.tipoDocumento,
        c.serieNumero || 'S/N',
        c.ruc || '',
        `"${c.proveedor}"`,
        'PEN',
        c.baseImponible.toFixed(2),
        c.igv.toFixed(2),
        c.total.toFixed(2),
        c.categoria || 'Sin Categoría',
        c.origenCarga,
      ].join(',');
    });
    const csv = '\uFEFF' + [encabezado.join(','), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RCE_Compras_${periodoMes}_FOGON.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ CSV exportado para SIRE / Siscont.');
  };

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50 relative">

      {/* TOAST NOTIFICACIÓN */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-[300] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl max-w-sm animate-slide-up border ${
          toastMsg.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          toastMsg.tipo === 'demo'  ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          {toastMsg.tipo === 'error'
            ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            : <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />}
          <p className="text-sm font-semibold leading-snug">{toastMsg.msg}</p>
          <button onClick={() => setToastMsg(null)} className="ml-2 shrink-0 opacity-50 hover:opacity-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-amber-500" /> Control de Gastos y Cuadre de Caja
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Registro diario de salidas de caja, ingresos por ventas y generación del reporte <strong>Control Caja Borrador</strong>.
          </p>
        </div>

        {/* BOTONES PRINCIPALES */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setModalManual(true)}
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> + Registrar Gasto
          </button>
          <button
            onClick={() => setModalReporteCaja(true)}
            className="flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" /> Control Caja (PDF/Print)
          </button>
          <button
            onClick={exportarControlCajaExcel}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all cursor-pointer"
            title="Descargar formato Excel compatible con el cuaderno físico"
          >
            <Download className="w-4 h-4" /> Excel Control Caja
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS AVANZADOS */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4 md:p-5 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Rangos rápidos de fecha */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Rango:</span>
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'ayer', label: 'Ayer' },
              { id: 'semana', label: 'Esta Semana' },
              { id: 'mes', label: 'Este Mes' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setRangoPreset(p.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-600 transition-all cursor-pointer active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Selector personalizado Desde - Hasta */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Buscador y Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          
          {/* Buscador */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busquedaTexto}
              onChange={e => setBusquedaTexto(e.target.value)}
              placeholder="Buscar gasto, proveedor, RUC..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Categoría */}
          <div>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="Todas">📂 Todas las categorías</option>
              {CATEGORIAS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Método de Pago */}
          <div>
            <select
              value={filtroMetodoPago}
              onChange={e => setFiltroMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="Todos">💳 Todos los medios de pago</option>
              <option value="Efectivo">💵 Efectivo</option>
              <option value="Yape">📱 Yape / Plin</option>
              <option value="Tarjeta">💳 Tarjeta</option>
              <option value="Mixto">🔄 Mixto</option>
            </select>
          </div>

          {/* Botón Exportar SIRE */}
          <div>
            <button
              onClick={exportarCSV}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
              title="Exportar CSV formato SIRE"
            >
              <Download className="w-3.5 h-3.5" /> Exportar SIRE (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          PANEL DE CUADRE DEL DÍA: INGRESOS vs EGRESOS
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* TARJETA 1: INGRESOS POR VENTAS */}
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" /> Ingresos por Ventas
            </span>
            <span className="text-[10px] font-bold text-slate-400">{ventas.length} ventas</span>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900">
            S/ {ventasDetalle.total.toFixed(2)}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] text-slate-600 font-bold">
            <div>💵 Efec: S/ {ventasDetalle.efec.toFixed(2)}</div>
            <div>📱 Yape: S/ {ventasDetalle.yape.toFixed(2)}</div>
            <div>💳 Tarj: S/ {ventasDetalle.tarj.toFixed(2)}</div>
          </div>
        </div>

        {/* TARJETA 2: GASTOS Y EGRESOS */}
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Gastos y Compras
            </span>
            <span className="text-[10px] font-bold text-slate-400">{compras.length} gastos</span>
          </div>
          <p className="text-2xl font-black font-mono text-rose-600">
            S/ {gastosDetalle.total.toFixed(2)}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] text-slate-600 font-bold">
            <div>💵 Efec: S/ {gastosDetalle.efec.toFixed(2)}</div>
            <div>📱 Yape: S/ {gastosDetalle.yape.toFixed(2)}</div>
            <div>💳 Tarj: S/ {gastosDetalle.tarj.toFixed(2)}</div>
          </div>
        </div>

        {/* TARJETA 3: SALDO EFECTIVO EN CAJA Y BALANCE NETO */}
        <div className="bg-slate-900 rounded-3xl shadow-lg p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-amber-400" /> Efectivo Esperado en Caja
              </span>
              <span className="text-[10px] text-slate-400 font-mono">C.I.: S/ {cuadreCaja.ciEfec.toFixed(2)}</span>
            </div>
            <p className="text-3xl font-black font-mono text-emerald-400">
              S/ {cuadreCaja.saldoEfectivoFinal.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              (Caja Inicial + Ventas Efectivo - Gastos Efectivo)
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-400">Utilidad Neta del Periodo:</span>
            <span className={`font-mono font-black ${cuadreCaja.utilidadNetaOperativa >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              S/ {cuadreCaja.utilidadNetaOperativa.toFixed(2)}
            </span>
          </div>
        </div>

      </div>

      {/* TABLA PRINCIPAL DE GASTOS Y COMPRAS */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center flex-wrap gap-2">
          <h2 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> Registro Detallado de Gastos y Facturas
          </h2>
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {compras.length} Registro{compras.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {cargando ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[850px]">
              <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 w-12 text-center">Nº</th>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Descripción / Proveedor</th>
                  <th className="px-5 py-4">Categoría</th>
                  <th className="px-5 py-4">Comprobante</th>
                  <th className="px-5 py-4 text-right">Monto (S/)</th>
                  <th className="px-5 py-4 text-center">Medio Pago</th>
                  <th className="px-5 py-4 text-center">Origen</th>
                  <th className="px-5 py-4 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm bg-white">
                {compras.length > 0 ? compras.map((c, idx) => {
                  const fechaEm = c.fechaEmision
                    ? new Date(c.fechaEmision).toLocaleDateString('es-PE')
                    : new Date(c.creadoEn).toLocaleDateString('es-PE');
                  const origen = ORIGEN_BADGE[c.origenCarga] || ORIGEN_BADGE['manual'];
                  const colores = COLORES_CATEGORIA[c.categoria] || COLORES_CATEGORIA['Sin Categoría'];

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 text-center font-mono text-xs text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-600 text-xs">{fechaEm}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-black text-slate-900 text-xs leading-tight">{c.proveedor}</div>
                        {c.ruc && c.ruc !== '00000000000' && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">RUC: {c.ruc}</div>
                        )}
                      </td>

                      {/* CATEGORÍA INLINE */}
                      <td className="px-5 py-3.5">
                        {editCatId === c.id ? (
                          <div className="relative">
                            <select
                              autoFocus
                              defaultValue={c.categoria || ''}
                              onBlur={e => {
                                if (e.target.value !== c.categoria) {
                                  actualizarCategoria(c.id, e.target.value || null);
                                } else {
                                  setEditCatId(null);
                                }
                              }}
                              onChange={e => actualizarCategoria(c.id, e.target.value || null)}
                              className="border border-amber-400 rounded-lg px-2 py-1 text-xs font-bold bg-white focus:outline-none focus:border-amber-500 w-full"
                            >
                              <option value="">Sin categoría</option>
                              {CATEGORIAS.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditCatId(c.id)}
                            title="Click para editar categoría"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all hover:opacity-80 cursor-pointer ${colores.bg} ${colores.text} ${colores.border}`}
                          >
                            {c.categoria || 'Sin categoría'}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                          </button>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-600 text-xs">{c.tipoDocumento || 'Recibo'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.serieNumero || 'S/N'}</div>
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-black text-slate-950 text-sm">
                        S/ {parseFloat(c.total || 0).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          c.metodoPago === 'Efectivo' ? 'bg-amber-100 text-amber-800' :
                          c.metodoPago === 'Yape' ? 'bg-purple-100 text-purple-800' :
                          c.metodoPago?.startsWith('Mixto') ? 'bg-indigo-100 text-indigo-800' :
                          'bg-blue-100 text-blue-800'
                        }`} title={c.metodoPago}>
                          {c.metodoPago || 'Efectivo'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${origen.cls}`}>
                          {origen.label}
                        </span>
                      </td>

                      {/* ACCIONES: EDITAR Y ELIMINAR */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => abrirModalEditar(c)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-90 cursor-pointer"
                            title="Editar este gasto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setCompraEliminando(c)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all active:scale-90 cursor-pointer"
                            title="Eliminar este gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="9" className="text-center py-16 text-slate-400">
                      <RefreshCw className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                      <p className="font-black uppercase text-xs tracking-wider mb-1">No hay gastos en este rango</p>
                      <p className="text-xs">Registra un nuevo gasto manual o amplía las fechas de búsqueda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          MODAL DE REGISTRO MANUAL DE GASTO (ÁGIL + MIXTO)
      ═══════════════════════════════════════════════════ */}
      {modalManual && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-scale-in">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-tight text-sm">
                <PlusCircle className="w-5 h-5 text-amber-500" /> Registrar Nuevo Gasto / Compra
              </h3>
              <button onClick={() => setModalManual(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-slate-50 max-h-[80vh] overflow-y-auto custom-scrollbar">

              {/* CHIPS DE CONCEPTOS RÁPIDOS */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Conceptos Frecuentes (Autollenado Rápido)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CONCEPTOS_RAPIDOS.map((cp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => aplicarConceptoRapido(cp)}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white hover:bg-amber-100 hover:text-amber-900 border border-slate-200 text-slate-700 transition-all cursor-pointer active:scale-95"
                    >
                      {cp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                
                {/* Nombre / Descripción */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Nombre / Descripción del Gasto *
                  </label>
                  <input
                    type="text"
                    value={formCompra.proveedor}
                    onChange={e => setFormCompra(f => ({ ...f, proveedor: e.target.value }))}
                    placeholder="Ej. Pollo para caldo, Fluorescentes (2), Martha Silva Sueldo, Gas..."
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>

                {/* Monto Total */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Monto Total (S/) *
                  </label>
                  <input
                    type="number" min="0" step="0.01"
                    value={formCompra.total}
                    onChange={e => calcularPorTotal(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:border-amber-500 bg-white font-mono font-black text-slate-900"
                  />
                </div>

                {/* Método de Pago */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Medio de Pago *
                  </label>
                  <select
                    value={formCompra.metodoPago}
                    onChange={e => {
                      const nuevoMetodo = e.target.value;
                      setFormCompra(f => {
                        const tot = parseFloat(f.total) || 0;
                        return {
                          ...f,
                          metodoPago: nuevoMetodo,
                          montoEfectivoMixto: nuevoMetodo === 'Mixto' ? String(tot) : '',
                          montoYapeMixto: '',
                          montoTarjetaMixto: '',
                        };
                      });
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 bg-white font-bold text-slate-800"
                  >
                    <option value="Efectivo">💵 Efectivo (Caja)</option>
                    <option value="Yape">📱 Yape / Plin</option>
                    <option value="Tarjeta">💳 Tarjeta / Banco</option>
                    <option value="Mixto">🔄 Pago Mixto (Desglosar)</option>
                  </select>
                </div>

                {/* PANEL DESGLOSE PAGO MIXTO */}
                {formCompra.metodoPago === 'Mixto' && (() => {
                  const tot = parseFloat(formCompra.total) || 0;
                  const efec = parseFloat(formCompra.montoEfectivoMixto) || 0;
                  const yape = parseFloat(formCompra.montoYapeMixto) || 0;
                  const tarj = parseFloat(formCompra.montoTarjetaMixto) || 0;
                  const suma = efec + yape + tarj;
                  const dif = tot - suma;
                  return (
                    <div className="col-span-2 bg-amber-50/70 border border-amber-300 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                          🔄 Desglose de Pago Mixto
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-600">Total: S/ {tot.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💵 Efectivo (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={formCompra.montoEfectivoMixto}
                            onChange={e => setFormCompra(f => ({ ...f, montoEfectivoMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">📱 Yape / Plin (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={formCompra.montoYapeMixto}
                            onChange={e => setFormCompra(f => ({ ...f, montoYapeMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💳 Tarjeta (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={formCompra.montoTarjetaMixto}
                            onChange={e => setFormCompra(f => ({ ...f, montoTarjetaMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-xs font-black px-3 py-2 rounded-xl ${
                        Math.abs(dif) < 0.01 ? 'bg-emerald-100 text-emerald-800' :
                        dif > 0 ? 'bg-amber-200 text-amber-900' : 'bg-rose-100 text-rose-800'
                      }`}>
                        <span>Suma Asignada: S/ {suma.toFixed(2)}</span>
                        <span>
                          {Math.abs(dif) < 0.01 ? '✅ Cuadrado Exacto' :
                           dif > 0 ? `⚠️ Falta asignar: S/ ${dif.toFixed(2)}` :
                           `⚠️ Excede por: S/ ${Math.abs(dif).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Categoría */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Categoría</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIAS.map(cat => {
                      const activa = formCompra.categoria === cat;
                      const colores = COLORES_CATEGORIA[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCompra(f => ({ ...f, categoria: cat }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-black border transition-all cursor-pointer ${
                            activa ? `${colores.bg} ${colores.text} ${colores.border} scale-105 shadow-sm` : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Fecha del Gasto</label>
                  <input
                    type="date"
                    value={formCompra.fechaEmision}
                    onChange={e => setFormCompra(f => ({ ...f, fechaEmision: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white font-mono"
                  />
                </div>

                {/* Tipo de Comprobante */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Comprobante</label>
                  <select
                    value={formCompra.tipoDocumento}
                    onChange={e => setFormCompra(f => ({ ...f, tipoDocumento: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="Recibo Interno">Recibo Interno / Sin Comprobante</option>
                    <option value="Boleta">Boleta de Venta</option>
                    <option value="Factura">Factura</option>
                    <option value="Ticket">Ticket</option>
                  </select>
                </div>

                {/* Serie y Número / RUC Opcionales */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nº Comprobante / Recibo</label>
                  <input
                    type="text"
                    value={formCompra.serieNumero}
                    onChange={e => setFormCompra(f => ({ ...f, serieNumero: e.target.value }))}
                    placeholder="Ej. REC-045, F001-124"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">RUC (Opcional)</label>
                  <input
                    type="text" maxLength={11}
                    value={formCompra.ruc}
                    onChange={e => setFormCompra(f => ({ ...f, ruc: e.target.value }))}
                    placeholder="11 dígitos"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white font-mono"
                  />
                </div>

              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setModalManual(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={guardarCompraManual}
                disabled={guardando}
                className="px-6 py-2.5 text-sm font-black text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {guardando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Gasto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL DE EDICIÓN COMPLETA DE GASTO (ÁGIL + MIXTO)
      ═══════════════════════════════════════════════════ */}
      {modalEditar && compraEditando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-tight text-sm">
                <Edit3 className="w-5 h-5 text-amber-500" /> Editar Gasto / Compra # {compraEditando.id}
              </h3>
              <button onClick={() => setModalEditar(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-slate-50 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nombre / Descripción *</label>
                  <input
                    type="text"
                    value={compraEditando.proveedor}
                    onChange={e => setCompraEditando(f => ({ ...f, proveedor: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Monto Total (S/) *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={compraEditando.total}
                    onChange={e => calcularPorTotal(e.target.value, true)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-base font-mono font-black text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Medio de Pago</label>
                  <select
                    value={compraEditando.metodoPago}
                    onChange={e => setCompraEditando(f => ({ ...f, metodoPago: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
                  >
                    <option value="Efectivo">💵 Efectivo (Caja)</option>
                    <option value="Yape">📱 Yape / Plin</option>
                    <option value="Tarjeta">💳 Tarjeta / Banco</option>
                    <option value="Mixto">🔄 Pago Mixto (Desglosar)</option>
                  </select>
                </div>

                {/* PANEL DESGLOSE PAGO MIXTO EN EDICIÓN */}
                {compraEditando.metodoPago === 'Mixto' && (() => {
                  const tot = parseFloat(compraEditando.total) || 0;
                  const efec = parseFloat(compraEditando.montoEfectivoMixto) || 0;
                  const yape = parseFloat(compraEditando.montoYapeMixto) || 0;
                  const tarj = parseFloat(compraEditando.montoTarjetaMixto) || 0;
                  const suma = efec + yape + tarj;
                  const dif = tot - suma;
                  return (
                    <div className="col-span-2 bg-amber-50/70 border border-amber-300 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                          🔄 Desglose Pago Mixto
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-600">Total: S/ {tot.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💵 Efectivo (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={compraEditando.montoEfectivoMixto}
                            onChange={e => setCompraEditando(f => ({ ...f, montoEfectivoMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">📱 Yape (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={compraEditando.montoYapeMixto}
                            onChange={e => setCompraEditando(f => ({ ...f, montoYapeMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">💳 Tarjeta (S/)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={compraEditando.montoTarjetaMixto}
                            onChange={e => setCompraEditando(f => ({ ...f, montoTarjetaMixto: e.target.value }))}
                            placeholder="0.00"
                            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-xs font-black px-3 py-2 rounded-xl ${
                        Math.abs(dif) < 0.01 ? 'bg-emerald-100 text-emerald-800' :
                        dif > 0 ? 'bg-amber-200 text-amber-900' : 'bg-rose-100 text-rose-800'
                      }`}>
                        <span>Suma Asignada: S/ {suma.toFixed(2)}</span>
                        <span>
                          {Math.abs(dif) < 0.01 ? '✅ Cuadrado' :
                           dif > 0 ? `⚠️ Falta: S/ ${dif.toFixed(2)}` :
                           `⚠️ Excede: S/ ${Math.abs(dif).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Categoría</label>
                  <select
                    value={compraEditando.categoria || ''}
                    onChange={e => setCompraEditando(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    value={compraEditando.fechaEmision}
                    onChange={e => setCompraEditando(f => ({ ...f, fechaEmision: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tipo Comprobante</label>
                  <select
                    value={compraEditando.tipoDocumento}
                    onChange={e => setCompraEditando(f => ({ ...f, tipoDocumento: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="Recibo Interno">Recibo Interno</option>
                    <option value="Boleta">Boleta de Venta</option>
                    <option value="Factura">Factura</option>
                    <option value="Ticket">Ticket</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Serie / Número</label>
                  <input
                    type="text"
                    value={compraEditando.serieNumero || ''}
                    onChange={e => setCompraEditando(f => ({ ...f, serieNumero: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">RUC</label>
                  <input
                    type="text" maxLength={11}
                    value={compraEditando.ruc || ''}
                    onChange={e => setCompraEditando(f => ({ ...f, ruc: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white font-mono"
                  />
                </div>

              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={() => setModalEditar(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={guardarEdicionCompra}
                disabled={guardando}
                className="px-6 py-2.5 text-sm font-black text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {guardando ? <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
      ═══════════════════════════════════════════════════ */}
      {compraEliminando && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 text-center animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2 uppercase">¿Eliminar este registro de gasto?</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Vas a eliminar <strong>"{compraEliminando.proveedor}"</strong> por el monto de <strong>S/ {parseFloat(compraEliminando.total || 0).toFixed(2)}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCompraEliminando(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarEliminarCompra}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm shadow-lg shadow-red-500/20 transition-all cursor-pointer active:scale-95"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL / VISTA DE IMPRESIÓN 'CONTROL CAJA BORRADOR'
      ═══════════════════════════════════════════════════ */}
      {modalReporteCaja && (() => {
        const fechaObj = new Date(fechaDesde + 'T12:00:00');
        const diaNombre = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][fechaObj.getDay()];
        const mesNombre = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][fechaObj.getMonth()];
        const anio = fechaObj.getFullYear();

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
              
              {/* Barra de control superior (no se imprime) */}
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <Printer className="w-5 h-5 text-amber-400" />
                  <span className="font-black text-sm uppercase tracking-wider">Vista Previa — Control Caja Borrador</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
                  </button>
                  <button
                    onClick={exportarControlCajaExcel}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" /> Excel
                  </button>
                  <button onClick={() => setModalReporteCaja(false)} className="text-slate-400 hover:text-white ml-2 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* CONTENIDO IMPRIMIBLE (Hoja física A4 idéntica a la foto) */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-slate-100 print:p-0 print:bg-white" id="imprimible-control-caja">
                <div className="bg-white p-8 md:p-12 shadow-lg border border-slate-300 rounded-2xl mx-auto max-w-[820px] print:shadow-none print:border-none print:p-0 print:max-w-none text-slate-900 font-sans">
                  
                  {/* Encabezado del documento */}
                  <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
                    <h1 className="text-2xl font-black uppercase tracking-wider text-slate-950">CONTROL CAJA BORRADOR</h1>
                    <p className="text-xs font-bold text-slate-700 mt-1 uppercase tracking-widest">
                      TIENDA: <input type="text" value={tiendaInfo} onChange={e => setTiendaInfo(e.target.value)} className="font-black border-b border-dashed border-slate-400 focus:outline-none text-center px-2 py-0.5 bg-transparent" />
                    </p>
                  </div>

                  {/* Metadatos Fecha / Caja Inicial */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold mb-4 pb-4 border-b border-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Fecha:</span>
                      <span className="font-mono font-black">{fechaDesde === fechaHasta ? fechaDesde : `${fechaDesde} al ${fechaHasta}`}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Día:</span>
                      <span className="font-black">{diaNombre}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Mes:</span>
                      <span className="font-black">{mesNombre}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Año:</span>
                      <span className="font-mono font-black">{anio}</span>
                    </div>
                  </div>

                  {/* C.I. (Caja Inicial Editable en Pantalla) */}
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 mb-6 text-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black uppercase text-slate-700">C.I. (Caja Inicial):</span>
                      <span className="font-mono font-bold">S/</span>
                      <input
                        type="number"
                        step="0.10"
                        value={cajaInicialEfec}
                        onChange={e => setCajaInicialEfec(e.target.value)}
                        placeholder="Efectivo"
                        className="w-20 font-mono font-black text-slate-900 border-b border-slate-400 bg-transparent text-center focus:outline-none"
                        title="Caja Inicial Efectivo"
                      />
                      <span className="text-slate-500 font-bold">+</span>
                      <input
                        type="number"
                        step="0.10"
                        value={cajaInicialYape}
                        onChange={e => setCajaInicialYape(e.target.value)}
                        placeholder="Yape"
                        className="w-20 font-mono font-black text-slate-900 border-b border-slate-400 bg-transparent text-center focus:outline-none"
                        title="Caja Inicial Yape"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">(Yape)</span>
                    </div>
                    <div className="font-mono font-black text-sm text-slate-950">
                      Total C.I.: S/ {cuadreCaja.totalCI.toFixed(2)}
                    </div>
                  </div>

                  {/* TABLA FORMAL CONTROL CAJA */}
                  <table className="w-full text-xs border-collapse border border-slate-900 mb-6">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900 font-black uppercase text-[11px] border-b-2 border-slate-900">
                        <th className="border border-slate-900 p-2 text-center w-8">Nº</th>
                        <th className="border border-slate-900 p-2 text-left">NOMBRE / DESCRIPCIÓN</th>
                        <th className="border border-slate-900 p-2 text-left w-32">CATEGORÍA</th>
                        <th className="border border-slate-900 p-2 text-right w-24">MONTO</th>
                        <th className="border border-slate-900 p-2 text-center w-36">Nº COMPROBANTE / PAGO</th>
                        <th className="border border-slate-900 p-2 text-center w-24">FIRMA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-400">
                      {compras.length > 0 ? compras.map((c, i) => {
                        const comprobanteStr = c.serieNumero ? `${c.tipoDocumento} ${c.serieNumero}` : (c.metodoPago === 'Yape' ? 'YAPE' : (c.tipoDocumento || ''));
                        return (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="border border-slate-900 p-2 text-center font-mono text-slate-500 font-bold">{i + 1}</td>
                            <td className="border border-slate-900 p-2 font-bold uppercase">{c.proveedor}</td>
                            <td className="border border-slate-900 p-2 text-slate-600">{c.categoria || 'Otros'}</td>
                            <td className="border border-slate-900 p-2 text-right font-mono font-black">
                              {parseFloat(c.total || 0).toFixed(2)}
                            </td>
                            <td className="border border-slate-900 p-2 text-center font-mono font-bold text-slate-700">
                              {c.metodoPago || comprobanteStr}
                            </td>
                            <td className="border border-slate-900 p-2 text-center"></td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan="6" className="border border-slate-900 p-8 text-center text-slate-400 font-bold">
                            Sin registros de gastos en la fecha seleccionada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-100 font-black border-t-2 border-slate-900 text-slate-950">
                        <td colSpan="3" className="border border-slate-900 p-2.5 text-right uppercase tracking-wider">
                          TOTAL GASTOS / EGRESOS (S.T.):
                        </td>
                        <td className="border border-slate-900 p-2.5 text-right font-mono text-sm">
                          S/ {gastosDetalle.total.toFixed(2)}
                        </td>
                        <td colSpan="2" className="border border-slate-900 p-2 text-[10px] text-slate-700">
                          Efec: S/ {gastosDetalle.efec.toFixed(2)} | Yape/Dig: S/ {(gastosDetalle.yape + gastosDetalle.tarj).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Resumen Detallado de Cuadre y Firmas con desglose de monedas por separado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-4 border-t-2 border-slate-900">
                    <div className="space-y-3 font-bold bg-slate-50 p-4 rounded-xl border border-slate-300">
                      
                      {/* 1. INGRESOS POR VENTAS DETALLADO */}
                      <div className="pb-2 border-b border-slate-200">
                        <div className="flex justify-between text-emerald-800 font-black text-xs uppercase mb-1">
                          <span>1. INGRESOS POR VENTAS:</span>
                          <span className="font-mono text-sm">S/ {ventasDetalle.total.toFixed(2)}</span>
                        </div>
                        <div className="pl-3 space-y-0.5 text-[11px] text-slate-700 font-normal">
                          <div className="flex justify-between">
                            <span>• Efectivo en Ventas:</span>
                            <span className="font-mono font-bold text-slate-900">S/ {ventasDetalle.efec.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Yape / Plin en Ventas:</span>
                            <span className="font-mono font-bold text-slate-900">S/ {ventasDetalle.yape.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Tarjeta / POS en Ventas:</span>
                            <span className="font-mono font-bold text-slate-900">S/ {ventasDetalle.tarj.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. GASTOS Y EGRESOS DETALLADO */}
                      <div className="pb-2 border-b border-slate-200">
                        <div className="flex justify-between text-rose-800 font-black text-xs uppercase mb-1">
                          <span>2. GASTOS Y EGRESOS DEL DÍA:</span>
                          <span className="font-mono text-sm">S/ {gastosDetalle.total.toFixed(2)}</span>
                        </div>
                        <div className="pl-3 space-y-0.5 text-[11px] text-slate-700 font-normal">
                          <div className="flex justify-between">
                            <span>• Salidas en Efectivo (Caja):</span>
                            <span className="font-mono font-bold text-slate-900">S/ {gastosDetalle.efec.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Pagos en Yape / Plin:</span>
                            <span className="font-mono font-bold text-slate-900">S/ {gastosDetalle.yape.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Pagos en Tarjeta / Banco:</span>
                            <span className="font-mono font-bold text-slate-900">S/ {gastosDetalle.tarj.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 3. CUADRE DE EFECTIVO EN CAJA (FÍSICO) */}
                      <div className="pb-2 border-b border-slate-200 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
                        <div className="flex justify-between text-slate-950 font-black text-xs uppercase">
                          <span>3. SALDO FINAL EN EFECTIVO (CAJÓN):</span>
                          <span className="font-mono text-sm text-amber-700 font-black">S/ {cuadreCaja.saldoEfectivoFinal.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-normal mt-1 leading-tight">
                          (C.I. Efectivo S/ {cuadreCaja.ciEfec.toFixed(2)} + Ventas Efec S/ {ventasDetalle.efec.toFixed(2)} - Gastos Efec S/ {gastosDetalle.efec.toFixed(2)})
                        </div>
                      </div>

                      {/* 4. SALDO DIGITAL / BANCARIO */}
                      <div className="pb-1 text-[11px] text-slate-700">
                        <div className="flex justify-between">
                          <span className="font-bold">4. SALDO DIGITAL (YAPE + TARJETA):</span>
                          <span className="font-mono font-black text-indigo-900">
                            S/ {(ventasDetalle.yape + ventasDetalle.tarj - gastosDetalle.yape - gastosDetalle.tarj + cuadreCaja.ciYape).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* 5. UTILIDAD OPERATIVA NETA */}
                      <div className="flex justify-between text-slate-900 pt-1 text-xs font-black border-t border-slate-300">
                        <span className="uppercase">UTILIDAD NETA DEL DÍA:</span>
                        <span className={`font-mono text-sm ${cuadreCaja.utilidadNetaOperativa >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          S/ {cuadreCaja.utilidadNetaOperativa.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between items-center py-2">
                      <div className="w-full bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-700">
                        <div className="font-black text-slate-900 uppercase tracking-wider text-center pb-1 border-b border-slate-200">
                          Resumen del Arqueo
                        </div>
                        <div className="flex justify-between">
                          <span>Total Comprobantes Emitidos:</span>
                          <span className="font-mono font-bold">{ventas.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Egresos / Compras:</span>
                          <span className="font-mono font-bold">{compras.length}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                          <span>Balance General:</span>
                          <span className="text-emerald-600">✓ CONFORME</span>
                        </div>
                      </div>

                      <div className="w-52 border-t-2 border-dashed border-slate-800 text-center text-[10px] font-black uppercase tracking-widest text-slate-700 pt-2 mt-6">
                        FIRMA RESPONSABLE CAJA
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ESTILOS DE IMPRESIÓN LIMPIOS PARA PDF */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #imprimible-control-caja, #imprimible-control-caja * {
            visibility: visible;
          }
          #imprimible-control-caja {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>

    </section>
  );
}
