// Configuración central del API
const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = {
  // Mesas (salón)
  getMesas: () => fetch(`${API_BASE}/api/mesas`).then(r => r.json()),
  enviarACocina: (num, body) => fetch(`${API_BASE}/api/mesas/${num}/pedido`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  unirMesa: (num, numeroMesaAUnir) => fetch(`${API_BASE}/api/mesas/${num}/unir`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numeroMesaAUnir }),
  }).then(r => r.json()),
  separarMesas: (num) => fetch(`${API_BASE}/api/mesas/${num}/separar`, { method: 'POST' }).then(r => r.json()),
  crearMesa: (body) => fetch(`${API_BASE}/api/mesas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  editarMesa: (numero, body) => fetch(`${API_BASE}/api/mesas/${numero}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  eliminarMesa: (numero) => fetch(`${API_BASE}/api/mesas/${numero}`, {
    method: 'DELETE',
  }).then(r => r.json()),

  // Cocina (unificado: salón + delivery)
  getPedidosCocina: () => fetch(`${API_BASE}/api/pedidos/cocina`).then(r => r.json()),
  getPedidosBarra: () => fetch(`${API_BASE}/api/pedidos/barra`).then(r => r.json()),
  prepararPedido: (id, seccion) => fetch(`${API_BASE}/api/pedidos/${id}/preparar`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seccion }),
  }).then(r => r.json()),
  servirPedido: (id) => fetch(`${API_BASE}/api/pedidos/${id}/servir`, { method: 'PATCH' }).then(r => r.json()),
  updateItemNotas: (itemId, notas) => fetch(`${API_BASE}/api/pedidos/items/${itemId}/notas`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notas }),
  }).then(r => r.json()),
  prepararItem: (itemId) => fetch(`${API_BASE}/api/pedidos/items/${itemId}/preparar`, {
    method: 'PATCH',
  }).then(r => r.json()),

  // Ensaladas
  getPedidosEnsaladas: () => fetch(`${API_BASE}/api/pedidos/ensaladas`).then(r => r.json()),
  prepararEnsalada: (pedidoId) => fetch(`${API_BASE}/api/pedidos/${pedidoId}/ensalada-lista`, { method: 'PATCH' }).then(r => r.json()),

  // Cancelación de pedidos (mozo)
  cancelarPedido: (id, body) => fetch(`${API_BASE}/api/pedidos/${id}/cancelar`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  cancelarItemPedido: (id, body) => fetch(`${API_BASE}/api/pedidos/${id}/cancelar-item`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),

  // Alertas de cancelación para cocina
  getCancelacionesCocina: () => fetch(`${API_BASE}/api/cocina/cancelaciones`).then(r => r.json()),
  dismissCancelacionCocina: (id) => fetch(`${API_BASE}/api/cocina/cancelaciones/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Alertas de cancelación para barra
  getCancelacionesBarra: () => fetch(`${API_BASE}/api/barra/cancelaciones`).then(r => r.json()),
  dismissCancelacionBarra: (id) => fetch(`${API_BASE}/api/barra/cancelaciones/${id}`, { method: 'DELETE' }).then(r => r.json()),
  entregarItem: (itemId) => fetch(`${API_BASE}/api/pedidos/items/${itemId}/entregar`, {
    method: 'PATCH',
  }).then(r => r.json()),
  entregarTodoPedido: (pedidoId) => fetch(`${API_BASE}/api/pedidos/${pedidoId}/entregar-todo`, {
    method: 'PATCH',
  }).then(r => r.json()),

  // Delivery / PedidosYa
  crearPedidoLlevar: (body) => fetch(`${API_BASE}/api/pedidos/llevar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  getPedidosLlevar: () => fetch(`${API_BASE}/api/pedidos/llevar`).then(r => r.json()),
  confirmarEntrega: (id) => fetch(`${API_BASE}/api/pedidos/${id}/entregar`, { method: 'PATCH' }).then(r => r.json()),

  // Productos
  getProductos: () => fetch(`${API_BASE}/api/productos`).then(r => r.json()),
  crearProducto: (body) => fetch(`${API_BASE}/api/productos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  editarProducto: (id, body) => fetch(`${API_BASE}/api/productos/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  eliminarProducto: (id) => fetch(`${API_BASE}/api/productos/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Usuarios
  getUsuarios: () => fetch(`${API_BASE}/api/usuarios`).then(r => r.json()),
  crearUsuario: (body) => fetch(`${API_BASE}/api/usuarios`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  eliminarUsuario: (id) => fetch(`${API_BASE}/api/usuarios/${id}`, { method: 'DELETE' }).then(r => r.json()),
  editarUsuario: (id, body) => fetch(`${API_BASE}/api/usuarios/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  login: (pin) => fetch(`${API_BASE}/api/usuarios/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
  }).then(r => r.json()),
  validateAuth: (pin) => fetch(`${API_BASE}/api/usuarios/validate-auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
  }).then(r => r.json()),

  // Ventas (acepta pedidoIds array)
  cobrar: (body) => fetch(`${API_BASE}/api/ventas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  getResumenVentas: (desde = null) => fetch(`${API_BASE}/api/ventas/resumen${desde ? `?desde=${desde}` : ''}`).then(r => r.json()),
  getHistorialVentas: (desde, hasta) => fetch(`${API_BASE}/api/ventas${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then(r => r.json()),
  cambiarMetodoPago: (ventaId, metodoPago, pin, montos = {}) => fetch(`${API_BASE}/api/ventas/${ventaId}/metodo-pago`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metodoPago, pin, ...montos }),
  }).then(r => r.json()),
  cambiarTipoEntrega: (ventaId, body) => fetch(`${API_BASE}/api/ventas/${ventaId}/tipo-entrega`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  anularVenta: (ventaId, body) => fetch(`${API_BASE}/api/ventas/${ventaId}/anular`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),

  // Compras
  getCompras: (desde, hasta) => fetch(`${API_BASE}/api/compras${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then(r => r.json()),
  crearCompra: (body) => fetch(`${API_BASE}/api/compras`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  getComprasStats: () => fetch(`${API_BASE}/api/compras/stats`).then(r => r.json()),
  sincronizarSunat: (body) => fetch(`${API_BASE}/api/compras/sincronizar-sunat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  actualizarCategoriaCompra: (id, categoria) => fetch(`${API_BASE}/api/compras/${id}/categoria`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoria }),
  }).then(r => r.json()),

  // Reportes
  getReporteContable: (desde, hasta) => fetch(`${API_BASE}/api/reportes/contable${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then(r => r.json()),
  getCancelaciones: (desde, hasta) => fetch(`${API_BASE}/api/reportes/cancelaciones${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then(r => r.json()),
  getReporteMozos: (desde, hasta) => fetch(`${API_BASE}/api/reportes/mozos${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then(r => r.json()),
  getRotacion: (desde = null, hasta = null) => {
    let url = `${API_BASE}/api/reportes/rotacion`;
    const params = [];
    if (desde) params.push(`desde=${desde}`);
    if (hasta) params.push(`hasta=${hasta}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return fetch(url).then(r => r.json());
  },

  // Consulta DNI/RUC segura
  consultarCliente: (doc) => fetch(`${API_BASE}/api/clientes/consulta/${doc}`).then(r => r.json()),
  getEmpresa: () => fetch(`${API_BASE}/api/empresa`).then(r => r.json()),

  // SUNAT / apisunat.pe — Diagnóstico y reintentos manuales
  getNubefactPendientes: () => fetch(`${API_BASE}/api/sunat/pendientes`).then(r => r.json()),
  reintentarNubefact: (id) => fetch(`${API_BASE}/api/sunat/reintentar/${id}`, { method: 'POST' }).then(r => r.json()),
  reintentarTodosNubefact: () => fetch(`${API_BASE}/api/sunat/reintentar-todos`, { method: 'POST' }).then(r => r.json()),

  // Ofertas por Temporada
  getOfertas: () => fetch(`${API_BASE}/api/ofertas`).then(r => r.json()),
  crearOferta: (body) => fetch(`${API_BASE}/api/ofertas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  editarOferta: (id, body) => fetch(`${API_BASE}/api/ofertas/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  activarOferta: (id, activa) => fetch(`${API_BASE}/api/ofertas/${id}/activar`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activa }),
  }).then(r => r.json()),
  eliminarOferta: (id) => fetch(`${API_BASE}/api/ofertas/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Nuevas funciones
  checkUserStatus: (id) => fetch(`${API_BASE}/api/usuarios/check/${id}`).then(r => r.json()),
  actualizarDelivery: (id, body) => fetch(`${API_BASE}/api/pedidos/llevar/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
  getStatus: () => fetch(`${API_BASE}/api/status`).then(r => r.json()),
  actualizarClienteVenta: (ventaId, body) => fetch(`${API_BASE}/api/ventas/${ventaId}/datos-cliente`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json()),
};
