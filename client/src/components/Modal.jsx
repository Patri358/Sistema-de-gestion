import { useEffect } from 'react';
import { IconX } from './Icons.jsx';

export default function Modal({ titulo, subtitulo, icono, size, onCerrar, children }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onCerrar();
    }
    document.addEventListener('keydown', handleKey);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCerrar();
      }}
    >
      <div
        className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            {icono && <span className="modal-icon">{icono}</span>}
            <div>
              <h2 id="modal-title">{titulo}</h2>
              {subtitulo && <p>{subtitulo}</p>}
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onCerrar}>
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
