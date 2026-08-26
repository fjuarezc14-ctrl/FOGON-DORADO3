import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, X, Search, Wallet, Phone, MapPin, UserRound, Briefcase, ArrowDownCircle, Eye, Pencil, Trash2, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';
import { api } from '../api';

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Yape', 'Mixto'];

export default function CreditosPage({ currentUser }) {
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalCliente, setModalCliente] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState(null);
  const [modalAbono, setModalAbono] = useState(false);
  const [clienteAbono, setClienteAbono] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [clienteDetalle, setClienteDetalle] = useState(null);
  const [toast, setToast] = useState(null);
  const [formCliente, setFormCliente] = useState({
    nombre: '', tipoDoc: 'DNI', numDoc: '', telefono: '', direccion: '', esTrabajador: false, usuarioId: '',
  });
  const [formAbono, setFormAbono] = useState({
    monto: '', metodoPago: 'Efectivo', montoEfectivo: '', montoTarjeta: '', montoYape: '', nota: '',
  });

  const showToast = (msg, tipo = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTodo = useCallback(async () => {
    try {
      const [cs, us] = await Promise.all([api.getClientes(), api.getUsuarios()]);
      setClientes(cs || []);
      setUsuarios(us || []);
    } catch (e) {
      console.error('Error cargando créditos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTodo(); }, [fetchTodo]);

  const filtered = clientes.filter(c =>
    (c.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.numDoc || '').includes(search)
  );

  const abrirNuevoCliente = () => {
    setEditandoCliente(null);
    setFormCliente({ nombre: '', tipoDoc: 'DNI', numDoc: '', telefono: '', direccion: '', esTrabajador: false, usuarioId: '' });
    setModalCliente(true);
  };

  const abrirEditarCliente = (c) => {
    setEditandoCliente(c);
    setFormCliente({
      nombre: c.nombre || '',
      tipoDoc: c.tipoDoc || 'DNI',
      numDoc: c.numDoc || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      esTrabajador: c.esTrabajador || false,
      usuarioId: c.usuarioId || '',
    });
    setModalCliente(true);
  };

  const guardarCliente = async () => {
    if (!formCliente.nombre.trim()) { showToast('El nombre es obligatorio.', 'error'); return; }
    try {
      if (editandoCliente) {
        await api.editarCliente(editandoCliente.id, formCliente);
        showToast('✅ Cliente actualizado correctamente.');
      } else {
        await api.crearCliente(formCliente);
        showToast('✅ Cliente creado correctamente.');
      }
      setModalCliente(false);
      await fetchTodo();
    } catch (err) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const eliminarCliente = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este cliente?')) return;
    try {
      await api.eliminarCliente(id);
      showToast('✅ Cliente eliminado.');
      await fetchTodo();
    } catch (err) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const abrirDetalle = async (c) => {
    try {
      const detalle = await api.getClienteDetalle(c.id);
      setClienteDetalle(detalle);
      setModalDetalle(true);
    } catch (err) {
      showToast('❌ Error al cargar detalle: ' + err.message, 'error');
    }
  };

  const abrirAbono = (c) => {
    setClienteAbono(c);
    setFormAbono({ monto: '', metodoPago: 'Efectivo', montoEfectivo: '', montoTarjeta: '', montoYape: '', nota: '' });
    setModalAbono(true);
  };

  const guardarAbono = async () => {
    if (!formAbono.monto || parseFloat(formAbono.monto) <= 0) { showToast('Ingresa un monto válido.', 'error'); return; }
    try {
      await api.abonarCredito(clienteAbono.id, {
        ...formAbono,
        registradoPor: currentUser?.nombre || 'Cajero',
      });
      showToast('✅ Abono registrado correctamente.');
      setModalAbono(false);
      await fetchTodo();
    } catch (err) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  return (
    <section className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50 relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[300] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl max-w-sm border ${
          toast.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <p className="text-sm font-semibold">{toast.msg}</p>
          <button onClick={() => setToast(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-500" /> Módulo de Créditos
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de clientes con cuenta corriente y abonos</p>
        </div>
        <button onClick={abrirNuevoCliente} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all font-bold text-sm shadow-lg">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o documento..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Users className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="font-bold text-lg">No hay clientes registrados</p>
          <p className="text-sm">Crea el primer cliente para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-white text-sm ${c.esTrabajador ? 'bg-violet-500' : 'bg-amber-500'}`}>
                    {c.nombre?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 leading-tight">{c.nombre}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      {c.esTrabajador ? <Briefcase className="w-3 h-3" /> : <UserRound className="w-3 h-3" />}
                      {c.esTrabajador ? 'Trabajador interno' : `${c.tipoDoc}: ${c.numDoc || 'S/D'}`}
                    </p>
                  </div>
                </div>
                {c.esTrabajador && <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2 py-1 rounded-lg">STAFF</span>}
              </div>

              <div className="flex items-center gap-2 text-sm mb-3">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-600">{c.telefono || 'Sin teléfono'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Consumido</p>
                  <p className="font-black text-sm text-slate-700">S/ {(c.totalConsumido || 0).toFixed(2)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                  <p className="text-[9px] uppercase font-bold text-emerald-500">Abonado</p>
                  <p className="font-black text-sm text-emerald-600">S/ {(c.totalAbonado || 0).toFixed(2)}</p>
                </div>
                <div className={`rounded-xl p-2.5 text-center ${(c.saldo || 0) > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                  <p className={`text-[9px] uppercase font-bold ${(c.saldo || 0) > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Saldo</p>
                  <p className={`font-black text-sm ${(c.saldo || 0) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>S/ {(c.saldo || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => abrirAbono(c)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                  <ArrowDownCircle className="w-4 h-4" /> Abonar
                </button>
                <button onClick={() => abrirDetalle(c)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                  <Eye className="w-4 h-4" /> Cuenta
                </button>
                <button onClick={() => abrirEditarCliente(c)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => eliminarCliente(c.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CLIENTE */}
      {modalCliente && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4" onClick={() => setModalCliente(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-slate-800 text-lg">{editandoCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => setModalCliente(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre *</label>
                <input value={formCliente.nombre} onChange={e => setFormCliente({ ...formCliente, nombre: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm" placeholder="Ej. Juan Pérez" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo Doc.</label>
                  <select value={formCliente.tipoDoc} onChange={e => setFormCliente({ ...formCliente, tipoDoc: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none">
                    <option>DNI</option>
                    <option>RUC</option>
                    <option>CE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">N° Documento</label>
                  <input value={formCliente.numDoc} onChange={e => setFormCliente({ ...formCliente, numDoc: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Teléfono</label>
                <input value={formCliente.telefono} onChange={e => setFormCliente({ ...formCliente, telefono: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dirección</label>
                <input value={formCliente.direccion} onChange={e => setFormCliente({ ...formCliente, direccion: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm" />
              </div>

              <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-xl">
                <input type="checkbox" checked={formCliente.esTrabajador} onChange={e => setFormCliente({ ...formCliente, esTrabajador: e.target.checked })}
                  className="w-4 h-4 accent-violet-600" />
                <div>
                  <label className="text-sm font-bold text-violet-800">Es trabajador interno</label>
                  <p className="text-xs text-violet-500">Permite líneas de crédito para personal</p>
                </div>
              </div>

              {formCliente.esTrabajador && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Asociar con usuario del sistema</label>
                  <select value={formCliente.usuarioId} onChange={e => setFormCliente({ ...formCliente, usuarioId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none">
                    <option value="">— Sin asociar —</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModalCliente(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm">Cancelar</button>
              <button onClick={guardarCliente} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800">{editandoCliente ? 'Guardar Cambios' : 'Crear Cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ABONO */}
      {modalAbono && clienteAbono && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4" onClick={() => setModalAbono(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-slate-800 text-lg">Registrar Abono</h2>
                <p className="text-xs text-slate-500">{clienteAbono.nombre}</p>
              </div>
              <button onClick={() => setModalAbono(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            {/* Banner de saldo deudor */}
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-4 ${(clienteAbono.saldo || 0) > 0 ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <div>
                <p className={`text-[10px] font-black uppercase ${(clienteAbono.saldo || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Saldo Deudor Actual</p>
                <p className={`text-2xl font-black font-mono ${(clienteAbono.saldo || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>S/ {(clienteAbono.saldo || 0).toFixed(2)}</p>
              </div>
              {(clienteAbono.saldo || 0) > 0
                ? <span className="text-3xl">⚠️</span>
                : <span className="text-3xl">✅</span>
              }
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto *</label>
                <input type="number" step="0.01" value={formAbono.monto} onChange={e => setFormAbono({ ...formAbono, monto: e.target.value })}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 text-lg font-black text-center focus:ring-2 focus:ring-emerald-500/30 outline-none"
                  placeholder="S/ 0.00" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Método de Pago</label>
                <select value={formAbono.metodoPago} onChange={e => setFormAbono({ ...formAbono, metodoPago: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none">
                  {METODOS_PAGO.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {formAbono.metodoPago === 'Mixto' && (
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" placeholder="Efectivo" value={formAbono.montoEfectivo} onChange={e => setFormAbono({ ...formAbono, montoEfectivo: e.target.value })} className="px-2 py-2 rounded-xl border border-slate-200 text-sm" />
                  <input type="number" placeholder="Tarjeta" value={formAbono.montoTarjeta} onChange={e => setFormAbono({ ...formAbono, montoTarjeta: e.target.value })} className="px-2 py-2 rounded-xl border border-slate-200 text-sm" />
                  <input type="number" placeholder="Yape" value={formAbono.montoYape} onChange={e => setFormAbono({ ...formAbono, montoYape: e.target.value })} className="px-2 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nota (opcional)</label>
                <input value={formAbono.nota} onChange={e => setFormAbono({ ...formAbono, nota: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none" placeholder="Ej. Abono parcial" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModalAbono(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm">Cancelar</button>
              <button onClick={guardarAbono} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm">Registrar Abono</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE CUENTA */}
      {modalDetalle && clienteDetalle && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[400] flex items-center justify-center p-4" onClick={() => setModalDetalle(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-black text-slate-800 text-lg">Cuenta Corriente</h2>
                <p className="text-sm text-slate-500">{clienteDetalle.nombre} {clienteDetalle.numDoc ? `(${clienteDetalle.tipoDoc}: ${clienteDetalle.numDoc})` : ''}</p>
              </div>
              <button onClick={() => setModalDetalle(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400">Consumido</p>
                <p className="font-black text-lg text-slate-800">S/ {(clienteDetalle.totalConsumido || 0).toFixed(2)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-500">Abonado</p>
                <p className="font-black text-lg text-emerald-600">S/ {(clienteDetalle.totalAbonado || 0).toFixed(2)}</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${(clienteDetalle.saldo || 0) > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                <p className={`text-[10px] uppercase font-bold ${(clienteDetalle.saldo || 0) > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Saldo</p>
                <p className={`font-black text-lg ${(clienteDetalle.saldo || 0) > 0 ? 'text-rose-600' : 'text-slate-800'}`}>S/ {(clienteDetalle.saldo || 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-bold text-sm text-slate-700 mb-3">Ventas a Crédito</h3>
              {clienteDetalle.ventasCredito?.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Sin consumos registrados</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
                      <th className="py-2">Fecha</th>
                      <th className="py-2">Comprobante</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clienteDetalle.ventasCredito?.map(v => (
                      <tr key={v.id} className="border-b border-slate-50">
                        <td className="py-2">{new Date(v.fecha).toLocaleDateString('es-PE')}</td>
                        <td className="py-2">{v.tipoComprobante}</td>
                        <td className="py-2 text-right font-bold">{v.montoCredito > 0 ? `S/ ${v.montoCredito.toFixed(2)}` : `S/ ${v.total.toFixed(2)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 className="font-bold text-sm text-slate-700 mb-3">Historial de Abonos</h3>
              {clienteDetalle.AbonosCredito?.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Sin abonos registrados</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100">
                      <th className="py-2">Fecha</th>
                      <th className="py-2">Método</th>
                      <th className="py-2">Registrado por</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clienteDetalle.AbonosCredito?.map(a => (
                      <tr key={a.id} className="border-b border-slate-50">
                        <td className="py-2">{new Date(a.creadoEn).toLocaleDateString('es-PE')} {new Date(a.creadoEn).toLocaleTimeString('es-PE', {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="py-2">{a.metodoPago}</td>
                        <td className="py-2">{a.registradoPor}</td>
                        <td className="py-2 text-right font-bold text-emerald-600">S/ {a.monto.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
