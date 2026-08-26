import React, { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCheck, CheckCircle2, User, Truck, Salad, AlertTriangle } from 'lucide-react';
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

const cleanNotasEnsalada = (notas) => {
  if (!notas) return null;

  const partes = notas.split(' · ');
  const partesEnsalada = partes.filter(p => {
    const pLower = p.toLowerCase();
    if (pLower.includes('acompañamiento') || pLower.includes('guarnicion') || pLower.includes('bebida') || pLower.includes('entrada') || pLower.includes('fondo')) {
      return false;
    }
    return true;
  });

  if (partesEnsalada.length === 0) return null;
  return partesEnsalada.join(' · ');
};

export default function EnsaladasPage() {
  const [pedidos, setPedidos] = useState([]);
  const [horaLocal, setHoraLocal] = useState('');

  const fetchPedidos = useCallback(async () => {
    try {
      const data = await api.getPedidosEnsaladas();
      if (Array.isArray(data)) {
        setPedidos(data);
      }
    } catch (err) {
      console.error('Error cargando ensaladas:', err);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    const tick = () => {
      fetchPedidos();
      setHoraLocal(new Date().toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
      }));
    };
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, [fetchPedidos]);

  const marcarListoEnsalada = async (pedidoId) => {
    try {
      await api.prepararEnsalada(pedidoId);
      await fetchPedidos();
    } catch (err) {
      alert('Error al despachar ensaladas: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full bg-slate-950">
      {/* Header con gradiente verde esmeralda */}
      <header className="h-16 bg-slate-900 border-b border-emerald-950/60 flex items-center justify-between px-4 md:px-8 z-10 shrink-0 text-white">
        <div className="hidden sm:flex items-center gap-2 text-emerald-300 text-sm font-medium">
          <Salad className="w-4 h-4 text-emerald-400" />
          <span>Operaciones</span>
          <span className="text-white font-bold">Monitor de Ensaladas</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Estación Activa
          </div>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Salad className="w-6 h-6 text-emerald-400" /> Ensaladas Pendientes
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Muestra las ensaladas correspondientes a pollos, parrillas, combos y ensaladas adicionales.
            </p>
          </div>
          <div className="text-white flex items-center gap-2 font-bold text-sm bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 shadow-md">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{horaLocal || new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 items-start pb-10">
          {pedidos.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <p className="text-white text-xl font-bold uppercase tracking-widest">Sin ensaladas pendientes</p>
              <p className="text-slate-400 mt-2">La estación de ensaladas está al día.</p>
            </div>
          ) : (
            pedidos.map((p) => {
              const esDelivery = p.tipoEntrega === 'llevar' || p.tipoEntrega === 'delivery' || !!p.codigoPedidosYa;
              const cocinaLista = p.estadoCocina === 'Servido';
              return (
                <div
                  key={p.pedidoId}
                  className={`rounded-t-xl rounded-b shadow-2xl flex flex-col bg-slate-900 border border-slate-800 transform transition-all hover:-translate-y-1 relative`}
                  style={{ minHeight: '300px' }}
                >
                  {/* Header del ticket */}
                  <div className={`p-3 text-center shrink-0 border-b-4 relative ${
                    esDelivery 
                      ? 'bg-emerald-600 border-emerald-700 text-white' 
                      : 'bg-emerald-500 border-emerald-600 text-slate-950'
                  }`}>
                    {/* Alerta animada si el plato principal ya salió de la cocina */}
                    {cocinaLista && (
                      <div className="absolute -top-3 -right-2 bg-rose-600 text-white text-[9px] font-black px-2.5 py-1 rounded-lg shadow-lg animate-bounce border border-white tracking-widest z-10 uppercase">
                        🔥 Listo en Cocina
                      </div>
                    )}
                    {esDelivery ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5 mb-1 text-[10px] uppercase font-bold tracking-wider opacity-90">
                          <Truck className="w-3.5 h-3.5" />
                          <span>
                            {p.codigoPedidosYa?.startsWith('DELIVERY -') ? '📞 Delivery'
                              : p.codigoPedidosYa?.startsWith('LLEVAR -') ? '🛍️ Llevar'
                              : '🛵 PedidosYa'}
                          </span>
                        </div>
                        <h2 className="font-black text-xl uppercase tracking-tight leading-none truncate">
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

                  {/* Info del pedido */}
                  <div className="p-3 flex justify-between items-center text-[10px] font-black text-slate-400 border-b border-slate-800 shrink-0 bg-slate-900/60">
                    <span className="flex items-center gap-1.5 truncate max-w-[55%]">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      {p.mesero}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {p.hora}
                    </span>
                  </div>

                  {/* Items que requieren ensalada */}
                  <div className="p-4 flex-1 bg-slate-900/40 min-h-[140px]">
                    {p.items.length === 0 ? (
                      <div className="text-center text-xs text-slate-500 pt-6 italic">Ensalada del día regular</div>
                    ) : (
                      p.items.map((item, i) => (
                        <div key={i} className="flex flex-col py-1.5 border-b border-dashed border-slate-800 last:border-0">
                          <div className="flex items-start">
                            <span className="font-black text-base mr-2 text-emerald-400 w-5 text-center shrink-0">
                              {item.cant}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="block text-slate-200 font-bold text-xs uppercase leading-snug">
                                {item.nombre}
                              </span>
                            </div>
                          </div>
                          {(() => {
                            const notaLimpia = cleanNotasEnsalada(item.notas);
                            if (!notaLimpia) return null;
                            return (
                              <div className="ml-7 mt-1">
                                <span className="inline-block bg-emerald-950 border border-emerald-800/80 text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                  📋 {notaLimpia}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Botón listo */}
                  <div className="p-4 bg-slate-900/80 shrink-0 pb-5 border-t border-slate-800/50">
                    <button
                      onClick={() => marcarListoEnsalada(p.pedidoId)}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-slate-950 font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs border border-emerald-500/20"
                    >
                      <CheckCheck className="w-4.5 h-4.5" />
                      Ensaladas Listas
                    </button>
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
