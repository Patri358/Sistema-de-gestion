import { useMemo, useState } from 'react';
import ProductoForm from './ProductoForm.jsx';
import EditarProductoModal from './EditarProductoModal.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import {
  IconBox,
  IconCart,
  IconEdit,
  IconImage,
  IconSearch,
  IconTag,
  IconTrash,
  IconX,
} from './Icons.jsx';
import { formatARS, iniciales } from '../utils.js';

function estadoStock(cantidad) {
  if (cantidad <= 0) return { clase: 'stock-out', texto: 'Sin stock' };
  if (cantidad <= 5) return { clase: 'stock-low', texto: `${cantidad} en stock` };
  return { clase: 'stock-ok', texto: `${cantidad} en stock` };
}

function ProductoCard({ producto, enCarrito, onAgregar, onEditar, onEliminar }) {
  const stock = estadoStock(producto.cantidad);
  const sinStock = producto.cantidad <= 0;
  const alMaximo = enCarrito >= producto.cantidad;

  return (
    <article className="product-card">
      <div className="product-media">
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
        ) : (
          <div className="product-placeholder">
            <span>{iniciales(producto.nombre)}</span>
            <IconImage size={22} />
          </div>
        )}
        {sinStock && <span className="media-tag">Sin stock</span>}

        <div className="product-actions">
          <button
            type="button"
            className="card-action"
            title="Editar producto"
            aria-label={`Editar ${producto.nombre}`}
            onClick={() => onEditar(producto)}
          >
            <IconEdit size={16} />
          </button>
          <button
            type="button"
            className="card-action danger"
            title="Eliminar producto"
            aria-label={`Eliminar ${producto.nombre}`}
            onClick={() => onEliminar(producto)}
          >
            <IconTrash size={16} />
          </button>
        </div>
      </div>

      <div className="product-body">
        <div className="product-heading">
          <h3 title={producto.nombre}>{producto.nombre}</h3>
          <span className="chip chip-category">
            <IconTag size={12} />
            {producto.categoria}
          </span>
        </div>

        <p className="product-price">{formatARS(producto.precio)}</p>

        <div className="product-meta">
          <span className={`chip ${stock.clase}`}>{stock.texto}</span>
          <span className="barcode" title="Código de barra">
            {producto.codigo_barras || 'Sin código'}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block btn-sm"
          onClick={() => onAgregar(producto)}
          disabled={sinStock || alMaximo}
        >
          <IconCart size={16} />
          {sinStock
            ? 'Sin stock'
            : alMaximo
              ? `En el carrito (${enCarrito})`
              : enCarrito > 0
                ? `Agregar otro (${enCarrito})`
                : 'Agregar al carrito'}
        </button>
      </div>
    </article>
  );
}

export default function Inventario({
  productos,
  categorias,
  filtros,
  onFiltros,
  cargando,
  carrito,
  onAgregar,
  onCrear,
  onEditar,
  onEliminar,
  onIrACategorias,
}) {
  const [productoEditando, setProductoEditando] = useState(null);
  const [productoAEliminar, setProductoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  const cantidadesEnCarrito = useMemo(() => {
    const mapa = new Map();
    for (const item of carrito) {
      mapa.set(item.producto.id, item.cantidad);
    }
    return mapa;
  }, [carrito]);

  const hayFiltros = Boolean(filtros.busqueda || filtros.categoria);

  async function confirmarEliminacion() {
    if (!productoAEliminar) return;
    setErrorEliminar('');
    setEliminando(true);
    try {
      await onEliminar(productoAEliminar.id);
      setProductoAEliminar(null);
    } catch (err) {
      setErrorEliminar(err.message);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="inventario-layout">
      <ProductoForm
        categorias={categorias}
        onCrear={onCrear}
        onIrACategorias={onIrACategorias}
      />

      <div className="productos-panel">
        <div className="page-head">
          <div>
            <h1>Inventario</h1>
            <p>Buscá por nombre o código de barra, editá el stock y armá el carrito.</p>
          </div>
          <span className="count-pill">
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <div className="card filters">
          <div className="search-field">
            <IconSearch size={19} />
            <input
              type="search"
              value={filtros.busqueda}
              placeholder="Buscar por nombre o código de barra..."
              aria-label="Buscar productos"
              onChange={(e) => onFiltros({ ...filtros, busqueda: e.target.value })}
            />
            {filtros.busqueda && (
              <button
                type="button"
                className="icon-button"
                aria-label="Limpiar búsqueda"
                onClick={() => onFiltros({ ...filtros, busqueda: '' })}
              >
                <IconX size={16} />
              </button>
            )}
          </div>

          <div className="select-field">
            <IconTag size={18} />
            <select
              value={filtros.categoria}
              aria-label="Filtrar por categoría"
              onChange={(e) => onFiltros({ ...filtros, categoria: e.target.value })}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.nombre}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
          </div>

          {hayFiltros && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onFiltros({ busqueda: '', categoria: '' })}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {cargando ? (
          <div className="product-grid">
            {Array.from({ length: 6 }).map((_, indice) => (
              <div key={indice} className="product-card skeleton-card">
                <div className="skeleton skeleton-media" />
                <div className="skeleton-body">
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-line short" />
                  <div className="skeleton skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="card empty-state">
            <span className="empty-icon">
              <IconBox size={30} />
            </span>
            <h2>{hayFiltros ? 'No encontramos productos' : 'Tu inventario está vacío'}</h2>
            <p>
              {hayFiltros
                ? 'Probá con otro nombre, código de barra o categoría.'
                : categorias.length === 0
                  ? 'Primero creá una categoría y después cargá tu primer producto.'
                  : 'Cargá el primer producto desde el formulario para empezar.'}
            </p>
            {hayFiltros ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onFiltros({ busqueda: '', categoria: '' })}
              >
                Ver todos los productos
              </button>
            ) : (
              categorias.length === 0 && (
                <button type="button" className="btn btn-secondary" onClick={onIrACategorias}>
                  Crear categoría
                </button>
              )
            )}
          </div>
        ) : (
          <div className="product-grid">
            {productos.map((producto) => (
              <ProductoCard
                key={producto.id}
                producto={producto}
                enCarrito={cantidadesEnCarrito.get(producto.id) ?? 0}
                onAgregar={onAgregar}
                onEditar={setProductoEditando}
                onEliminar={(seleccionado) => {
                  setErrorEliminar('');
                  setProductoAEliminar(seleccionado);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {productoEditando && (
        <EditarProductoModal
          producto={productoEditando}
          categorias={categorias}
          onGuardar={onEditar}
          onCerrar={() => setProductoEditando(null)}
        />
      )}

      {productoAEliminar && (
        <ConfirmModal
          titulo="Eliminar producto"
          mensaje={`¿Seguro que querés eliminar "${productoAEliminar.nombre}"?`}
          detalle="Se quitará del inventario y del carrito. Esta acción no se puede deshacer."
          textoConfirmar="Eliminar producto"
          onConfirmar={confirmarEliminacion}
          onCerrar={() => setProductoAEliminar(null)}
          cargando={eliminando}
          error={errorEliminar}
        />
      )}
    </div>
  );
}
