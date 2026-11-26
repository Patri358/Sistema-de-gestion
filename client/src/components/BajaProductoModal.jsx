import { useState } from 'react';
import BuscadorProductos from './BuscadorProductos.jsx';
import Modal from './Modal.jsx';
import { IconAlert, IconTrash } from './Icons.jsx';
import { esProductoPeso } from '../utils.js';

export default function BajaProductoModal({ productos, onGuardar, onCerrar }) {
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('Vencimiento');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const producto = productos.find((item) => item.id === Number(productoId));
  const unidad = esProductoPeso(producto) ? 'gramos' : 'unidades';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!productoId) {
      setError('Elegí un producto');
      return;
    }
    const valor = Number(cantidad);
    if (!Number.isInteger(valor) || valor <= 0) {
      setError('La cantidad debe ser un número entero mayor que 0');
      return;
    }
    if (motivo === 'Otro' && !motivoDetalle.trim()) {
      setError('Indicá la razón de la baja');
      return;
    }

    setGuardando(true);
    try {
      await onGuardar({
        productoId: Number(productoId),
        cantidad: valor,
        motivo,
        motivoDetalle: motivo === 'Otro' ? motivoDetalle.trim() : undefined,
      });
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Dar de baja un producto"
      subtitulo="La baja queda registrada en los movimientos de stock"
      icono={<IconAlert size={18} />}
      onCerrar={onCerrar}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="baja-producto">Producto</label>
          <BuscadorProductos
            id="baja-producto"
            productos={productos}
            value={productoId}
            onChange={setProductoId}
            disabled={guardando}
            placeholder="Escribí para buscar un producto"
          />
        </div>

        <div className="field">
          <label htmlFor="baja-cantidad">Cantidad ({unidad})</label>
          <input
            id="baja-cantidad"
            type="number"
            min="1"
            step="1"
            value={cantidad}
            onChange={(event) => setCantidad(event.target.value)}
            disabled={guardando}
          />
          {producto && (
            <small className="field-hint">
              Stock disponible: {producto.gramosPorUnidad || producto.gramos_por_unidad ? producto.gramosDisponibles ?? producto.gramos_disponibles ?? 0 : producto.cantidad}{' '}
              {unidad}
            </small>
          )}
        </div>

        <div className="field">
          <label htmlFor="baja-motivo">Motivo</label>
          <select
            id="baja-motivo"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            disabled={guardando}
          >
            <option value="Vencimiento">Vencimiento</option>
            <option value="Rotura">Rotura</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        {motivo === 'Otro' && (
          <div className="field">
            <label htmlFor="baja-motivo-detalle">Razón de la baja</label>
            <input
              id="baja-motivo-detalle"
              type="text"
              maxLength={200}
              value={motivoDetalle}
              onChange={(event) => setMotivoDetalle(event.target.value)}
              placeholder="Indicá manualmente la razón"
              disabled={guardando}
            />
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-danger" disabled={guardando}>
            <IconTrash size={15} /> Confirmar baja
          </button>
        </div>
      </form>
    </Modal>
  );
}
