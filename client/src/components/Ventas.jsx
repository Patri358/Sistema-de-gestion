import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GraficoLineas from './GraficoLineas.jsx';
import GraficoTorta from './GraficoTorta.jsx';
import EditarVentaModal from './EditarVentaModal.jsx';
import {
  IconAlert,
  IconBox,
  IconChart,
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
  const nombreDetalle =
    periodo === 'dia'
      ? 'Detalles de ventas del día'
      : periodo === 'mes'
        ? 'Detalles de ventas del mes'
        : 'Detalles de ventas del año';
  const masVendidos = datos?.masVendidos ?? [];
  const mediosPago = datos?.mediosPago ?? [];
  const vencidos = datos?.vencidos ?? [];
  const etiquetaRotacion =
    periodo === 'dia' ? 'horas' : periodo === 'mes' ? 'días' : 'meses';

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Estadísticas</h1>
          <p>Consultá la evolución de las ventas, los productos más vendidos y la rotación del stock.</p>
        </div>

        <div className="ventas-controls">
          <div className="periodo-selector" role="group" aria-label="Período de las estadísticas">
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

      <section className="card stats-panel" id="stats-picos-card">
        <div className="stats-panel-head">
          <span className="stat-icon blue">
            <IconChart size={20} />
          </span>
          <div>
            <h2>Picos de ventas</h2>
            <p>Movimiento por {etiquetaRotacion} · {etiqueta}</p>
          </div>
        </div>
        <GraficoLineas series={series} periodo={periodo} etiqueta={etiqueta} cargando={cargando} />
      </section>

      <div className="stats-sections">
        <section className="card stats-panel" id="stats-productos-estrellas">
          <div className="stats-panel-head">
            <span className="stat-icon amber">
              <IconBox size={20} />
            </span>
            <div>
              <h2>Productos estrellas</h2>
              <p>Top 10 por unidades vendidas y facturación</p>
            </div>
          </div>
          {cargando ? (
            <div className="chart-empty">Cargando...</div>
          ) : masVendidos.length ? (
            <div className="tabla-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidades</th>
                    <th>Facturación</th>
                  </tr>
                </thead>
                <tbody>
                  {masVendidos.map((producto) => (
                    <tr key={`estrella-${producto.productoId ?? producto.nombre}`}>
                      <td>{producto.nombre}</td>
                      <td>{producto.cantidad}</td>
                      <td>{formatARS(producto.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-empty">Sin productos vendidos en el período.</div>
          )}
        </section>

        <section className="card stats-panel" id="stats-medios-pago-card">
          <div className="stats-panel-head">
            <span className="stat-icon">
              <IconWallet size={20} />
            </span>
            <div>
              <h2>Medios de pago</h2>
              <p>Distribución de la facturación (sin fiado)</p>
            </div>
          </div>
          <GraficoTorta mediosPago={mediosPago} cargando={cargando} />
        </section>

        <section className="card stats-panel" id="stats-vencidos">
          <div className="stats-panel-head">
            <span className="stat-icon red">
              <IconAlert size={20} />
            </span>
            <div>
              <h2>Historial de productos que más se vencen</h2>
              <p>Los 10 más vencidos · todo el historial</p>
            </div>
          </div>
          {cargando ? (
            <div className="chart-empty">Cargando...</div>
          ) : vencidos.length ? (
            <div className="tabla-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidades vencidas</th>
                  </tr>
                </thead>
                <tbody>
                  {vencidos.map((producto) => (
                    <tr key={`vencido-${producto.productoId ?? producto.producto}`}>
                      <td>{producto.producto}</td>
                      <td>{producto.unidades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-empty">Sin bajas por vencimiento registradas.</div>
          )}
        </section>
      </div>

      <details className="detalle-periodo" id="stats-detalle">
        <summary>
          <IconChevron size={18} />
          <span>{nombreDetalle}</span>
          <small>{etiqueta}</small>
        </summary>

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
              const unidadesVenta = venta.items.reduce(
                (suma, item) => suma + (item.tipo === 'peso' ? 0 : item.cantidad),
                0
              );
              const gramosVenta = venta.items.reduce(
                (suma, item) => suma + (item.tipo === 'peso' ? item.cantidad : 0),
                0
              );
              const etiquetaVenta = [
                unidadesVenta ? `${unidadesVenta} u.` : '',
                gramosVenta ? `${gramosVenta} g` : '',
              ]
                .filter(Boolean)
                .join(' · ');
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
                      <span>
                        {periodo === 'dia'
                          ? formatHora(venta.fecha)
                          : `${formatFechaCorta(venta.dia)} · ${formatHora(venta.fecha)}`}
                      </span>
                      {venta.cliente && <small className="venta-cliente">{venta.cliente}</small>}
                    </span>
                    <span className="chip chip-pago">{venta.metodoPago}</span>
                    <span className="venta-unidades">{etiquetaVenta}</span>
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
                              <td>
                                {item.tipo === 'peso' ? `${item.cantidad} g` : item.cantidad}
                              </td>
                              <td>
                                {formatARS(item.precio)}
                                {item.tipo === 'peso' ? ' / g' : ''}
                              </td>
                              <td>
                                <strong>{formatARS(item.subtotal)}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {(venta.cliente ||
                        venta.descuento > 0 ||
                        venta.pagoCon !== null ||
                        venta.vuelto !== null) && (
                        <div className="venta-detalle-resumen">
                          {venta.cliente && (
                            <div className="summary-row">
                              <span>Cliente</span>
                              <span>{venta.cliente}</span>
                            </div>
                          )}
                          {venta.descuento > 0 && (
                            <>
                              <div className="summary-row">
                                <span>Subtotal</span>
                                <span>{formatARS(venta.subtotal)}</span>
                              </div>
                              <div className="summary-row descuento-row">
                                <span>
                                  Descuento
                                  {venta.descuentoTipo === 'porcentaje' &&
                                  venta.descuentoValor > 0
                                    ? ` (${venta.descuentoValor}%)`
                                    : ''}
                                </span>
                                <span>-{formatARS(venta.descuento)}</span>
                              </div>
                            </>
                          )}
                          {venta.pagoCon !== null && (
                            <div className="summary-row">
                              <span>Pagó con</span>
                              <span>{formatARS(venta.pagoCon)}</span>
                            </div>
                          )}
                          {venta.vuelto !== null && (
                            <div className="summary-row vuelto-row">
                              <span>Vuelto</span>
                              <span>{formatARS(venta.vuelto)}</span>
                            </div>
                          )}
                          <div className="summary-row venta-detalle-total">
                            <span>Total</span>
                            <strong>{formatARS(venta.total)}</strong>
                          </div>
                        </div>
                      )}

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
      </details>

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
          Para mover los datos a otra PC usá <strong>Descargar base</strong> desde Configuración y
          copiá el archivo <code>almacen.db</code> en la carpeta <code>server/data</code> del otro
          equipo.
        </span>
      </div>
    </div>
  );
}
