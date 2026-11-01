import { IconChart } from './Icons.jsx';
import { formatARS } from '../utils.js';

export default function GraficoVentas({ productos, etiqueta, cargando }) {
  const visibles = productos.slice(0, 8);
  const maximo = visibles[0]?.cantidad || 1;
  const totalUnidades = productos.reduce((suma, producto) => suma + producto.cantidad, 0);

  return (
    <section className="card chart-card">
      <div className="chart-head">
        <div>
          <h2>
            <IconChart size={18} /> Productos más vendidos
          </h2>
          <p>Según unidades vendidas · {etiqueta}</p>
        </div>
        {!cargando && productos.length > 0 && (
          <span className="count-pill">{totalUnidades} u. vendidas</span>
        )}
      </div>

      {cargando ? (
        <div className="chart-bars">
          {Array.from({ length: 4 }).map((_, indice) => (
            <div key={indice} className="skeleton chart-skeleton" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <div className="empty-state inline chart-empty">
          <span className="empty-icon">
            <IconChart size={26} />
          </span>
          <h3>Sin ventas en este período</h3>
          <p>Cuando registres ventas, acá vas a ver los productos más vendidos.</p>
        </div>
      ) : (
        <>
          <div className="chart-bars">
            {visibles.map((producto, indice) => {
              const porcentaje = Math.max(4, Math.round((producto.cantidad / maximo) * 100));
              return (
                <div className="chart-row" key={producto.productoId ?? producto.nombre}>
                  <span className={`chart-rank ${indice === 0 ? 'top' : ''}`}>{indice + 1}</span>
                  <div className="chart-label">
                    <strong title={producto.nombre}>{producto.nombre}</strong>
                    <small>{producto.categoria}</small>
                  </div>
                  <div className="chart-bar-area">
                    <div className="chart-track">
                      <div className="chart-fill" style={{ width: `${porcentaje}%` }} />
                    </div>
                    <span className="chart-units">{producto.cantidad} u.</span>
                  </div>
                  <span className="chart-money">{formatARS(producto.total)}</span>
                </div>
              );
            })}
          </div>

          {productos.length > visibles.length && (
            <p className="chart-foot">
              Mostrando los 8 productos con más unidades vendidas de {productos.length} vendidos.
            </p>
          )}
        </>
      )}
    </section>
  );
}
