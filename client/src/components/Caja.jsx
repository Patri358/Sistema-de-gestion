import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconAlert, IconCheck, IconReceipt, IconWallet } from './Icons.jsx';
import { formatARS, formatFechaCorta, formatFechaLarga, formatHora, todayLocal } from '../utils.js';

function ListaMetodos({ resumen }) {
  if (resumen.porMetodo.length === 0) {
    return <p className="caja-vacio">No hay ventas registradas en esta sesión.</p>;
  }

  return (
    <div className="caja-metodos">
      {resumen.porMetodo.map((metodo) => (
        <div className="caja-metodo-row" key={metodo.metodoPago}>
          <span className="caja-metodo-nombre">{metodo.metodoPago}</span>
          <span className="caja-metodo-cantidad">
            {metodo.cantidad} {metodo.cantidad === 1 ? 'venta' : 'ventas'}
          </span>
          <strong>{formatARS(metodo.total)}</strong>
        </div>
      ))}
    </div>
  );
}

function Fila({ etiqueta, valor, destacado = false, tono = '' }) {
  return (
    <div className={`caja-resumen-row ${destacado ? 'destacado' : ''}`}>
      <span>{etiqueta}</span>
      <strong className={tono}>{valor}</strong>
    </div>
  );
}

function DetalleCierre({ sesion }) {
  const resumen = sesion.resumen;
  const diferencia = resumen.diferencia ?? 0;
  const tono = diferencia < 0 ? 'negativo' : diferencia > 0 ? 'positivo' : '';

  return (
    <>
      <div className="caja-cierre-total">
        <span>Total generado</span>
        <strong>{formatARS(resumen.totalVentas)}</strong>
        <small>
          {resumen.cantidadVentas} {resumen.cantidadVentas === 1 ? 'venta' : 'ventas'} ·{' '}
          {formatHora(sesion.fechaApertura)} a {formatHora(sesion.fechaCierre)}
        </small>
      </div>

      <div className="caja-resumen-rows">
        <Fila etiqueta="Apertura" valor={formatARS(sesion.montoApertura)} />
        <Fila etiqueta="Ventas en efectivo" valor={formatARS(resumen.totalEfectivo)} />
        <Fila etiqueta="Otros medios de pago" valor={formatARS(resumen.totalOtros)} />
        <Fila etiqueta="Efectivo esperado" valor={formatARS(resumen.efectivoEsperado)} />
        <Fila etiqueta="Efectivo contado" valor={formatARS(sesion.montoCierre)} destacado />
        <Fila
          etiqueta="Diferencia"
          valor={`${diferencia > 0 ? '+' : ''}${formatARS(diferencia)}`}
          destacado
          tono={tono}
        />
      </div>

      <div className="caja-cierre-metodos">
        <h3>Detalle por medio de pago</h3>
        <ListaMetodos resumen={resumen} />
      </div>

      <p className="caja-cierre-hint">
        El efectivo contado quedará como sugerencia para la próxima apertura de caja.
      </p>
    </>
  );
}

export default function Caja({ datos, cargando, onSolicitarApertura, onCerrarCaja }) {
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [montoContado, setMontoContado] = useState('');
  const [error, setError] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [resumenCierre, setResumenCierre] = useState(null);

  if (cargando) {
    return (
      <div className="caja-page">
        <div className="page-head">
          <div>
            <h1>Caja</h1>
            <p>Aperturas, cierres y resumen de ventas del día.</p>
          </div>
        </div>
        <div className="card caja-skeleton" />
      </div>
    );
  }

  const sesionAbierta = datos?.caja ?? null;
  const sesionVisible = sesionAbierta ?? datos?.ultimaCerrada ?? null;
  const resumen = sesionVisible?.resumen ?? {
    cantidadVentas: 0,
    totalVentas: 0,
    totalEfectivo: 0,
    totalOtros: 0,
    porMetodo: [],
    efectivoEsperado: null,
    diferencia: null,
  };
  const estado = sesionAbierta ? 'abierta' : (datos?.sesiones?.length ?? 0) > 0 ? 'cerrada' : 'pendiente';
  const diferencia = resumen.diferencia;
  const tonoDiferencia =
    diferencia === null ? '' : diferencia < 0 ? 'negativo' : diferencia > 0 ? 'positivo' : '';
  const diferenciaPreview =
    mostrarCierre && montoContado !== '' && Number.isFinite(Number(montoContado))
      ? Number(montoContado) - (resumen.efectivoEsperado ?? 0)
      : null;
  const tonoPreview =
    diferenciaPreview === null
      ? ''
      : diferenciaPreview < 0
        ? 'negativo'
        : diferenciaPreview > 0
          ? 'positivo'
          : '';
  const ultimoCierre = datos?.ultimoCierre;

  function abrirCierre() {
    setMontoContado(String(resumen.efectivoEsperado ?? 0));
    setError('');
    setMostrarCierre(true);
  }

  async function confirmarCierre(event) {
    event.preventDefault();
    setError('');

    const numero = Number(montoContado);
    if (montoContado === '' || !Number.isFinite(numero) || numero < 0) {
      setError('Ingresá el efectivo contado al cerrar');
      return;
    }

    setCerrando(true);
    try {
      const respuesta = await onCerrarCaja(numero);
      setMostrarCierre(false);
      const sesiones = respuesta.sesiones ?? [];
      setResumenCierre(
        respuesta.ultimaCerrada ??
          [...sesiones].reverse().find((sesion) => sesion.montoCierre !== null) ??
          null
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="caja-page">
      <div className="page-head">
        <div>
          <h1>Caja</h1>
          <p>
            Abrí y cerrá la caja todas las veces que necesites durante el día.
            {ultimoCierre && (
              <span className="caja-ultimo-cierre">
                Último cierre: {formatFechaCorta(ultimoCierre.slice(0, 10))} · {formatHora(ultimoCierre)}
              </span>
            )}
          </p>
        </div>
        <span className="count-pill capitalize">
          {formatFechaLarga(datos?.dia ?? todayLocal())}
        </span>
      </div>

      <section className={`caja-banner ${estado}`}>
        <span className="caja-banner-icon">
          {estado === 'abierta' ? (
            <IconWallet size={20} />
          ) : estado === 'cerrada' ? (
            <IconCheck size={20} />
          ) : (
            <IconAlert size={20} />
          )}
        </span>
        <div className="caja-banner-info">
          <strong>
            {estado === 'abierta'
              ? 'Caja abierta'
              : estado === 'cerrada'
                ? 'Caja cerrada'
                : 'La caja de hoy todavía no está abierta'}
          </strong>
          <p>
            {estado === 'abierta'
              ? `Abierta a las ${formatHora(sesionAbierta.fechaApertura)} con ${formatARS(sesionAbierta.montoApertura)}.`
              : estado === 'cerrada'
                ? `Última sesión cerrada a las ${formatHora(datos.ultimaCerrada?.fechaCierre ?? ultimoCierre)} con ${formatARS(datos.ultimaCerrada?.montoCierre ?? 0)}. Podés abrir una nueva.`
                : 'Abrila para habilitar el registro de ventas del día.'}
          </p>
        </div>
        {estado === 'abierta' && (
          <button type="button" className="btn btn-danger btn-sm" onClick={abrirCierre}>
            Cerrar caja
          </button>
        )}
        {estado === 'cerrada' && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setResumenCierre(datos.ultimaCerrada)}
            >
              Ver resumen
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onSolicitarApertura}>
              Abrir nueva caja
            </button>
          </>
        )}
        {estado === 'pendiente' && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onSolicitarApertura}>
            Abrir caja
          </button>
        )}
      </section>

      {sesionVisible && (
        <div className="caja-stats">
          <article className="caja-stat">
            <span>Apertura</span>
            <strong>{formatARS(sesionVisible.montoApertura)}</strong>
            <small>Efectivo inicial</small>
          </article>
          <article className="caja-stat">
            <span>Efectivo vendido</span>
            <strong>{formatARS(resumen.totalEfectivo)}</strong>
            <small>Pagos en efectivo</small>
          </article>
          <article className="caja-stat">
            <span>Otros medios</span>
            <strong>{formatARS(resumen.totalOtros)}</strong>
            <small>Débito, crédito y más</small>
          </article>
          <article className="caja-stat destacado">
            <span>Efectivo esperado</span>
            <strong>{formatARS(resumen.efectivoEsperado)}</strong>
            <small>Apertura + ventas en efectivo</small>
          </article>
        </div>
      )}

      <div className="caja-grid">
        <section className="card caja-card">
          <div className="caja-card-head">
            <h2>Ventas por medio de pago</h2>
            <span>
              {resumen.cantidadVentas} {resumen.cantidadVentas === 1 ? 'venta' : 'ventas'}
            </span>
          </div>
          <ListaMetodos resumen={resumen} />
        </section>

        <section className="card caja-card">
          <div className="caja-card-head">
            <h2>Resumen de la sesión</h2>
          </div>
          <div className="caja-resumen-rows">
            <Fila etiqueta="Total generado" valor={formatARS(resumen.totalVentas)} destacado />
            <Fila etiqueta="Efectivo" valor={formatARS(resumen.totalEfectivo)} />
            <Fila etiqueta="Otros medios" valor={formatARS(resumen.totalOtros)} />
            {sesionVisible && (
              <Fila etiqueta="Efectivo esperado" valor={formatARS(resumen.efectivoEsperado)} />
            )}
            {sesionVisible && sesionVisible.montoCierre !== null && (
              <>
                <Fila etiqueta="Efectivo contado" valor={formatARS(sesionVisible.montoCierre)} />
                <Fila
                  etiqueta="Diferencia"
                  valor={`${diferencia > 0 ? '+' : ''}${formatARS(diferencia)}`}
                  destacado
                  tono={tonoDiferencia}
                />
              </>
            )}
          </div>
          {estado === 'pendiente' && (
            <div className="inline-notice">
              <span>Las ventas se habilitan al abrir la caja del día.</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={onSolicitarApertura}>
                Abrir caja
              </button>
            </div>
          )}
        </section>
      </div>

      {(datos?.sesiones?.length ?? 0) > 0 && (
        <section className="card caja-card caja-sesiones-card">
          <div className="caja-card-head">
            <h2>Sesiones de hoy</h2>
            <span>{datos.sesiones.length} en total</span>
          </div>
          <div className="caja-sesiones">
            {datos.sesiones.map((sesion, indice) => (
              <div className="caja-sesion-row" key={sesion.id}>
                <span className="caja-sesion-num">#{indice + 1}</span>
                <div className="caja-sesion-info">
                  <strong>
                    {formatHora(sesion.fechaApertura)} a{' '}
                    {sesion.fechaCierre ? formatHora(sesion.fechaCierre) : 'ahora'}
                  </strong>
                  <small>
                    {sesion.montoCierre === null
                      ? `Abierta · ${sesion.resumen.cantidadVentas} ventas`
                      : `Cerrada · contado ${formatARS(sesion.montoCierre)}`}
                  </small>
                </div>
                <strong className="caja-sesion-total">
                  {formatARS(sesion.resumen.totalVentas)}
                </strong>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setResumenCierre(sesion)}
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {mostrarCierre && (
        <Modal
          titulo="Cerrar caja"
          subtitulo={formatFechaLarga(datos?.dia ?? todayLocal())}
          icono={<IconWallet size={18} />}
          onCerrar={cerrando ? () => {} : () => setMostrarCierre(false)}
        >
          <form className="formulario" onSubmit={confirmarCierre}>
            <p className="confirm-text">
              Contá el efectivo de la caja y registrá el total con el que cerrás esta sesión.
            </p>

            <div className="caja-esperado-box">
              <span>Efectivo esperado</span>
              <strong>{formatARS(resumen.efectivoEsperado)}</strong>
              <small>Apertura + ventas en efectivo de esta sesión</small>
            </div>

            <div className="field">
              <label htmlFor="monto-cierre">Efectivo contado</label>
              <input
                id="monto-cierre"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                autoFocus
                disabled={cerrando}
              />
            </div>

            {diferenciaPreview !== null && (
              <div className={`caja-diferencia-preview ${tonoPreview}`}>
                <span>Diferencia estimada</span>
                <strong>
                  {diferenciaPreview > 0 ? '+' : ''}
                  {formatARS(diferenciaPreview)}
                </strong>
              </div>
            )}

            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMostrarCierre(false)}
                disabled={cerrando}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-danger" disabled={cerrando}>
                {cerrando ? 'Cerrando...' : 'Cerrar caja'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {resumenCierre && (
        <Modal
          titulo="Resumen de cierre"
          subtitulo={formatFechaLarga(resumenCierre.dia)}
          icono={<IconReceipt size={18} />}
          size="lg"
          onCerrar={() => setResumenCierre(null)}
        >
          <DetalleCierre sesion={resumenCierre} />
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setResumenCierre(null)}
            >
              Listo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
