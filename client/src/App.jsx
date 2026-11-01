import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import Inventario from './components/Inventario.jsx';
import Carrito from './components/Carrito.jsx';
import Ventas from './components/Ventas.jsx';
import Categorias from './components/Categorias.jsx';
import {
  IconAlert,
  IconBox,
  IconCart,
  IconCheck,
  IconDownload,
  IconReceipt,
  IconStore,
  IconTag,
  IconX,
} from './components/Icons.jsx';
import { formatARS } from './utils.js';

const TABS = [
  { id: 'inventario', etiqueta: 'Inventario', Icono: IconBox },
  { id: 'carrito', etiqueta: 'Carrito', Icono: IconCart },
  { id: 'ventas', etiqueta: 'Ventas', Icono: IconReceipt },
  { id: 'categorias', etiqueta: 'Categorías', Icono: IconTag },
];

export default function App() {
  const [tab, setTab] = useState('inventario');
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ busqueda: '', categoria: '' });
  const [carrito, setCarrito] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [comprando, setComprando] = useState(false);

  const notify = useCallback((mensaje, tipo = 'success') => {
    setToast({ mensaje, tipo, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(() => {
      setCargando(true);
      api
        .getProductos(filtros)
        .then((datos) => {
          if (!cancelado) setProductos(datos);
        })
        .catch((err) => {
          if (!cancelado) notify(err.message, 'error');
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }, 220);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [filtros.busqueda, filtros.categoria, refreshKey, notify]);

  useEffect(() => {
    let cancelado = false;
    api
      .getCategorias()
      .then((datos) => {
        if (!cancelado) setCategorias(datos);
      })
      .catch((err) => {
        if (!cancelado) notify(err.message, 'error');
      });
    return () => {
      cancelado = true;
    };
  }, [refreshKey, notify]);

  useEffect(() => {
    setFiltros((actual) =>
      actual.categoria && !categorias.some((categoria) => categoria.nombre === actual.categoria)
        ? { ...actual, categoria: '' }
        : actual
    );
  }, [categorias]);

  const unidadesCarrito = useMemo(
    () => carrito.reduce((suma, item) => suma + item.cantidad, 0),
    [carrito]
  );

  function agregarAlCarrito(producto) {
    if (producto.cantidad <= 0) {
      notify(`No hay stock disponible de "${producto.nombre}"`, 'error');
      return;
    }

    const existente = carrito.find((item) => item.producto.id === producto.id);
    if (existente && existente.cantidad >= producto.cantidad) {
      notify(`Ya agregaste todo el stock disponible de "${producto.nombre}"`, 'error');
      return;
    }

    if (existente) {
      setCarrito(
        carrito.map((item) =>
          item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        )
      );
    } else {
      setCarrito([...carrito, { producto, cantidad: 1 }]);
    }
  }

  function cambiarCantidad(productoId, delta) {
    setCarrito((actual) =>
      actual.map((item) => {
        if (item.producto.id !== productoId) return item;
        const cantidad = Math.min(
          item.producto.cantidad,
          Math.max(1, item.cantidad + delta)
        );
        return { ...item, cantidad };
      })
    );
  }

  function quitarDelCarrito(productoId) {
    setCarrito((actual) => actual.filter((item) => item.producto.id !== productoId));
  }

  function vaciarCarrito() {
    setCarrito([]);
  }

  async function crearProducto(datos) {
    const creado = await api.crearProducto(datos);
    setRefreshKey((valor) => valor + 1);
    notify(`"${creado.nombre}" se agregó al inventario`);
    return creado;
  }

  async function editarProducto(id, datos) {
    const actualizado = await api.actualizarProducto(id, datos);
    setRefreshKey((valor) => valor + 1);
    setCarrito((actual) =>
      actual
        .map((item) =>
          item.producto.id === id
            ? {
                producto: actualizado,
                cantidad: Math.min(item.cantidad, actualizado.cantidad),
              }
            : item
        )
        .filter((item) => item.cantidad > 0)
    );
    notify(`"${actualizado.nombre}" se actualizó correctamente`);
    return actualizado;
  }

  async function eliminarProducto(id) {
    await api.eliminarProducto(id);
    setRefreshKey((valor) => valor + 1);
    setCarrito((actual) => actual.filter((item) => item.producto.id !== id));
    notify('Producto eliminado del inventario');
  }

  async function crearCategoria(nombre) {
    const categoria = await api.crearCategoria(nombre);
    setRefreshKey((valor) => valor + 1);
    notify(`Categoría "${categoria.nombre}" creada`);
    return categoria;
  }

  async function renombrarCategoria(id, nombre) {
    const categoria = await api.actualizarCategoria(id, nombre);
    setRefreshKey((valor) => valor + 1);
    notify(`Categoría renombrada a "${categoria.nombre}"`);
    return categoria;
  }

  async function eliminarCategoria(id) {
    await api.eliminarCategoria(id);
    setRefreshKey((valor) => valor + 1);
    notify('Categoría eliminada');
  }

  async function confirmarVenta(metodoPago) {
    setComprando(true);
    try {
      const venta = await api.crearVenta(
        metodoPago,
        carrito.map(({ producto, cantidad }) => ({ productoId: producto.id, cantidad }))
      );
      setCarrito([]);
      setRefreshKey((valor) => valor + 1);
      setTab('ventas');
      notify(`Venta #${venta.id} registrada por ${formatARS(venta.total)}`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setComprando(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <button
            type="button"
            className="brand"
            onClick={() => setTab('inventario')}
            aria-label="Ir al inventario"
          >
            <span className="brand-logo">
              <IconStore size={22} />
            </span>
            <span className="brand-text">
              <strong>Almacén</strong>
              <small>Gestión de inventario</small>
            </span>
          </button>

          <nav className="tabs" aria-label="Secciones del sistema">
            {TABS.map(({ id, etiqueta, Icono }) => (
              <button
                key={id}
                type="button"
                className={`tab ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
              >
                <Icono size={18} />
                <span>{etiqueta}</span>
                {id === 'carrito' && unidadesCarrito > 0 && (
                  <span className="tab-badge">{unidadesCarrito}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <a
              className="btn btn-secondary btn-sm"
              href={api.exportarDbUrl}
              title="Descargar el archivo SQLite completo"
            >
              <IconDownload size={16} />
              <span className="hide-sm">Descargar base</span>
            </a>
          </div>
        </div>
      </header>

      <main className="app-main">
        {tab === 'inventario' && (
          <Inventario
            productos={productos}
            categorias={categorias}
            filtros={filtros}
            onFiltros={setFiltros}
            cargando={cargando}
            carrito={carrito}
            onAgregar={agregarAlCarrito}
            onCrear={crearProducto}
            onEditar={editarProducto}
            onEliminar={eliminarProducto}
            onIrACategorias={() => setTab('categorias')}
          />
        )}

        {tab === 'carrito' && (
          <Carrito
            carrito={carrito}
            onCambiarCantidad={cambiarCantidad}
            onQuitar={quitarDelCarrito}
            onVaciar={vaciarCarrito}
            onConfirmar={confirmarVenta}
            comprando={comprando}
            onIrAComprar={() => setTab('inventario')}
          />
        )}

        {tab === 'ventas' && <Ventas refreshKey={refreshKey} />}

        {tab === 'categorias' && (
          <Categorias
            categorias={categorias}
            onCrear={crearCategoria}
            onRenombrar={renombrarCategoria}
            onEliminar={eliminarCategoria}
            onIrAInventario={() => setTab('inventario')}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>Datos guardados localmente en SQLite</span>
        <span className="dot">·</span>
        <span>Sistema de almacén</span>
      </footer>

      {toast && (
        <div className={`toast toast-${toast.tipo}`} role="status" key={toast.id}>
          {toast.tipo === 'error' ? <IconAlert size={18} /> : <IconCheck size={18} />}
          <span>{toast.mensaje}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Cerrar aviso"
            onClick={() => setToast(null)}
          >
            <IconX size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
