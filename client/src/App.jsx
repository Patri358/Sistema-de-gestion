import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { api, guardarToken, limpiarToken, leerToken } from './api.js';
import Login from './components/Login.jsx';
import Inventario from './components/Inventario.jsx';
import Carrito from './components/Carrito.jsx';
import Ventas from './components/Ventas.jsx';
import Productos from './components/Categorias.jsx';
import StockBajo from './components/StockBajo.jsx';
import Caja from './components/Caja.jsx';
import AbrirCajaModal from './components/AbrirCajaModal.jsx';
import MovimientosStock from './components/MovimientosStock.jsx';
import ConfiguracionModal from './components/ConfiguracionModal.jsx';
import Clientes from './components/Clientes.jsx';
import Proveedores from './components/Proveedores.jsx';
import Vencimientos from './components/Vencimientos.jsx';
import {
  IconAlert,
  IconBox,
  IconCalendar,
  IconChart,
  IconHistory,
  IconLogout,
  IconSettings,
  IconStore,
  IconTag,
  IconTruck,
  IconUsers,
  IconWallet,
} from './components/Icons.jsx';
import {
  esProductoPeso,
  formatARS,
  normalizarProducto,
  stockDisponible,
  subtotalProducto,
  todayLocal,
} from './utils.js';

const TABS = [
  { id: 'inventario', etiqueta: 'Inventario', Icono: IconBox },
  { id: 'stock-bajo', etiqueta: 'Stock bajo', Icono: IconAlert },
  { id: 'movimientos', etiqueta: 'Movimientos de stock', Icono: IconHistory },
  { id: 'estadisticas', etiqueta: 'Estadísticas', Icono: IconChart },
  { id: 'clientes', etiqueta: 'Clientes', Icono: IconUsers },
  { id: 'caja', etiqueta: 'Caja', Icono: IconWallet },
  { id: 'categorias', etiqueta: 'Productos', Icono: IconTag },
  { id: 'proveedores', etiqueta: 'Proveedores', Icono: IconTruck },
  { id: 'vencimientos', etiqueta: 'Vencimientos', Icono: IconCalendar },
];

const SECCIONES_EMPLEADO = [
  'inventario',
  'stock-bajo',
  'clientes',
  'caja',
  'vencimientos',
];

function seccionesPermitidas(usuario) {
  if (!usuario || usuario.rol === 'admin') return TABS.map(({ id }) => id);
  if (usuario.rol === 'empleado' || usuario.rol !== 'encargado') return SECCIONES_EMPLEADO;
  const guardadas = Array.isArray(usuario.permisos) ? usuario.permisos : [];
  return TABS.map(({ id }) => id).filter(
    (id) => SECCIONES_EMPLEADO.includes(id) || guardadas.includes(id)
  );
}

function fechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function correspondeUnAvisoVencimiento(aviso, hoy) {
  if (aviso === 'inicio_mes') return hoy.getDate() === 1;
  if (aviso === 'inicio_semana') return (hoy.getDay() + 6) % 7 === 0;
  return true;
}

function correspondeAvisoVencimiento(avisos, hoy) {
  return avisos.some((aviso) => correspondeUnAvisoVencimiento(aviso, hoy));
}

function vencimientosParaAvisos(vencimientos, avisos, hoy) {
  const rangos = avisos
    .filter((aviso) => correspondeUnAvisoVencimiento(aviso, hoy))
    .map((aviso) => rangoAvisoVencimiento(aviso, hoy));
  return vencimientos.filter((item) =>
    rangos.some((rango) => item.fecha >= rango.desde && item.fecha <= rango.hasta)
  );
}

function rangoAvisoVencimiento(aviso, hoy) {
  if (aviso === 'inicio_mes') {
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return { desde: fechaISO(desde), hasta: fechaISO(hasta) };
  }
  if (aviso === 'inicio_semana') {
    const diaSemana = (hoy.getDay() + 6) % 7;
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - diaSemana);
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 6);
    return { desde: fechaISO(desde), hasta: fechaISO(hasta) };
  }
  const iso = fechaISO(hoy);
  return { desde: iso, hasta: iso };
}

export default function App() {
  const [tab, setTab] = useState('inventario');
  const [productos, setProductos] = useState([]);
  const [productosTodos, setProductosTodos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [stockBajo, setStockBajo] = useState({ productos: [] });
  const [cargandoStockBajo, setCargandoStockBajo] = useState(true);
  const [caja, setCaja] = useState(null);
  const [cargandoCaja, setCargandoCaja] = useState(true);
  const [mostrarApertura, setMostrarApertura] = useState(false);
  const cajaSolicitud = useRef(0);
  const aperturaPreguntada = useRef(false);
  const ultimoAviso = useRef({ mensaje: '', momento: 0 });
  const diaActual = useRef(todayLocal());
  const [filtros, setFiltros] = useState({ busqueda: '', categoria: '' });
  const [carrito, setCarrito] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [comprando, setComprando] = useState(false);
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(() => Boolean(leerToken()));
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [configVencimientos, setConfigVencimientos] = useState({
    avisos: ['dia'],
    borrarStockCero: false,
  });
  const [modoOscuro, setModoOscuro] = useState(() => {
    try {
      const guardado = localStorage.getItem('cstore-tema');
      if (guardado === 'dark' || guardado === 'light') return guardado === 'dark';
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const notify = useCallback((mensaje, tipo = 'success') => {
    const ahora = Date.now();
    if (mensaje === ultimoAviso.current.mensaje && ahora - ultimoAviso.current.momento < 800) {
      return;
    }
    ultimoAviso.current = { mensaje, momento: ahora };
    const tipoToast = tipo === 'error' ? 'error' : 'success';
    toast[mensaje === 'Failed to fetch' ? 'error' : tipoToast](mensaje, {
      className: `toast-${mensaje === 'Failed to fetch' ? 'error' : tipoToast}`,
    });
  }, []);

  const esAdmin = sesion?.rol === 'admin';
  const seccionesVisibles = seccionesPermitidas(sesion);
  const tabsVisibles = TABS.filter(({ id }) => seccionesVisibles.includes(id));

  useEffect(() => {
    if (!leerToken()) {
      setVerificandoSesion(false);
      return undefined;
    }

    let cancelado = false;
    api
      .getSesion()
      .then((datos) => {
        if (!cancelado) setSesion(datos.usuario);
      })
      .catch(() => {
        if (!cancelado) limpiarToken();
      })
      .finally(() => {
        if (!cancelado) setVerificandoSesion(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    function finalizarSesion() {
      limpiarToken();
      setSesion(null);
      setCarrito([]);
      setMostrarConfiguracion(false);
      setMostrarApertura(false);
    }

    window.addEventListener('sesion-expirada', finalizarSesion);
    return () => window.removeEventListener('sesion-expirada', finalizarSesion);
  }, []);

  useEffect(() => {
    function avisarErrorRed() {
      notify('Failed to fetch', 'error');
    }
    window.addEventListener('api-error', avisarErrorRed);
    return () => window.removeEventListener('api-error', avisarErrorRed);
  }, [notify]);

  useEffect(() => {
    if (!sesion) return;
    if (!tabsVisibles.some(({ id }) => id === tab)) setTab('inventario');
  }, [sesion, esAdmin, tab]);

  useEffect(() => {
    if (mostrarConfiguracion && esAdmin) cargarUsuarios();
  }, [mostrarConfiguracion, esAdmin]);

  useEffect(() => {
    if (!sesion) return undefined;
    let cancelado = false;
    api
      .getConfigVencimientos()
      .then((datos) => {
        if (!cancelado) setConfigVencimientos(datos);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [sesion]);

  const avisosVencimientosKey = configVencimientos.avisos.join(',');

  useEffect(() => {
    if (!sesion) return undefined;
    let cancelado = false;

    async function revisarAvisos() {
      const ahora = new Date();
      const avisosActuales = configVencimientos.avisos;
      if (!correspondeAvisoVencimiento(avisosActuales, ahora)) return;
      const dia = todayLocal();
      const claveAviso = `aviso-venc-${dia}-${[...avisosActuales].sort().join('-')}`;
      if (sessionStorage.getItem(claveAviso)) return;

      try {
        const [config, vencimientos] = await Promise.all([
          api.getConfigVencimientos(),
          api.getVencimientos(),
        ]);
        if (cancelado) return;
        if (!correspondeAvisoVencimiento(config.avisos, ahora)) return;
        const proximos = vencimientosParaAvisos(vencimientos, config.avisos, ahora);
        if (proximos.length === 0) return;
        sessionStorage.setItem(claveAviso, '1');
        const nombres = proximos.slice(0, 3).map((item) => item.producto).join(', ');
        notify(
          `Hay ${proximos.length} ${proximos.length === 1 ? 'producto por vencer' : 'productos por vencer'}: ${nombres}${proximos.length > 3 ? '...' : ''}`
        );
      } catch {
        if (!cancelado) notify('No se pudieron cargar los avisos de vencimientos', 'error');
      }
    }

    revisarAvisos();
    const timer = setInterval(revisarAvisos, 60000);
    window.addEventListener('focus', revisarAvisos);
    return () => {
      cancelado = true;
      clearInterval(timer);
      window.removeEventListener('focus', revisarAvisos);
    };
  }, [sesion, avisosVencimientosKey, notify]);

  useEffect(() => {
    const tema = modoOscuro ? 'dark' : 'light';
    document.documentElement.dataset.theme = tema;
    try {
      localStorage.setItem('cstore-tema', tema);
    } catch {}
  }, [modoOscuro]);

  useEffect(() => {
    if (!sesion) return undefined;
    let cancelado = false;
    const timer = setTimeout(() => {
      setCargando(true);
      api
        .getProductos(filtros)
        .then((datos) => {
          if (!cancelado) setProductos(datos.map(normalizarProducto));
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
  }, [filtros.busqueda, filtros.categoria, refreshKey, notify, sesion]);

  useEffect(() => {
    if (!sesion) return undefined;
    let cancelado = false;
    api
      .getProductos({})
      .then((datos) => {
        if (!cancelado) setProductosTodos(datos.map(normalizarProducto));
      })
      .catch((err) => {
        if (!cancelado) notify(err.message, 'error');
      });
    return () => {
      cancelado = true;
    };
  }, [refreshKey, notify, sesion]);

  useEffect(() => {
    if (!sesion) return undefined;
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
  }, [refreshKey, notify, sesion]);

  useEffect(() => {
    if (!sesion) return undefined;
    let cancelado = false;
    setCargandoStockBajo(true);
    api
      .getStockBajo()
      .then((datos) => {
          if (!cancelado) {
            setStockBajo({
              ...datos,
              productos: (datos.productos ?? []).map(normalizarProducto),
            });
          }
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
  }, [refreshKey, notify, sesion]);

  useEffect(() => {
    if (!sesion) return undefined;
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
  }, [refreshKey, notify, sesion]);

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
    const normalizado = normalizarProducto(producto);
    const peso = esProductoPeso(normalizado);
    const etiqueta = peso ? 'g' : 'unidades';
    if (Number(normalizado.activo) === 0) {
      notify(`"${normalizado.nombre}" está deshabilitado y no se puede vender`, 'error');
      return 0;
    }

    const totalDisponible = stockDisponible(normalizado);
    if (totalDisponible <= 0) {
      notify(`No hay stock disponible de "${normalizado.nombre}"`, 'error');
      return 0;
    }

    const existente = carrito.find((item) => item.producto.id === normalizado.id);
    const enCarrito = existente?.cantidad ?? 0;
    const disponible = totalDisponible - enCarrito;
    if (disponible <= 0) {
      notify(`Ya agregaste todo el stock disponible de "${normalizado.nombre}"`, 'error');
      return 0;
    }

    const solicitada = Math.max(1, Math.floor(Number(cantidadSolicitada) || 1));
    const agregar = Math.min(solicitada, disponible);

    setCarrito((actual) => {
      const item = actual.find(({ producto: actualProducto }) => actualProducto.id === normalizado.id);
      if (item) {
        return actual.map((actualItem) =>
          actualItem.producto.id === normalizado.id
            ? { ...actualItem, cantidad: actualItem.cantidad + agregar }
            : actualItem
        );
      }
      return [...actual, { producto: normalizado, cantidad: agregar }];
    });

    if (agregar < solicitada) {
      notify(
        `Solo quedaban ${disponible} ${etiqueta} de "${normalizado.nombre}". Se agregaron ${agregar}.`,
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
          stockDisponible(item.producto),
          Math.max(1, item.cantidad + delta)
        );
        return { ...item, cantidad };
      })
    );
  }

  function fijarCantidad(productoId, valor) {
    if (valor === '' || valor === null || valor === undefined) return;
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return;
    setCarrito((actual) =>
      actual.map((item) => {
        if (item.producto.id !== productoId) return item;
        const cantidad = Math.min(
          stockDisponible(item.producto),
          Math.max(1, Math.floor(numero))
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
    const creado = normalizarProducto(await api.crearProducto(datos));
    setRefreshKey((valor) => valor + 1);
    notify(`Producto ${creado.nombre} creado con exito`);
    return creado;
  }

  async function editarProducto(id, datos) {
    const anterior = productosTodos.find((producto) => producto.id === id);
    const actualizado = normalizarProducto(await api.actualizarProducto(id, datos));
    setRefreshKey((valor) => valor + 1);
    setCarrito((actual) =>
      actual
        .map((item) =>
          item.producto.id === id
            ? {
                producto: actualizado,
                cantidad: Math.min(item.cantidad, stockDisponible(actualizado)),
              }
            : item
        )
        .filter(
          (item) =>
            item.cantidad > 0 &&
            item.producto.tipo === actualizado.tipo &&
            Number(actualizado.activo) !== 0
        )
    );
    const cambioStock =
      anterior && Number(anterior.cantidad) !== Number(actualizado.cantidad);
    notify(
      cambioStock
        ? 'Stock actualizado con exito'
        : `Producto ${actualizado.nombre} editado con exito`
    );
    return actualizado;
  }

  async function alternarActivoProducto(id) {
    const anterior = productosTodos.find((producto) => producto.id === id);
    if (!anterior) return undefined;

    const activo = Number(anterior.activo) === 0;
    try {
      const actualizado = normalizarProducto(
        await api.actualizarProducto(id, {
          nombre: anterior.nombre,
          categoria: anterior.categoria,
          precio: anterior.precio,
          cantidad: anterior.cantidad,
          stock_minimo: anterior.stock_minimo ?? 10,
          codigo_barras: anterior.codigo_barras ?? '',
          imagen: anterior.imagen ?? null,
          activo,
          tipo: anterior.tipo,
          gramosPorUnidad: anterior.gramosPorUnidad ?? null,
        })
      );
      setRefreshKey((valor) => valor + 1);
      setCarrito((items) =>
        items.filter((item) => item.producto.id !== id || activo)
      );
      notify(
        activo
          ? `Producto ${actualizado.nombre} habilitado con exito`
          : `Producto ${actualizado.nombre} deshabilitado con exito`
      );
      return actualizado;
    } catch (err) {
      notify(err.message, 'error');
      throw err;
    }
  }

  async function eliminarProducto(id) {
    const producto = productosTodos.find((item) => item.id === id);
    await api.eliminarProducto(id);
    setRefreshKey((valor) => valor + 1);
    setCarrito((actual) => actual.filter((item) => item.producto.id !== id));
    notify(`Producto ${producto?.nombre ?? id} eliminado con exito`);
  }

  async function crearCategoria(nombre) {
    const categoria = await api.crearCategoria(nombre);
    setRefreshKey((valor) => valor + 1);
    notify(`Categoria ${categoria.nombre} creada con exito`);
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
    notify('Buenos dias, caja abierta');
    return datos;
  }

  async function retirarCaja(monto, motivo) {
    const datos = await api.retirarCaja(monto, motivo);
    cajaSolicitud.current += 1;
    setCaja(datos);
    setCargandoCaja(false);
    notify('Dinero retirado con exito');
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

  async function cargarUsuarios() {
    setCargandoUsuarios(true);
    try {
      const datos = await api.getUsuarios();
      setUsuarios(datos.usuarios);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setCargandoUsuarios(false);
    }
  }

  async function crearUsuario(datos) {
    const creado = await api.crearUsuario(datos);
    await cargarUsuarios();
    notify('Usuario creado con exito');
    return creado;
  }

  async function actualizarUsuario(id, datos) {
    const actualizado = await api.actualizarUsuario(id, datos);
    if (id === sesion?.id) setSesion(actualizado);
    await cargarUsuarios();
    notify(`Usuario "${actualizado.nombre}" actualizado`);
    return actualizado;
  }

  async function eliminarUsuario(id) {
    await api.eliminarUsuario(id);
    await cargarUsuarios();
    notify('Usuario eliminado');
  }

  async function descargarBase() {
    try {
      await api.descargarBase();
      notify('Base de datos descargada');
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function guardarConfigVencimientos(datos) {
    const guardado = await api.guardarConfigVencimientos(datos);
    setConfigVencimientos(guardado);
    notify('Cambios guardados');
    return guardado;
  }

  async function iniciarSesion(usuario, password) {
    const datos = await api.login(usuario, password);
    guardarToken(datos.token);
    setSesion(datos.usuario);
    setTab('inventario');
    setCarrito([]);
    setRefreshKey((valor) => valor + 1);
  }

  function cerrarSesion() {
    limpiarToken();
    setSesion(null);
    setCarrito([]);
    setMostrarConfiguracion(false);
    setMostrarApertura(false);
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
      await api.crearVenta(
        metodoPago,
        carrito.map(({ producto, cantidad }) => ({ productoId: producto.id, cantidad })),
        opciones
      );
      setCarrito([]);
      setRefreshKey((valor) => valor + 1);
      notify('Felicitaciones por la venta');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setComprando(false);
    }
  }

  if (verificandoSesion) {
    return (
      <div className="login-page">
        <div className="login-card login-cargando">Verificando sesión...</div>
      </div>
    );
  }

  if (!sesion) {
    return <Login onIngresar={iniciarSesion} />;
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
              <strong>C-Store POS</strong>
              <small>Gestión de inventario</small>
            </span>
          </button>

          <div className="header-actions">
            <span className="header-usuario" title={`Rol: ${esAdmin ? 'Admin' : 'Empleado'}`}>
              <strong>{sesion.nombre}</strong>
              <small>{esAdmin ? 'Admin' : 'Empleado'}</small>
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={cerrarSesion}
              title="Cerrar sesión"
            >
              <IconLogout size={16} />
              <span className="hide-sm">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <nav className="tabs" aria-label="Secciones del sistema">
            {tabsVisibles.map(({ id, etiqueta, Icono }) => (
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

            <button
              type="button"
              className={`tab ${mostrarConfiguracion ? 'active' : ''}`}
              onClick={() => setMostrarConfiguracion(true)}
              aria-label="Abrir configuración"
            >
              <IconSettings size={18} />
              <span>Configuración</span>
            </button>
          </nav>
        </aside>

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
              onIrAProductos={esAdmin ? () => setTab('categorias') : undefined}
            />
            <Carrito
              carrito={carrito}
              onCambiarCantidad={cambiarCantidad}
              onFijarCantidad={fijarCantidad}
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
            onIrAInventario={() => setTab('inventario')}
            onIrAMovimientos={
              seccionesVisibles.includes('movimientos') ? () => setTab('movimientos') : null
            }
          />
        )}

        {tab === 'movimientos' && <MovimientosStock refreshKey={refreshKey} />}

        {tab === 'estadisticas' && <Ventas refreshKey={refreshKey} onEditarVenta={editarVenta} />}

        {tab === 'clientes' && (
          <Clientes onAviso={notify} onCambio={() => setRefreshKey((valor) => valor + 1)} />
        )}

        {tab === 'caja' && (
          <Caja
            datos={caja}
            cargando={cargandoCaja}
            onSolicitarApertura={() => setMostrarApertura(true)}
            onRetirarCaja={retirarCaja}
            onCerrarCaja={cerrarCaja}
          />
        )}

        {tab === 'categorias' && (
          <Productos
            productos={productosTodos}
            categorias={categorias}
            cargando={cargando}
            onCrearProducto={crearProducto}
            onEditarProducto={editarProducto}
            onEliminarProducto={eliminarProducto}
            onAlternarActivo={alternarActivoProducto}
            onCrearCategoria={crearCategoria}
            onRenombrarCategoria={renombrarCategoria}
            onEliminarCategoria={eliminarCategoria}
            onIrAInventario={() => setTab('inventario')}
          />
        )}

        {tab === 'proveedores' && <Proveedores onAviso={notify} />}

        {tab === 'vencimientos' && <Vencimientos onAviso={notify} />}
        </main>
      </div>

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

      {mostrarConfiguracion && (
        <ConfiguracionModal
          modoOscuro={modoOscuro}
          onCambiarModo={setModoOscuro}
          esAdmin={esAdmin}
          usuarioActual={sesion}
          usuarios={usuarios}
          cargandoUsuarios={cargandoUsuarios}
          onCreate={crearUsuario}
          onUpdate={actualizarUsuario}
          onDelete={eliminarUsuario}
          onDescargarBase={descargarBase}
          configVencimientos={configVencimientos}
          onGuardarConfigVencimientos={guardarConfigVencimientos}
          onCerrar={() => setMostrarConfiguracion(false)}
        />
      )}

      <ToastContainer
        position="top-right"
        autoClose={3600}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        theme={modoOscuro ? 'dark' : 'light'}
      />
    </div>
  );
}
