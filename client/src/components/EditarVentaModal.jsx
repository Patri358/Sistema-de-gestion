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
import {
  calcularDescuento,
  formatARS,
  formatFechaCorta,
  formatHora,
  normalizarProducto,
  stockDisponible,
} from '../utils.js';
import { api } from '../api.js';

export default function EditarVentaModal({ venta, onGuardar, onCerrar }) {
  const [metodoPago, setMetodoPago] = useState(venta.metodoPago);
  const [cliente, setCliente] = useState(venta.cliente || '');
  const [items, setItems] = useState(() =>
    venta.items.map((item) => ({
      productoId: item.productoId,
      nombre: item.nombre,
      categoria: item.categoria,
      precio: item.precio,
      cantidad: item.cantidad,
      tipo: item.tipo === 'peso' ? 'peso' : 'unidad',
      gramos: item.gramos ?? null,
      gramosPorUnidad: item.gramosPorUnidad ?? null,
      precioUnidad: item.precioUnidad ?? item.precio,
    }))
  );
  const [descuentoTipo, setDescuentoTipo] = useState(venta.descuentoTipo || 'porcentaje');
  const [descuentoValor, setDescuentoValor] = useState(
    Number(venta.descuentoValor) > 0 ? String(venta.descuentoValor) : ''
  );
  const [pagoCon, setPagoCon] = useState(
    venta.pagoCon !== null && venta.pagoCon !== undefined ? String(venta.pagoCon) : ''
  );
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [productoAgregarId, setProductoAgregarId] = useState('');
  const [cantidadAgregar, setCantidadAgregar] = useState('1');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const esFiado = metodoPago === 'Fiado';

  useEffect(() => {
    let cancelado = false;
    api
      .getProductos()
      .then((datos) => {
        if (cancelado) return;
        const normalizados = datos.map(normalizarProducto);
        setProductos(normalizados);
        setItems((actual) =>
          actual.map((item) => {
            const producto = normalizados.find((fila) => fila.id === item.productoId);
            if (!producto) return item;
            const peso = producto.tipo === 'peso';
            return {
              ...item,
              nombre: producto.nombre,
              categoria: producto.categoria,
              tipo: producto.tipo,
              gramos: peso ? item.cantidad : null,
              gramosPorUnidad: peso ? producto.gramosPorUnidad : null,
              precioUnidad: producto.precio,
              precio: peso ? producto.precioPorGramo : producto.precio,
            };
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
    if (!producto) return 0;
    return Math.max(0, stockDisponible(producto) + cantidadOriginal(productoId));
  }

  function cambiarCantidad(productoId, valor) {
    const numero = Math.max(1, Math.min(disponibleProducto(productoId), Math.floor(Number(valor) || 1)));
    setItems((actual) =>
      actual.map((item) =>
        item.productoId === productoId ? { ...item, cantidad: numero, gramos: item.tipo === 'peso' ? numero : null } : item
      )
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
    if (Number(producto.activo) === 0) {
      setError(`"${producto.nombre}" está deshabilitado y no se puede vender`);
      return;
    }
    const disponible = stockDisponible(producto);
    if (disponible <= 0) {
      setError(`No hay stock disponible de "${producto.nombre}"`);
      return;
    }

    const peso = producto.tipo === 'peso';
    const cantidad = Math.max(1, Math.min(disponible, Math.floor(Number(cantidadAgregar) || 1)));
    setItems((actual) => {
      if (actual.some((item) => item.productoId === producto.id)) return actual;
      return [
        ...actual,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          precio: peso ? producto.precioPorGramo : producto.precio,
          precioUnidad: producto.precio,
          cantidad,
          tipo: producto.tipo,
          gramos: peso ? cantidad : null,
          gramosPorUnidad: peso ? producto.gramosPorUnidad : null,
        },
      ];
    });
    setProductoAgregarId('');
    setCantidadAgregar(peso ? '100' : '1');
    setError('');
  }

  async function guardar(event) {
    event.preventDefault();
    setError('');
    if (items.length === 0) {
      setError('La venta debe tener al menos un producto');
      return;
    }
    if (!pagoSuficiente) {
      setError('El monto pagado no alcanza a cubrir el total de la venta');
      return;
    }
    if (esFiado && !cliente.trim()) {
      setError('El nombre del cliente es obligatorio para vender a fiado');
      return;
    }

    const limiteDescuento = descuentoTipo === 'porcentaje' ? 100 : subtotal;
    const valorDescuento = Math.max(0, Math.min(Number(descuentoValor) || 0, limiteDescuento));

    setGuardando(true);
    try {
      await onGuardar(
        venta.id,
        metodoPago,
        items.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          tipo: item.tipo,
          gramos: item.tipo === 'peso' ? item.cantidad : null,
        })),
        {
          descuentoTipo: descuento > 0 ? descuentoTipo : null,
          descuentoValor: descuento > 0 ? valorDescuento : 0,
          pagoCon:
            metodoPago === 'Efectivo' && pagoCon.trim() !== '' && Number.isFinite(Number(pagoCon))
              ? Number(pagoCon)
              : null,
          cliente: cliente.trim() || null,
          clienteId: esFiado ? venta.clienteId ?? null : null,
        }
      );
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const subtotal = items.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  const { importe: descuento, total } = calcularDescuento(subtotal, descuentoTipo, descuentoValor);
  const pagoConNumero = Number(pagoCon);
  const pagoConCargado = pagoCon.trim() !== '';
  const pagoSuficiente =
    metodoPago !== 'Efectivo' ||
    !pagoConCargado ||
    (Number.isFinite(pagoConNumero) && pagoConNumero >= total);
  const vuelto =
    metodoPago === 'Efectivo' && pagoConCargado && pagoSuficiente
      ? Math.round((pagoConNumero - total + Number.EPSILON) * 100) / 100
      : null;
  const productosParaAgregar = productos.filter(
    (producto) =>
      Number(producto.activo) !== 0 &&
      stockDisponible(producto) > 0 &&
      !items.some((item) => item.productoId === producto.id)
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
            const peso = item.tipo === 'peso';
            const paso = peso ? 100 : 1;
            const sufijo = peso ? ' g' : '';
            return (
              <div className="venta-edit-row" key={item.productoId}>
                <div className="venta-edit-info">
                  <strong>{item.nombre}</strong>
                  <small>
                    {item.categoria} · {formatARS(item.precio)}
                    {peso ? ' / g' : ''} · disponible {disponible}
                    {sufijo}
                  </small>
                </div>

                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Restar ${peso ? 'gramos' : 'una unidad'} de ${item.nombre}`}
                    onClick={() => cambiarCantidad(item.productoId, item.cantidad - paso)}
                    disabled={item.cantidad <= 1}
                  >
                    <IconMinus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, disponible)}
                    value={item.cantidad}
                    aria-label={`${peso ? 'Gramos' : 'Cantidad'} de ${item.nombre} en la venta`}
                    onChange={(e) => cambiarCantidad(item.productoId, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Sumar ${peso ? 'gramos' : 'una unidad'} de ${item.nombre}`}
                    onClick={() => cambiarCantidad(item.productoId, item.cantidad + paso)}
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
                  {producto.nombre} ·{' '}
                  {producto.tipo === 'peso'
                    ? `${formatARS(producto.precioPorGramo)} / g · stock ${stockDisponible(producto)} g`
                    : `${formatARS(producto.precio)} · stock ${producto.cantidad}`}
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

        <div className="venta-edit-resumen">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatARS(subtotal)}</span>
          </div>

          <div className="descuento-control">
            <label htmlFor="editar-descuento-valor">Descuento</label>
            <div className="descuento-inputs">
              <select
                id="editar-descuento-tipo"
                aria-label="Tipo de descuento"
                value={descuentoTipo}
                onChange={(e) => setDescuentoTipo(e.target.value)}
              >
                <option value="porcentaje">%</option>
                <option value="monto">$</option>
              </select>
              <input
                id="editar-descuento-valor"
                type="number"
                min="0"
                max={descuentoTipo === 'porcentaje' ? 100 : subtotal}
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                aria-label="Descuento"
                value={descuentoValor}
                onChange={(e) => setDescuentoValor(e.target.value)}
              />
            </div>
          </div>

          {descuento > 0 && (
            <div className="summary-row descuento-row">
              <span>Descuento aplicado</span>
              <span>-{formatARS(descuento)}</span>
            </div>
          )}

          <div className="venta-edit-total">
            <span>Total actualizado</span>
            <strong>{formatARS(total)}</strong>
          </div>
        </div>

        <div className="field">
          <label htmlFor="editar-cliente-venta">
            Nombre del cliente{' '}
            {esFiado ? (
              <span className="required-tag">obligatorio</span>
            ) : (
              <span className="optional-tag">opcional</span>
            )}
          </label>
          <input
            id="editar-cliente-venta"
            type="text"
            maxLength={120}
            value={cliente}
            placeholder="Ej: Juan Pérez"
            onChange={(e) => setCliente(e.target.value)}
          />
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

        {metodoPago === 'Efectivo' && (
          <div className="efectivo-pago">
            <div className="field">
              <label htmlFor="editar-pago-con">
                ¿Con cuánto pagó? <span className="optional-tag">opcional</span>
              </label>
              <input
                id="editar-pago-con"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={pagoCon}
                placeholder={formatARS(total)}
                onChange={(e) => setPagoCon(e.target.value)}
              />
            </div>
            {vuelto !== null && (
              <div className="vuelto-box">
                <span>Vuelto</span>
                <strong>{formatARS(vuelto)}</strong>
              </div>
            )}
            {pagoConCargado && !pagoSuficiente && (
              <p className="summary-hint error">El monto pagado no alcanza a cubrir el total.</p>
            )}
          </div>
        )}

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
