import { useEffect, useRef, useState } from 'react';
import { IconAlert, IconImage, IconTag, IconX } from './Icons.jsx';
import { comprimirImagen } from '../utils.js';

const FORM_VACIO = {
  nombre: '',
  categoria: '',
  precio: '',
  cantidad: '',
  codigo_barras: '',
  imagen: null,
  tipo: 'unidad',
  gramosPorUnidad: '',
};

export default function ProductoForm({ categorias, onCrear, onCerrar }) {
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const inputImagen = useRef(null);
  const esPeso = form.tipo === 'peso';

  useEffect(() => {
    setForm((actual) => {
      if (actual.categoria && !categorias.some((categoria) => categoria.nombre === actual.categoria)) {
        return { ...actual, categoria: '' };
      }
      return actual;
    });
  }, [categorias]);

  function setCampo(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
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
    if (form.cantidad === '' || Number(form.cantidad) < 0) {
      setError('Ingresá una cantidad válida');
      return;
    }
    if (esPeso) {
      const gramos = Number(form.gramosPorUnidad);
      if (form.gramosPorUnidad === '' || !Number.isInteger(gramos) || gramos <= 0) {
        setError('Los gramos por unidad deben ser un número entero mayor que 0');
        return;
      }
    }

    setEnviando(true);
    try {
      await onCrear({
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        precio: Number(form.precio),
        cantidad: Number(form.cantidad),
        codigo_barras: form.codigo_barras.trim(),
        imagen: form.imagen,
        tipo: form.tipo,
        gramosPorUnidad: esPeso ? Number(form.gramosPorUnidad) : null,
      });
      setForm(FORM_VACIO);
      onCerrar?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
      <form onSubmit={handleSubmit} className="formulario producto-form">
        <div className="producto-form-grid">
          <div className="field producto-form-nombre">
            <label htmlFor="nombre">Nombre del producto</label>
            <input
              id="nombre"
              type="text"
              value={form.nombre}
              maxLength={120}
              placeholder="Ej: Leche entera 1L"
              onChange={(e) => setCampo('nombre', e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="categoria">
              <IconTag size={13} /> Categoría
            </label>
            <select
              id="categoria"
              value={form.categoria}
              onChange={(e) => setCampo('categoria', e.target.value)}
              disabled={categorias.length === 0}
              required
            >
              <option value="" disabled>
                {categorias.length === 0 ? 'No hay categorías creadas' : 'Seleccioná una categoría'}
              </option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.nombre}>
                  {categoria.nombre}
                </option>
              ))}
            </select>

            {categorias.length === 0 && (
              <div className="inline-notice">
                <span>Primero creá una categoría con el botón “Crear categoría”.</span>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="tipo">Tipo de venta</label>
            <select
              id="tipo"
              value={form.tipo}
              onChange={(e) => setCampo('tipo', e.target.value)}
            >
              <option value="unidad">Venta por unidad</option>
              <option value="peso">Venta por peso</option>
            </select>
          </div>

          {esPeso && (
            <div className="field">
              <label htmlFor="gramos-por-unidad">Gramos por unidad</label>
              <input
                id="gramos-por-unidad"
                type="number"
                min="1"
                step="1"
                value={form.gramosPorUnidad}
                placeholder="Ej: 1000"
                onChange={(e) => setCampo('gramosPorUnidad', e.target.value)}
                required
              />
              <small className="field-hint">
                Ej: 3 unidades de 1000 g = 3000 g disponibles.
              </small>
            </div>
          )}

          <div className="field">
            <label htmlFor="precio">{esPeso ? 'Precio por unidad' : 'Precio'}</label>
            <input
              id="precio"
              type="number"
              min="0"
              step="0.01"
              value={form.precio}
              placeholder="0.00"
              onChange={(e) => setCampo('precio', e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="cantidad">{esPeso ? 'Unidades en stock' : 'Cantidad'}</label>
            <input
              id="cantidad"
              type="number"
              min="0"
              step="1"
              value={form.cantidad}
              placeholder="0"
              onChange={(e) => setCampo('cantidad', e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="codigo">Código de barra</label>
            <input
              id="codigo"
              type="text"
              value={form.codigo_barras}
              maxLength={60}
              placeholder="Opcional"
              onChange={(e) => setCampo('codigo_barras', e.target.value)}
            />
          </div>
        </div>

        <div className="producto-form-footer">
          <div className="field producto-form-imagen">
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
                className="upload-box upload-box-compact"
                onClick={() => inputImagen.current?.click()}
                disabled={procesandoImagen}
              >
                <IconImage size={22} />
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

          <div className="producto-form-actions">
            {error && (
              <div className="alert alert-error" role="alert">
                <IconAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={enviando || procesandoImagen || categorias.length === 0}
            >
              {enviando ? 'Guardando...' : 'Guardar producto'}
            </button>
          </div>
        </div>
      </form>
  );
}
