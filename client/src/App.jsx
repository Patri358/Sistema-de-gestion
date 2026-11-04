import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Inventario from './components/Inventario.jsx';
import Carrito from './components/Carrito.jsx';
import Ventas from './components/Ventas.jsx';
import Categorias from './components/Categorias.jsx';
import StockBajo from './components/StockBajo.jsx';
import Caja from './components/Caja.jsx';
import AbrirCajaModal from './components/AbrirCajaModal.jsx';
import {
  IconAlert,
  IconBox,
  IconCheck,
  IconDownload,
  IconReceipt,
  IconStore,
  IconTag,
  IconWallet,
  IconX,
} from './components/Icons.jsx';
import { formatARS, todayLocal } from './utils.js';

const TABS = [
  { id: 'inventario', etiqueta: 'Inventario', Icono: IconBox },
  { id: 'stock-bajo', etiqueta: 'Stock bajo', Icono: IconAlert },
  { id: 'ventas', etiqueta: 'Ventas', Icono: IconReceipt },
  { id: 'caja', etiqueta: 'Caja', Icono: IconWallet },
  { id: 'categorias', etiqueta: 'Categorías', Icono: IconTag },
];

export default function App() {
  const [tab, setTab] = useState('inventario');
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [stockBajo, setStockBajo] = useState({ limite: 10, productos: [] });
  const [cargandoStockBajo, setCargandoStockBajo] = useState(true);
  const [caja, setCaja] = useState(null);
  const [cargandoCaja, setCargandoCaja] = useState(true);
  const [mostrarApertura, setMostrarApertura] = useState(false);
  const cajaSolicitud = useRef(0);
  const aperturaPreguntada = useRef(false);
  const diaActual = useRef(todayLocal());
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
    let cancelado = false;
    setCargandoStockBajo(true);
    api
      .getStockBajo()
      .then((datos) => {
        if (!cancelado) setStockBajo(datos);
      })
      .catch((err) => {
        if (!cancelado) notify(err.message, 'error');
      })
      .finally(() => {
        if (!cancelado) setCargandoStockBajo(false);
      });

    return () => {
      cancelado = true;
    };
  }, [refreshKey, notify]);

  useEffect(() => {
    let cancelado = false;
    const solicitud = cajaSolicitud.current + 1;
    cajaSolicitud.current = solicitud;
    setCargandoCaja(true);
    api
      .getCaja()
      .then((datos) => {
        if (cancelado || solicitud !== cajaSolicitud.current) return;
        setCaja(datos);
        if (!datos.caja && (datos.sesiones?.length ?? 0) === 0 && !aperturaPreguntada.current) {
          aperturaPreguntada.current = true;
          setMostrarApertura(true);
        }
      })
      .catch((err) => {
        if (!cancelado && solicitud === cajaSolicitud.current) notify(err.message, 'error');
      })
      .finally(() => {
        if (!cancelado && solicitud === cajaSolicitud.current) setCargandoCaja(false);
      });

    return () => {
      cancelado = true;
    };
  }, [refreshKey, notify]);

  useEffect(() => {
    function revisarCambioDeDia() {
      const hoy = todayLocal();
      if (hoy === diaActual.current) return;
      diaActual.current = hoy;
      aperturaPreguntada.current = false;
      setMostrarApertura(false);
      setRefreshKey((valor) => valor + 1);
    }

    const timer = setInterval(revisarCambioDeDia, 60000);
    window.addEventListener('focus', revisarCambioDeDia);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', revisarCambioDeDia);
    };
  }, []);

  useEffect(() => {
    setFiltros((actual) =>
      actual.categoria && !categorias.some((categoria) => categoria.nombre === actual.categoria)
        ? { ...actual, categoria: '' }
        : actual
    );
  }, [categorias]);

  function agregarAlCarrito(producto, cantidadSolicitada = 1) {
    if (Number(producto.activo) === 0) {
      notify(`"${producto.nombre}" está deshabilitado y no se puede vender`, 'error');
      return 0;
    }
    if (producto.cantidad <= 0) {
      notify(`No hay stock disponible de "${producto.nombre}"`, 'error');
      return 0;
    }

    const existente = carrito.find((item) => item.producto.id === producto.id);
    const enCarrito = existente?.cantidad ?? 0;
    const disponible = producto.cantidad - enCarrito;
    if (disponible <= 0) {
      notify(`Ya agregaste todo el stock disponible de "${producto.nombre}"`, 'error');
      return 0;
    }

    const solicitada = Math.max(1, Math.floor(Number(cantidadSolicitada) || 1));
    const agregar = Math.min(solicitada, disponible);

    setCarrito((actual) => {
      const item = actual.find(({ producto: actualProducto }) => actualProducto.id === producto.id);
      if (item) {
        return actual.map((actualItem) =>
          actualItem.producto.id === producto.id
            ? { ...actualItem, cantidad: actualItem.cantidad + agregar }
            : actualItem
        );
      }
      return [...actual, { producto, cantidad: agregar }];
    });

    if (agregar < solicitada) {
      notify(
        `Solo quedaban ${disponible} unidades de "${producto.nombre}". Se agregaron ${agregar}.`,
        'error'
      );
    }
    return agregar;
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
        .filter((item) => item.cantidad > 0 && Number(actualizado.activo) !== 0)
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

  async function abrirCaja(montoApertura) {
    const datos = await api.abrirCaja(montoApertura);
    cajaSolicitud.current += 1;
    setCaja(datos);
    setCargandoCaja(false);
    setMostrarApertura(false);
    notify(`Caja abierta con ${formatARS(datos.caja.montoApertura)}`);
    return datos;
  }

  async function cerrarCaja(montoCierre) {
    const datos = await api.cerrarCaja(montoCierre);
    cajaSolicitud.current += 1;
    setCaja(datos);
    setCargandoCaja(false);
    const diferencia = datos.resumen.diferencia ?? 0;
    notify(
      diferencia === 0
        ? 'Caja cerrada sin diferencias'
        : `Caja cerrada. Diferencia: ${diferencia > 0 ? '+' : ''}${formatARS(diferencia)}`,
      diferencia < 0 ? 'error' : 'success'
    );
    return datos;
  }

  async function editarVenta(id, metodoPago, items, opciones) {
    const actualizada = await api.actualizarVenta(id, metodoPago, items, opciones);
    setRefreshKey((valor) => valor + 1);
    notify(`Venta #${id} actualizada por ${formatARS(actualizada.total)}`);
    return actualizada;
  }

  async function confirmarVenta(metodoPago, opciones = {}) {
    if (!caja?.abierta) {
      notify(
        caja?.cerrada
          ? 'La caja de hoy está cerrada. No se pueden registrar más ventas'
          : 'Primero abrí la caja del día para registrar ventas',
        'error'
      );
      return;
    }

    setComprando(true);
    try {
      const venta = await api.crearVenta(
        metodoPago,
        carrito.map(({ producto, cantidad }) => ({ productoId: producto.id, cantidad })),
        opciones
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
              <strong>Almacén Nona Nene</strong>
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
                {id === 'inventario' && carrito.length > 0 && (
                  <span className="tab-badge">
                    {carrito.reduce((suma, item) => suma + item.cantidad, 0)}
                  </span>
                )}
                {id === 'stock-bajo' && stockBajo.productos.length > 0 && (
                  <span className="tab-badge warning">{stockBajo.productos.length}</span>
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
          <div className="inventario-layout">
            <Inventario
              productos={productos}
              categorias={categorias}
              filtros={filtros}
              onFiltros={setFiltros}
              cargando={cargando}
              carrito={carrito}
              onAgregar={agregarAlCarrito}
              onEditar={editarProducto}
              onEliminar={eliminarProducto}
              onIrACategorias={() => setTab('categorias')}
            />
            <Carrito
              carrito={carrito}
              onCambiarCantidad={cambiarCantidad}
              onQuitar={quitarDelCarrito}
              onVaciar={vaciarCarrito}
              onConfirmar={confirmarVenta}
              comprando={comprando}
              cajaAbierta={Boolean(caja?.abierta)}
              cajaEstado={caja?.abierta ? 'abierta' : caja?.cerrada ? 'cerrada' : 'sin-abrir'}
              onIrACaja={() => setTab('caja')}
            />
          </div>
        )}

        {tab === 'stock-bajo' && (
          <StockBajo
            datos={stockBajo}
            cargando={cargandoStockBajo}
            categorias={categorias}
            onEditar={editarProducto}
            onIrAInventario={() => setTab('inventario')}
          />
        )}

        {tab === 'ventas' && <Ventas refreshKey={refreshKey} onEditarVenta={editarVenta} />}

        {tab === 'caja' && (
          <Caja
            datos={caja}
            cargando={cargandoCaja}
            onSolicitarApertura={() => setMostrarApertura(true)}
            onCerrarCaja={cerrarCaja}
          />
        )}

        {tab === 'categorias' && (
          <Categorias
            categorias={categorias}
            onCrear={crearCategoria}
            onRenombrar={renombrarCategoria}
            onEliminar={eliminarCategoria}
            onCrearProducto={crearProducto}
            onIrAInventario={() => setTab('inventario')}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>Datos guardados localmente en SQLite</span>
        <span className="dot">·</span>
        <span>Sistema de almacén</span>
      </footer>

      {mostrarApertura && !caja?.caja && (
        <AbrirCajaModal
          sugerencia={caja?.sugerenciaApertura ?? 0}
          onAbrir={abrirCaja}
          onCerrar={() => setMostrarApertura(false)}
        />
      )}

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
