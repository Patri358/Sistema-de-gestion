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

function ListaRetiros({ retiros = [], vacio = 'No hay retiros de efectivo en esta sesión.' }) {
  if (retiros.length === 0) {
    return <p className="caja-vacio">{vacio}</p>;
  }

  return (
    <div className="caja-retiros-lista">
      {retiros.map((retiro) => (
        <div className="caja-retiro-row" key={retiro.id}>
          <div className="caja-retiro-info">
            <strong>{retiro.motivo}</strong>
            <small>
              {formatFechaCorta(retiro.dia)} · {formatHora(retiro.fecha)}
            </small>
          </div>
          <strong className="caja-retiro-monto">-{formatARS(retiro.monto)}</strong>
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
        <Fila
          etiqueta="Retiros de efectivo"
          valor={`-${formatARS(resumen.totalRetiros ?? 0)}`}
          tono={resumen.totalRetiros > 0 ? 'negativo' : ''}
        />
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

      <div className="caja-cierre-metodos">
        <h3>Retiros de efectivo</h3>
        <ListaRetiros retiros={sesion.retiros} />
      </div>

      <p className="caja-cierre-hint">
        El efectivo contado quedará como sugerencia para la próxima apertura de caja.
      </p>
    </>
  );
}

export default function Caja({ datos, cargando, onSolicitarApertura, onRetirarCaja, onCerrarCaja }) {
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [mostrarRetiro, setMostrarRetiro] = useState(false);
  const [montoContado, setMontoContado] = useState('');
  const [montoRetiro, setMontoRetiro] = useState('');
  const [motivoRetiro, setMotivoRetiro] = useState('');
  const [error, setError] = useState('');
  const [errorRetiro, setErrorRetiro] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [retirando, setRetirando] = useState(false);
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
    totalRetiros: 0,
    porMetodo: [],
    efectivoEsperado: null,
    diferencia: null,
  };
  const retiros = sesionVisible?.retiros ?? [];
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

  function abrirRetiro() {
    setMontoRetiro('');
    setMotivoRetiro('');
    setErrorRetiro('');
    setMostrarRetiro(true);
  }

  async function confirmarRetiro(event) {
    event.preventDefault();
    setErrorRetiro('');

    const numero = Number(montoRetiro);
    if (montoRetiro === '' || !Number.isFinite(numero) || numero <= 0) {
      setErrorRetiro('Ingresá un monto mayor a 0');
      return;
    }
    if (!motivoRetiro.trim()) {
      setErrorRetiro('Indicá el motivo del retiro');
      return;
    }

    setRetirando(true);
    try {
      await onRetirarCaja(numero, motivoRetiro.trim());
      setMostrarRetiro(false);
    } catch (err) {
      setErrorRetiro(err.message);
    } finally {
      setRetirando(false);
    }
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
        <div className="caja-banner-actions">
          {estado === 'abierta' && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={abrirRetiro}>
                Retirar dinero
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={abrirCierre}>
                Cerrar caja
              </button>
            </>
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
        </div>
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
          <article className="caja-stat">
            <span>Retiros</span>
            <strong>{formatARS(resumen.totalRetiros ?? 0)}</strong>
            <small>Efectivo retirado</small>
          </article>
          <article className="caja-stat destacado">
            <span>Efectivo esperado</span>
            <strong>{formatARS(resumen.efectivoEsperado)}</strong>
            <small>Apertura + ventas - retiros</small>
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
            <Fila
              etiqueta="Retiros"
              valor={`-${formatARS(resumen.totalRetiros ?? 0)}`}
              tono={resumen.totalRetiros > 0 ? 'negativo' : ''}
            />
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

      {sesionVisible && (
        <section className="card caja-card caja-retiros-card">
          <div className="caja-card-head">
            <div>
              <h2>Retiros de efectivo</h2>
              <p className="caja-card-sub">Movimientos de dinero fuera de la caja</p>
            </div>
            <span>
              {retiros.length} {retiros.length === 1 ? 'retiro' : 'retiros'}
            </span>
          </div>
          <ListaRetiros retiros={retiros} />
          {retiros.length > 0 && (
            <div className="caja-retiros-total">
              <span>Total retirado</span>
              <strong>{formatARS(resumen.totalRetiros ?? 0)}</strong>
            </div>
          )}
        </section>
      )}

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

      {mostrarRetiro && (
        <Modal
          titulo="Retirar dinero"
          subtitulo={formatFechaLarga(datos?.dia ?? todayLocal())}
          icono={<IconWallet size={18} />}
          onCerrar={retirando ? () => {} : () => setMostrarRetiro(false)}
        >
          <form className="formulario" onSubmit={confirmarRetiro}>
            <p className="confirm-text">
              Registrá el efectivo que retirás de la caja. Va a quedar guardado con la fecha y hora
              para el cierre de la sesión.
            </p>

            <div className="caja-esperado-box">
              <span>Efectivo disponible</span>
              <strong>{formatARS(resumen.efectivoEsperado)}</strong>
              <small>Apertura + ventas en efectivo - retiros</small>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="monto-retiro">Monto a retirar</label>
                <input
                  id="monto-retiro"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={montoRetiro}
                  onChange={(e) => setMontoRetiro(e.target.value)}
                  autoFocus
                  disabled={retirando}
                />
              </div>
              <div className="field">
                <label htmlFor="motivo-retiro">Motivo</label>
                <input
                  id="motivo-retiro"
                  type="text"
                  maxLength={200}
                  value={motivoRetiro}
                  placeholder="Ej: pago a proveedor, cambio de fondo"
                  onChange={(e) => setMotivoRetiro(e.target.value)}
                  disabled={retirando}
                />
              </div>
            </div>

            {errorRetiro && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{errorRetiro}</span>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMostrarRetiro(false)}
                disabled={retirando}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={retirando}>
                {retirando ? 'Registrando...' : 'Registrar retiro'}
              </button>
            </div>
          </form>
        </Modal>
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
              <small>Apertura + ventas en efectivo - retiros de esta sesión</small>
            </div>

            <div className="caja-cierre-retiros">
              <h3>Movimientos de efectivo retirado</h3>
              <ListaRetiros
                retiros={retiros}
                vacio="No se registraron retiros en esta sesión."
              />
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
