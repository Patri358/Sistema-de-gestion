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

export const METODOS_PAGO = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Mercado Pago', 'QR'];

export default function Carrito({
  carrito,
  onCambiarCantidad,
  onQuitar,
  onVaciar,
  onConfirmar,
  comprando,
  cajaAbierta,
  cajaEstado,
  onIrACaja,
}) {
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  const total = carrito.reduce((suma, item) => suma + item.producto.precio * item.cantidad, 0);
  const unidades = carrito.reduce((suma, item) => suma + item.cantidad, 0);
  const vacio = carrito.length === 0;

  return (
    <aside className="card carrito-panel" aria-label="Carrito de venta">
      <div className="carrito-panel-head">
        <div className="carrito-panel-title">
          <span className="carrito-panel-icon">
            <IconCart size={19} />
          </span>
          <div>
            <h2>Carrito</h2>
            <p>
              {vacio
                ? 'Agregá productos o escaneá un código'
                : `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} · ${carrito.length} producto${carrito.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        {!vacio && (
          <button
            type="button"
            className="icon-button danger"
            onClick={onVaciar}
            aria-label="Vaciar carrito"
            title="Vaciar carrito"
          >
            <IconTrash size={16} />
          </button>
        )}
      </div>

      {vacio ? (
        <div className="carrito-panel-empty">
          <span className="empty-icon">
            <IconCart size={28} />
          </span>
          <h3>El carrito está vacío</h3>
          <p>Elegí la cantidad en una tarjeta del inventario o usá el lector de código de barras.</p>
        </div>
      ) : (
        <>
          <div className="cart-items carrito-panel-items">
            {carrito.map(({ producto, cantidad }) => (
              <div key={producto.id} className="cart-item">
                <div className="cart-thumb">
                  {producto.imagen ? (
                    <img src={producto.imagen} alt={producto.nombre} />
                  ) : (
                    <div className="cart-thumb-placeholder">
                      <span>{iniciales(producto.nombre)}</span>
                      <IconImage size={14} />
                    </div>
                  )}
                </div>

                <div className="cart-info">
                  <h3 title={producto.nombre}>{producto.nombre}</h3>
                  <p>{producto.categoria} · {formatARS(producto.precio)}</p>
                  <span className="cart-stock">Stock: {producto.cantidad}</span>
                </div>

                <div className="cart-subtotal">
                  <strong>{formatARS(producto.precio * cantidad)}</strong>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Eliminar ${producto.nombre} del carrito`}
                    onClick={() => onQuitar(producto.id)}
                  >
                    <IconX size={15} />
                  </button>
                </div>

                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Quitar una unidad de ${producto.nombre}`}
                    onClick={() => onCambiarCantidad(producto.id, -1)}
                    disabled={cantidad <= 1}
                  >
                    <IconMinus size={14} />
                  </button>
                  <span>{cantidad}</span>
                  <button
                    type="button"
                    aria-label={`Agregar una unidad de ${producto.nombre}`}
                    onClick={() => onCambiarCantidad(producto.id, 1)}
                    disabled={cantidad >= producto.cantidad}
                  >
                    <IconPlus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="carrito-panel-summary">
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

            {!cajaAbierta && (
              <div className={`inline-notice caja-notice ${cajaEstado}`}>
                <span>
                  {cajaEstado === 'cerrada'
                    ? 'La caja está cerrada. Abrila de nuevo para registrar ventas.'
                    : 'Abrí la caja del día para confirmar la venta.'}
                </span>
                <button type="button" className="btn btn-primary btn-sm" onClick={onIrACaja}>
                  Ir a Caja
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => onConfirmar(metodoPago)}
              disabled={comprando || !cajaAbierta}
            >
              {!cajaAbierta
                ? cajaEstado === 'cerrada'
                  ? 'Caja cerrada'
                  : 'Abrí la caja para vender'
                : comprando
                  ? 'Registrando venta...'
                  : `Confirmar compra · ${formatARS(total)}`}
            </button>
            <p className="summary-hint">
              {cajaAbierta
                ? 'El stock se descuenta automáticamente al confirmar.'
                : 'La caja debe estar abierta para confirmar la venta.'}
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
