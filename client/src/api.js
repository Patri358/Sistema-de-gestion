const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status} al comunicarse con el servidor`);
  }
  return data;
}

export const api = {
  getProductos({ busqueda = '', categoria = '' } = {}) {
    const params = new URLSearchParams();
    if (busqueda) params.set('busqueda', busqueda);
    if (categoria) params.set('categoria', categoria);
    const qs = params.toString();
    return request(`/productos${qs ? `?${qs}` : ''}`);
  },
  getStockBajo() {
    return request('/productos/stock-bajo');
  },
  buscarProductoCodigo(codigo) {
    const params = new URLSearchParams({ codigo });
    return request(`/productos/buscar-codigo?${params.toString()}`);
  },
  crearProducto(producto) {
    return request('/productos', { method: 'POST', body: JSON.stringify(producto) });
  },
  actualizarProducto(id, producto) {
    return request(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(producto) });
  },
  eliminarProducto(id) {
    return request(`/productos/${id}`, { method: 'DELETE' });
  },
  getCategorias() {
    return request('/categorias');
  },
  crearCategoria(nombre) {
    return request('/categorias', { method: 'POST', body: JSON.stringify({ nombre }) });
  },
  actualizarCategoria(id, nombre) {
    return request(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify({ nombre }) });
  },
  eliminarCategoria(id) {
    return request(`/categorias/${id}`, { method: 'DELETE' });
  },
  getVentas(periodo, valor) {
    const params = new URLSearchParams({ periodo, valor });
    return request(`/ventas?${params.toString()}`);
  },
  crearVenta(metodoPago, items) {
    return request('/ventas', {
      method: 'POST',
      body: JSON.stringify({ metodoPago, items }),
    });
  },
  actualizarVenta(id, metodoPago, items) {
    return request(`/ventas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ metodoPago, items }),
    });
  },
  getCaja() {
    return request('/caja');
  },
  abrirCaja(montoApertura) {
    return request('/caja/abrir', {
      method: 'POST',
      body: JSON.stringify({ montoApertura }),
    });
  },
  cerrarCaja(montoCierre) {
    return request('/caja/cerrar', {
      method: 'POST',
      body: JSON.stringify({ montoCierre }),
    });
  },
  exportarDbUrl: `${BASE}/exportar`,
};
