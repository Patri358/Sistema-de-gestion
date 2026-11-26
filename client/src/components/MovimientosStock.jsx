import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../api.js';
import IngresoMercaderiaModal from './IngresoMercaderiaModal.jsx';
import BajaProductoModal from './BajaProductoModal.jsx';
import {
  IconAlert,
  IconHistory,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconTruck,
} from './Icons.jsx';
import { formatFechaCorta, formatHora } from '../utils.js';

const TIPOS = {
  ajuste: 'Ajuste manual',
  alta: 'Alta de producto',
  venta: 'Venta',
  edicion_venta: 'Edición de venta',
};

export default function MovimientosStock({ refreshKey }) {
  const [movimientos, setMovimientos] = useState([]);
  const [ingresos, setIngresos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [mostrandoIngreso, setMostrandoIngreso] = useState(false);
  const [mostrandoBaja, setMostrandoBaja] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');

    Promise.all([api.getMovimientosStock(productoId), api.getProductos()])
      .then(([datos, listaProductos]) => {
        if (cancelado) return;
        setMovimientos(datos.movimientos ?? []);
        setIngresos(datos.ingresos ?? []);
        setProductos(listaProductos);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [productoId, refreshKey, recarga]);

  const productoElegido = productos.find((producto) => producto.id === Number(productoId));

  async function registrarIngreso(items) {
    await api.registrarIngresoMercaderia(items);
    toast.success('Ingreso de mercadería registrado');
    setRecarga((valor) => valor + 1);
  }

  async function registrarBaja(datos) {
    await api.darBajaProducto(datos);
    toast.success('Baja registrada');
    setRecarga((valor) => valor + 1);
  }

  function unidadProducto(productoIdItem) {
    const producto = productos.find((item) => item.id === productoIdItem);
    return producto?.tipo === 'peso' ? 'g' : 'u.';
  }

  return (
    <div className="movimientos-page">
      <div className="page-head">
        <div>
          <h1>Movimientos de stock</h1>
          <p>
            Historial de entradas y salidas con el motivo, la fecha y la hora de cada cambio.
          </p>
        </div>

        <div className="movimientos-controls">
          <div className="movimientos-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setMostrandoIngreso(true)}
            >
              <IconPlus size={15} /> Ingreso de mercadería
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={() => setMostrandoBaja(true)}
            >
              <IconTrash size={15} /> Dar de baja un producto
            </button>
          </div>
          <div className="field">
            <label htmlFor="movimientos-producto">Producto</label>
            <select
              id="movimientos-producto"
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
            >
              <option value="">Todos los productos</option>
              {productos.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRecarga((valor) => valor + 1)}
          >
            <IconRefresh size={16} /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <IconAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="card movimientos-card">
        <div className="movimientos-card-head">
          <div>
            <h2>{productoElegido ? productoElegido.nombre : 'Últimos movimientos'}</h2>
            <small>
              {productoElegido
                ? `Stock actual: ${productoElegido.cantidad} unidades`
                : 'Se muestran los 500 movimientos más recientes'}
            </small>
          </div>
          <span className="count-pill">
            {movimientos.length} {movimientos.length === 1 ? 'movimiento' : 'movimientos'}
          </span>
        </div>

        {cargando ? (
          <div className="movimientos-lista">
            {Array.from({ length: 4 }).map((_, indice) => (
              <div key={indice} className="movimiento-row skeleton-movimiento" />
            ))}
          </div>
        ) : movimientos.length === 0 ? (
          <div className="empty-state inline">
            <span className="empty-icon">
              <IconHistory size={26} />
            </span>
            <h3>No hay movimientos para mostrar</h3>
            <p>
              Los ajustes de stock y las ventas van a quedar registrados acá automáticamente.
            </p>
          </div>
        ) : (
          <div className="movimientos-lista">
            <div className="movimiento-row movimiento-row-head" aria-hidden="true">
              <span>Fecha y hora</span>
              <span>Producto</span>
              <span>Motivo</span>
              <span className="movimiento-cantidad-head">Stock</span>
            </div>
            {movimientos.map((movimiento) => (
              <div className="movimiento-row" key={movimiento.id}>
                <div className="movimiento-fecha">
                  <strong>{formatFechaCorta(movimiento.dia)}</strong>
                  <small>{formatHora(movimiento.fecha)}</small>
                </div>
                <div className="movimiento-producto">
                  <strong>{movimiento.productoNombre}</strong>
                  <small>{TIPOS[movimiento.tipo] ?? movimiento.tipo}</small>
                </div>
                <div className="movimiento-motivo" title={movimiento.motivo}>
                  {movimiento.motivo}
                </div>
                <div
                  className={`movimiento-cantidad ${
                    movimiento.delta > 0 ? 'ingreso' : 'egreso'
                  }`}
                >
                  <strong>
                    {movimiento.delta > 0 ? '+' : ''}
                    {movimiento.delta}
                  </strong>
                  <small>
                    {movimiento.cantidadAnterior} → {movimiento.cantidadNueva}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card movimientos-card" id="ingresos-por-lote">
        <div className="movimientos-card-head">
          <div>
            <h2>Ingresos por lote</h2>
            <small>
              {productoElegido
                ? `Lotes que incluyen ${productoElegido.nombre}`
                : 'Se muestran los 100 lotes más recientes'}
            </small>
          </div>
          <span className="count-pill">
            {ingresos.length} {ingresos.length === 1 ? 'lote' : 'lotes'}
          </span>
        </div>

        {cargando ? (
          <div className="movimientos-lista">
            {Array.from({ length: 2 }).map((_, indice) => (
              <div key={indice} className="movimiento-row skeleton-movimiento" />
            ))}
          </div>
        ) : ingresos.length === 0 ? (
          <div className="empty-state inline">
            <span className="empty-icon">
              <IconTruck size={26} />
            </span>
            <h3>No hay ingresos registrados</h3>
            <p>
              Usá <strong>Ingreso de mercadería</strong> para cargar lotes nuevos en el stock.
            </p>
          </div>
        ) : (
          <div className="lotes-lista">
            {ingresos.map((lote) => (
              <article className="lote-card" key={lote.loteId ?? lote.fecha}>
                <div className="lote-card-head">
                  <strong>
                    Lote #{lote.loteId ?? '—'} · {formatFechaCorta(lote.dia)}
                  </strong>
                  <small>{formatHora(lote.fecha)}</small>
                </div>
                <div className="lote-items">
                  {lote.items.map((item, indice) => (
                    <div className="lote-item" key={`${lote.loteId}-${item.productoId}-${indice}`}>
                      <span className="lote-item-producto">{item.producto}</span>
                      <span className="lote-item-cantidad">
                        +{item.cantidad} {unidadProducto(item.productoId)}
                      </span>
                      <span className="lote-item-vencimiento">
                        {item.fechaVencimiento
                          ? `Vence ${formatFechaCorta(item.fechaVencimiento)}`
                          : 'Sin vencimiento'}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {mostrandoIngreso && (
        <IngresoMercaderiaModal
          productos={productos}
          onGuardar={registrarIngreso}
          onCerrar={() => setMostrandoIngreso(false)}
        />
      )}

      {mostrandoBaja && (
        <BajaProductoModal
          productos={productos}
          onGuardar={registrarBaja}
          onCerrar={() => setMostrandoBaja(false)}
        />
      )}
    </div>
  );
}
