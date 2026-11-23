const BASE = '/api';
const CLAVE_SESION = 'cstore-sesion';

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_SESION);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE_SESION, token);
  } catch {}
}

export function limpiarToken() {
  try {
    localStorage.removeItem(CLAVE_SESION);
  } catch {}
}

async function request(path, options = {}, conAuth = true) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const token = leerToken();
  if (conAuth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 401 && conAuth && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('sesion-expirada'));
  }
  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status} al comunicarse con el servidor`);
  }
  return data;
}

export const api = {
  login(usuario, password) {
    return request(
      '/login',
      { method: 'POST', body: JSON.stringify({ usuario, password }) },
      false
    );
  },
  getSesion() {
    return request('/sesion');
  },
  getUsuarios() {
    return request('/usuarios');
  },
  crearUsuario(datos) {
    return request('/usuarios', { method: 'POST', body: JSON.stringify(datos) });
  },
  actualizarUsuario(id, datos) {
    return request(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
  },
  eliminarUsuario(id) {
    return request(`/usuarios/${id}`, { method: 'DELETE' });
  },
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
  crearVenta(metodoPago, items, opciones = {}) {
    return request('/ventas', {
      method: 'POST',
      body: JSON.stringify({ metodoPago, items, ...opciones }),
    });
  },
  actualizarVenta(id, metodoPago, items, opciones = {}) {
    return request(`/ventas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ metodoPago, items, ...opciones }),
    });
  },
  getMovimientosStock(productoId) {
    const params = new URLSearchParams();
    if (productoId) params.set('productoId', productoId);
    const qs = params.toString();
    return request(`/movimientos-stock${qs ? `?${qs}` : ''}`);
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
  retirarCaja(monto, motivo) {
    return request('/caja/retirar', {
      method: 'POST',
      body: JSON.stringify({ monto, motivo }),
    });
  },
  cerrarCaja(montoCierre) {
    return request('/caja/cerrar', {
      method: 'POST',
      body: JSON.stringify({ montoCierre }),
    });
  },
  async descargarBase() {
    const token = leerToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE}/exportar`, { headers });
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sesion-expirada'));
    }
    if (!res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch {}
      throw new Error(data?.error || `Error ${res.status} al descargar la base`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const nombre = res.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] ?? 'almacen.db';
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
