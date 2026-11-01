import { useState } from 'react';
import {
  IconCart,
  IconImage,
  IconMinus,
  IconPlus,
  IconTrash,
  IconWallet,
  IconX,
} from './Icons.jsx';
import { formatARS, iniciales } from '../utils.js';

const METODOS_PAGO = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Mercado Pago', 'QR'];

export default function Carrito({
  carrito,
  onCambiarCantidad,
  onQuitar,
  onVaciar,
  onConfirmar,
  comprando,
  onIrAComprar,
}) {
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  const total = carrito.reduce((suma, item) => suma + item.producto.precio * item.cantidad, 0);
  const unidades = carrito.reduce((suma, item) => suma + item.cantidad, 0);

  if (carrito.length === 0) {
    return (
      <div className="card empty-state big">
        <span className="empty-icon">
          <IconCart size={30} />
        </span>
        <h1>El carrito está vacío</h1>
        <p>Agregá productos desde el inventario para armar una venta.</p>
        <button type="button" className="btn btn-primary" onClick={onIrAComprar}>
          Ir al inventario
        </button>
      </div>
    );
  }

  return (
    <div className="carrito-layout">
      <div className="cart-main">
        <div className="page-head">
          <div>
            <h1>Carrito de venta</h1>
            <p>Revisá las cantidades y elegí el método de pago para confirmar.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onVaciar}>
            <IconTrash size={15} /> Vaciar carrito
          </button>
        </div>

        <div className="card cart-items">
          {carrito.map(({ producto, cantidad }) => (
            <div key={producto.id} className="cart-item">
              <div className="cart-thumb">
                {producto.imagen ? (
                  <img src={producto.imagen} alt={producto.nombre} />
                ) : (
                  <div className="cart-thumb-placeholder">
                    <span>{iniciales(producto.nombre)}</span>
                    <IconImage size={16} />
                  </div>
                )}
              </div>

              <div className="cart-info">
                <h3>{producto.nombre}</h3>
                <p>
                  {formatARS(producto.precio)} · {producto.categoria}
                  {producto.codigo_barras ? ` · ${producto.codigo_barras}` : ''}
                </p>
                <span className="cart-stock">Stock disponible: {producto.cantidad}</span>
              </div>

              <div className="stepper">
                <button
                  type="button"
                  aria-label={`Quitar una unidad de ${producto.nombre}`}
                  onClick={() => onCambiarCantidad(producto.id, -1)}
                  disabled={cantidad <= 1}
                >
                  <IconMinus size={15} />
                </button>
                <span>{cantidad}</span>
                <button
                  type="button"
                  aria-label={`Agregar una unidad de ${producto.nombre}`}
                  onClick={() => onCambiarCantidad(producto.id, 1)}
                  disabled={cantidad >= producto.cantidad}
                >
                  <IconPlus size={15} />
                </button>
              </div>

              <div className="cart-subtotal">
                <strong>{formatARS(producto.precio * cantidad)}</strong>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Eliminar ${producto.nombre} del carrito`}
                  onClick={() => onQuitar(producto.id)}
                >
                  <IconX size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="card cart-summary">
        <h2>Resumen de la venta</h2>

        <div className="summary-row">
          <span>Artículos</span>
          <span>{unidades}</span>
        </div>
        <div className="summary-row">
          <span>Productos distintos</span>
          <span>{carrito.length}</span>
        </div>

        <div className="summary-total">
          <span>Total</span>
          <strong>{formatARS(total)}</strong>
        </div>

        <div className="field">
          <label htmlFor="metodo-pago">
            <IconWallet size={15} /> Método de pago
          </label>
          <select
            id="metodo-pago"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
          >
            {METODOS_PAGO.map((metodo) => (
              <option key={metodo} value={metodo}>
                {metodo}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => onConfirmar(metodoPago)}
          disabled={comprando}
        >
          {comprando ? 'Registrando venta...' : `Confirmar compra · ${formatARS(total)}`}
        </button>
        <p className="summary-hint">La venta queda guardada y el stock se descuenta automáticamente.</p>
      </aside>
    </div>
  );
}
