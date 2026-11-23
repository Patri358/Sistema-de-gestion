import { useState } from 'react';
import ConfirmModal from './ConfirmModal.jsx';
import Modal from './Modal.jsx';
import {
  IconAlert,
  IconEdit,
  IconLogout,
  IconMoon,
  IconPalette,
  IconSettings,
  IconSun,
  IconTrash,
  IconUserPlus,
  IconUsers,
} from './Icons.jsx';

function rolEtiqueta(rol) {
  return rol === 'admin' ? 'Admin' : 'Empleado';
}

export default function ConfiguracionModal({
  modoOscuro,
  onCambiarModo,
  esAdmin,
  usuarioActual,
  usuarios = [],
  cargandoUsuarios,
  onCreate,
  onUpdate,
  onDelete,
  onCerrarSesion,
  onCerrar,
}) {
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [rol, setRol] = useState('empleado');
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  function reiniciarFormulario() {
    setNombre('');
    setPassword('');
    setConfirmarPassword('');
    setRol('empleado');
    setEditandoId(null);
    setError('');
  }

  function prepararEdicion(usuario) {
    setNombre(usuario.nombre);
    setPassword('');
    setConfirmarPassword('');
    setRol(usuario.rol);
    setEditandoId(usuario.id);
    setError('');
  }

  async function guardarUsuario(event) {
    event.preventDefault();
    setError('');

    if (!nombre.trim()) {
      setError('Ingresá el nombre del usuario');
      return;
    }

    if (!editandoId && !password) {
      setError('Ingresá la contraseña');
      return;
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const datos = {
      nombre: nombre.trim(),
      rol,
      ...(password ? { password, confirmarPassword } : {}),
    };

    setGuardando(true);
    try {
      if (editandoId) await onUpdate(editandoId, datos);
      else await onCreate(datos);
      reiniciarFormulario();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminacion() {
    if (!usuarioAEliminar) return;
    setErrorEliminar('');
    setEliminando(true);
    try {
      await onDelete(usuarioAEliminar.id);
      setUsuarioAEliminar(null);
      if (editandoId === usuarioAEliminar.id) reiniciarFormulario();
    } catch (err) {
      setErrorEliminar(err.message);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Modal
      titulo="Configuración"
      subtitulo="Apariencia y usuarios del sistema"
      icono={<IconSettings size={18} />}
      size="lg"
      onCerrar={onCerrar}
    >
      <section className="config-section">
        <div className="config-section-head">
          <span className="config-icon">
            <IconPalette size={19} />
          </span>
          <div>
            <h3>Apariencia</h3>
            <p>Elegí cómo se ve C-Store POS en este equipo.</p>
          </div>
        </div>

        <div className="config-row">
          <div className="config-row-info">
            <strong>Modo oscuro</strong>
            <small>
              {modoOscuro
                ? 'La interfaz está usando colores oscuros.'
                : 'Activalo para reducir el brillo de la pantalla.'}
            </small>
          </div>
          <button
            type="button"
            className={`theme-toggle ${modoOscuro ? 'activo' : ''}`}
            role="switch"
            aria-checked={modoOscuro}
            aria-label="Modo oscuro"
            onClick={() => onCambiarModo(!modoOscuro)}
          >
            <span className="theme-toggle-thumb">
              {modoOscuro ? <IconMoon size={13} /> : <IconSun size={13} />}
            </span>
          </button>
        </div>
      </section>

      <section className="config-section">
        <div className="config-section-head">
          <span className="config-icon">
            <IconUsers size={19} />
          </span>
          <div>
            <h3>Sesión</h3>
            <p>
              Ingresaste como <strong>{usuarioActual?.nombre ?? 'usuario'}</strong> ·{' '}
              {rolEtiqueta(usuarioActual?.rol)}
            </p>
          </div>
        </div>
        <div className="config-row">
          <div className="config-row-info">
            <strong>Cerrar sesión</strong>
            <small>Para entrar con otro usuario hace falta volver a identificarse.</small>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCerrarSesion}>
            <IconLogout size={15} />
            Cerrar sesión
          </button>
        </div>
      </section>

      {esAdmin && (
        <section className="config-section">
          <div className="config-section-head">
            <span className="config-icon">
              <IconUsers size={19} />
            </span>
            <div>
              <h3>Usuarios</h3>
              <p>Ver, editar, crear y eliminar cuentas del sistema.</p>
            </div>
          </div>

          <div className="config-usuarios-lista" id="usuarios-lista">
            {cargandoUsuarios ? (
              <p className="config-vacio">Cargando usuarios...</p>
            ) : usuarios.length === 0 ? (
              <p className="config-vacio">Todavía no hay usuarios cargados.</p>
            ) : (
              usuarios.map((usuario) => (
                <div className="config-usuario-row" key={usuario.id}>
                  <div className="config-usuario-info">
                    <strong>{usuario.nombre}</strong>
                    <span className={`config-rol ${usuario.rol}`}>{rolEtiqueta(usuario.rol)}</span>
                  </div>
                  <div className="config-usuario-acciones">
                    <button
                      type="button"
                      className="icon-button"
                      title={`Editar ${usuario.nombre}`}
                      aria-label={`Editar ${usuario.nombre}`}
                      onClick={() => prepararEdicion(usuario)}
                    >
                      <IconEdit size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      title={
                        usuario.id === usuarioActual?.id
                          ? 'No podés eliminar tu propio usuario'
                          : `Eliminar ${usuario.nombre}`
                      }
                      aria-label={`Eliminar ${usuario.nombre}`}
                      disabled={usuario.id === usuarioActual?.id}
                      onClick={() => setUsuarioAEliminar(usuario)}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form className="config-usuario-form" onSubmit={guardarUsuario}>
            <div className="config-form-head">
              <IconUserPlus size={17} />
              <strong>{editandoId ? 'Editar usuario' : 'Registrar nuevo usuario'}</strong>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="usuario-nombre">Nombre</label>
                <input
                  id="usuario-nombre"
                  type="text"
                  maxLength={60}
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  disabled={guardando}
                />
              </div>
              <div className="field">
                <label htmlFor="usuario-rol">Rol</label>
                <select
                  id="usuario-rol"
                  value={rol}
                  onChange={(event) => setRol(event.target.value)}
                  disabled={guardando}
                >
                  <option value="empleado">Empleado</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="usuario-password">
                  {editandoId ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                </label>
                <input
                  id="usuario-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={guardando}
                />
              </div>
              <div className="field">
                <label htmlFor="usuario-confirmar">Confirmar contraseña</label>
                <input
                  id="usuario-confirmar"
                  type="password"
                  autoComplete="new-password"
                  value={confirmarPassword}
                  onChange={(event) => setConfirmarPassword(event.target.value)}
                  disabled={guardando}
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="config-form-actions">
              {editandoId && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={reiniciarFormulario}
                  disabled={guardando}
                >
                  Cancelar edición
                </button>
              )}
              <button type="submit" className="btn btn-primary btn-sm" disabled={guardando} id="usuario-guardar">
                {guardando
                  ? 'Guardando...'
                  : editandoId
                    ? 'Guardar cambios'
                    : 'Registrar usuario'}
              </button>
            </div>
          </form>
        </section>
      )}

      {usuarioAEliminar && (
        <ConfirmModal
          titulo="Eliminar usuario"
          mensaje={`¿Eliminar a "${usuarioAEliminar.nombre}"?`}
          detalle="Las cajas que abrió o cerró van a mostrar “Usuario eliminado”."
          textoConfirmar="Eliminar usuario"
          onConfirmar={confirmarEliminacion}
          onCerrar={() => setUsuarioAEliminar(null)}
          cargando={eliminando}
          error={errorEliminar}
        />
      )}
    </Modal>
  );
}
