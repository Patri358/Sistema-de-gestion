import Modal from './Modal.jsx';
import { IconAlert, IconTrash } from './Icons.jsx';

export default function ConfirmModal({
  titulo,
  mensaje,
  detalle,
  textoConfirmar = 'Eliminar',
  onConfirmar,
  onCerrar,
  cargando = false,
  error = '',
}) {
  return (
    <Modal
      titulo={titulo}
      icono={<IconTrash size={18} />}
      onCerrar={cargando ? () => {} : onCerrar}
    >
      <p className="confirm-text">{mensaje}</p>
      {detalle && <div className="confirm-detail">{detalle}</div>}

      {error && (
        <div className="alert alert-error" role="alert">
          <IconAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={cargando}>
          Cancelar
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirmar} disabled={cargando}>
          {cargando ? 'Eliminando...' : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
