import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GraficoVentas from './GraficoVentas.jsx';
import EditarVentaModal from './EditarVentaModal.jsx';
import {
  IconBox,
  IconChevron,
  IconDownload,
  IconEdit,
  IconReceipt,
  IconRefresh,
  IconWallet,
} from './Icons.jsx';
import {
  etiquetaPeriodo,
  formatARS,
  formatFechaCorta,
  formatHora,
  todayLocal,
} from '../utils.js';

const PERIODOS = [
  { id: 'dia', etiqueta: 'Día' },
  { id: 'mes', etiqueta: 'Mes' },
  { id: 'anio', etiqueta: 'Año' },
];

export default function Ventas({ refreshKey, onEditarVenta }) {
  const ahora = new Date();
  const hoy = todayLocal();
  const mesActual = hoy.slice(0, 7);
  const anioActual = String(ahora.getFullYear());

  const [periodo, setPeriodo] = useState('dia');
  const [valor, setValor] = useState(hoy);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ventaAbierta, setVentaAbierta] = useState(null);
  const [ventaEditando, setVentaEditando] = useState(null);
  const [recarga, setRecarga] = useState(0);

  const valorActual = periodo === 'dia' ? hoy : periodo === 'mes' ? mesActual : anioActual;

  useEffect(() => {
    if (!valor || (periodo === 'anio' && !/^\d{4}$/.test(valor))) {
      setCargando(false);
      return undefined;
    }

    let cancelado = false;
    setCargando(true);
    setError('');
    setVentaAbierta(null);

    api
      .getVentas(periodo, valor)
      .then((respuesta) => {
        if (!cancelado) setDatos(respuesta);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err.message);
          setDatos(null);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [periodo, valor, refreshKey, recarga]);

  function cambiarPeriodo(nuevo) {
    if (nuevo === periodo) return;
    setPeriodo(nuevo);
    setValor(nuevo === 'dia' ? hoy : nuevo === 'mes' ? mesActual : anioActual);
  }

  const etiqueta = etiquetaPeriodo(periodo, valor);
  const totalPeriodo = datos?.totalPeriodo ?? 0;
  const cantidadVentas = datos?.cantidadVentas ?? 0;
  const unidades = datos?.unidades ?? 0;
  const series = datos?.series ?? [];
  const ticketPromedio = cantidadVentas > 0 ? totalPeriodo / cantidadVentas : 0;
  const nombreDetalle = periodo === 'dia' ? 'Detalle del día' : periodo === 'mes' ? 'Detalle del mes' : 'Detalle del año';

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ventas</h1>
          <p>Consultá las ventas por día, mes o año, el total ganado y cómo se distribuyeron.</p>
        </div>

        <div className="ventas-controls">
          <div className="periodo-selector" role="group" aria-label="Período de las ventas">
            {PERIODOS.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                className={`periodo-btn ${periodo === opcion.id ? 'active' : ''}`}
                aria-pressed={periodo === opcion.id}
                onClick={() => cambiarPeriodo(opcion.id)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>

          {periodo === 'dia' && (
            <input
              type="date"
              value={valor}
              max={hoy}
              aria-label="Fecha de las ventas"
              onChange={(e) => setValor(e.target.value)}
            />
          )}
          {periodo === 'mes' && (
            <input
              type="month"
              value={valor}
              max={mesActual}
              aria-label="Mes de las ventas"
              onChange={(e) => setValor(e.target.value)}
            />
          )}
          {periodo === 'anio' && (
            <input
              type="number"
              min="2000"
              max={anioActual}
              step="1"
              value={valor}
              aria-label="Año de las ventas"
              className="year-input"
              onChange={(e) => setValor(e.target.value)}
            />
          )}

          {valor !== valorActual && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setValor(valorActual)}
            >
              Actual
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRecarga((numero) => numero + 1)}
            title="Actualizar ventas"
          >
            <IconRefresh size={16} /> Actualizar
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <article className="card stat-card stat-money">
          <span className="stat-icon">
            <IconWallet size={22} />
          </span>
          <div>
            <p>Total ganado</p>
            <strong>{formatARS(totalPeriodo)}</strong>
            <small className="capitalize">{etiqueta}</small>
          </div>
        </article>

        <article className="card stat-card">
          <span className="stat-icon blue">
            <IconReceipt size={22} />
          </span>
          <div>
            <p>Ventas</p>
            <strong>{cantidadVentas}</strong>
            <small>ticket promedio {formatARS(ticketPromedio)}</small>
          </div>
        </article>

        <article className="card stat-card">
          <span className="stat-icon amber">
            <IconBox size={22} />
          </span>
          <div>
            <p>Unidades vendidas</p>
            <strong>{unidades}</strong>
            <small>productos vendidos en el período</small>
          </div>
        </article>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <GraficoVentas series={series} periodo={periodo} etiqueta={etiqueta} cargando={cargando} />

      <div className="card ventas-card">
        <div className="ventas-card-head">
          <h2>{nombreDetalle}</h2>
          <span>{etiqueta}</span>
        </div>

        {cargando ? (
          <div className="ventas-lista">
            {Array.from({ length: 3 }).map((_, indice) => (
              <div key={indice} className="venta-row skeleton-venta" />
            ))}
          </div>
        ) : !datos || datos.ventas.length === 0 ? (
          <div className="empty-state inline">
            <span className="empty-icon">
              <IconReceipt size={28} />
            </span>
            <h3>No hay ventas en este período</h3>
            <p>Las compras confirmadas desde el carrito van a aparecer acá.</p>
          </div>
        ) : (
          <div className="ventas-lista">
            {datos.ventas.map((venta) => {
              const abierta = ventaAbierta === venta.id;
              const unidadesVenta = venta.items.reduce((suma, item) => suma + item.cantidad, 0);
              return (
                <div key={venta.id} className={`venta ${abierta ? 'abierta' : ''}`}>
                  <button
                    type="button"
                    className="venta-head"
                    onClick={() => setVentaAbierta(abierta ? null : venta.id)}
                    aria-expanded={abierta}
                  >
                    <span className="venta-id">#{venta.id}</span>
                    <span className="venta-hora">
                      {periodo === 'dia'
                        ? formatHora(venta.fecha)
                        : `${formatFechaCorta(venta.dia)} · ${formatHora(venta.fecha)}`}
                    </span>
                    <span className="chip chip-pago">{venta.metodoPago}</span>
                    <span className="venta-unidades">{unidadesVenta} u.</span>
                    <strong>{formatARS(venta.total)}</strong>
                    <IconChevron size={18} className={abierta ? 'rotado' : ''} />
                  </button>

                  {abierta && (
                    <div className="venta-detalle">
                      <table>
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Cant.</th>
                            <th>Precio</th>
                            <th>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {venta.items.map((item) => (
                            <tr key={`${venta.id}-${item.productoId}`}>
                              <td>
                                <span className="detalle-nombre">{item.nombre}</span>
                                <span className="detalle-categoria">{item.categoria}</span>
                              </td>
                              <td>{item.cantidad}</td>
                              <td>{formatARS(item.precio)}</td>
                              <td>
                                <strong>{formatARS(item.subtotal)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="venta-detalle-acciones">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setVentaEditando(venta)}
                        >
                          <IconEdit size={15} /> Editar venta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ventaEditando && (
        <EditarVentaModal
          venta={ventaEditando}
          onGuardar={onEditarVenta}
          onCerrar={() => setVentaEditando(null)}
        />
      )}

      <div className="backup-note">
        <IconDownload size={16} />
        <span>
          Para mover los datos a otra PC usá <strong>Descargar base</strong> y copiá el archivo
          <code>almacen.db</code> en la carpeta <code>server/data</code> del otro equipo.
        </span>
      </div>
    </div>
  );
}
