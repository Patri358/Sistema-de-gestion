import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconAlert, IconWallet } from './Icons.jsx';
import { formatARS, formatFechaLarga, todayLocal } from '../utils.js';

export default function AbrirCajaModal({ sugerencia = 0, onAbrir, onCerrar }) {
  const [monto, setMonto] = useState(sugerencia > 0 ? String(sugerencia) : '');
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  async function confirmar(event) {
    event.preventDefault();
    setError('');

    const numero = Number(monto);
    if (monto === '' || !Number.isFinite(numero) || numero < 0) {
      setError('Ingresá un monto de apertura válido');
      return;
    }

    setAbriendo(true);
    try {
      await onAbrir(numero);
    } catch (err) {
      setError(err.message);
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <Modal
      titulo="Abrir caja"
      subtitulo={formatFechaLarga(todayLocal())}
      icono={<IconWallet size={18} />}
      onCerrar={abriendo ? () => {} : onCerrar}
    >
      <form className="formulario" onSubmit={confirmar}>
        <p className="confirm-text">
          Ingresá el efectivo inicial con el que empieza el día. Lo usaremos para calcular el
          efectivo esperado al cerrar la caja.
        </p>

        {sugerencia > 0 && (
          <div className="caja-sugerencia">
            <IconWallet size={17} />
            <span>
              Último cierre registrado: <strong>{formatARS(sugerencia)}</strong>
            </span>
          </div>
        )}

        <div className="field">
          <label htmlFor="monto-apertura">Efectivo inicial</label>
          <input
            id="monto-apertura"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
            disabled={abriendo}
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={abriendo}>
            Más tarde
          </button>
          <button type="submit" className="btn btn-primary" disabled={abriendo}>
            {abriendo ? 'Abriendo...' : 'Abrir caja'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
