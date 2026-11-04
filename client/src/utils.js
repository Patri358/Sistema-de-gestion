const formatoMoneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatARS(value) {
  return formatoMoneda.format(Number(value) || 0);
}

export function calcularDescuento(subtotal, tipo, valor) {
  const bruto = Math.max(0, Number(subtotal) || 0);
  const numero = Number(valor);
  if (valor === '' || valor === null || valor === undefined || !Number.isFinite(numero) || numero <= 0) {
    return { importe: 0, total: bruto };
  }

  const importe =
    tipo === 'porcentaje'
      ? bruto * (Math.min(numero, 100) / 100)
      : Math.min(numero, bruto);
  const redondeado = Math.round((importe + Number.EPSILON) * 100) / 100;
  return {
    importe: redondeado,
    total: Math.round((bruto - redondeado + Number.EPSILON) * 100) / 100,
  };
}

export function todayLocal() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFechaLarga(dia) {
  const [y, m, d] = String(dia).split('-').map(Number);
  if (!y || !m || !d) return dia;
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatFechaCorta(dia) {
  const [y, m, d] = String(dia).split('-');
  if (!y || !m || !d) return dia;
  return `${d}/${m}/${y}`;
}

export function formatMesLargo(mes) {
  const [y, m] = String(mes).split('-').map(Number);
  if (!y || !m) return mes;
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
}

export function etiquetaPeriodo(periodo, valor) {
  if (periodo === 'dia') return formatFechaLarga(valor);
  if (periodo === 'mes') return formatMesLargo(valor);
  return `Año ${valor}`;
}

export function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.onload = () => {
        const MAX = 900;
        const escala = Math.min(1, MAX / Math.max(img.width, img.height));
        const ancho = Math.max(1, Math.round(img.width * escala));
        const alto = Math.max(1, Math.round(img.height * escala));

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ancho, alto);
        ctx.drawImage(img, 0, 0, ancho, alto);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

export function iniciales(texto) {
  return String(texto || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? '')
    .join('');
}
