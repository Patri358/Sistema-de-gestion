import { IconAlert, IconCheck, IconTag } from './Icons.jsx';
import { esProductoPeso, formatARS } from '../utils.js';

function StockBajoCard({ producto }) {
  const peso = esProductoPeso(producto);
  const sinStock = producto.cantidad <= 0;
  const minimo = Number(producto.stock_minimo ?? 10);
  const faltan = Math.max(0, minimo - producto.cantidad);
  const porcentaje = Math.min(
    100,
    Math.max(4, Math.round((producto.cantidad / Math.max(1, minimo)) * 100))
  );

  return (
    <article className={`stock-card ${sinStock ? 'critico' : ''}`}>
      <div className="stock-card-head">
        <h3 title={producto.nombre}>{producto.nombre}</h3>
        <span className="chip chip-category">
          <IconTag size={12} />
          {producto.categoria}
        </span>
      </div>

      <div className="stock-card-data">
        <strong>
          {formatARS(producto.precio)}
          {peso && producto.precioPorGramo ? <small> · {formatARS(producto.precioPorGramo)}/g</small> : null}
        </strong>
        <span className={`chip ${sinStock ? 'stock-out' : 'stock-low'}`}>
          <IconAlert size={12} />
          {sinStock
            ? 'Sin stock'
            : peso
              ? `${producto.cantidad} u. · ${producto.gramosDisponibles ?? 0} g`
              : `${producto.cantidad} en stock`}
        </span>
      </div>

      <div className="stock-bar" aria-hidden="true">
        <span className="stock-fill" style={{ width: `${porcentaje}%` }} />
      </div>

      <p className="stock-card-alerta">
        {sinStock
          ? `Reponé este producto para volver a venderlo. Stock mínimo: ${minimo}.`
          : `Faltan ${faltan} unidad${faltan === 1 ? '' : 'es'} para alcanzar el stock mínimo (${minimo}).`}
      </p>

      <div className="stock-card-foot">
        <span className="barcode" title="Código de barra">
          {producto.codigo_barras || 'Sin código'}
        </span>
      </div>
    </article>
  );
}

export default function StockBajo({ datos, cargando, onIrAInventario }) {
  const productos = datos?.productos ?? [];
  const sinStock = productos.filter((producto) => producto.cantidad <= 0).length;

  return (
    <div className="stock-bajo">
      <div className="page-head">
        <div>
          <h1>Stock bajo</h1>
          <p>Productos por debajo del stock mínimo configurado. Avisá al administrador para reponerlos.</p>
        </div>
        <span className="count-pill">
          {productos.length} {productos.length === 1 ? 'producto' : 'productos'} en alerta
        </span>
      </div>

      {cargando ? (
        <div className="stock-bajo-grid">
          {Array.from({ length: 3 }).map((_, indice) => (
            <div key={indice} className="skeleton stock-bajo-skeleton" />
          ))}
        </div>
      ) : productos.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon success">
            <IconCheck size={28} />
          </span>
          <h2>Todo el stock está al día</h2>
          <p>No hay productos por debajo de su stock mínimo en este momento.</p>
          <button type="button" className="btn btn-secondary" onClick={onIrAInventario}>
            Ir al inventario
          </button>
        </div>
      ) : (
        <>
          {sinStock > 0 && (
            <div className="alert alert-error stock-bajo-alerta">
              <IconAlert size={18} />
              <span>
                {sinStock === 1
                  ? 'Hay 1 producto sin stock. Reponelo cuanto antes.'
                  : `Hay ${sinStock} productos sin stock. Reponelos cuanto antes.`}
              </span>
            </div>
          )}

          <div className="stock-bajo-grid">
            {productos.map((producto) => (
              <StockBajoCard key={producto.id} producto={producto} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
