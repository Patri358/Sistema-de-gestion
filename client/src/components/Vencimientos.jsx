import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import {
  IconAlert,
  IconCalendar,
  IconChevron,
  IconPlus,
  IconTrash,
} from './Icons.jsx';
import { api } from '../api.js';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function fechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function primerDiaMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function diasCalendario(mes) {
  const inicio = primerDiaMes(mes);
  const desplazamiento = (inicio.getDay() + 6) % 7;
  const primerDia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - desplazamiento);
  return Array.from({ length: 42 }, (_, indice) =>
    new Date(primerDia.getFullYear(), primerDia.getMonth(), primerDia.getDate() + indice)
  );
}

function fechaLarga(iso) {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function nombreMes(fecha) {
  return fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export default function Vencimientos({ onAviso }) {
  const [mes, setMes] = useState(() => primerDiaMes(new Date()));
  const [vencimientos, setVencimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [productos, setProductos] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [productoId, setProductoId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(null);
  const [errorGuardar, setErrorGuardar] = useState('');

  const cargar = useCallback(async () => {
    const [datos, catalogo] = await Promise.all([
      api.getVencimientos(),
      api.getProductos(),
    ]);
    setVencimientos(datos);
    setProductos(catalogo);
    return datos;
  }, []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    cargar()
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [cargar]);

  const porFecha = useMemo(() => {
    const agrupados = {};
    vencimientos.forEach((vencimiento) => {
      if (!agrupados[vencimiento.fecha]) agrupados[vencimiento.fecha] = [];
      agrupados[vencimiento.fecha].push(vencimiento);
    });
    return agrupados;
  }, [vencimientos]);

  const productosFiltrados = useMemo(() => {
    const busqueda = busquedaProducto.trim().toLocaleLowerCase('es-AR');
    if (!busqueda) return productos;
    return productos.filter((item) =>
      item.nombre.toLocaleLowerCase('es-AR').includes(busqueda)
    );
  }, [productos, busquedaProducto]);

  const dias = useMemo(() => diasCalendario(mes), [mes]);
  const hoy = fechaISO(new Date());
  const mesActual = mes.getMonth();
  const vencimientosDelDia = fechaSeleccionada ? porFecha[fechaSeleccionada] ?? [] : [];

  function cambiarMes(delta) {
    setMes((actual) => new Date(actual.getFullYear(), actual.getMonth() + delta, 1));
  }

  function abrirDia(iso) {
    setFechaSeleccionada(iso);
    setBusquedaProducto('');
    setProductoId('');
    setErrorGuardar('');
  }

  function cerrarModal() {
    setFechaSeleccionada(null);
    setBusquedaProducto('');
    setProductoId('');
    setErrorGuardar('');
  }

  function handleBusquedaProducto(event) {
    const busqueda = event.target.value;
    setBusquedaProducto(busqueda);
    const seleccionado = productos.find((item) => String(item.id) === String(productoId));
    const sigueSeleccionado =
      seleccionado &&
      seleccionado.nombre.toLocaleLowerCase('es-AR') === busqueda.trim().toLocaleLowerCase('es-AR');
    if (!sigueSeleccionado) setProductoId('');
  }

  function seleccionarProducto(item) {
    setProductoId(String(item.id));
    setBusquedaProducto(item.nombre);
    setErrorGuardar('');
  }

  async function handleGuardar(event) {
    event.preventDefault();
    setErrorGuardar('');
    if (!productoId) {
      setErrorGuardar('Elegí un producto creado');
      return;
    }

    setGuardando(true);
    try {
      const creado = await api.crearVencimiento({
        producto_id: Number(productoId),
        fecha: fechaSeleccionada,
      });
      setVencimientos((actual) => [...actual, creado]);
      setProductoId('');
      onAviso?.(`Vencimiento de ${creado.producto} registrado`);
    } catch (err) {
      setErrorGuardar(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    setEliminando(id);
    try {
      await api.eliminarVencimiento(id);
      setVencimientos((actual) => actual.filter((item) => item.id !== id));
      onAviso?.('Vencimiento eliminado');
    } catch (err) {
      onAviso?.(err.message, 'error');
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div className="vencimientos-page">
      <header className="page-head">
        <div className="page-head-copy">
          <h1>Vencimientos</h1>
          <p>Cargá productos por fecha para ver cuándo vencen en el calendario.</p>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" role="alert">
          <IconAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="card calendario-card" aria-label="Calendario de vencimientos">
        <div className="calendario-toolbar">
          <button
            type="button"
            className="icon-button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
          >
            <IconChevron size={18} className="calendario-flecha-izquierda" />
          </button>
          <h2>{nombreMes(mes)}</h2>
          <div className="calendario-toolbar-acciones">
            <button
              type="button"
              className="icon-button"
              onClick={() => cambiarMes(1)}
              aria-label="Mes siguiente"
            >
              <IconChevron size={18} className="calendario-flecha-derecha" />
            </button>
          </div>
        </div>

        <div className="calendario-semana">
          {DIAS_SEMANA.map((dia) => (
            <span key={dia}>{dia}</span>
          ))}
        </div>

        {cargando ? (
          <div className="calendario-skeleton">
            {Array.from({ length: 6 }, (_, indice) => (
              <span key={indice} />
            ))}
          </div>
        ) : (
          <div className="calendario-grid">
            {dias.map((dia) => {
              const iso = fechaISO(dia);
              const items = porFecha[iso] ?? [];
              const fueraDeMes = dia.getMonth() !== mesActual;
              const clases = [
                'calendario-dia',
                fueraDeMes ? 'fuera-mes' : '',
                iso === hoy ? 'hoy' : '',
                items.length > 0 ? 'con-vencimientos' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={iso}
                  type="button"
                  className={clases}
                  data-fecha={iso}
                  onClick={() => abrirDia(iso)}
                  aria-label={`Ver vencimientos del ${fechaLarga(iso)}`}
                >
                  <span className="calendario-dia-numero">{dia.getDate()}</span>
                  <span className="calendario-dia-items">
                    {items.slice(0, 3).map((item) => (
                      <span className="calendario-chip" key={item.id}>
                        {item.producto}
                      </span>
                    ))}
                    {items.length > 3 && <small>+{items.length - 3} más</small>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {fechaSeleccionada && (
        <Modal
          titulo="Vencimientos"
          subtitulo={fechaLarga(fechaSeleccionada)}
          icono={<IconCalendar size={18} />}
          onCerrar={cerrarModal}
        >
          <div className="vencimiento-lista">
            {vencimientosDelDia.length === 0 ? (
              <p className="proveedor-modal-vacio">No hay productos cargados para esta fecha.</p>
            ) : (
              vencimientosDelDia.map((item) => (
                <div className="vencimiento-item" key={item.id}>
                  <strong>{item.producto}</strong>
                  <button
                    type="button"
                    className="icon-button danger"
                    disabled={eliminando === item.id}
                    onClick={() => handleEliminar(item.id)}
                    aria-label={`Eliminar vencimiento de ${item.producto}`}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleGuardar} className="formulario" id="form-vencimiento">
            <div className="field">
              <label htmlFor="buscar-producto-vencimiento">Producto</label>
              <input
                id="buscar-producto-vencimiento"
                type="search"
                value={busquedaProducto}
                placeholder="Buscar producto por nombre"
                autoFocus
                autoComplete="off"
                onChange={handleBusquedaProducto}
              />
              <div className="vencimiento-productos" id="vencimiento-productos">
                {productosFiltrados.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-producto-id={item.id}
                    aria-pressed={String(item.id) === String(productoId)}
                    onClick={() => seleccionarProducto(item)}
                  >
                    {item.nombre}
                  </button>
                ))}
              </div>
              {productos.length === 0 && (
                <small className="field-help">No hay productos creados todavía.</small>
              )}
              {productos.length > 0 && productosFiltrados.length === 0 && (
                <small className="field-help">No se encontraron productos con ese nombre.</small>
              )}
            </div>
            {errorGuardar && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{errorGuardar}</span>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={cerrarModal}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                <IconPlus size={16} />
                {guardando ? 'Guardando...' : 'Guardar vencimiento'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
