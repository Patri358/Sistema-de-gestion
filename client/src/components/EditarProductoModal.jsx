import { useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { IconAlert, IconEdit, IconImage, IconTag, IconX } from './Icons.jsx';
import { comprimirImagen } from '../utils.js';

export default function EditarProductoModal({ producto, categorias, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    nombre: producto.nombre,
    categoria: producto.categoria,
    precio: String(producto.precio),
    cantidad: String(producto.cantidad),
    codigo_barras: producto.codigo_barras || '',
    imagen: producto.imagen || null,
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const inputImagen = useRef(null);

  function setCampo(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  }

  function sumarStock(extra) {
    setForm((actual) => {
      const actualCantidad = Math.max(0, Math.floor(Number(actual.cantidad) || 0));
      return { ...actual, cantidad: String(actualCantidad + extra) };
    });
  }

  async function handleImagen(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');

    if (!file.type.startsWith('image/')) {
      setError('El archivo seleccionado no es una imagen');
      event.target.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('La imagen no puede superar los 4 MB');
      event.target.value = '';
      return;
    }

    setProcesandoImagen(true);
    try {
      const dataUrl = await comprimirImagen(file);
      setCampo('imagen', dataUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoImagen(false);
      if (inputImagen.current) inputImagen.current.value = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.nombre.trim()) {
      setError('Ingresá el nombre del producto');
      return;
    }
    if (!form.categoria) {
      setError('Seleccioná una categoría');
      return;
    }
    if (form.precio === '' || Number(form.precio) < 0) {
      setError('Ingresá un precio válido');
      return;
    }
    if (form.cantidad === '' || !Number.isInteger(Number(form.cantidad)) || Number(form.cantidad) < 0) {
      setError('La cantidad debe ser un número entero mayor o igual a 0');
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(producto.id, {
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        precio: Number(form.precio),
        cantidad: Number(form.cantidad),
        codigo_barras: form.codigo_barras.trim(),
        imagen: form.imagen,
      });
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Editar producto"
      subtitulo={`#${producto.id} · ${producto.nombre}`}
      icono={<IconEdit size={18} />}
      size="lg"
      onCerrar={guardando ? () => {} : onCerrar}
    >
      <form onSubmit={handleSubmit} className="formulario">
        <div className="field">
          <label htmlFor="editar-nombre">Nombre del producto</label>
          <input
            id="editar-nombre"
            type="text"
            value={form.nombre}
            maxLength={120}
            onChange={(e) => setCampo('nombre', e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="editar-categoria">
            <IconTag size={13} /> Categoría
          </label>
          <select
            id="editar-categoria"
            value={form.categoria}
            onChange={(e) => setCampo('categoria', e.target.value)}
            required
          >
            <option value="" disabled>
              Seleccioná una categoría
            </option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.nombre}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="editar-precio">Precio</label>
            <input
              id="editar-precio"
              type="number"
              min="0"
              step="0.01"
              value={form.precio}
              onChange={(e) => setCampo('precio', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="editar-cantidad">Stock</label>
            <input
              id="editar-cantidad"
              type="number"
              min="0"
              step="1"
              value={form.cantidad}
              onChange={(e) => setCampo('cantidad', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="stock-quick">
          <span>Agregar stock rápido:</span>
          {[1, 5, 10].map((extra) => (
            <button
              key={extra}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => sumarStock(extra)}
            >
              +{extra}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="editar-codigo">Código de barra</label>
          <input
            id="editar-codigo"
            type="text"
            value={form.codigo_barras}
            maxLength={60}
            placeholder="Opcional"
            onChange={(e) => setCampo('codigo_barras', e.target.value)}
          />
        </div>

        <div className="field">
          <span className="label">Imagen</span>
          {form.imagen ? (
            <div className="imagen-preview">
              <img src={form.imagen} alt="Vista previa del producto" />
              <div className="imagen-preview-acciones">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => inputImagen.current?.click()}
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  className="btn btn-danger-ghost btn-sm"
                  onClick={() => setCampo('imagen', null)}
                >
                  <IconX size={15} /> Quitar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="upload-box"
              onClick={() => inputImagen.current?.click()}
              disabled={procesandoImagen}
            >
              <IconImage size={26} />
              <span>{procesandoImagen ? 'Procesando imagen...' : 'Subir imagen'}</span>
              <small>JPG, PNG o WEBP · se comprime automáticamente</small>
            </button>
          )}
          <input
            ref={inputImagen}
            type="file"
            accept="image/*"
            onChange={handleImagen}
            hidden
          />
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <IconAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={guardando || procesandoImagen}
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
