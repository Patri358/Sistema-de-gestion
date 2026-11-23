import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import {
  IconAlert,
  IconCheck,
  IconReceipt,
  IconUsers,
  IconWallet,
} from './Icons.jsx';
import { api } from '../api.js';
import { formatARS, formatFechaCorta, formatHora, iniciales } from '../utils.js';

function estadoCompra(venta) {
  if (!venta.fiado || venta.saldo === 0) {
    return { texto: 'Pagada', clase: 'pagada' };
  }
  if (venta.montoPagado > 0) {
    return { texto: 'Pago parcial', clase: 'parcial' };
  }
  return { texto: 'Pendiente', clase: 'pendiente' };
}

export default function Clientes({ onAviso, onCambio }) {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState('');
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [pagoVentaId, setPagoVentaId] = useState('');
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState('');

  const cargarClientes = useCallback(async () => {
    const datos = await api.getClientes();
    setClientes(datos);
    return datos;
  }, []);

  useEffect(() => {
    let activo = true;
    cargarClientes()
      .then((datos) => {
        if (activo && datos.length > 0) setClienteId(datos[0].id);
      })
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [cargarClientes]);

  useEffect(() => {
    if (clienteId === null) {
      setDetalle(null);
      return;
    }
    let activo = true;
    setCargandoDetalle(true);
    setError('');
    api
      .getCliente(clienteId)
      .then((datos) => {
        if (activo) setDetalle(datos);
      })
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargandoDetalle(false);
      });
    return () => {
      activo = false;
    };
  }, [clienteId]);

  function abrirPago() {
    const pendientes = (detalle?.ventas ?? []).filter(
      (venta) => venta.fiado && venta.saldo > 0
    );
    if (pendientes.length === 0) return;
    setPagoVentaId(String(pendientes[0].id));
    setPagoMonto(String(pendientes[0].saldo));
    setErrorPago('');
    setPagoAbierto(true);
  }

  function cambiarCompra(id) {
    const venta = (detalle?.ventas ?? []).find((item) => item.id === Number(id));
    setPagoVentaId(id);
    setPagoMonto(venta ? String(venta.saldo) : '');
    setErrorPago('');
  }

  async function confirmarPago(event) {
    event.preventDefault();
    if (!detalle || !pagoVentaId) return;
    const monto = Number(pagoMonto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorPago('Ingresá un monto mayor a 0');
      return;
    }

    setPagando(true);
    setErrorPago('');
    try {
      const actualizado = await api.pagarDeuda(detalle.id, Number(pagoVentaId), monto);
      setDetalle(actualizado);
      await cargarClientes();
      onCambio?.();
      setPagoAbierto(false);
      onAviso?.(`Deuda de ${actualizado.nombre} pagada`, 'success');
    } catch (err) {
      setErrorPago(err.message);
    } finally {
      setPagando(false);
    }
  }

  const comprasPendientes = (detalle?.ventas ?? []).filter(
    (venta) => venta.fiado && venta.saldo > 0
  );
  const compraSeleccionada = comprasPendientes.find(
    (venta) => venta.id === Number(pagoVentaId)
  );

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>Consultá compras, deudas y pagos registrados.</p>
        </div>
      </section>

      {error && (
        <div className="inline-notice error" role="alert">
          <IconAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="clientes-layout">
        <section className="card clientes-lista" aria-label="Lista de clientes">
          <div className="card-head">
            <div>
              <h2>Clientes</h2>
              <p>{clientes.length} registrados</p>
            </div>
          </div>

          {cargando ? (
            <p className="estado-vacio">Cargando clientes...</p>
          ) : clientes.length === 0 ? (
            <p className="estado-vacio">
              Todavía no hay clientes. Se crean automáticamente al vender a fiado o al cargar un
              nombre de cliente en el carrito.
            </p>
          ) : (
            <div className="clientes-listado">
              {clientes.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  className={`cliente-row ${clienteId === cliente.id ? 'active' : ''}`}
                  onClick={() => setClienteId(cliente.id)}
                >
                  <span className="cliente-avatar">{iniciales(cliente.nombre)}</span>
                  <span className="cliente-row-info">
                    <strong>{cliente.nombre}</strong>
                    <small>
                      {cliente.cantidadCompras}{' '}
                      {cliente.cantidadCompras === 1 ? 'compra' : 'compras'}
                    </small>
                  </span>
                  <span className={`cliente-deuda ${cliente.deuda > 0 ? 'pendiente' : 'pagada'}`}>
                    {formatARS(cliente.deuda)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card clientes-detalle" id="cliente-detalle" aria-label="Detalle del cliente">
          {!detalle ? (
            <div className="estado-vacio">
              <IconUsers size={28} />
              <p>Seleccioná un cliente para ver sus compras.</p>
            </div>
          ) : cargandoDetalle ? (
            <div className="estado-vacio">Cargando compras...</div>
          ) : (
            <>
              <div className="clientes-detalle-head">
                <div className="clientes-detalle-titulo">
                  <span className="cliente-avatar grande">{iniciales(detalle.nombre)}</span>
                  <div>
                    <h2>{detalle.nombre}</h2>
                    <p>Desde {detalle.creadoEn?.slice(0, 10) || '—'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={abrirPago}
                  disabled={detalle.deuda <= 0}
                >
                  <IconWallet size={16} />
                  Pagar deuda
                </button>
              </div>

              <div className="clientes-stats">
                <div>
                  <span>Deuda actual</span>
                  <strong className={detalle.deuda > 0 ? 'texto-pendiente' : ''}>
                    {formatARS(detalle.deuda)}
                  </strong>
                </div>
                <div>
                  <span>Total comprado</span>
                  <strong>{formatARS(detalle.totalCompras)}</strong>
                </div>
                <div>
                  <span>A fiado</span>
                  <strong>{formatARS(detalle.totalFiado)}</strong>
                </div>
                <div>
                  <span>Pagado</span>
                  <strong>{formatARS(detalle.totalPagado)}</strong>
                </div>
              </div>

              <h3 className="clientes-subtitulo">Compras</h3>
              {detalle.ventas.length === 0 ? (
                <p className="estado-vacio">Este cliente todavía no tiene compras registradas.</p>
              ) : (
                <div className="clientes-compras">
                  {detalle.ventas.map((venta) => {
                    const estado = estadoCompra(venta);
                    return (
                      <article key={venta.id} className="cliente-compra">
                        <div className="cliente-compra-head">
                          <div>
                            <strong>
                              <IconReceipt size={15} /> Compra #{venta.id}
                            </strong>
                            <small>
                              {formatFechaCorta(venta.dia)} · {formatHora(venta.fecha)} ·{' '}
                              {venta.metodoPago}
                            </small>
                          </div>
                          <span className={`cliente-estado ${estado.clase}`}>{estado.texto}</span>
                        </div>
                        <div className="cliente-compra-montos">
                          <span>
                            Total <strong>{formatARS(venta.total)}</strong>
                          </span>
                          <span>
                            Pagado <strong>{formatARS(venta.montoPagado)}</strong>
                          </span>
                          <span>
                            Saldo <strong>{formatARS(venta.saldo)}</strong>
                          </span>
                        </div>
                        {venta.pagos.length > 0 && (
                          <div className="cliente-compra-pagos">
                            {venta.pagos.map((pago) => (
                              <span key={pago.id}>
                                {formatARS(pago.monto)} · {formatFechaCorta(pago.dia)} ·{' '}
                                {pago.usuario}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {pagoAbierto && detalle && (
        <Modal
          titulo="Pagar deuda"
          subtitulo={`Cliente: ${detalle.nombre}`}
          icono={<IconWallet size={20} />}
          onCerrar={() => setPagoAbierto(false)}
        >
          <form className="config-form" onSubmit={confirmarPago}>
            <div className="field">
              <label htmlFor="pago-compra">Compra a pagar</label>
              <select
                id="pago-compra"
                value={pagoVentaId}
                onChange={(event) => cambiarCompra(event.target.value)}
              >
                {comprasPendientes.map((venta) => (
                  <option key={venta.id} value={venta.id}>
                    Compra #{venta.id} · {formatFechaCorta(venta.dia)} · saldo{' '}
                    {formatARS(venta.saldo)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="pago-monto">¿Cuánto querés pagar?</label>
              <input
                id="pago-monto"
                type="number"
                min="0.01"
                max={compraSeleccionada?.saldo ?? undefined}
                step="0.01"
                inputMode="decimal"
                value={pagoMonto}
                onChange={(event) => setPagoMonto(event.target.value)}
              />
              {compraSeleccionada && (
                <small className="field-hint">
                  Saldo pendiente de esta compra: {formatARS(compraSeleccionada.saldo)}
                </small>
              )}
            </div>

            {errorPago && (
              <div className="inline-notice error" role="alert">
                <IconAlert size={16} />
                <span>{errorPago}</span>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPagoAbierto(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={pagando}>
                {pagando ? 'Registrando pago...' : <><IconCheck size={16} /> Confirmar pago</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
