import { useState } from 'react';
import BuscadorProductos from './BuscadorProductos.jsx';
import Modal from './Modal.jsx';
import { IconPlus, IconTruck, IconX } from './Icons.jsx';
import { esProductoPeso } from '../utils.js';

let siguienteClave = 0;

function filaVacia() {
  siguienteClave += 1;
  return { clave: siguienteClave, productoId: '', cantidad: '', fechaVencimiento: '' };
}

export default function IngresoMercaderiaModal({ productos, onGuardar, onCerrar }) {
  const [filas, setFilas] = useState([filaVacia()]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function actualizar(indice, campo, valor) {
    setFilas((actuales) =>
      actuales.map((fila, posicion) =>
        posicion === indice ? { ...fila, [campo]: valor } : fila
      )
    );
  }

  function unidadDe(fila) {
    const producto = productos.find((item) => item.id === Number(fila.productoId));
    return esProductoPeso(producto) ? 'gramos' : 'unidades';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    for (const [indice, fila] of filas.entries()) {
      if (!fila.productoId) {
        setError(`Elegí un producto en la fila ${indice + 1}`);
        return;
      }
      const cantidad = Number(fila.cantidad);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        setError(`La cantidad de la fila ${indice + 1} debe ser mayor que 0`);
        return;
      }
    }

    setGuardando(true);
    try {
      await onGuardar(
        filas.map((fila) => ({
          productoId: Number(fila.productoId),
          cantidad: Number(fila.cantidad),
          fechaVencimiento: fila.fechaVencimiento || null,
        }))
      );
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Ingreso de mercadería"
      subtitulo="Registrá uno o varios lotes que entran al stock"
      icono={<IconTruck size={18} />}
      size="lg"
      onCerrar={onCerrar}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="ingreso-filas">
          {filas.map((fila, indice) => (
            <div className="ingreso-fila" key={fila.clave}>
              <div className="field">
                <label htmlFor={`ingreso-producto-${indice}`}>Producto</label>
                <BuscadorProductos
                  id={`ingreso-producto-${indice}`}
                  productos={productos}
                  value={fila.productoId}
                  onChange={(valor) => actualizar(indice, 'productoId', valor)}
                  disabled={guardando}
                  placeholder="Escribí para buscar un producto"
                />
              </div>
              <div className="field">
                <label htmlFor={`ingreso-cantidad-${indice}`}>
                  Cantidad ({unidadDe(fila)})
                </label>
                <input
                  id={`ingreso-cantidad-${indice}`}
                  type="number"
                  min="1"
                  step="1"
                  value={fila.cantidad}
                  onChange={(event) => actualizar(indice, 'cantidad', event.target.value)}
                  disabled={guardando}
                />
              </div>
              <div className="field">
                <label htmlFor={`ingreso-vencimiento-${indice}`}>
                  Vencimiento del lote <span className="opcional">(opcional)</span>
                </label>
                <input
                  id={`ingreso-vencimiento-${indice}`}
                  type="date"
                  value={fila.fechaVencimiento}
                  onChange={(event) => actualizar(indice, 'fechaVencimiento', event.target.value)}
                  disabled={guardando}
                />
              </div>
              <button
                type="button"
                className="icon-button ingreso-quitar"
                aria-label={`Quitar fila ${indice + 1}`}
                onClick={() => setFilas((actuales) => actuales.filter((_, pos) => pos !== indice))}
                disabled={filas.length === 1 || guardando}
              >
                <IconX size={16} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setFilas((actuales) => [...actuales, filaVacia()])}
          disabled={guardando}
        >
          <IconPlus size={15} /> Agregar otro producto
        </button>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? 'Registrando...' : 'Registrar ingreso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
