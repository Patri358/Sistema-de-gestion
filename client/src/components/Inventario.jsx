import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  IconBarcode,
  IconBox,
  IconCart,
  IconImage,
  IconMinus,
  IconPlus,
  IconSearch,
  IconTag,
  IconX,
} from './Icons.jsx';
import { esProductoPeso, formatARS, iniciales, stockDisponible } from '../utils.js';

function estadoStock(cantidad) {
  if (cantidad <= 0) return { clase: 'stock-out', texto: 'Sin stock' };
  if (cantidad <= 5) return { clase: 'stock-low', texto: `${cantidad} en stock` };
  return { clase: 'stock-ok', texto: `${cantidad} en stock` };
}

function ProductoCard({ producto, enCarrito, onAgregar }) {
  const peso = esProductoPeso(producto);
  const stock = estadoStock(producto.cantidad);
  const deshabilitado = Number(producto.activo) === 0;
  const sinStock = stockDisponible(producto) <= 0;
  const disponible = Math.max(0, stockDisponible(producto) - enCarrito);
  const alMaximo = disponible <= 0;
  const bloqueado = deshabilitado || sinStock;
  const paso = peso ? 100 : 1;
  const sufijo = peso ? ' g' : '';
  const [cantidad, setCantidad] = useState(peso ? Math.min(paso, Math.max(0, disponible)) : 1);

  useEffect(() => {
    setCantidad((actual) => Math.min(Math.max(0, actual), Math.max(0, disponible)));
  }, [disponible]);

  function cambiarCantidad(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return;
    setCantidad(Math.min(Math.max(0, Math.floor(numero)), Math.max(0, disponible)));
  }

  return (
    <article className={`product-card ${deshabilitado ? 'deshabilitado' : ''}`}>
      <div className="product-media">
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
        ) : (
          <div className="product-placeholder">
            <span>{iniciales(producto.nombre)}</span>
            <IconImage size={22} />
          </div>
        )}
        {deshabilitado && <span className="media-tag">Deshabilitado</span>}
        {!deshabilitado && sinStock && <span className="media-tag">Sin stock</span>}

      </div>

      <div className="product-body">
        <div className="product-heading">
          <h3 title={producto.nombre}>{producto.nombre}</h3>
          <span className="chip chip-category">
            <IconTag size={12} />
            {producto.categoria}
          </span>
        </div>

        <p className="product-price">
          {peso && producto.precioPorGramo ? (
            <>
              {formatARS(producto.precioPorGramo)} <small>/ g</small>
              <span className="price-secondary">{formatARS(producto.precio)} por unidad</span>
            </>
          ) : (
            formatARS(producto.precio)
          )}
        </p>

        <div className="product-meta">
          <span className={`chip ${deshabilitado ? 'chip-disabled' : stock.clase}`}>
            {deshabilitado
              ? 'No disponible'
              : peso
                ? `${producto.cantidad} u. · ${producto.gramosDisponibles ?? 0} g`
                : stock.texto}
          </span>
          <span className="barcode" title="Código de barra">
            {producto.codigo_barras || 'Sin código'}
          </span>
        </div>

        <div className="product-buy-row">
          <div className="qty-picker">
            <button
              type="button"
              aria-label={`Restar ${peso ? 'gramos' : 'una unidad'} de ${producto.nombre}`}
              onClick={() => cambiarCantidad(cantidad - paso)}
              disabled={bloqueado || alMaximo || cantidad <= 0}
            >
              <IconMinus size={14} />
            </button>
            <input
              type="number"
              min="0"
              max={Math.max(0, disponible)}
              value={cantidad}
              aria-label={`${peso ? 'Gramos' : 'Cantidad'} de ${producto.nombre}`}
              onChange={(e) => cambiarCantidad(e.target.value)}
              disabled={bloqueado || alMaximo}
            />
            <button
              type="button"
              aria-label={`Sumar ${peso ? 'gramos' : 'una unidad'} de ${producto.nombre}`}
              onClick={() => cambiarCantidad(cantidad + paso)}
              disabled={bloqueado || alMaximo || cantidad >= disponible}
            >
              <IconPlus size={14} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm product-add"
            onClick={() => onAgregar(producto, cantidad)}
            disabled={bloqueado || alMaximo || cantidad <= 0}
          >
            <IconCart size={16} />
            {deshabilitado
              ? 'Deshabilitado'
              : sinStock
              ? 'Sin stock'
              : alMaximo
                ? `En el carrito (${enCarrito}${sufijo})`
                : cantidad <= 0
                  ? 'Ingresá una cantidad'
                  : cantidad > 1
                    ? `Agregar ${cantidad}${sufijo}`
                    : enCarrito > 0
                      ? 'Agregar otro'
                      : 'Agregar al carrito'}
          </button>
        </div>
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
  onIrAProductos,
}) {
  const [codigoEscaneo, setCodigoEscaneo] = useState('');
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [mensajeCodigo, setMensajeCodigo] = useState(null);

  const cantidadesEnCarrito = useMemo(() => {
    const mapa = new Map();
    for (const item of carrito) {
      mapa.set(item.producto.id, item.cantidad);
    }
    return mapa;
  }, [carrito]);

  const hayFiltros = Boolean(filtros.busqueda || filtros.categoria);

  async function escanearCodigo(event) {
    event.preventDefault();
    const codigo = codigoEscaneo.trim();
    if (!codigo || buscandoCodigo) return;

    setBuscandoCodigo(true);
    setMensajeCodigo(null);
    try {
      const producto = await api.buscarProductoCodigo(codigo);
      const peso = producto.tipo === 'peso';
      const agregadas = onAgregar(producto, peso ? 100 : 1);
      if (peso && agregadas) {
        setMensajeCodigo({
          tipo: 'ok',
          texto: `"${producto.nombre}" es por peso. Ajustá los gramos en el carrito.`,
        });
        setCodigoEscaneo('');
        return;
      }

      setMensajeCodigo(
        agregadas
          ? { tipo: 'ok', texto: `"${producto.nombre}" agregado al carrito` }
          : { tipo: 'error', texto: `No se pudo agregar "${producto.nombre}"` }
      );
      setCodigoEscaneo('');
    } catch (err) {
      setMensajeCodigo({ tipo: 'error', texto: err.message });
    } finally {
      setBuscandoCodigo(false);
    }
  }

  return (
    <div className="productos-panel">
      <div className="page-head">
        <div>
          <h1>Inventario</h1>
          <p>Buscá por nombre o código de barra y armá el carrito.</p>
        </div>
        <span className="count-pill">
          {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      <form className="card scan-bar" onSubmit={escanearCodigo}>
        <div className="scan-field">
          <IconBarcode size={20} />
          <input
            type="text"
            value={codigoEscaneo}
            placeholder="Escaneá o escribí un código de barras y presioná Enter"
            aria-label="Código de barras para agregar al carrito"
            onChange={(e) => setCodigoEscaneo(e.target.value)}
            autoFocus
            disabled={buscandoCodigo}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={buscandoCodigo || !codigoEscaneo.trim()}>
          <IconCart size={16} />
          {buscandoCodigo ? 'Buscando...' : 'Agregar'}
        </button>
        {mensajeCodigo && (
          <span className={`scan-feedback ${mensajeCodigo.tipo}`} role="status">
            {mensajeCodigo.texto}
          </span>
        )}
      </form>

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
                : onIrAProductos
                  ? categorias.length === 0
                    ? 'Primero creá una categoría desde la sección Productos y después cargá tu primer producto.'
                    : 'Cargá el primer producto desde la sección Productos.'
                  : 'No hay productos disponibles en este momento.'}
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
              onIrAProductos && (
                <button type="button" className="btn btn-secondary" onClick={onIrAProductos}>
                  {categorias.length === 0 ? 'Crear categoría' : 'Cargar producto'}
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
              />
            ))}
          </div>
        )}

    </div>
  );
}
