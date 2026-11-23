import { useState } from 'react';
import { IconAlert, IconLock, IconStore } from './Icons.jsx';

export default function Login({ onIngresar }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ingresando, setIngresando] = useState(false);

  async function confirmar(event) {
    event.preventDefault();
    setError('');
    if (!usuario.trim() || !password) {
      setError('Ingresá nombre de usuario y contraseña');
      return;
    }

    setIngresando(true);
    try {
      await onIngresar(usuario.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setIngresando(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={confirmar}>
        <div className="login-brand">
          <span className="login-logo">
            <IconStore size={28} />
          </span>
          <div>
            <h1>C-Store POS</h1>
            <p>Gestión de inventario y ventas</p>
          </div>
        </div>

        <div className="login-titulo">
          <span className="login-icono">
            <IconLock size={20} />
          </span>
          <div>
            <h2>Iniciar sesión</h2>
            <p>Ingresá tus credenciales para continuar.</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="usuario-login">Nombre de usuario</label>
          <input
            id="usuario-login"
            type="text"
            autoComplete="username"
            value={usuario}
            onChange={(event) => setUsuario(event.target.value)}
            placeholder="Tu usuario"
            autoFocus
            disabled={ingresando}
          />
        </div>

        <div className="field">
          <label htmlFor="password-login">Contraseña</label>
          <input
            id="password-login"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu contraseña"
            disabled={ingresando}
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary login-submit" disabled={ingresando}>
          {ingresando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
