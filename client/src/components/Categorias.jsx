import { useState } from 'react';
import ConfirmModal from './ConfirmModal.jsx';
import ProductoForm from './ProductoForm.jsx';
import { IconAlert, IconEdit, IconPlus, IconTag, IconTrash } from './Icons.jsx';

export default function Categorias({
  categorias,
  onCrear,
  onRenombrar,
  onEliminar,
  onCrearProducto,
  onIrAInventario,
}) {
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState('');

  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState('');

  const [categoriaAEliminar, setCategoriaAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  const totalProductos = categorias.reduce((suma, categoria) => suma + categoria.productos, 0);

  async function handleCrear(event) {
    event.preventDefault();
    setErrorCrear('');
    if (!nombre.trim()) {
      setErrorCrear('Ingresá el nombre de la categoría');
      return;
    }

    setCreando(true);
    try {
      await onCrear(nombre.trim());
      setNombre('');
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
      await onRenombrar(editandoId, nombreEdit.trim());
      cancelarEdicion();
    } catch (err) {
      setErrorEdit(err.message);
    } finally {
      setGuardandoEdit(false);
    }
  }

  async function confirmarEliminacion() {
    if (!categoriaAEliminar) return;
    setErrorEliminar('');
    setEliminando(true);
    try {
      await onEliminar(categoriaAEliminar.id);
      setCategoriaAEliminar(null);
    } catch (err) {
      setErrorEliminar(err.message);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="categorias-layout">
      <div className="categorias-formularios">
        <section className="card form-card">
          <div className="card-title">
            <span className="icon-badge">
              <IconPlus size={18} />
            </span>
            <div>
              <h2>Nueva categoría</h2>
              <p className="card-sub">Después vas a poder elegirla al crear o editar productos.</p>
            </div>
          </div>

          <form onSubmit={handleCrear} className="formulario">
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
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            {errorCrear && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{errorCrear}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={creando}>
              {creando ? 'Creando...' : 'Crear categoría'}
            </button>
          </form>

          <p className="form-help">
            Solo las categorías creadas acá aparecen en el formulario de productos.
          </p>
        </section>

        <ProductoForm categorias={categorias} onCrear={onCrearProducto} />
      </div>

      <div className="categorias-panel">
        <div className="page-head">
          <div>
            <h1>Categorías</h1>
            <p>Creá categorías, cargá productos nuevos y organizá los que ya tenés.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onIrAInventario}>
            Ir al inventario
          </button>
        </div>

        <div className="card categorias-card">
          <div className="categorias-card-head">
            <h2>Categorías creadas</h2>
            <span>
              {categorias.length} categoría{categorias.length === 1 ? '' : 's'} · {totalProductos}{' '}
              producto{totalProductos === 1 ? '' : 's'} asignado{totalProductos === 1 ? '' : 's'}
            </span>
          </div>

          {categorias.length === 0 ? (
            <div className="empty-state inline">
              <span className="empty-icon">
                <IconTag size={28} />
              </span>
              <h3>No hay categorías todavía</h3>
              <p>Creá la primera categoría con el formulario para poder cargar productos.</p>
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
                          onChange={(e) => setNombreEdit(e.target.value)}
                          disabled={guardandoEdit}
                        />
                        <button type="submit" className="btn btn-primary btn-sm" disabled={guardandoEdit}>
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
                              setErrorEliminar('');
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
        </div>

        <p className="list-help">
          Las categorías con productos asociados no se pueden eliminar. Primero cambiá o eliminá esos
          productos.
        </p>
      </div>

      {categoriaAEliminar && (
        <ConfirmModal
          titulo="Eliminar categoría"
          mensaje={`¿Seguro que querés eliminar la categoría "${categoriaAEliminar.nombre}"?`}
          detalle="Esta acción no se puede deshacer."
          textoConfirmar="Eliminar categoría"
          onConfirmar={confirmarEliminacion}
          onCerrar={() => setCategoriaAEliminar(null)}
          cargando={eliminando}
          error={errorEliminar}
        />
      )}
    </div>
  );
}
