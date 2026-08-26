import React, { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, DollarSign, XCircle, Users, Truck, Calendar, Search, Receipt, Printer, X, Wallet, Briefcase } from 'lucide-react';

import { api } from '../api';


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

export default function ReportesPage() {
  const getPrimerDiaMes = () => {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  };

  const getHoyString = () => {
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [fechaDesde, setFechaDesde] = useState(getHoyString());
  const [fechaHasta, setFechaHasta] = useState(getHoyString());
  const [resumen, setResumen] = useState({ 
    ventasTotal: 0, 
    ventasBase: 0, 
    ventasIGV: 0, 
    comprasTotal: 0, 
    comprasBase: 0, 
    comprasIGV: 0, 
    igvAPagar: 0 
  });
  const [cancelaciones, setCancelaciones] = useState([]);
  const [mozos, setMozos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrando, setFiltrando] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [activeComprobante, setActiveComprobante] = useState(null);
  const [sunatModalOpen, setSunatModalOpen] = useState(false);
  const [rotacion, setRotacion] = useState([]);
  const [compras, setCompras] = useState([]);
  const [reportePollos, setReportePollos] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [gerencialModalOpen, setGerencialModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');

  // Filtros de secciones para el Reporte Gerencial PDF
  const [incluirBalance, setIncluirBalance] = useState(true);
  const [incluirMozos, setIncluirMozos] = useState(true);
  const [incluirRotacion, setIncluirRotacion] = useState(true);
  const [incluirGastos, setIncluirGastos] = useState(true);
  const [incluirPedidosYa, setIncluirPedidosYa] = useState(true);
  const [incluirPersonal, setIncluirPersonal] = useState(true);

  const getChickenEquivalency = (name) => {
    const normalized = name.toLowerCase();
    if (normalized.includes('1/2 pollo') || normalized.includes('medio pollo')) {
      return 0.5;
    }
    if (normalized.includes('1/4 pollo') || normalized.includes('cuarto de pollo') || normalized.includes('cuarto pollo')) {
      return 0.25;
    }
    if (normalized.includes('1/8 pollo') || normalized.includes('octavo de pollo') || normalized.includes('octavo pollo')) {
      return 0.125;
    }
    if (normalized.includes('1 pollo') || normalized.includes('pollo entero') || normalized.includes('un pollo')) {
      return 1.0;
    }
    return 0;
  };


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

  const reimprimirComprobante = (v) => {
    if (!v) return;
    const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    const correlativoStr = String(v.id % 10000).padStart(4, '0');
    const totalLetras = numeroALetras(v.total);
    const hashResumen = "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=";
    const rucEmpresa = "R.U.C. N° 10710311191";
    const qrData = `${rucEmpresa}|03|${serie}|${correlativoStr}|${v.igv.toFixed(2)}|${v.total.toFixed(2)}|${v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}|${v.tipoComprobante === 'Factura'?'6':'1'}|${v.numDocumento || '00000000'}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrData)}`;

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
      hashResumen: "gSbTDa" + Math.random().toString(36).substring(2, 8).toUpperCase() + "iIZDyirfA6TBPKJnEI=",
      metodoPago: v.metodoPago,
      montoEfectivo: v.montoEfectivo || 0,
      montoTarjeta: v.montoTarjeta || 0,
      montoYape: v.montoYape || 0,
      qrImageUrl,
      deliveryInfo: parsedDelivery,
    });

    setSunatModalOpen(true);
    
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const enviarPorWhatsApp = (v) => {
    if (!v) return;
    const telefono = prompt("Ingresa el número de WhatsApp del cliente (Ej. 999888777):");
    if (!telefono) return;
    
    // Validar celular peruano de 9 dígitos
    const cleanedPhone = telefono.replace(/\D/g, '');
    if (cleanedPhone.length !== 9) {
      alert("Por favor, ingresa un número de celular válido de 9 dígitos.");
      return;
    }
    
    const serie = v.serie || (v.tipoComprobante === 'Factura' ? 'F001' : 'B001');
    const correlativoStr = String(v.id % 10000).padStart(4, '0');
    
    const mensaje = `Estimado cliente *${v.nombreCliente || 'Consumidor Final'}*, le hacemos entrega de su comprobante electrónico *${v.tipoComprobante === 'Factura' ? 'FACTURA' : 'BOLETA'} ${serie}-${correlativoStr}* por un monto total de *S/ ${v.total.toFixed(2)}*.\n\nPuede consultar y descargar su documento ingresando con sus datos en: https://consulta.susii.com\n\n¡Gracias por su preferencia en *El Fogón Dorado*!`;
    
    const waURL = `https://api.whatsapp.com/send?phone=51${cleanedPhone}&text=${encodeURIComponent(mensaje)}`;
    window.open(waURL, '_blank');
  };


  const fetchReportes = useCallback(async (desde, hasta) => {
    setFiltrando(true);
    try {
      const [data, cancs, mzs, vts, rot, cmps, pollos, clients] = await Promise.all([
        api.getReporteContable(desde, hasta),
        api.getCancelaciones(desde, hasta),
        api.getReporteMozos(desde, hasta),
        api.getHistorialVentas(desde, hasta),
        api.getRotacion(desde, hasta),
        api.getCompras(desde, hasta),
        api.getReportePollos(desde, hasta).catch(() => null),
        api.getClientes().catch(() => []),
      ]);
      setResumen(data);
      setCancelaciones(cancs || []);
      setMozos(mzs || []);
      setVentas(vts || []);
      setRotacion(rot || []);
      setCompras(cmps || []);
      setReportePollos(pollos);
      setClientes(clients || []);
    } catch(err) {
      console.error('Error cargando reportes:', err);
    } finally {
      setLoading(false);
      setFiltrando(false);
    }
  }, []);


  useEffect(() => {
    fetchReportes(fechaDesde, fechaHasta);
  }, []);

  const handleFiltrar = () => {
    if (!fechaDesde || !fechaHasta) {
      alert('Por favor selecciona ambas fechas.');
      return;
    }
    fetchReportes(fechaDesde, fechaHasta);
  };

  const exportarLibroContableRCE = async () => {
    try {
      setFiltrando(true);
      // Obtener el historial real detallado de ventas y compras del periodo seleccionado
      const [ventasData, comprasData] = await Promise.all([
        api.getHistorialVentas(fechaDesde, fechaHasta),
        api.getCompras(fechaDesde, fechaHasta)
      ]);

      const rows = [
        ['REGISTRO TRIBUTARIO (RCE / RVE) - EL FOGÓN DORADO'],
        [`PERIODO: DESDE ${fechaDesde} HASTA ${fechaHasta}`],
        [],
        ['TIPO', 'FECHA EMISION', 'COMPROBANTE', 'NUM DOCUMENTO', 'CLIENTE / PROVEEDOR', 'METODO PAGO', 'BASE IMPONIBLE (S/)', 'IGV (S/)', 'TOTAL (S/)', 'EFECTIVO (S/)', 'TARJETA (S/)', 'YAPE (S/)']
      ];

      // Insertar Ventas
      ventasData.forEach(v => {
        const date = v.createdAt ? v.createdAt.split('T')[0] : '';
        let efec = v.montoEfectivo || (v.metodoPago === 'Efectivo' ? v.total : 0);
        let tarj = v.montoTarjeta || (v.metodoPago === 'Tarjeta' ? v.total : 0);
        let yape = v.montoYape || (v.metodoPago === 'Yape' ? v.total : 0);
        
        if (v.metodoPago === 'Mixto' && (efec + tarj + yape) < v.total) {
          efec += (v.total - (efec + tarj + yape));
        }

        rows.push([
          'VENTA',
          date,
          v.tipoComprobante,
          v.numDocumento || 'S/D',
          v.nombreCliente || 'PÚBLICO GENERAL',
          v.metodoPago,
          v.subtotal.toFixed(2),
          v.igv.toFixed(2),
          v.total.toFixed(2),
          efec.toFixed(2),
          tarj.toFixed(2),
          yape.toFixed(2)
        ]);
      });

      // Insertar Compras
      comprasData.forEach(c => {
        const date = c.creadoEn ? c.creadoEn.split('T')[0] : '';
        rows.push([
          'COMPRA',
          date,
          c.tipoDocumento || 'Factura',
          c.ruc || 'S/D',
          c.proveedor,
          'Efectivo/Transferencia',
          c.baseImponible.toFixed(2),
          c.igv.toFixed(2),
          c.total.toFixed(2),
          '0.00',
          '0.00',
          '0.00'
        ]);
      });

      // Convertir a CSV compatible con Excel en español (con codificación UTF-8 BOM)
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `RCE_RVE_FOGON_${fechaDesde}_AL_${fechaHasta}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error al generar libro contable: ' + err.message);
    } finally {
      setFiltrando(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-bold">Cargando reporte contable...</p>
      </div>
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50">
      {/* HEADER Y FILTRO DE FECHAS */}
      <div className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-amber-500"></div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Panel Contable y Auditoría</h1>
          <p className="text-xs md:text-sm text-slate-500">Auditoría tributaria de IGV mensual, mermas de cancelaciones y rendimiento de meseros.</p>
        </div>
        
        {/* Controles del Rango de Fechas */}
        <div className="flex flex-wrap items-end gap-3 sm:gap-4 z-10">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl h-[38px] shrink-0 border border-slate-200/50">
            <button
              onClick={() => {
                const hoy = getHoyString();
                setFechaDesde(hoy);
                setFechaHasta(hoy);
                fetchReportes(hoy, hoy);
              }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                fechaDesde === getHoyString() && fechaHasta === getHoyString()
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                const ayerDate = new Date();
                ayerDate.setDate(ayerDate.getDate() - 1);
                const yyyy = ayerDate.getFullYear();
                const mm = String(ayerDate.getMonth() + 1).padStart(2, '0');
                const dd = String(ayerDate.getDate()).padStart(2, '0');
                const ayerStr = `${yyyy}-${mm}-${dd}`;
                setFechaDesde(ayerStr);
                setFechaHasta(ayerStr);
                fetchReportes(ayerStr, ayerStr);
              }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                fechaDesde !== getHoyString() && fechaDesde === fechaHasta && (() => {
                  const ayerDate = new Date();
                  ayerDate.setDate(ayerDate.getDate() - 1);
                  const yyyy = ayerDate.getFullYear();
                  const mm = String(ayerDate.getMonth() + 1).padStart(2, '0');
                  const dd = String(ayerDate.getDate()).padStart(2, '0');
                  return fechaDesde === `${yyyy}-${mm}-${dd}`;
                })()
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ayer
            </button>
            <button
              onClick={() => {
                const primerDia = getPrimerDiaMes();
                const hoy = getHoyString();
                setFechaDesde(primerDia);
                setFechaHasta(hoy);
                fetchReportes(primerDia, hoy);
              }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                fechaDesde === getPrimerDiaMes() && fechaHasta === getHoyString()
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Este Mes
            </button>
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Desde:</label>
            <input 
              type="date" 
              value={fechaDesde} 
              onChange={(e) => setFechaDesde(e.target.value)} 
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Hasta:</label>
            <input 
              type="date" 
              value={fechaHasta} 
              onChange={(e) => setFechaHasta(e.target.value)} 
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 transition-all font-mono"
            />
          </div>
          <button 
            onClick={handleFiltrar}
            disabled={filtrando}
            className="bg-slate-900 hover:bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 h-[38px]"
          >
            {filtrando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Search className="w-4 h-4" />}
            Filtrar
          </button>
          <button 
            onClick={exportarLibroContableRCE} 
            disabled={filtrando}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition-all active:scale-95 disabled:opacity-50 h-[38px]"
          >
            <Download className="w-4 h-4" /> Exportar RCE / Ventas
          </button>
          <button 
            onClick={() => setGerencialModalOpen(true)}
            disabled={filtrando}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all active:scale-95 disabled:opacity-50 h-[38px]"
          >
            <Printer className="w-4 h-4" /> Reporte Gerencial (PDF)
          </button>
        </div>
      </div>
       {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3">
        {[
          { id: 'resumen', label: '📊 Resumen Financiero y RCE' },
          { id: 'rotacion', label: '🍽️ Rotación y Pollos' },
          { id: 'pedidosya', label: '🛵 Control PedidosYa' },
          { id: 'consumo', label: '👥 Consumos y Créditos' },
          { id: 'mozos', label: '👥 Mozos y Cancelaciones' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO DE PESTAÑAS */}

      {/* 1. RESUMEN FINANCIERO Y COMPROBANTES (RCE) */}
      {activeTab === 'resumen' && (
        <>
          {/* METRICAS DE BALANCE COMERCIAL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* TARJETA VENTAS */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.01]">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm"><TrendingUp className="w-5 h-5"/></div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider">Ventas en Periodo</h2>
                </div>
                <p className="text-3xl font-black font-mono text-slate-900 mb-1">S/ {resumen.ventasTotal.toFixed(2)}</p>
                <p className="text-xs text-slate-400">Impuestos y base imponible acumulados.</p>
              </div>
              <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-4 mt-6">
                <span>Base Imp: S/ {resumen.ventasBase.toFixed(2)}</span>
                <span className="font-bold text-blue-600">IGV (10.5%): S/ {resumen.ventasIGV.toFixed(2)}</span>
              </div>
            </div>

            {/* TARJETA COMPRAS */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.01]">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shadow-sm"><TrendingDown className="w-5 h-5"/></div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider">Compras en Periodo</h2>
                </div>
                <p className="text-3xl font-black font-mono text-slate-900 mb-1">S/ {resumen.comprasTotal.toFixed(2)}</p>
                <p className="text-xs text-slate-400">Gastos comerciales y crédito fiscal acumulado.</p>
              </div>
              <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-4 mt-6">
                <span>Base Imp: S/ {resumen.comprasBase.toFixed(2)}</span>
                <span className="font-bold text-rose-600">IGV (10.5%): S/ {resumen.comprasIGV.toFixed(2)}</span>
              </div>
            </div>

            {/* TARJETA IGV ESTIMADO */}
            <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden flex flex-col justify-between transition-all hover:scale-[1.01]">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500 rounded-full opacity-10 blur-xl"></div>
              <div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-10 h-10 bg-slate-800 text-amber-400 rounded-xl flex items-center justify-center shadow-sm border border-slate-800"><DollarSign className="w-5 h-5"/></div>
                  <h2 className="font-black text-amber-400 uppercase text-xs tracking-wider">IGV Neto Estimado</h2>
                </div>
                <p className="text-4xl font-black font-mono text-white mb-1 relative z-10">
                  S/ {resumen.igvAPagar.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">Impuestos netos a liquidar (Débito - Crédito).</p>
              </div>
              <div className="flex justify-between text-xs text-slate-400 border-t border-slate-800 pt-4 mt-6 relative z-10">
                <span>Periodo Auditoría</span>
                <span className="font-bold text-amber-400 uppercase tracking-widest text-[10px]">Rango Activo</span>
              </div>
            </div>
          </div>

          {/* DESGLOSE DE RECAUDACIÓN EN CAJA */}
          {resumen.desgloseCaja && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 mb-8 shadow-sm">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" /> Desglose de Recaudación en Caja (Periodo Seleccionado)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-emerald-800">💵 Efectivo Total</span>
                  <p className="text-lg font-mono font-black text-emerald-700 mt-0.5">S/ {(resumen.desgloseCaja.efectivo ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-blue-800">💳 Tarjeta / POS</span>
                  <p className="text-lg font-mono font-black text-blue-700 mt-0.5">S/ {(resumen.desgloseCaja.tarjeta ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-purple-800">📱 Yape / Plin</span>
                  <p className="text-lg font-mono font-black text-purple-700 mt-0.5">S/ {(resumen.desgloseCaja.yape ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-indigo-800">🛵 PedidosYa</span>
                  <p className="text-lg font-mono font-black text-indigo-700 mt-0.5">S/ {(resumen.desgloseCaja.pedidosYa ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-violet-50/70 border border-violet-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-violet-800">👤 Consumo Planilla</span>
                  <p className="text-lg font-mono font-black text-violet-700 mt-0.5">S/ {(resumen.desgloseCaja.consumos ?? resumen.desgloseCaja.consumoPlanilla ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-sky-800">🤝 Crédito Comercial</span>
                  <p className="text-lg font-mono font-black text-sky-700 mt-0.5">S/ {(resumen.desgloseCaja.credito ?? resumen.desgloseCaja.consumoClientes ?? 0).toFixed(2)}</p>
                </div>
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-center">
                  <span className="text-[10px] font-black uppercase text-amber-800">🎁 Cortesías</span>
                  <p className="text-lg font-mono font-black text-amber-700 mt-0.5">S/ {(resumen.desgloseCaja.cortesias ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* HISTORIAL Y AUDITORÍA DE COMPROBANTES EMITIDOS */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-500" /> Registro de Comprobantes Emitidos (RCE)
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Listado oficial de comprobantes emitidos en el periodo.</p>
              </div>
              {(() => {
                const ventasComerciales = ventas;
                return (
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {ventasComerciales.length} Comprobante{ventasComerciales.length !== 1 ? 's' : ''}
                  </span>
                );
              })()}
            </div>
            <div className="table-scroll">
              <table className="w-full text-left min-w-[750px]">
                <thead className="bg-white text-slate-450 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">ID / Hora</th>
                    <th className="px-6 py-4">Comprobante / Cliente</th>
                    <th className="px-6 py-4">Mesa / Delivery</th>
                    <th className="px-6 py-4">Método de Pago</th>
                    <th className="px-6 py-4">Detalle Items</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                  {(() => {
                    const filtradas = ventas;
                    return filtradas.length > 0 ? filtradas.map(v => (
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
                              {v.anulado && (
                                <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-1 shrink-0">
                                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></span> 🚫 DEVUELTO
                                </span>
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
                          {v.codigoPedidosYa ? (
                            v.codigoPedidosYa.startsWith('DELIVERY -') ? (
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
                            )
                          ) : (
                            <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-md whitespace-nowrap">
                              🍽️ Mesa {v.mesaNum || 'S/M'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {v.anulado ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-red-100 border border-red-200 text-red-700 whitespace-nowrap">
                              🚫 CANCELADO
                            </span>
                          ) : (() => {
                            let method = v.metodoPago;
                            if (method === 'PedidosYa' && v.codigoPedidosYa) {
                              if (v.codigoPedidosYa.startsWith('DELIVERY -') || v.codigoPedidosYa.startsWith('LLEVAR -')) {
                                method = 'Efectivo';
                              }
                            }
                            return (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                method === 'Efectivo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                method === 'Tarjeta' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                method === 'Yape' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                                method === 'Cortesía' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                method === 'Consumo' ? 'bg-violet-50 border-violet-200 text-violet-700' :
                                'bg-indigo-50 border-indigo-200 text-indigo-700'
                              }`}>{method}</span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-xs font-bold text-slate-500 uppercase" title={v.itemsResumen}>
                          {v.itemsResumen}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-base">
                          {v.anulado ? (
                            <div className="flex flex-col items-end leading-none">
                              <span className="text-red-600 font-black">S/ 0.00</span>
                              {v.montoOriginal != null && (
                                <span className="line-through text-slate-400 font-bold text-xs mt-1">
                                  S/ {v.montoOriginal.toFixed(2)}
                                </span>
                              )}
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
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No se encontraron comprobantes emitidos en este rango de fechas.
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 2. ROTACIÓN Y EQUIVALENCIA DE POLLOS */}
      {activeTab === 'rotacion' && (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
          <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" /> Rotación de Productos y Consumo de Pollos
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Productos vendidos ordenados por cantidad. Incluye cálculo de equivalencias en pollos enteros.</p>
            </div>
            {(() => {
              // Calcular desde datos de rotación (frontend)
              let totalEq = 0, enteros = 0, medios = 0, cuartos = 0, octavos = 0;
              rotacion.forEach(item => {
                const equiv = getChickenEquivalency(item.nombre);
                const parcial = equiv * item.cantidad;
                totalEq += parcial;
                if (equiv === 1.0)   enteros += item.cantidad;
                if (equiv === 0.5)   medios  += item.cantidad;
                if (equiv === 0.25)  cuartos += item.cantidad;
                if (equiv === 0.125) octavos += item.cantidad;
              });
              // Preferir datos del backend si están disponibles
              if (reportePollos) {
                enteros = reportePollos.totalEnteros;
                medios  = reportePollos.totalMedios;
                cuartos = reportePollos.totalCuartos;
                octavos = reportePollos.totalOctavos;
                totalEq = reportePollos.totalUnidadesEquivalentes;
              }
              const pollosEnterosFinal = Math.floor(totalEq);
              const fraccionDecimal   = +(totalEq - pollosEnterosFinal).toFixed(3);
              const fraccionLabel = fraccionDecimal === 0 ? ''
                : fraccionDecimal >= 0.875 ? ' + 7/8'
                : fraccionDecimal >= 0.750 ? ' + 3/4'
                : fraccionDecimal >= 0.625 ? ' + 5/8'
                : fraccionDecimal >= 0.500 ? ' + 1/2'
                : fraccionDecimal >= 0.375 ? ' + 3/8'
                : fraccionDecimal >= 0.250 ? ' + 1/4'
                : ' + 1/8';
              return (
                <div className="flex flex-col items-end gap-1">
                  <span className="bg-amber-100 text-amber-900 text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                    🍗 Total: {pollosEnterosFinal}{fraccionLabel} entero{pollosEnterosFinal !== 1 ? 's' : ''} ({totalEq.toFixed(2)} eq.)
                  </span>
                  {(enteros > 0 || medios > 0 || cuartos > 0 || octavos > 0) && (
                    <span className="text-[10px] text-amber-700 font-bold">
                      {enteros > 0 ? `${enteros} entero${enteros !== 1 ? 's' : ''} · ` : ''}
                      {medios > 0  ? `${medios} ½ · ` : ''}
                      {cuartos > 0 ? `${cuartos} ¼ · ` : ''}
                      {octavos > 0 ? `${octavos} ⅛` : ''}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {reportePollos && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 md:p-5 bg-slate-50/50 border-b border-slate-100">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">🍗 Stock Inicial Pollos</span>
                <p className="text-xl font-mono font-black text-slate-800 mt-1">{reportePollos.stockInicial} Unids.</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">📊 Ventas Equivalentes (Fórmula)</span>
                <p className="text-xl font-mono font-black text-emerald-600 mt-1">{reportePollos.totalUnidadesEquivalentes.toFixed(2)} Unids.</p>
                <p className="text-[8px] font-bold text-slate-400 mt-0.5">Σ (1/8*0.125 + 1/4*0.25 + 1/2*0.5 + 1*1.0)</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">🔄 Porcentaje Rotación</span>
                <p className="text-xl font-mono font-black text-blue-600 mt-1">{reportePollos.porcentajeRotacion}%</p>
                <p className="text-[8px] font-bold text-slate-400 mt-0.5">Equivalente / Stock Inicial</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">📋 Desglose Fracciones</span>
                <div className="grid grid-cols-2 gap-1 text-[10px] font-bold text-slate-650 mt-1">
                  <span>1/8: {reportePollos.totalOctavos}</span>
                  <span>1/4: {reportePollos.totalCuartos}</span>
                  <span>1/2: {reportePollos.totalMedios}</span>
                  <span>Enteros: {reportePollos.totalEnteros}</span>
                </div>
              </div>
            </div>
          )}
          <div className="table-scroll">
            <table className="w-full text-left min-w-[500px]">
              <thead className="bg-white text-slate-450 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4 text-center">Cantidad Vendida</th>
                  <th className="px-6 py-4 text-center">Equivalencia (Pollo Entero)</th>
                  <th className="px-6 py-4 text-right">Total (S/)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                {rotacion.length > 0 ? rotacion.map((r, i) => {
                  const equiv = getChickenEquivalency(r.nombre);
                  return (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800">{r.nombre}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] text-slate-400 uppercase font-medium">{r.categoria}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                          {r.cantidad}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {equiv > 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-50 border border-amber-200 text-amber-700 font-mono">
                            {(equiv * r.cantidad).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-slate-900">
                        S/ {r.total.toFixed(2)}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="5" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">Sin registros de rotación en este rango de fechas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CONTROL PEDIDOSYA */}
      {activeTab === 'pedidosya' && (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
          <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-500" /> Control de Ventas de PedidosYa
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Listado detallado para conciliar la liquidación semanal del portal PedidosYa.</p>
            </div>
            {(() => {
              const totalPY = ventas
                .filter(v => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -'))
                .reduce((s, v) => s + v.total, 0);
              return (
                <span className="bg-indigo-100 text-indigo-900 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">
                  Total PedidosYa: S/ {totalPY.toFixed(2)}
                </span>
              );
            })()}
          </div>
          <div className="table-scroll">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">ID Venta</th>
                  <th className="px-6 py-4">Fecha / Hora</th>
                  <th className="px-6 py-4">Código PedidosYa</th>
                  <th className="px-6 py-4">Detalle items</th>
                  <th className="px-6 py-4 text-right">Total (S/)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                {(() => {
                  const itemsPY = ventas.filter(v => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -'));
                  return itemsPY.length > 0 ? itemsPY.map(v => (
                    <tr key={v.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-900">#VT-{v.id}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono">{v.fecha || new Date(v.createdAt).toLocaleDateString('es-PE')}</span> · <span className="text-slate-400 font-mono text-xs">{v.hora}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-xl text-xs font-black font-mono">
                          {v.codigoPedidosYa || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 uppercase max-w-xs truncate" title={v.itemsResumen}>{v.itemsResumen}</td>
                      <td className="px-6 py-4 text-right font-mono font-black text-slate-950">S/ {v.total.toFixed(2)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                        No se registraron ventas de PedidosYa en este periodo.
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CONSUMO DE PERSONAL (PLANILLA) */}
      {activeTab === 'consumo' && (() => {
        const clienteMap = new Map(clientes.map(c => [c.id, c]));

        const listadoPlanilla = [];
        const listadoComercial = [];

        ventas.forEach(v => {
          if (v.anulado || v.estadoPedido === 'Cancelado') return;

          if (v.metodoPago === 'Consumo') {
            listadoPlanilla.push({
              id: v.id,
              fecha: v.fecha,
              createdAt: v.createdAt,
              hora: v.hora,
              nombre: v.nombreCliente || v.mesero || 'Consumo Personal',
              documento: '',
              itemsResumen: v.itemsResumen,
              monto: v.descuentoAplicado || v.total,
              rawVenta: v
            });
          } else {
            const splits = v.creditoSplit || parsearCreditoSplit(v.ofertaDescripcion, v.clienteCreditoId, (v.montoCredito > 0 ? v.montoCredito : (v.metodoPago === 'Crédito' ? v.total : 0)));
            if (splits.length > 0) {
              splits.forEach(s => {
                const cli = clienteMap.get(s.clienteId);
                const esTrab = cli?.esTrabajador || false;
                const nombre = cli?.nombre || s.nombre || v.nombreCliente || 'Cliente Crédito';
                const doc = cli?.numDoc || cli?.documento || '';
                const item = {
                  id: v.id,
                  fecha: v.fecha,
                  createdAt: v.createdAt,
                  hora: v.hora,
                  nombre,
                  documento: doc,
                  itemsResumen: v.itemsResumen,
                  monto: s.monto,
                  rawVenta: v
                };
                if (esTrab) listadoPlanilla.push(item);
                else listadoComercial.push(item);
              });
            } else if (v.metodoPago === 'Crédito') {
              listadoComercial.push({
                id: v.id,
                fecha: v.fecha,
                createdAt: v.createdAt,
                hora: v.hora,
                nombre: v.nombreCliente || 'Cliente Comercial',
                documento: '',
                itemsResumen: v.itemsResumen,
                monto: v.total,
                rawVenta: v
              });
            }
          }
        });

        // Acumulados
        const planillaPorColaborador = {};
        listadoPlanilla.forEach(item => {
          planillaPorColaborador[item.nombre] = (planillaPorColaborador[item.nombre] || 0) + item.monto;
        });

        const clientesPorComercial = {};
        listadoComercial.forEach(item => {
          const key = item.documento ? `${item.nombre} (${item.documento})` : item.nombre;
          clientesPorComercial[key] = (clientesPorComercial[key] || 0) + item.monto;
        });

        const totalPlanilla = listadoPlanilla.reduce((sum, item) => sum + item.monto, 0);
        const totalComercial = listadoComercial.reduce((sum, item) => sum + item.monto, 0);

        return (
          <div className="space-y-8">
            {/* Sección 1: Resumen de Acumulados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tarjeta Planilla */}
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-violet-750 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-600" /> Acumulado para Planilla (Interno)
                  </h3>
                  <span className="bg-violet-100 text-violet-850 text-[10px] font-black px-2.5 py-1 rounded-full">
                    S/ {totalPlanilla.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {Object.entries(planillaPorColaborador).length > 0 ? (
                    Object.entries(planillaPorColaborador).map(([nombre, total]) => (
                      <div key={nombre} className="bg-violet-50/40 border border-violet-100/50 rounded-2xl p-3 text-center">
                        <p className="text-[9px] text-slate-450 font-black uppercase truncate" title={nombre}>{nombre}</p>
                        <p className="text-sm font-black text-violet-700 font-mono mt-0.5">S/ {total.toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-center py-6 text-slate-400 text-xs font-bold uppercase">Sin consumos de planilla en este periodo.</p>
                  )}
                </div>
              </div>

              {/* Tarjeta Comercial */}
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-teal-750 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-teal-650" /> Acumulado Créditos Comerciales
                  </h3>
                  <span className="bg-teal-100 text-teal-855 text-[10px] font-black px-2.5 py-1 rounded-full">
                    S/ {totalComercial.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {Object.entries(clientesPorComercial).length > 0 ? (
                    Object.entries(clientesPorComercial).map(([nombre, total]) => (
                      <div key={nombre} className="bg-teal-50/40 border border-teal-100/50 rounded-2xl p-3 text-center">
                        <p className="text-[9px] text-slate-450 font-black uppercase truncate" title={nombre}>{nombre}</p>
                        <p className="text-sm font-black text-teal-750 font-mono mt-0.5">S/ {total.toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-center py-6 text-slate-400 text-xs font-bold uppercase">Sin créditos comerciales en este periodo.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Listado A: Crédito Clientes (Comerciales) */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-teal-650" /> Cuentas por Cobrar · Crédito Clientes
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ventas financiadas a clientes de confianza con cuenta corriente comercial.</p>
                </div>
                <span className="bg-teal-100 text-teal-850 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">
                  Total Clientes: S/ {totalComercial.toFixed(2)}
                </span>
              </div>
              <div className="table-scroll">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Cliente Comercial</th>
                      <th className="px-6 py-4">Detalle Items</th>
                      <th className="px-6 py-4 text-right">Monto Crédito</th>
                      <th className="px-6 py-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                    {listadoComercial.length > 0 ? listadoComercial.map((item, idx) => {
                      return (
                        <tr key={`${item.id}-${idx}`} className="hover:bg-teal-50/20 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-900">#VT-{item.id}</td>
                          <td className="px-6 py-4 font-mono">
                            {item.fecha || new Date(item.createdAt).toLocaleDateString('es-PE')} · <span className="text-slate-400 text-xs">{item.hora}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-900 font-bold uppercase">{item.nombre}</span>
                            {item.documento && <span className="ml-2 bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">{item.documento}</span>}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 uppercase max-w-xs truncate" title={item.itemsResumen}>{item.itemsResumen}</td>
                          <td className="px-6 py-4 text-right font-mono font-black text-teal-700">S/ {item.monto.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => reimprimirComprobante(item.rawVenta)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-teal-650 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 mx-auto"
                            >
                              <Printer className="w-3 h-3" /> Ver Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No se registraron ventas a crédito comercial en este periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Listado B: Consumo de Planilla / Personal */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-650" /> Descuentos Planilla · Consumo de Personal
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Historial completo de consumos registrados por colaboradores internos.</p>
                </div>
                <span className="bg-violet-100 text-violet-850 text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider">
                  Total Planilla: S/ {totalPlanilla.toFixed(2)}
                </span>
              </div>
              <div className="table-scroll">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-white text-slate-450 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Fecha / Hora</th>
                      <th className="px-6 py-4">Colaborador / Personal</th>
                      <th className="px-6 py-4">Detalle Items</th>
                      <th className="px-6 py-4 text-right">Monto Descuento</th>
                      <th className="px-6 py-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                    {listadoPlanilla.length > 0 ? listadoPlanilla.map((item, idx) => {
                      return (
                        <tr key={`${item.id}-${idx}`} className="hover:bg-violet-50/20 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-900">#VT-{item.id}</td>
                          <td className="px-6 py-4 font-mono">
                            {item.fecha || new Date(item.createdAt).toLocaleDateString('es-PE')} · <span className="text-slate-400 text-xs">{item.hora}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-slate-900 font-bold uppercase">{item.nombre}</span>
                            <span className="ml-2 bg-violet-100 text-violet-800 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">Planilla</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 uppercase max-w-xs truncate" title={item.itemsResumen}>{item.itemsResumen}</td>
                          <td className="px-6 py-4 text-right font-mono font-black text-violet-700">S/ {item.monto.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => reimprimirComprobante(item.rawVenta)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 mx-auto"
                            >
                              <Printer className="w-3 h-3" /> Ver Ticket
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                          No se registraron consumos de personal en este periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. RENDIMIENTO MOZOS Y CANCELACIONES */}
      {activeTab === 'mozos' && (
        <div className="space-y-8">
          {/* RENDIMIENTO POR MOZOS */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" /> Rendimiento de Mozos en el Periodo
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{mozos.length} mozo{mozos.length !== 1 ? 's' : ''} con comanda</span>
            </div>
            <div className="table-scroll">
              <table className="w-full text-left min-w-[400px]">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Mozo / Mesero</th>
                    <th className="px-6 py-4 text-center">Mesas Activas Ahora</th>
                    <th className="px-6 py-4 text-center">Mesas Atendidas y Cobradas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                  {mozos.length > 0 ? mozos.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 text-amber-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0">{m.nombre[0]}</div>
                          <span className="font-bold text-slate-800">{m.nombre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${m.mesasActivas > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                          {m.mesasActivas} mesa{m.mesasActivas !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700">
                          {m.mesasAtendidas} atendida{m.mesasAtendidas !== 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">Sin actividad de mozos en este rango de fechas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PEDIDOS CANCELADOS DEL DÍA */}
          <div className="bg-white rounded-3xl border border-red-200/60 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-red-100 bg-red-50 flex justify-between items-center">
              <h2 className="font-black text-red-700 uppercase text-xs tracking-wider flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" /> Pedidos Cancelados e Incidencias en el Periodo
              </h2>
              <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                {cancelaciones.length} cancelación{cancelaciones.length !== 1 ? 'es' : ''}
              </span>
            </div>
            <div className="table-scroll">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-4">Fecha / Hora</th>
                    <th className="px-5 py-4">Mesa / Delivery</th>
                    <th className="px-5 py-4">Cancelado por</th>
                    <th className="px-5 py-4">Motivo / Explicación</th>
                    <th className="px-5 py-4">Detalle Consumo</th>
                    <th className="px-5 py-4 text-right">Pérdida Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm bg-white font-bold text-slate-700">
                  {cancelaciones.length > 0 ? cancelaciones.map((c, i) => (
                    <tr key={i} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-slate-800 text-xs">{c.fecha || 'Hoy'}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{c.hora}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.mesa
                          ? <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-black">Mesa {c.mesa}</span>
                          : <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 w-max"><Truck className="w-3.5 h-3.5" />{c.codigoPedidosYa || 'Delivery'}</span>
                        }
                      </td>
                      <td className="px-5 py-4 text-slate-800">{c.canceladoPor}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs italic max-w-[200px] truncate" title={c.motivoCancela}>{c.motivoCancela}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs max-w-[220px] truncate" title={c.resumenItems}>{c.resumenItems}</td>
                      <td className="px-5 py-4 text-right font-mono font-black text-red-600">- S/ {c.total.toFixed(2)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">No hay cancelaciones registradas en este rango de fechas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {cancelaciones.length > 0 && (
              <div className="p-5 border-t border-red-100 bg-red-50/50 flex justify-end">
                <span className="font-black text-red-700 text-sm">
                  Total Pérdida en Periodo: <span className="font-mono text-xl ml-2">S/ {cancelaciones.reduce((s, c) => s + c.total, 0).toFixed(2)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUNAT Comprobante Susii Style Modal */}
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
              
              {activeComprobante.items.map((item, idx) => {
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
                  />
                </div>
              ) : (
                <div style={{ display: 'none' }}>
                  <img 
                    src={activeComprobante.qrImageUrl} 
                    alt="QR Comprobante" 
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

      {/* Modal Reporte Gerencial */}
      {gerencialModalOpen && (
        <div id="modal-reporte-gerencial-container" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] animate-slide-up">
            <div className="bg-slate-950 p-4 text-white flex justify-between items-center shrink-0 no-print">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" /> Reporte Gerencial Ejecutivo
              </h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95">
                  <Printer className="w-3.5 h-3.5" /> Imprimir / Guardar PDF
                </button>
                <button onClick={() => setGerencialModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Checkboxes para filtrar secciones del reporte */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-3.5 no-print shrink-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Incluir en el Reporte:</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirBalance}
                    onChange={e => setIncluirBalance(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Balance / IGV
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirMozos}
                    onChange={e => setIncluirMozos(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Mozos
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirRotacion}
                    onChange={e => setIncluirRotacion(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Rotación y Pollos
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirGastos}
                    onChange={e => setIncluirGastos(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Compras y Gastos
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirPedidosYa}
                    onChange={e => setIncluirPedidosYa(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  PedidosYa
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluirPersonal}
                    onChange={e => setIncluirPersonal(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                  />
                  Personal (Planilla)
                </label>
              </div>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 font-sans">
              <div className="text-center border-b pb-6 mb-6">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">El Fogón Dorado</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Reporte de Gestión Gerencial</p>
                <p className="text-xs text-slate-400 mt-2 font-mono">Periodo: {fechaDesde} al {fechaHasta}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Generado el: {new Date().toLocaleString('es-PE')}</p>
              </div>

              {incluirBalance && (
                <div className="mb-8">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    1. Balance y Resumen Gerencial Ejecutivo
                  </h2>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="border rounded-2xl p-4 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ventas</p>
                      <p className="text-xl font-black font-mono text-slate-800 mt-1 font-sans">S/ {resumen.ventasTotal.toFixed(2)}</p>
                      <div className="text-[10px] text-slate-500 mt-2 space-y-0.5 font-bold">
                        <p>Base Imp.: S/ {resumen.ventasBase.toFixed(2)}</p>
                        <p className="font-semibold text-emerald-600">IGV (10.5%): S/ {resumen.ventasIGV.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="border rounded-2xl p-4 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Compras / Gastos</p>
                      <p className="text-xl font-black font-mono text-slate-800 mt-1 font-sans">S/ {resumen.comprasTotal.toFixed(2)}</p>
                      <div className="text-[10px] text-slate-500 mt-2 space-y-0.5 font-bold">
                        <p>Base Imp.: S/ {resumen.comprasBase.toFixed(2)}</p>
                        <p className="font-semibold text-rose-600">IGV (10.5%): S/ {resumen.comprasIGV.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="border rounded-2xl p-4 bg-slate-900 text-white">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IGV Neto a Liquidar</p>
                      <p className="text-xl font-black font-mono text-amber-400 mt-1 font-sans">S/ {resumen.igvAPagar.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-400 mt-2">Diferencia entre débito fiscal y crédito fiscal.</p>
                    </div>
                    <div className="border rounded-2xl p-4 bg-amber-500/10 border-amber-500/20 text-amber-950">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Consumo Total de Pollos</p>
                      <p className="text-xl font-black font-mono text-amber-800 mt-1 font-sans">
                        {(() => {
                          let totalEq = 0, enteros = 0, medios = 0, cuartos = 0, octavos = 0;
                          if (reportePollos) {
                            totalEq = reportePollos.totalUnidadesEquivalentes;
                            enteros = reportePollos.totalEnteros;
                            medios  = reportePollos.totalMedios;
                            cuartos = reportePollos.totalCuartos;
                            octavos = reportePollos.totalOctavos;
                          } else {
                            rotacion.forEach(item => {
                              const equiv = getChickenEquivalency(item.nombre);
                              totalEq += equiv * item.cantidad;
                              if (equiv === 1.0)   enteros += item.cantidad;
                              if (equiv === 0.5)   medios  += item.cantidad;
                              if (equiv === 0.25)  cuartos += item.cantidad;
                              if (equiv === 0.125) octavos += item.cantidad;
                            });
                          }
                          const pollosEnterosFinal = Math.floor(totalEq);
                          const fraccionDecimal   = +(totalEq - pollosEnterosFinal).toFixed(3);
                          const fraccionLabel = fraccionDecimal === 0 ? ''
                            : fraccionDecimal >= 0.875 ? ' + 7/8'
                            : fraccionDecimal >= 0.750 ? ' + 3/4'
                            : fraccionDecimal >= 0.625 ? ' + 5/8'
                            : fraccionDecimal >= 0.500 ? ' + 1/2'
                            : fraccionDecimal >= 0.375 ? ' + 3/8'
                            : fraccionDecimal >= 0.250 ? ' + 1/4'
                            : ' + 1/8';
                          return (
                            <>
                              {pollosEnterosFinal}{fraccionLabel} <span className="text-xs font-black">ent.</span>
                              <br/>
                              <span className="text-[10px] font-bold text-amber-700">
                                {[enteros > 0 ? `${enteros} entero${enteros!==1?'s':''}` : null, medios > 0 ? `${medios} ½` : null, cuartos > 0 ? `${cuartos} ¼` : null, octavos > 0 ? `${octavos} ⅛` : null].filter(Boolean).join(' · ')}
                              </span>
                            </>
                          );
                        })()}
                      </p>
                      <p className="text-[9px] text-amber-700/80 mt-2 leading-tight">Consolidado de equivalencias de pollo a la brasa vendido.</p>
                    </div>
                  </div>
                </div>
              )}

              {incluirMozos && (
                <div className="mb-8">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                    2. Rendimiento de Mozos (Mesas Atendidas)
                  </h2>
                  <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b">
                        <tr>
                          <th className="px-4 py-3">Nombre Mozo</th>
                          <th className="px-4 py-3 text-center">Mesas Activas</th>
                          <th className="px-4 py-3 text-center">Mesas Atendidas y Cobradas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-slate-700">
                        {mozos.length > 0 ? mozos.map((m, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 font-bold text-slate-800">{m.nombre}</td>
                            <td className="px-4 py-3 text-center">{m.mesasActivas}</td>
                            <td className="px-4 py-3 text-center text-emerald-600 font-bold">{m.mesasAtendidas}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="3" className="px-4 py-3 text-center text-slate-400">Sin registros en el periodo</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {incluirRotacion && (
                <div className="mb-8 break-inside-avoid-page">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    3. Rotación Detallada de Productos por Categoría
                  </h2>
                  <div className="space-y-6">
                    {(() => {
                      const grouped = {};
                      rotacion.forEach(r => {
                        const cat = r.categoria || 'Otros';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(r);
                      });

                      const categories = Object.keys(grouped).sort();
                      if (categories.length === 0) {
                        return <p className="text-xs text-slate-400 text-center py-4">Sin datos de rotación en el periodo.</p>;
                      }

                      return categories.map(cat => {
                        const items = grouped[cat].sort((a, b) => b.cantidad - a.cantidad);
                        const totalCatQty = items.reduce((sum, item) => sum + item.cantidad, 0);
                        const totalCatRev = items.reduce((sum, item) => sum + item.total, 0);

                        return (
                          <div key={cat} className="border rounded-2xl overflow-hidden bg-slate-50/20 break-inside-avoid mb-4">
                            <div className="bg-slate-100/80 px-4 py-2.5 border-b flex justify-between items-center">
                              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{cat}</span>
                              <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase">
                                <span>Cant. Total: <strong className="text-slate-800">{totalCatQty}</strong></span>
                                <span>Total Ventas: <strong className="text-slate-800">S/ {totalCatRev.toFixed(2)}</strong></span>
                              </div>
                            </div>
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-455 text-[9px] font-black uppercase tracking-wider border-b">
                                <tr>
                                  <th className="px-4 py-2">Producto</th>
                                  <th className="px-4 py-2 text-center">Cantidad Vendida</th>
                                  <th className="px-4 py-2 text-center">Equivalencia Pollo (Und.)</th>
                                  <th className="px-4 py-2 text-right">Recaudación (S/)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y font-semibold text-slate-700 bg-white">
                                {items.map((r, idx) => {
                                  const equiv = getChickenEquivalency(r.nombre);
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/20">
                                      <td className="px-4 py-2 text-slate-850">{r.nombre}</td>
                                      <td className="px-4 py-2 text-center font-bold">{r.cantidad}</td>
                                      <td className="px-4 py-2 text-center font-mono">
                                        {equiv > 0 ? (equiv * r.cantidad).toFixed(2) : '-'}
                                      </td>
                                      <td className="px-4 py-2 text-right font-mono text-slate-900 font-bold">S/ {r.total.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {incluirGastos && (
                <div className="mb-8 break-inside-avoid">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                    4. Detalle de Compras y Gastos del Periodo
                  </h2>
                  <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-550 font-bold uppercase tracking-wider border-b">
                        <tr>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Comprobante</th>
                          <th className="px-4 py-3">Proveedor / RUC</th>
                          <th className="px-4 py-3 text-right">Base Imp.</th>
                          <th className="px-4 py-3 text-right">IGV (10.5%)</th>
                          <th className="px-4 py-3 text-right">Total (S/)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium text-slate-700 bg-white">
                        {compras.length > 0 ? compras.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono text-[10px]">{c.creadoEn ? c.creadoEn.split('T')[0] : ''}</td>
                            <td className="px-4 py-3 uppercase text-[10px] font-bold">{c.tipoDocumento || 'Factura'}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 uppercase text-[11px]">{c.proveedor}</span>
                                <span className="text-[9px] text-slate-450 font-mono">{c.ruc || 'S/D'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">S/ {c.baseImponible.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono text-rose-600">S/ {c.igv.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">S/ {c.total.toFixed(2)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="6" className="px-4 py-4 text-center text-slate-400">Sin compras o gastos registrados en el periodo</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(incluirPedidosYa || incluirPersonal) && (
                <div className={`grid ${incluirPedidosYa && incluirPersonal ? 'grid-cols-2' : 'grid-cols-1'} gap-6 mt-8 break-inside-avoid`}>
                  {incluirPedidosYa && (
                    <div>
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        5. Conciliación PedidosYa
                      </h2>
                      <div className="border rounded-2xl p-4 bg-indigo-50/20 flex flex-col justify-between h-[130px]">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Recaudado PedidosYa</p>
                          <p className="text-3xl font-black text-indigo-950 mt-2 font-mono">
                            S/ {(() => {
                              const totalPY = ventas
                                .filter(v => v.metodoPago === 'PedidosYa' && v.codigoPedidosYa && !v.codigoPedidosYa.startsWith('DELIVERY -') && !v.codigoPedidosYa.startsWith('LLEVAR -'))
                                .reduce((s, v) => s + v.total, 0);
                              return totalPY.toFixed(2);
                            })()}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Monto consolidado para conciliar la liquidación semanal del portal PedidosYa.
                        </p>
                      </div>
                    </div>
                  )}

                  {incluirPersonal && (
                    <div>
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b pb-2 mb-4 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
                        6. Consumo de Personal (Planilla)
                      </h2>
                      <div className="border rounded-2xl overflow-hidden max-h-[130px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-550 font-bold uppercase tracking-wider border-b sticky top-0">
                            <tr>
                              <th className="px-4 py-2">Colaborador</th>
                              <th className="px-4 py-2 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-medium text-slate-700 bg-white">
                            {(() => {
                              const consumos = ventas.filter(v => v.metodoPago === 'Consumo' || v.metodoPago === 'Cortesía');
                              const porMozo = {};
                              consumos.forEach(v => {
                                const mName = v.mesero || v.nombreCliente || 'Sin Nombre';
                                porMozo[mName] = (porMozo[mName] || 0) + v.total;
                              });
                              const entries = Object.entries(porMozo);
                              return entries.length > 0 ? entries.map(([mozo, total]) => (
                                <tr key={mozo}>
                                  <td className="px-4 py-2 font-bold text-slate-850 truncate max-w-[120px]">{mozo}</td>
                                  <td className="px-4 py-2 text-right font-mono font-bold text-violet-700">S/ {total.toFixed(2)}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan="2" className="px-4 py-4 text-center text-slate-400">Sin consumos en el periodo</td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-16 flex justify-around text-xs break-inside-avoid">
                <div className="text-center w-48">
                  <div className="border-b border-slate-300 h-10 mb-2"></div>
                  <p className="font-bold text-slate-700">Firma Administrador</p>
                </div>
                <div className="text-center w-48">
                  <div className="border-b border-slate-300 h-10 mb-2"></div>
                  <p className="font-bold text-slate-700">Firma Propietario</p>
                  <p className="text-[10px] text-slate-400">El Fogón Dorado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @page {
          size: auto;
          margin: 15mm 20mm !important;
        }
        @media print {
          /* Ocultar elementos de navegación y fondos */
          aside, header, #sidebar-menu, #sidebar-backdrop, button, nav, .no-print {
            display: none !important;
          }
          /* Ocultar el resto del contenido de la página excepto el modal a imprimir */
          main > *:not(section),
          section > *:not(#modal-comprobante-sunat-print-container):not(#modal-reporte-gerencial-container):not(#modal-cierre) {
            display: none !important;
          }
           /* Garantizar que el body y todos los contenedores padre fluyan libremente sin alturas fijas */
          html, body, #root, #root > div, #root > div > main, #root > div > main > section {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: auto !important;
            display: block !important;
            position: static !important;
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
          #modal-reporte-gerencial-container {
            position: relative !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          #modal-reporte-gerencial-container > div {
            border-radius: 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
          }
          #modal-reporte-gerencial-container .overflow-y-auto {
            overflow: visible !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .break-inside-avoid-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </section>
  );
}


