import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { METODOS_PAGO } from './Carrito.jsx';
import {
  IconAlert,
  IconEdit,
  IconMinus,
  IconPlus,
  IconTrash,
  IconWallet,
} from './Icons.jsx';
import { formatARS, formatFechaCorta, formatHora } from '../utils.js';
import { api } from '../api.js';

export default function EditarVentaModal({ venta, onGuardar, onCerrar }) {
  const [metodoPago, setMetodoPago] = useState(venta.metodoPago);
  const [items, setItems] = useState(() =>
    venta.items.map((item) => ({
      productoId: item.productoId,
      nombre: item.nombre,
      categoria: item.categoria,
      precio: item.precio,
      cantidad: item.cantidad,
    }))
  );
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [productoAgregarId, setProductoAgregarId] = useState('');
  const [cantidadAgregar, setCantidadAgregar] = useState('1');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    api
      .getProductos()
      .then((datos) => {
        if (cancelado) return;
        setProductos(datos);
        setItems((actual) =>
          actual.map((item) => {
            const producto = datos.find((fila) => fila.id === item.productoId);
            return producto
              ? {
                  ...item,
                  nombre: producto.nombre,
                  categoria: producto.categoria,
                  precio: producto.precio,
                }
              : item;
          })
        );
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
  }, []);

  function cantidadOriginal(productoId) {
    return venta.items.find((item) => item.productoId === productoId)?.cantidad ?? 0;
  }

  function disponibleProducto(productoId) {
    const producto = productos.find((fila) => fila.id === productoId);
    return Math.max(0, (producto?.cantidad ?? 0) + cantidadOriginal(productoId));
  }

  function cambiarCantidad(productoId, valor) {
    const numero = Math.max(1, Math.min(disponibleProducto(productoId), Math.floor(Number(valor) || 1)));
    setItems((actual) =>
      actual.map((item) => (item.productoId === productoId ? { ...item, cantidad: numero } : item))
    );
  }

  function quitarItem(productoId) {
    setItems((actual) => actual.filter((item) => item.productoId !== productoId));
  }

  function agregarProducto() {
    const producto = productos.find((fila) => fila.id === Number(productoAgregarId));
    if (!producto) {
      setError('Elegí un producto para agregar');
      return;
    }
    if (producto.cantidad <= 0) {
      setError(`No hay stock disponible de "${producto.nombre}"`);
      return;
    }

    const cantidad = Math.max(1, Math.min(producto.cantidad, Math.floor(Number(cantidadAgregar) || 1)));
    setItems((actual) => {
      if (actual.some((item) => item.productoId === producto.id)) return actual;
      return [
        ...actual,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          precio: producto.precio,
          cantidad,
        },
      ];
    });
    setProductoAgregarId('');
    setCantidadAgregar('1');
    setError('');
  }

  async function guardar(event) {
    event.preventDefault();
    setError('');
    if (items.length === 0) {
      setError('La venta debe tener al menos un producto');
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(
        venta.id,
        metodoPago,
        items.map((item) => ({ productoId: item.productoId, cantidad: item.cantidad }))
      );
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const total = items.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  const productosParaAgregar = productos.filter(
    (producto) =>
      producto.cantidad > 0 && !items.some((item) => item.productoId === producto.id)
  );

  return (
    <Modal
      titulo="Editar venta"
      subtitulo={`#${venta.id} · ${formatFechaCorta(venta.dia)} ${formatHora(venta.fecha)}`}
      icono={<IconEdit size={18} />}
      size="lg"
      onCerrar={guardando ? () => {} : onCerrar}
    >
      <form className="formulario" onSubmit={guardar}>
        <p className="confirm-text">
          Cambiá cantidades, productos o el medio de pago. El stock se ajusta automáticamente.
        </p>

        <div className="venta-edit-items">
          {items.map((item) => {
            const disponible = disponibleProducto(item.productoId);
            return (
              <div className="venta-edit-row" key={item.productoId}>
                <div className="venta-edit-info">
                  <strong>{item.nombre}</strong>
                  <small>
                    {item.categoria} · {formatARS(item.precio)} · disponible {disponible}
                  </small>
                </div>

                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Restar una unidad de ${item.nombre}`}
                    onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)}
                    disabled={item.cantidad <= 1}
                  >
                    <IconMinus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, disponible)}
                    value={item.cantidad}
                    aria-label={`Cantidad de ${item.nombre} en la venta`}
                    onChange={(e) => cambiarCantidad(item.productoId, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Sumar una unidad de ${item.nombre}`}
                    onClick={() => cambiarCantidad(item.productoId, item.cantidad + 1)}
                    disabled={item.cantidad >= disponible}
                  >
                    <IconPlus size={14} />
                  </button>
                </div>

                <strong className="venta-edit-subtotal">
                  {formatARS(item.precio * item.cantidad)}
                </strong>

                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Quitar ${item.nombre} de la venta`}
                  onClick={() => quitarItem(item.productoId)}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="venta-edit-add">
          <div className="field">
            <label htmlFor="venta-producto-agregar">Agregar producto</label>
            <select
              id="venta-producto-agregar"
              value={productoAgregarId}
              onChange={(e) => setProductoAgregarId(e.target.value)}
              disabled={cargando || productosParaAgregar.length === 0}
            >
              <option value="">
                {cargando
                  ? 'Cargando productos...'
                  : productosParaAgregar.length === 0
                    ? 'No hay más productos con stock'
                    : 'Elegí un producto'}
              </option>
              {productosParaAgregar.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre} · {formatARS(producto.precio)} · stock {producto.cantidad}
                </option>
              ))}
            </select>
          </div>

          <div className="field venta-edit-add-cantidad">
            <label htmlFor="venta-cantidad-agregar">Cantidad</label>
            <input
              id="venta-cantidad-agregar"
              type="number"
              min="1"
              value={cantidadAgregar}
              onChange={(e) => setCantidadAgregar(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={agregarProducto}
            disabled={!productoAgregarId}
          >
            <IconPlus size={16} /> Agregar
          </button>
        </div>

        <div className="venta-edit-total">
          <span>Total actualizado</span>
          <strong>{formatARS(total)}</strong>
        </div>

        <div className="field">
          <label htmlFor="editar-metodo-pago">
            <IconWallet size={15} /> Método de pago
          </label>
          <select
            id="editar-metodo-pago"
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

        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando || cargando}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
