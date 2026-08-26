// ================================================================
// CONFIGURACIÓN CENTRALIZADA DE API — VT VALETEC
// ================================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Cliente HTTP seguro con validación de cabeceras, manejo de errores de proxy (502/504)
 * y protección contra parseo inválido de HTML.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {})
  };

  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      if (isJson) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error HTTP ${response.status}: ${response.statusText}`);
      } else {
        if (response.status === 502) {
          throw new Error('502 Bad Gateway: El servidor backend no está respondiendo o se encuentra en reinicio.');
        }
        if (response.status === 504) {
          throw new Error('504 Gateway Timeout: El servidor tardó demasiado en responder.');
        }
        throw new Error(`Error ${response.status}: El servidor no devolvió una respuesta JSON válida.`);
      }
    }

    if (!isJson) {
      return null;
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s). Verifica la conexión Wi-Fi con el servidor.`);
    }
    throw err;
  }
}

export const api = {
  // Mesas (salón)
  getMesas: () => apiRequest('/api/mesas'),
  enviarACocina: (num, body) => apiRequest(`/api/mesas/${num}/pedido`, {
    method: 'POST', body: JSON.stringify(body)
  }),
  unirMesa: (num, numeroMesaAUnir) => apiRequest(`/api/mesas/${num}/unir`, {
    method: 'POST', body: JSON.stringify({ numeroMesaAUnir })
  }),
  separarMesas: (num) => apiRequest(`/api/mesas/${num}/separar`, { method: 'POST' }),
  crearMesa: (body) => apiRequest('/api/mesas', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarMesa: (numero, body) => apiRequest(`/api/mesas/${numero}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarMesa: (numero) => apiRequest(`/api/mesas/${numero}`, { method: 'DELETE' }),

  // Cocina (unificado: salón + delivery)
  getPedidosCocina: () => apiRequest('/api/pedidos/cocina'),
  getPedidosBarra: () => apiRequest('/api/pedidos/barra'),
  prepararPedido: (id, seccion) => apiRequest(`/api/pedidos/${id}/preparar`, {
    method: 'PATCH', body: JSON.stringify({ seccion })
  }),
  servirPedido: (id) => apiRequest(`/api/pedidos/${id}/servir`, { method: 'PATCH' }),
  updateItemNotas: (itemId, notas) => apiRequest(`/api/pedidos/items/${itemId}/notas`, {
    method: 'PATCH', body: JSON.stringify({ notas })
  }),
  prepararItem: (itemId) => apiRequest(`/api/pedidos/items/${itemId}/preparar`, { method: 'PATCH' }),

  // Ensaladas
  getPedidosEnsaladas: () => apiRequest('/api/pedidos/ensaladas'),
  prepararEnsalada: (pedidoId) => apiRequest(`/api/pedidos/${pedidoId}/ensalada-lista`, { method: 'PATCH' }),

  // Cancelación de pedidos (mozo)
  cancelarPedido: (id, body) => apiRequest(`/api/pedidos/${id}/cancelar`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),
  cancelarItemPedido: (id, body) => apiRequest(`/api/pedidos/${id}/cancelar-item`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),

  // Alertas de cancelación para cocina
  getCancelacionesCocina: () => apiRequest('/api/cocina/cancelaciones'),
  dismissCancelacionCocina: (id) => apiRequest(`/api/cocina/cancelaciones/${id}`, { method: 'DELETE' }),

  // Alertas de cancelación para barra
  getCancelacionesBarra: () => apiRequest('/api/barra/cancelaciones'),
  dismissCancelacionBarra: (id) => apiRequest(`/api/barra/cancelaciones/${id}`, { method: 'DELETE' }),
  entregarItem: (itemId) => apiRequest(`/api/pedidos/items/${itemId}/entregar`, { method: 'PATCH' }),
  entregarTodoPedido: (pedidoId) => apiRequest(`/api/pedidos/${pedidoId}/entregar-todo`, { method: 'PATCH' }),

  // Delivery / PedidosYa
  crearPedidoLlevar: (body) => apiRequest('/api/pedidos/llevar', {
    method: 'POST', body: JSON.stringify(body)
  }),
  getPedidosLlevar: () => apiRequest('/api/pedidos/llevar'),
  confirmarEntrega: (id) => apiRequest(`/api/pedidos/${id}/entregar`, { method: 'PATCH' }),

  // Productos
  getProductos: () => apiRequest('/api/productos'),
  crearProducto: (body) => apiRequest('/api/productos', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarProducto: (id, body) => apiRequest(`/api/productos/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarProducto: (id) => apiRequest(`/api/productos/${id}`, { method: 'DELETE' }),

  // Usuarios
  getUsuarios: () => apiRequest('/api/usuarios'),
  crearUsuario: (body) => apiRequest('/api/usuarios', {
    method: 'POST', body: JSON.stringify(body)
  }),
  eliminarUsuario: (id) => apiRequest(`/api/usuarios/${id}`, { method: 'DELETE' }),
  editarUsuario: (id, body) => apiRequest(`/api/usuarios/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  login: (pin) => apiRequest('/api/usuarios/login', {
    method: 'POST', body: JSON.stringify({ pin })
  }),
  validateAuth: (pin) => apiRequest('/api/usuarios/validate-auth', {
    method: 'POST', body: JSON.stringify({ pin })
  }),

  // Ventas (acepta pedidoIds array)
  cobrar: (body) => apiRequest('/api/ventas', {
    method: 'POST', body: JSON.stringify(body)
  }),
  getResumenVentas: (desde = null) => {
    const qs = desde ? `?desde=${encodeURIComponent(desde)}` : '';
    return apiRequest(`/api/ventas/resumen${qs}`);
  },
  getHistorialVentas: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/ventas${qs}`);
  },
  cambiarMetodoPago: (ventaId, metodoPago, pin, montos = {}) => apiRequest(`/api/ventas/${ventaId}/metodo-pago`, {
    method: 'PATCH', body: JSON.stringify({ metodoPago, pin, ...montos })
  }),
  cambiarTipoEntrega: (ventaId, body) => apiRequest(`/api/ventas/${ventaId}/tipo-entrega`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),

  // Compras
  getCompras: (desde, hasta, extraParams = {}) => {
    let params = {};
    if (typeof desde === 'object' && desde !== null) {
      params = desde;
    } else {
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (extraParams) params = { ...params, ...extraParams };
    }
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest(`/api/compras${qs}`);
  },
  crearCompra: (body) => apiRequest('/api/compras', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarCompra: (id, body) => apiRequest(`/api/compras/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarCompra: (id) => apiRequest(`/api/compras/${id}`, {
    method: 'DELETE'
  }),
  getComprasStats: () => apiRequest('/api/compras/stats'),
  sincronizarSunat: (body) => apiRequest('/api/compras/sincronizar-sunat', {
    method: 'POST', body: JSON.stringify(body)
  }),
  actualizarCategoriaCompra: (id, categoria) => apiRequest(`/api/compras/${id}/categoria`, {
    method: 'PATCH', body: JSON.stringify({ categoria })
  }),

  // Reportes
  getReporteContable: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/reportes/contable${qs}`);
  },
  getCancelaciones: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/reportes/cancelaciones${qs}`);
  },
  getReporteMozos: (desde, hasta) => {
    const qs = (desde && hasta) ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : '';
    return apiRequest(`/api/reportes/mozos${qs}`);
  },
  getRotacion: (desde = null, hasta = null) => {
    const params = [];
    if (desde) params.push(`desde=${encodeURIComponent(desde)}`);
    if (hasta) params.push(`hasta=${encodeURIComponent(hasta)}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    return apiRequest(`/api/reportes/rotacion${qs}`);
  },
  getReportePollos: (desde = null, hasta = null) => {
    const params = [];
    if (desde) params.push(`desde=${encodeURIComponent(desde)}`);
    if (hasta) params.push(`hasta=${hasta}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    return apiRequest(`/api/reportes/pollos${qs}`);
  },

  // Consulta DNI/RUC segura
  consultarCliente: (doc) => apiRequest(`/api/clientes/consulta/${encodeURIComponent(doc)}`),

  // SUNAT / apisunat.pe — Diagnóstico y reintentos manuales
  getNubefactPendientes: () => apiRequest('/api/sunat/pendientes'),
  reintentarNubefact: (id) => apiRequest(`/api/sunat/reintentar/${id}`, { method: 'POST' }),
  reintentarTodosNubefact: () => apiRequest('/api/sunat/reintentar-todos', { method: 'POST' }),

  // Ofertas por Temporada
  getOfertas: () => apiRequest('/api/ofertas'),
  crearOferta: (body) => apiRequest('/api/ofertas', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarOferta: (id, body) => apiRequest(`/api/ofertas/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  activarOferta: (id, activa) => apiRequest(`/api/ofertas/${id}/activar`, {
    method: 'PATCH', body: JSON.stringify({ activa })
  }),
  eliminarOferta: (id) => apiRequest(`/api/ofertas/${id}`, { method: 'DELETE' }),

  // Nuevas funciones
  checkUserStatus: (id) => apiRequest(`/api/usuarios/check/${id}`),
  actualizarDelivery: (id, body) => apiRequest(`/api/pedidos/llevar/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  getStatus: () => apiRequest('/api/status'),
  actualizarClienteVenta: (ventaId, body) => apiRequest(`/api/ventas/${ventaId}/datos-cliente`, {
    method: 'PATCH', body: JSON.stringify(body)
  }),
  anularVenta: (ventaId, pin, motivo) => apiRequest(`/api/ventas/${ventaId}/anular`, {
    method: 'PATCH', body: JSON.stringify({ pin, motivo })
  }),

  // === MÓDULO DE CRÉDITOS ===
  getClientes: () => apiRequest('/api/clientes'),
  crearCliente: (body) => apiRequest('/api/clientes', {
    method: 'POST', body: JSON.stringify(body)
  }),
  editarCliente: (id, body) => apiRequest(`/api/clientes/${id}`, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  eliminarCliente: (id) => apiRequest(`/api/clientes/${id}`, { method: 'DELETE' }),
  getClienteDetalle: (id) => apiRequest(`/api/clientes/${id}`),
  abonarCredito: (id, body) => apiRequest(`/api/clientes/${id}/abonar`, {
    method: 'POST', body: JSON.stringify(body)
  }),
  getVentasCredito: () => apiRequest('/api/clientes/ventas/credito'),
  getAbonos: (desde) => {
    const qs = desde ? `?desde=${encodeURIComponent(desde)}` : '';
    return apiRequest(`/api/abonos${qs}`);
  },
};
