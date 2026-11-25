import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import {
  IconAlert,
  IconBox,
  IconEdit,
  IconPlus,
  IconSearch,
  IconSend,
  IconTruck,
} from './Icons.jsx';
import { api } from '../api.js';
import { formatARS } from '../utils.js';

function normalizarTexto(valor) {
  return String(valor ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const formularioVacio = {
  razon_social: '',
  telefono: '',
  email: '',
  rubro: '',
  descripcion: '',
};

export default function Proveedores({ onAviso }) {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedorId, setProveedorId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState('');

  const [mostrarModal, setMostrarModal] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [productoIds, setProductoIds] = useState([]);
  const [busquedaModal, setBusquedaModal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorCrear, setErrorCrear] = useState('');

  const [busquedaProductos, setBusquedaProductos] = useState('');
  const [precios, setPrecios] = useState({});
  const [cantidades, setCantidades] = useState({});
  const [guardandoPrecio, setGuardandoPrecio] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [mostrarResumen, setMostrarResumen] = useState(false);

  const cargarDatos = useCallback(async () => {
    const [lista, catalogo] = await Promise.all([api.getProveedores(), api.getProductos()]);
    setProveedores(lista);
    setProductos(catalogo);
    setProveedorId((actual) => (actual && lista.some((item) => item.id === actual) ? actual : lista[0]?.id ?? null));
    return lista;
  }, []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    cargarDatos()
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [cargarDatos]);

  useEffect(() => {
    if (!proveedorId) {
      setDetalle(null);
      setCarrito([]);
      return undefined;
    }

    let activo = true;
    setCargandoDetalle(true);
    setCarrito([]);
    api
      .getProveedor(proveedorId)
      .then((datos) => {
        if (!activo) return;
        setDetalle(datos);
        const mapaPrecios = {};
        datos.productos.forEach((producto) => {
          mapaPrecios[producto.id] = String(producto.precio_compra ?? 0);
        });
        setPrecios(mapaPrecios);
        setCantidades({});
      })
      .catch((err) => {
        if (activo) onAviso?.(err.message, 'error');
      })
      .finally(() => {
        if (activo) setCargandoDetalle(false);
      });

    return () => {
      activo = false;
    };
  }, [proveedorId, onAviso]);

  const productosFiltrados = useMemo(() => {
    const asignados = detalle?.productos ?? [];
    const termino = normalizarTexto(busquedaProductos.trim());
    if (!termino) return asignados;
    return asignados.filter((producto) =>
      [producto.nombre, producto.categoria].some((valor) =>
        normalizarTexto(valor).includes(termino)
      )
    );
  }, [detalle, busquedaProductos]);

  const productosModalFiltrados = useMemo(() => {
    const termino = normalizarTexto(busquedaModal.trim());
    if (!termino) return productos;
    return productos.filter((producto) =>
      [producto.nombre, producto.categoria, producto.codigo_barras].some((valor) =>
        normalizarTexto(valor).includes(termino)
      )
    );
  }, [productos, busquedaModal]);

  const totalPedido = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);

  function cerrarModal() {
    setMostrarModal(false);
    setProveedorEditando(null);
    setFormulario(formularioVacio);
    setProductoIds([]);
    setBusquedaModal('');
    setErrorCrear('');
  }

  function abrirCrearProveedor() {
    setProveedorEditando(null);
    setFormulario(formularioVacio);
    setProductoIds([]);
    setBusquedaModal('');
    setErrorCrear('');
    setMostrarModal(true);
  }

  function abrirEditarProveedor() {
    if (!detalle) return;
    setProveedorEditando(detalle.id);
    setFormulario({
      razon_social: detalle.razon_social,
      telefono: detalle.telefono,
      email: detalle.email,
      rubro: detalle.rubro,
      descripcion: detalle.descripcion,
    });
    setProductoIds(detalle.productos.map((producto) => producto.id));
    setBusquedaModal('');
    setErrorCrear('');
    setMostrarModal(true);
  }

  function alternarProductoModal(id) {
    setProductoIds((actual) =>
      actual.includes(id) ? actual.filter((valor) => valor !== id) : [...actual, id]
    );
  }

  async function handleGuardarProveedor(event) {
    event.preventDefault();
    setErrorCrear('');
    if (!formulario.razon_social.trim()) {
      setErrorCrear('Ingresá la razón social del proveedor');
      return;
    }

    const datos = { ...formulario, producto_ids: productoIds };
    setGuardando(true);
    try {
      const guardado = proveedorEditando
        ? await api.actualizarProveedor(proveedorEditando, datos)
        : await api.crearProveedor(datos);
      await cargarDatos();
      setProveedorId(guardado.id);
      setDetalle(guardado);
      const mapaPrecios = {};
      guardado.productos.forEach((producto) => {
        mapaPrecios[producto.id] = String(producto.precio_compra ?? 0);
      });
      setPrecios(mapaPrecios);
      setCarrito([]);
      cerrarModal();
      onAviso?.(
        proveedorEditando
          ? `Proveedor ${guardado.razon_social} actualizado con exito`
          : `Proveedor ${guardado.razon_social} creado con exito`
      );
    } catch (err) {
      setErrorCrear(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPrecio(producto) {
    if (!detalle) return;
    const precio = Number(precios[producto.id]);
    if (!Number.isFinite(precio) || precio < 0) {
      onAviso?.('Ingresá un precio de compra válido', 'error');
      return;
    }

    setGuardandoPrecio(producto.id);
    try {
      const actualizado = await api.guardarPrecioProveedor(detalle.id, producto.id, precio);
      setDetalle(actualizado);
      onAviso?.(`Precio de ${producto.nombre} guardado para ${actualizado.razon_social}`);
    } catch (err) {
      onAviso?.(err.message, 'error');
    } finally {
      setGuardandoPrecio(null);
    }
  }

  function agregarAlPedido(producto) {
    const cantidad = Math.max(1, Math.floor(Number(cantidades[producto.id]) || 1));
    const precio = Math.max(0, Number(precios[producto.id]) || 0);
    setCarrito((actual) => {
      const existente = actual.find((item) => item.id === producto.id);
      if (existente) {
        return actual.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + cantidad } : item
        );
      }
      return [
        ...actual,
        {
          id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad,
          precio,
        },
      ];
    });
    setCantidades((actual) => ({ ...actual, [producto.id]: '' }));
    onAviso?.(`${producto.nombre} agregado a la lista`);
  }

  function cambiarCantidadCarrito(id, delta) {
    setCarrito((actual) =>
      actual
        .map((item) => (item.id === id ? { ...item, cantidad: item.cantidad + delta } : item))
        .filter((item) => item.cantidad > 0)
    );
  }

  function quitarDelPedido(id) {
    setCarrito((actual) => actual.filter((item) => item.id !== id));
  }

  function abrirResumen() {
    if (carrito.length === 0) return;
    setMostrarResumen(true);
  }

  function textoResumen() {
    return carrito.map((item) => `${item.nombre} - Cantidad: ${item.cantidad}`).join('\n');
  }

  async function copiarResumen() {
    const texto = textoResumen();
    let area = null;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        area = document.createElement('textarea');
        area.value = texto;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        if (!document.execCommand('copy')) throw new Error('No se pudo copiar la lista');
      }
      onAviso?.('Lista copiada al portapapeles');
      setMostrarResumen(false);
    } catch (err) {
      onAviso?.(err.message || 'No se pudo copiar la lista', 'error');
    } finally {
      area?.remove();
    }
  }

  return (
    <div className="proveedores-page">
      <header className="page-head">
        <div className="page-head-copy">
          <h1>Proveedores</h1>
          <p>Administrá distribuidores, precios de compra y listas de pedido.</p>
        </div>
        <div className="page-head-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={abrirCrearProveedor}
          >
            <IconPlus size={16} />
            Agregar proveedor
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" role="alert">
          <IconAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="proveedores-layout">
        <section className="card proveedores-lista" aria-label="Lista de proveedores">
          <div className="card-head">
            <div>
              <h2>Distribuidores</h2>
              <p>{proveedores.length} proveedores registrados</p>
            </div>
          </div>
          {cargando ? (
            <div className="proveedores-skeleton">
              <span />
              <span />
              <span />
            </div>
          ) : proveedores.length === 0 ? (
            <div className="empty-state">
              <IconTruck size={28} />
              <h3>No hay proveedores</h3>
              <p>Agregá el primero para empezar a armar pedidos.</p>
            </div>
          ) : (
            <div className="proveedores-listado">
              {proveedores.map((proveedor) => (
                <button
                  key={proveedor.id}
                  type="button"
                  className={`proveedor-row ${proveedorId === proveedor.id ? 'active' : ''}`}
                  onClick={() => setProveedorId(proveedor.id)}
                  aria-label={`Seleccionar proveedor ${proveedor.razon_social}`}
                >
                  <span className="proveedor-avatar">
                    <IconTruck size={18} />
                  </span>
                  <span className="proveedor-row-info">
                    <strong>{proveedor.razon_social}</strong>
                    <small>
                      {proveedor.rubro || 'Sin rubro'} · {proveedor.productos} productos
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="proveedores-workspace">
          {!detalle ? (
            <section className="card proveedores-empty">
              <div className="empty-state">
                <IconTruck size={30} />
                <h3>Seleccioná un proveedor</h3>
                <p>Vas a ver sus productos, precios de compra y el pedido que quieras enviarle.</p>
              </div>
            </section>
          ) : (
            <>
              <section className="card proveedor-detalle" aria-label="Detalle del proveedor">
                <div className="proveedor-detalle-head">
                  <div>
                    <h2>{detalle.razon_social}</h2>
                    <p>{detalle.rubro || 'Sin rubro'}</p>
                  </div>
                  <div className="proveedor-detalle-actions">
                    <span className="proveedor-detalle-badge">
                      {detalle.productos.length} productos
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={abrirEditarProveedor}
                      aria-label={`Editar proveedor ${detalle.razon_social}`}
                    >
                      <IconEdit size={15} />
                      Editar
                    </button>
                  </div>
                </div>
                <div className="proveedor-detalle-grid">
                  <div>
                    <span className="proveedor-detalle-label">Teléfono</span>
                    <strong>{detalle.telefono || 'No indicado'}</strong>
                  </div>
                  <div>
                    <span className="proveedor-detalle-label">Mail</span>
                    <strong>{detalle.email || 'No indicado'}</strong>
                  </div>
                  <div className="proveedor-detalle-descripcion">
                    <span className="proveedor-detalle-label">Descripción</span>
                    <strong>{detalle.descripcion || 'Sin descripción'}</strong>
                  </div>
                </div>
              </section>

              <div className="proveedores-pedido-layout">
                <section className="card proveedor-productos" aria-label="Productos del proveedor">
                  <div className="card-head">
                    <div>
                      <h2>Productos</h2>
                      <p>Indicá el precio al que comprás cada producto de este proveedor.</p>
                    </div>
                    <label className="search-field">
                      <IconSearch size={17} />
                      <input
                        type="search"
                        placeholder="Buscar producto..."
                        value={busquedaProductos}
                        onChange={(event) => setBusquedaProductos(event.target.value)}
                        aria-label="Buscar productos del proveedor"
                      />
                    </label>
                  </div>

                  {cargandoDetalle ? (
                    <div className="proveedores-skeleton">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : productosFiltrados.length === 0 ? (
                    <div className="empty-state">
                      <IconBox size={28} />
                      <h3>Sin productos asignados</h3>
                      <p>Editá el proveedor para elegir los productos que distribuye.</p>
                    </div>
                  ) : (
                    <div className="proveedor-productos-list">
                      {productosFiltrados.map((producto) => (
                        <div className="proveedor-producto-row" key={producto.id}>
                          <div className="proveedor-producto-info">
                            <strong>{producto.nombre}</strong>
                            <small>{producto.categoria || 'Sin categoría'}</small>
                            <small>Venta: {formatARS(producto.precio)}</small>
                          </div>
                          <div className="proveedor-producto-precio">
                            <label htmlFor={`precio-proveedor-${producto.id}`}>Precio compra</label>
                            <div className="proveedor-inline-field">
                              <input
                                id={`precio-proveedor-${producto.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={precios[producto.id] ?? ''}
                                onChange={(event) =>
                                  setPrecios((actual) => ({
                                    ...actual,
                                    [producto.id]: event.target.value,
                                  }))
                                }
                                aria-label={`Precio de compra de ${producto.nombre}`}
                              />
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                disabled={guardandoPrecio === producto.id}
                                onClick={() => guardarPrecio(producto)}
                                aria-label={`Guardar precio de ${producto.nombre}`}
                              >
                                {guardandoPrecio === producto.id ? '...' : 'Guardar'}
                              </button>
                            </div>
                          </div>
                          <div className="proveedor-producto-cantidad">
                            <label htmlFor={`cantidad-proveedor-${producto.id}`}>Cantidad</label>
                            <input
                              id={`cantidad-proveedor-${producto.id}`}
                              type="number"
                              min="1"
                              step="1"
                              value={cantidades[producto.id] ?? ''}
                              onChange={(event) =>
                                setCantidades((actual) => ({
                                  ...actual,
                                  [producto.id]: event.target.value,
                                }))
                              }
                              aria-label={`Cantidad de ${producto.nombre}`}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => agregarAlPedido(producto)}
                            aria-label={`Agregar ${producto.nombre} a la lista`}
                          >
                            Agregar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="card proveedor-carrito" aria-label="Lista de pedido">
                  <div className="card-head">
                    <div>
                      <h2>Lista de pedido</h2>
                      <p>{carrito.length} productos seleccionados</p>
                    </div>
                  </div>
                  {carrito.length === 0 ? (
                    <div className="empty-state">
                      <IconSend size={28} />
                      <h3>Sin productos</h3>
                      <p>Agregá productos para armar el resumen.</p>
                    </div>
                  ) : (
                    <div className="proveedor-carrito-list">
                      {carrito.map((item) => (
                        <div className="proveedor-carrito-item" key={item.id}>
                          <div className="proveedor-carrito-item-info">
                            <strong>{item.nombre}</strong>
                            <small>
                              {item.cantidad} x {formatARS(item.precio)}
                            </small>
                          </div>
                          <div className="proveedor-carrito-controles">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => cambiarCantidadCarrito(item.id, -1)}
                              aria-label={`Quitar una unidad de ${item.nombre}`}
                            >
                              -
                            </button>
                            <span>{item.cantidad}</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => cambiarCantidadCarrito(item.id, 1)}
                              aria-label={`Agregar una unidad de ${item.nombre}`}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => quitarDelPedido(item.id)}
                              aria-label={`Eliminar ${item.nombre} de la lista`}
                            >
                              <IconAlert size={15} />
                            </button>
                          </div>
                          <strong>{formatARS(item.precio * item.cantidad)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="proveedor-carrito-total">
                    <span>Total estimado</span>
                    <strong>{formatARS(totalPedido)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm proveedor-carrito-enviar"
                    disabled={carrito.length === 0}
                    onClick={abrirResumen}
                  >
                    <IconSend size={16} />
                    Solicitar lista
                  </button>
                </section>
              </div>
            </>
          )}
        </div>
      </div>

      {mostrarModal && (
        <Modal
          titulo={proveedorEditando ? 'Editar proveedor' : 'Agregar proveedor'}
          subtitulo="Cargá los datos de contacto y los productos que distribuye."
          icono={<IconTruck size={18} />}
          size="lg"
          onCerrar={cerrarModal}
        >
          <form onSubmit={handleGuardarProveedor} className="formulario" id="form-proveedor">
            <div className="config-form">
              <div className="field">
                <label htmlFor="proveedor-razon-social">Razón social</label>
                <input
                  id="proveedor-razon-social"
                  type="text"
                  value={formulario.razon_social}
                  maxLength={120}
                  autoFocus
                  required
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, razon_social: event.target.value }))
                  }
                />
              </div>
              <div className="proveedor-form-grid">
                <div className="field">
                  <label htmlFor="proveedor-telefono">Teléfono</label>
                  <input
                    id="proveedor-telefono"
                    type="tel"
                    value={formulario.telefono}
                    maxLength={60}
                    onChange={(event) =>
                      setFormulario((actual) => ({ ...actual, telefono: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="proveedor-email">Mail</label>
                  <input
                    id="proveedor-email"
                    type="email"
                    value={formulario.email}
                    maxLength={120}
                    onChange={(event) =>
                      setFormulario((actual) => ({ ...actual, email: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="proveedor-rubro">Rubro</label>
                <input
                  id="proveedor-rubro"
                  type="text"
                  value={formulario.rubro}
                  maxLength={80}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, rubro: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="proveedor-descripcion">Descripción</label>
                <textarea
                  id="proveedor-descripcion"
                  rows="3"
                  value={formulario.descripcion}
                  maxLength={500}
                  onChange={(event) =>
                    setFormulario((actual) => ({ ...actual, descripcion: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Productos que distribuye</label>
                <label className="search-field">
                  <IconSearch size={17} />
                  <input
                    type="search"
                    placeholder="Buscar producto..."
                    value={busquedaModal}
                    onChange={(event) => setBusquedaModal(event.target.value)}
                    aria-label="Buscar productos que distribuye"
                  />
                </label>
                <div className="proveedor-modal-productos">
                  {productosModalFiltrados.length === 0 ? (
                    <p className="proveedor-modal-vacio">No hay productos disponibles.</p>
                  ) : (
                    productosModalFiltrados.map((producto) => (
                      <label
                        className="proveedor-modal-producto"
                        key={producto.id}
                        htmlFor={`distribuye-${producto.id}`}
                      >
                        <input
                          id={`distribuye-${producto.id}`}
                          type="checkbox"
                          checked={productoIds.includes(producto.id)}
                          onChange={() => alternarProductoModal(producto.id)}
                        />
                        <span>{producto.nombre}</span>
                        <small>{producto.categoria || 'Sin categoría'}</small>
                      </label>
                    ))
                  )}
                </div>
                <small className="proveedor-modal-ayuda">
                  {productoIds.length} productos seleccionados
                </small>
              </div>
            </div>
            {errorCrear && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{errorCrear}</span>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={cerrarModal}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                {guardando
                  ? 'Guardando...'
                  : proveedorEditando
                    ? 'Guardar cambios'
                    : 'Crear proveedor'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {mostrarResumen && (
        <Modal
          titulo="Lista para el proveedor"
          subtitulo="Productos y cantidades que vas a enviar."
          icono={<IconSend size={18} />}
          onCerrar={() => setMostrarResumen(false)}
        >
          <div className="proveedor-resumen-list">
            {carrito.map((item) => (
              <div className="proveedor-resumen-item" key={item.id}>
                <strong>{item.nombre}</strong>
                <span>Cantidad: {item.cantidad}</span>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMostrarResumen(false)}
            >
              Cerrar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={copiarResumen}>
              Copiar lista
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
