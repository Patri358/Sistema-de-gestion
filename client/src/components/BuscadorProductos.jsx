import { useEffect, useMemo, useRef, useState } from 'react';

export default function BuscadorProductos({
  id,
  productos,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar producto...',
}) {
  const seleccionado = productos.find((item) => item.id === Number(value));
  const [texto, setTexto] = useState(seleccionado?.nombre ?? '');
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  useEffect(() => {
    function cerrarFuera(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', cerrarFuera);
    return () => document.removeEventListener('mousedown', cerrarFuera);
  }, []);

  const coincidencias = useMemo(() => {
    const busqueda = texto.trim().toLocaleLowerCase('es');
    return productos.filter((producto) =>
      producto.nombre.toLocaleLowerCase('es').includes(busqueda)
    );
  }, [productos, texto]);

  function elegir(producto) {
    setTexto(producto.nombre);
    onChange(String(producto.id));
    setAbierto(false);
  }

  function handleKeyDown(evento) {
    if (evento.key === 'Escape') setAbierto(false);
    if (evento.key === 'Enter' && abierto && coincidencias.length) {
      evento.preventDefault();
      elegir(coincidencias[0]);
    }
  }

  return (
    <div className="product-search" ref={contenedor}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={texto}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setAbierto(true)}
        onChange={(evento) => {
          setTexto(evento.target.value);
          onChange('');
          setAbierto(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {abierto && (
        <div className="product-search-list" role="listbox">
          {coincidencias.length ? (
            coincidencias.map((producto) => (
              <button
                key={producto.id}
                type="button"
                role="option"
                aria-selected={Number(value) === producto.id}
                className={Number(value) === producto.id ? 'seleccionado' : ''}
                onClick={() => elegir(producto)}
              >
                {producto.nombre}
              </button>
            ))
          ) : (
            <span className="product-search-empty">Sin coincidencias</span>
          )}
        </div>
      )}
    </div>
  );
}
