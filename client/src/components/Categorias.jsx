import { useMemo, useState } from 'react';
import ConfirmModal from './ConfirmModal.jsx';
import EditarProductoModal from './EditarProductoModal.jsx';
import Modal from './Modal.jsx';
import ProductoForm from './ProductoForm.jsx';
import {
  IconAlert,
  IconBox,
  IconEdit,
  IconImage,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
  IconX,
} from './Icons.jsx';
import { esProductoPeso, formatARS, iniciales, stockDisponible } from '../utils.js';

function normalizarTexto(valor) {
  return String(valor ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function Productos({
  productos,
  categorias,
  cargando,
  onCrearProducto,
  onEditarProducto,
  onEliminarProducto,
  onAlternarActivo,
  onCrearCategoria,
  onRenombrarCategoria,
  onEliminarCategoria,
  onIrAInventario,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarProductoModal, setMostrarProductoModal] = useState(false);
  const [mostrarCategoriaModal, setMostrarCategoriaModal] = useState(false);

  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState('');

  const [productoEditando, setProductoEditando] = useState(null);
  const [productoAEliminar, setProductoAEliminar] = useState(null);
  const [eliminandoProducto, setEliminandoProducto] = useState(false);
  const [errorEliminarProducto, setErrorEliminarProducto] = useState('');
  const [alternandoActivo, setAlternandoActivo] = useState(null);

  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');

  const [categoriaAEliminar, setCategoriaAEliminar] = useState(null);
  const [eliminandoCategoria, setEliminandoCategoria] = useState(false);
  const [errorEliminarCategoria, setErrorEliminarCategoria] = useState('');

  const totalProductos = categorias.reduce((suma, categoria) => suma + categoria.productos, 0);

  const productosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return productos;
    return productos.filter((producto) =>
      [producto.nombre, producto.categoria, producto.codigo_barras].some((valor) =>
        normalizarTexto(valor).includes(termino)
      )
    );
  }, [productos, busqueda]);

  function cerrarCategoriaModal() {
    setMostrarCategoriaModal(false);
    setNombre('');
    setErrorCrear('');
  }

  async function handleCrearCategoria(event) {
    event.preventDefault();
    setErrorCrear('');
    if (!nombre.trim()) {
      setErrorCrear('Ingresá el nombre de la categoría');
      return;
    }

    setCreando(true);
    try {
      await onCrearCategoria(nombre.trim());
      cerrarCategoriaModal();
    } catch (err) {
      setErrorCrear(err.message);
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(categoria) {
    setEditandoId(categoria.id);
    setNombreEdit(categoria.nombre);
    setErrorEdit('');
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setNombreEdit('');
    setErrorEdit('');
  }

  async function guardarEdicion(event) {
    event.preventDefault();
    setErrorEdit('');
    if (!nombreEdit.trim()) {
      setErrorEdit('Ingresá un nombre');
      return;
    }

    setGuardandoEdit(true);
    try {
      await onRenombrarCategoria(editandoId, nombreEdit.trim());
      cancelarEdicion();
    } catch (err) {
      setErrorEdit(err.message);
    } finally {
      setGuardandoEdit(false);
    }
  }

  async function alternarActivo(producto) {
    if (alternandoActivo) return;
    setAlternandoActivo(producto.id);
    try {
      await onAlternarActivo(producto.id);
    } catch {
      setAlternandoActivo(null);
      return;
    }
    setAlternandoActivo(null);
  }

  async function confirmarEliminacionProducto() {
    if (!productoAEliminar) return;
    setErrorEliminarProducto('');
    setEliminandoProducto(true);
    try {
      await onEliminarProducto(productoAEliminar.id);
      setProductoAEliminar(null);
    } catch (err) {
      setErrorEliminarProducto(err.message);
    } finally {
      setEliminandoProducto(false);
    }
  }

  async function confirmarEliminacionCategoria() {
    if (!categoriaAEliminar) return;
    setErrorEliminarCategoria('');
    setEliminandoCategoria(true);
    try {
      await onEliminarCategoria(categoriaAEliminar.id);
      setCategoriaAEliminar(null);
    } catch (err) {
      setErrorEliminarCategoria(err.message);
    } finally {
      setEliminandoCategoria(false);
    }
  }

  return (
    <div className="productos-admin-page">
      <div className="page-head">
        <div>
          <h1>Productos</h1>
          <p>Cargá productos, administrá las categorías y mantené actualizado el inventario.</p>
        </div>
        <div className="page-head-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onIrAInventario}
          >
            Ir al inventario
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setMostrarCategoriaModal(true)}
          >
            <IconTag size={15} />
            Crear categoría
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setMostrarProductoModal(true)}
          >
            <IconPlus size={15} />
            Crear producto
          </button>
        </div>
      </div>

      <div className="productos-admin-layout">
        <section className="card productos-admin-card">
          <div className="categorias-card-head">
            <h2>Productos creados</h2>
            <span>
              {productos.length} producto{productos.length === 1 ? '' : 's'}
              {busqueda && ` · ${productosFiltrados.length} encontrado${productosFiltrados.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="search-field productos-admin-search">
            <IconSearch size={19} />
            <input
              type="search"
              value={busqueda}
              placeholder="Buscar por nombre, categoría o código de barra..."
              aria-label="Buscar productos creados"
              onChange={(event) => setBusqueda(event.target.value)}
            />
            {busqueda && (
              <button
                type="button"
                className="icon-button"
                aria-label="Limpiar búsqueda"
                onClick={() => setBusqueda('')}
              >
                <IconX size={16} />
              </button>
            )}
          </div>

          {cargando ? (
            <div className="productos-admin-list">
              {Array.from({ length: 4 }).map((_, indice) => (
                <div key={indice} className="producto-admin-card producto-admin-skeleton">
                  <div className="skeleton skeleton-media" />
                  <div className="skeleton-body">
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-line short" />
                  </div>
                </div>
              ))}
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="empty-state inline">
              <span className="empty-icon">
                <IconBox size={28} />
              </span>
              <h3>{busqueda ? 'No encontramos productos' : 'Todavía no hay productos'}</h3>
              <p>
                {busqueda
                  ? 'Probá con otro nombre, categoría o código de barra.'
                  : 'Usá el botón “Crear producto” para cargar el primero.'}
              </p>
            </div>
          ) : (
            <div className="productos-admin-list">
              {productosFiltrados.map((producto) => {
                const peso = esProductoPeso(producto);
                const deshabilitado = Number(producto.activo) === 0;
                return (
                  <article
                    key={producto.id}
                    className={`producto-admin-card ${deshabilitado ? 'deshabilitado' : ''}`}
                  >
                    <div className="producto-admin-media">
                      {producto.imagen ? (
                        <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
                      ) : (
                        <div className="product-placeholder">
                          <span>{iniciales(producto.nombre)}</span>
                          <IconImage size={20} />
                        </div>
                      )}
                    </div>

                    <div className="producto-admin-nombre" title={producto.nombre}>
                      {producto.nombre}
                    </div>

                    <span className="chip chip-category producto-admin-categoria">
                      <IconTag size={12} />
                      {producto.categoria}
                    </span>

                    <p className="producto-admin-price">
                      {peso && producto.precioPorGramo ? (
                        <>
                          {formatARS(producto.precioPorGramo)} <small>/ g</small>
                        </>
                      ) : (
                        formatARS(producto.precio)
                      )}
                    </p>

                    <span className="producto-admin-stock">
                      {peso
                        ? `${stockDisponible(producto)} g disponibles`
                        : `${producto.cantidad} en stock`}
                    </span>

                    <button
                      type="button"
                      className={`chip producto-admin-estado ${
                        deshabilitado ? 'chip-disabled' : 'stock-ok'
                      }`}
                      title={deshabilitado ? 'Habilitar producto' : 'Deshabilitar producto'}
                      aria-label={`${deshabilitado ? 'Habilitar' : 'Deshabilitar'} ${producto.nombre}`}
                      aria-pressed={!deshabilitado}
                      disabled={alternandoActivo === producto.id}
                      onClick={() => alternarActivo(producto)}
                    >
                      {alternandoActivo === producto.id
                        ? '...'
                        : deshabilitado
                          ? 'Inactivo'
                          : 'Activo'}
                    </button>

                    <div className="producto-admin-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title="Editar producto"
                        aria-label={`Editar ${producto.nombre}`}
                        onClick={() => setProductoEditando(producto)}
                      >
                        <IconEdit size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title="Eliminar producto"
                        aria-label={`Eliminar ${producto.nombre}`}
                        onClick={() => {
                          setErrorEliminarProducto('');
                          setProductoAEliminar(producto);
                        }}
                      >
                        <IconTrash size={17} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="categorias-panel">
          <section className="card categorias-card">
            <div className="categorias-card-head">
              <h2>Categorías</h2>
              <span>
                {categorias.length} categoría{categorias.length === 1 ? '' : 's'} · {totalProductos}{' '}
                producto{totalProductos === 1 ? '' : 's'}
              </span>
            </div>

            {categorias.length === 0 ? (
              <div className="empty-state inline">
                <span className="empty-icon">
                  <IconTag size={28} />
                </span>
                <h3>No hay categorías todavía</h3>
                <p>Creá la primera con el botón “Crear categoría”.</p>
              </div>
            ) : (
              <div className="categorias-lista">
                {categorias.map((categoria) => (
                  <div key={categoria.id} className="categoria-row-wrap">
                    <div className={`categoria-row ${editandoId === categoria.id ? 'editando' : ''}`}>
                      <span className="categoria-icon">
                        <IconTag size={17} />
                      </span>

                      {editandoId === categoria.id ? (
                        <form className="categoria-edit" onSubmit={guardarEdicion}>
                          <input
                            type="text"
                            value={nombreEdit}
                            maxLength={60}
                            autoFocus
                            aria-label={`Nuevo nombre para ${categoria.nombre}`}
                            onChange={(event) => setNombreEdit(event.target.value)}
                            disabled={guardandoEdit}
                          />
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={guardandoEdit}
                          >
                            {guardandoEdit ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={cancelarEdicion}
                            disabled={guardandoEdit}
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="categoria-info">
                            <strong>{categoria.nombre}</strong>
                            <small>
                              {categoria.productos} producto{categoria.productos === 1 ? '' : 's'}
                            </small>
                          </div>
                          <div className="categoria-actions">
                            <button
                              type="button"
                              className="icon-button"
                              title="Renombrar categoría"
                              aria-label={`Editar categoría ${categoria.nombre}`}
                              onClick={() => iniciarEdicion(categoria)}
                            >
                              <IconEdit size={17} />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              title={
                                categoria.productos > 0
                                  ? 'No se puede eliminar una categoría con productos'
                                  : 'Eliminar categoría'
                              }
                              aria-label={`Eliminar categoría ${categoria.nombre}`}
                              disabled={categoria.productos > 0}
                              onClick={() => {
                                setErrorEliminarCategoria('');
                                setCategoriaAEliminar(categoria);
                              }}
                            >
                              <IconTrash size={17} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {editandoId === categoria.id && errorEdit && (
                      <div className="alert alert-error categoria-alert" role="alert">
                        <IconAlert size={16} />
                        <span>{errorEdit}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="list-help">
            Las categorías con productos asociados no se pueden eliminar. Primero cambiá o eliminá
            esos productos.
          </p>
        </div>
      </div>

      {mostrarProductoModal && (
        <Modal
          titulo="Crear producto"
          subtitulo="Completá los datos y elegí una categoría existente"
          icono={<IconPlus size={18} />}
          size="xl"
          onCerrar={() => setMostrarProductoModal(false)}
        >
          <ProductoForm
            categorias={categorias}
            onCrear={onCrearProducto}
            onCerrar={() => setMostrarProductoModal(false)}
          />
        </Modal>
      )}

      {mostrarCategoriaModal && (
        <Modal
          titulo="Crear categoría"
          subtitulo="Las categorías organizan los productos del inventario"
          icono={<IconTag size={18} />}
          onCerrar={cerrarCategoriaModal}
        >
          <form onSubmit={handleCrearCategoria} className="formulario" id="form-crear-categoria">
            <div className="field">
              <label htmlFor="nombre-categoria">
                <IconTag size={13} /> Nombre de la categoría
              </label>
              <input
                id="nombre-categoria"
                type="text"
                value={nombre}
                maxLength={60}
                placeholder="Ej: Bebidas"
                onChange={(event) => setNombre(event.target.value)}
                autoFocus
                required
              />
            </div>

            {errorCrear && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{errorCrear}</span>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={cerrarCategoriaModal}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creando}>
                {creando ? 'Creando...' : 'Crear categoría'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {productoEditando && (
        <EditarProductoModal
          producto={productoEditando}
          categorias={categorias}
          onGuardar={onEditarProducto}
          onCerrar={() => setProductoEditando(null)}
        />
      )}

      {productoAEliminar && (
        <ConfirmModal
          titulo="Eliminar producto"
          mensaje={`¿Seguro que querés eliminar "${productoAEliminar.nombre}"?`}
          detalle="Se quitará del inventario y del carrito. Esta acción no se puede deshacer."
          textoConfirmar="Eliminar producto"
          onConfirmar={confirmarEliminacionProducto}
          onCerrar={() => setProductoAEliminar(null)}
          cargando={eliminandoProducto}
          error={errorEliminarProducto}
        />
      )}

      {categoriaAEliminar && (
        <ConfirmModal
          titulo="Eliminar categoría"
          mensaje={`¿Seguro que querés eliminar la categoría "${categoriaAEliminar.nombre}"?`}
          detalle="Esta acción no se puede deshacer."
          textoConfirmar="Eliminar categoría"
          onConfirmar={confirmarEliminacionCategoria}
          onCerrar={() => setCategoriaAEliminar(null)}
          cargando={eliminandoCategoria}
          error={errorEliminarCategoria}
        />
      )}
    </div>
  );
}
