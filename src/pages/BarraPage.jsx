import React, { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCheck, CheckCircle2, User, Truck, GlassWater, XCircle, AlertTriangle } from 'lucide-react';
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

export default function BarraPage() {
  const [pedidos, setPedidos] = useState([]);
  const [horaLocal, setHoraLocal] = useState('');
  const [cancelaciones, setCancelaciones] = useState([]);
  const [confirmandoPedidoId, setConfirmandoPedidoId] = useState(null);
  const [despachando, setDespachando] = useState(false);

  const fetchPedidos = useCallback(async () => {
    try {
      const data = await api.getPedidosBarra();
      setPedidos(data);
    } catch (err) {
      console.error('Error cargando barra:', err);
    }
  }, []);

  const fetchCancelaciones = useCallback(async () => {
    try {
      const data = await api.getCancelacionesBarra();
      if (Array.isArray(data)) setCancelaciones(data);
    } catch (err) {
      console.error('Error cargando cancelaciones de barra:', err);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    fetchCancelaciones();

    // 1. Refresco periódico cada 2 segundos (ultrarrápido)
    const tick = () => {
      fetchPedidos();
      fetchCancelaciones();
      setHoraLocal(new Date().toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }));
    };
    const interval = setInterval(tick, 2000);

    // 2. Refresco instantáneo e inmediato al tocar la pantalla o reactivar la pestaña
    let lastImmediateFetch = 0;
    const triggerInstantRefresh = () => {
      const now = Date.now();
      if (now - lastImmediateFetch > 1000) {
        lastImmediateFetch = now;
        fetchPedidos();
        fetchCancelaciones();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerInstantRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', triggerInstantRefresh);
    window.addEventListener('pointerdown', triggerInstantRefresh, { passive: true });

    // 3. Screen Wake Lock API para evitar que la tablet o monitor se suspenda
    let wakeLock = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
          // Navegador no soporta o rechazó wake lock (ignorar de forma segura)
        }
      }
    };
    requestWakeLock();
    document.addEventListener('visibilitychange', requestWakeLock);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', requestWakeLock);
      window.removeEventListener('focus', triggerInstantRefresh);
      window.removeEventListener('pointerdown', triggerInstantRefresh);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [fetchPedidos, fetchCancelaciones]);

  const handleClicListoPedido = (pedidoId) => {
    if (confirmandoPedidoId === pedidoId) {
      marcarListoBarra(pedidoId);
      setConfirmandoPedidoId(null);
    } else {
      setConfirmandoPedidoId(pedidoId);
      setTimeout(() => {
        setConfirmandoPedidoId(prev => (prev === pedidoId ? null : prev));
      }, 3500);
    }
  };

  const marcarListoBarra = async (pedidoId) => {
    setDespachando(true);
    try {
      await api.prepararPedido(pedidoId, 'barra');
      await fetchPedidos();
    } catch (err) {
      alert('Error al despachar bebidas: ' + err.message);
    } finally {
      setDespachando(false);
    }
  };

  const dismissCancelacion = async (id) => {
    try {
      await api.dismissCancelacionBarra(id);
      setCancelaciones(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setCancelaciones(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full bg-slate-950">
      {/* Header con gradiente índigo/morado */}
      <header className="h-16 bg-slate-900 border-b border-indigo-950/60 flex items-center justify-between px-4 md:px-8 z-10 shrink-0 text-white">
        <div className="hidden sm:flex items-center gap-2 text-indigo-300 text-sm font-medium">
          <GlassWater className="w-4 h-4 text-purple-400" />
          <span>Operaciones</span>
          <span className="text-white font-bold">Monitor de Barra (Bebidas)</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            Sincronización en Vivo · Barra
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          ALERTAS DE CANCELACIÓN PERSISTENTES EN BARRA
          (permanecen hasta que el barman presione "Entendido")
      ═══════════════════════════════════════════════════ */}
      {cancelaciones.length > 0 && (
        <div className="px-4 py-3 space-y-3 shrink-0 z-20">
          {cancelaciones.map((c) => {
            const esModificacion = c.tipo === 'MODIFICACIÓN';
            return (
              <div
                key={c.id}
                className={`flex items-start gap-4 border rounded-2xl p-4 shadow-2xl ${
                  esModificacion
                    ? 'bg-amber-950/90 border-amber-500 text-amber-100'
                    : 'bg-red-900/80 border-red-500 text-red-100'
                }`}
                style={{ animation: 'pulse 1.5s ease-in-out 3' }}
              >
                <div className="shrink-0 mt-0.5">
                  <AlertTriangle className={`w-8 h-8 ${esModificacion ? 'text-amber-400' : 'text-red-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-sm uppercase tracking-wider flex items-center gap-2 mb-1 ${esModificacion ? 'text-amber-200' : 'text-red-200'}`}>
                    {esModificacion ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        ⚠️ BEBIDAS MODIFICADAS EN CAJA — {c.mesaInfo}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        BEBIDA CANCELADA — {c.mesaInfo}
                      </>
                    )}
                  </p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${esModificacion ? 'text-amber-400' : 'text-red-400'}`}>
                    {esModificacion ? 'Modificado por' : 'Cancelado por'}: {c.canceladoPor} · {new Date(c.canceladoEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {c.items.map((item, i) => (
                      <span key={i} className={`inline-flex items-center gap-1.5 font-black text-xs px-3 py-1.5 rounded-xl border ${
                        esModificacion 
                          ? 'bg-amber-900/80 border-amber-600 text-amber-100'
                          : 'bg-red-800 border-red-600 text-red-100'
                      }`}>
                        <span className={esModificacion ? 'text-amber-300' : 'text-red-300'}>{item.cantidad}×</span>
                        {item.nombre}
                        <span className={`font-mono ${esModificacion ? 'text-amber-400' : 'text-red-400'}`}>S/ {parseFloat(item.precio || 0).toFixed(2)}</span>
                        {item.notas && <span className={`italic ${esModificacion ? 'text-amber-300' : 'text-red-300'}`}>· {item.notas}</span>}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => dismissCancelacion(c.id)}
                  className={`shrink-0 px-4 py-2.5 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg border text-white ${
                    esModificacion
                      ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 border-amber-400'
                      : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 border-amber-400'
                  }`}
                >
                  ✓ Entendido
                </button>
              </div>
            );
          })}
        </div>
      )}

      <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              Bebidas por Preparar
            </h1>
            <p className="text-xs md:text-sm text-indigo-300">
              Solo tragos, refrescos y cervezas · Las comidas van al monitor de cocina.
            </p>
          </div>
          <div className="text-white flex items-center gap-2 font-bold text-sm bg-slate-900 px-4 py-2 rounded-xl border border-indigo-950 shadow-md">
            <Clock className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>{horaLocal || new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 items-start pb-10">
          {pedidos.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-60">
              <div className="w-20 h-20 bg-indigo-950/40 rounded-full border-2 border-dashed border-indigo-500/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <p className="text-white text-xl font-black uppercase tracking-widest">Sin bebidas pendientes</p>
              <p className="text-indigo-400 mt-2 text-sm">La barra está al día. ¡Salud!</p>
            </div>
          ) : (
            pedidos.map((p) => {
              const esDelivery = p.tipoEntrega === 'llevar' || p.tipoEntrega === 'delivery' || !!p.codigoPedidosYa;
              return (
                <div
                  key={p.pedidoId}
                  className="bg-slate-900 border border-indigo-950/60 rounded-t-2xl rounded-b shadow-2xl flex flex-col transform transition-all hover:scale-[1.02] relative"
                  style={{ minHeight: '280px' }}
                >
                  {/* Header del Ticket */}
                  <div className={`p-4 text-center shrink-0 border-b-4 relative ${esDelivery ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-purple-600 border-purple-700 text-white'}`}>
                    {p.adicional && !esDelivery && (
                      <div className="absolute -top-3 -right-3 bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg rotate-12 animate-pulse border border-white tracking-widest z-10">
                        + ADICIONAL
                      </div>
                    )}
                    {esDelivery ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                          <Truck className="w-4 h-4 text-indigo-200" />
                          <span className="font-bold text-[10px] uppercase tracking-widest text-indigo-100">
                            {p.codigoPedidosYa?.startsWith('DELIVERY -') ? '📞 Delivery Fogón'
                              : p.codigoPedidosYa?.startsWith('LLEVAR -') ? '🛍️ Para Llevar / Retiro'
                              : '🛵 PedidosYa'}
                          </span>
                        </div>
                        <h2 className="font-black text-2xl uppercase tracking-tighter leading-none">
                          {(() => {
                            if (p.codigoPedidosYa?.startsWith('DELIVERY -')) {
                              const parsed = parseDeliveryInfo(p.codigoPedidosYa);
                              return parsed ? parsed.nombre : p.codigoPedidosYa.replace('DELIVERY - ', '');
                            } else if (p.codigoPedidosYa?.startsWith('LLEVAR -')) {
                              return p.codigoPedidosYa.replace('LLEVAR - ', '');
                            }
                            return p.codigoPedidosYa || 'DELIVERY';
                          })()}
                        </h2>
                      </>
                    ) : (
                      <h2 className="font-black text-2xl uppercase tracking-tighter leading-none">
                        Mesa {p.mesaNum}
                      </h2>
                    )}
                  </div>

                  {/* Info del ticket (Mozo / Hora) */}
                  <div className="px-4 py-2 flex justify-between items-center text-[10px] font-black text-indigo-300 border-b border-indigo-950/60 shrink-0 bg-slate-900/60">
                    <span className="flex items-center gap-1.5 uppercase">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      {p.mesero}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      {p.hora}
                    </span>
                  </div>

                  {/* Detalle de Bebidas */}
                  <div className="p-4 flex-1 bg-slate-900/40 min-h-[120px]">
                    {p.items.map((item, i) => (
                      <div key={i} className="flex flex-col py-2.5 border-b border-indigo-950/30 last:border-0">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start flex-1 min-w-0">
                            <span className="font-mono font-black text-base mr-3 text-purple-400 w-5 text-center shrink-0">
                              {item.cant}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="block text-slate-100 font-bold text-sm leading-snug pt-0.5 uppercase tracking-wide">
                                {item.nombre}
                              </span>
                              {parseFloat(item.precio || 0) > 0 && (
                                <span className="inline-block mt-1 bg-slate-800 border border-slate-700/60 text-slate-400 font-black text-[10px] px-2 py-0.5 rounded-lg font-mono">
                                  S/ {parseFloat(item.precio || 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {item.notas && (
                          <div className="ml-8 mt-1.5">
                            <span className="inline-block bg-purple-600 border border-purple-700 text-white font-bold text-xs md:text-sm px-2.5 py-1 rounded-xl shadow-sm uppercase tracking-wide">
                              📋 NOTA: {item.notas}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Botón despachar bebidas con confirmación en 2 pasos */}
                  <div className="p-4 bg-slate-900 shrink-0 border-t border-indigo-950/40">
                    {confirmandoPedidoId === p.pedidoId ? (
                      <div className="flex gap-2 animate-fade-in">
                        <button
                          onClick={() => marcarListoBarra(p.pedidoId)}
                          disabled={despachando}
                          className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 text-xs cursor-pointer animate-pulse border border-amber-600/30"
                        >
                          <CheckCheck className="w-4 h-4 text-slate-950" />
                          ¿Confirmar Despacho?
                        </button>
                        <button
                          onClick={() => setConfirmandoPedidoId(null)}
                          className="px-3.5 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-xl text-xs uppercase cursor-pointer"
                          title="Cancelar confirmación"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleClicListoPedido(p.pedidoId)}
                        disabled={despachando}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 active:scale-95 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Listo · Despachar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
