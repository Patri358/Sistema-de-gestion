import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const STOCK_BAJO_LIMITE = 10;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseCategoriaNombre(raw) {
  const nombre = String(raw ?? '').trim();
  if (!nombre) throw httpError(400, 'El nombre de la categoría es obligatorio');
  if (nombre.length > 60) throw httpError(400, 'La categoría no puede superar los 60 caracteres');
  return nombre;
}

function validarCategoria(nombre) {
  const categoria = db
    .prepare('SELECT nombre FROM categorias WHERE nombre = ? COLLATE NOCASE')
    .get(nombre);
  if (!categoria) {
    throw httpError(400, 'La categoría no existe. Creala primero en la sección Categorías');
  }
  return categoria.nombre;
}

function parseProducto(body) {
  const nombre = String(body?.nombre ?? '').trim();
  const categoria = parseCategoriaNombre(body?.categoria);
  const precioRaw = body?.precio;
  const cantidadRaw = body?.cantidad;
  const codigo = String(body?.codigo_barras ?? '').trim();
  const imagen = typeof body?.imagen === 'string' && body.imagen.startsWith('data:image/') ? body.imagen : null;

  if (!nombre) throw httpError(400, 'El nombre del producto es obligatorio');
  if (nombre.length > 120) throw httpError(400, 'El nombre no puede superar los 120 caracteres');

  const precio = Number(precioRaw);
  if (precioRaw === '' || precioRaw === null || precioRaw === undefined || !Number.isFinite(precio) || precio < 0) {
    throw httpError(400, 'El precio debe ser un número mayor o igual a 0');
  }

  const cantidad = Number(cantidadRaw);
  if (
    cantidadRaw === '' ||
    cantidadRaw === null ||
    cantidadRaw === undefined ||
    !Number.isInteger(cantidad) ||
    cantidad < 0
  ) {
    throw httpError(400, 'La cantidad debe ser un número entero mayor o igual a 0');
  }

  if (codigo.length > 60) throw httpError(400, 'El código de barra no puede superar los 60 caracteres');
  if (imagen && imagen.length > 4_500_000) {
    throw httpError(400, 'La imagen es demasiado grande (máximo aproximado 3 MB)');
  }

  return {
    nombre,
    categoria: validarCategoria(categoria),
    precio: round2(precio),
    cantidad,
    codigo_barras: codigo || null,
    imagen,
  };
}

function parseMonto(raw, etiqueta) {
  if (raw === '' || raw === null || raw === undefined) {
    throw httpError(400, `Ingresá un ${etiqueta} válido`);
  }
  const monto = Number(raw);
  if (!Number.isFinite(monto) || monto < 0) {
    throw httpError(400, `El ${etiqueta} debe ser un número mayor o igual a 0`);
  }
  return round2(monto);
}

function resumenVentasFilas(filas) {
  const metodos = new Map();
  let totalVentas = 0;

  for (const fila of filas) {
    const total = round2(fila.total);
    totalVentas = round2(totalVentas + total);
    const actual = metodos.get(fila.metodo_pago) ?? { metodoPago: fila.metodo_pago, cantidad: 0, total: 0 };
    actual.cantidad += 1;
    actual.total = round2(actual.total + total);
    metodos.set(fila.metodo_pago, actual);
  }

  const porMetodo = [...metodos.values()].sort(
    (a, b) => b.total - a.total || a.metodoPago.localeCompare(b.metodoPago, 'es')
  );
  const totalEfectivo = metodos.get('Efectivo')?.total ?? 0;

  return {
    cantidadVentas: filas.length,
    totalVentas,
    totalEfectivo: round2(totalEfectivo),
    totalOtros: round2(totalVentas - totalEfectivo),
    porMetodo,
  };
}

function resumenVentasDia(dia) {
  const filas = db.prepare('SELECT metodo_pago, total FROM ventas WHERE dia = ?').all(dia);
  return resumenVentasFilas(filas);
}

function resumenVentasRango(desde, hasta) {
  const filas = hasta
    ? db
        .prepare('SELECT metodo_pago, total FROM ventas WHERE fecha >= ? AND fecha <= ?')
        .all(desde, hasta)
    : db
        .prepare('SELECT metodo_pago, total FROM ventas WHERE fecha >= ?')
        .all(desde);
  return resumenVentasFilas(filas);
}

function cajaAObjeto(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    dia: fila.dia,
    montoApertura: fila.monto_apertura,
    montoCierre: fila.monto_cierre,
    fechaApertura: fila.fecha_apertura,
    fechaCierre: fila.fecha_cierre,
  };
}

function cajaConResumen(fila) {
  const caja = cajaAObjeto(fila);
  if (!caja) return null;
  const resumen = resumenVentasRango(caja.fechaApertura, caja.fechaCierre);
  const efectivoEsperado = round2(caja.montoApertura + resumen.totalEfectivo);
  return {
    ...caja,
    resumen: {
      ...resumen,
      efectivoEsperado,
      diferencia:
        caja.montoCierre === null ? null : round2(caja.montoCierre - efectivoEsperado),
    },
  };
}

function cajaAbiertaHoy(dia = localDay()) {
  return db
    .prepare(
      `SELECT * FROM cajas
       WHERE dia = ? AND monto_cierre IS NULL
       ORDER BY fecha_apertura DESC, id DESC
       LIMIT 1`
    )
    .get(dia);
}

function estadoCaja(dia = localDay()) {
  const filas = db
    .prepare('SELECT * FROM cajas WHERE dia = ? ORDER BY fecha_apertura ASC, id ASC')
    .all(dia);
  const sesiones = filas.map(cajaConResumen);
  const abierta = sesiones.find((sesion) => sesion.montoCierre === null) ?? null;
  const cerradasHoy = sesiones.filter((sesion) => sesion.montoCierre !== null);
  const ultimaCerrada = cerradasHoy.length ? cerradasHoy[cerradasHoy.length - 1] : null;
  const ultimoCierreGlobal = db
    .prepare(
      `SELECT monto_cierre, fecha_cierre FROM cajas
       WHERE monto_cierre IS NOT NULL
       ORDER BY fecha_cierre DESC, id DESC
       LIMIT 1`
    )
    .get();
  const resumenDia = resumenVentasDia(dia);
  const resumen = abierta
    ? abierta.resumen
    : ultimaCerrada
      ? ultimaCerrada.resumen
      : { ...resumenDia, efectivoEsperado: null, diferencia: null };

  return {
    dia,
    caja: abierta,
    abierta: Boolean(abierta),
    cerrada: !abierta && cerradasHoy.length > 0,
    sesiones,
    ultimaCerrada,
    ultimoCierre: ultimoCierreGlobal?.fecha_cierre ?? null,
    sugerenciaApertura: round2(ultimoCierreGlobal?.monto_cierre ?? 0),
    resumen,
    resumenDia: {
      ...resumenDia,
      cantidadSesiones: sesiones.length,
      sesionesCerradas: cerradasHoy.length,
    },
  };
}

app.get('/api/productos', (req, res) => {
  const busqueda = String(req.query.busqueda ?? '').trim();
  const categoria = String(req.query.categoria ?? '').trim();

  const condiciones = [];
  const params = [];

  if (busqueda) {
    condiciones.push('(nombre LIKE ? COLLATE NOCASE OR codigo_barras LIKE ? COLLATE NOCASE)');
    params.push(`%${busqueda}%`, `%${busqueda}%`);
  }
  if (categoria) {
    condiciones.push('categoria = ? COLLATE NOCASE');
    params.push(categoria);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const productos = db
    .prepare(`SELECT * FROM productos ${where} ORDER BY nombre COLLATE NOCASE ASC`)
    .all(...params);

  res.json(productos);
});

app.get('/api/productos/stock-bajo', (_req, res) => {
  const productos = db
    .prepare(
      `SELECT * FROM productos
       WHERE cantidad < ?
       ORDER BY cantidad ASC, nombre COLLATE NOCASE ASC`
    )
    .all(STOCK_BAJO_LIMITE);

  res.json({ limite: STOCK_BAJO_LIMITE, productos });
});

app.get('/api/productos/buscar-codigo', (req, res, next) => {
  try {
    const codigo = String(req.query.codigo ?? '').trim();
    if (!codigo) throw httpError(400, 'Ingresá un código de barras');
    const producto = db
      .prepare('SELECT * FROM productos WHERE codigo_barras = ? COLLATE NOCASE')
      .get(codigo);
    if (!producto) throw httpError(404, 'No existe un producto con ese código de barras');
    res.json(producto);
  } catch (error) {
    next(error);
  }
});

app.get('/api/caja', (_req, res) => {
  res.json(estadoCaja());
});

app.post('/api/caja/abrir', (req, res, next) => {
  try {
    const dia = localDay();
    if (cajaAbiertaHoy(dia)) {
      throw httpError(409, 'La caja de hoy ya está abierta');
    }

    const montoApertura = parseMonto(req.body?.montoApertura, 'monto de apertura');
    db.prepare(
      'INSERT INTO cajas (dia, monto_apertura, monto_cierre, fecha_apertura, fecha_cierre) VALUES (?, ?, NULL, ?, NULL)'
    ).run(dia, montoApertura, new Date().toISOString());

    res.status(201).json(estadoCaja(dia));
  } catch (error) {
    next(error);
  }
});

app.post('/api/caja/cerrar', (req, res, next) => {
  try {
    const dia = localDay();
    const caja = cajaAbiertaHoy(dia);
    if (!caja) throw httpError(409, 'No hay una caja abierta para cerrar');

    const montoCierre = parseMonto(req.body?.montoCierre, 'monto de cierre');
    db.prepare('UPDATE cajas SET monto_cierre = ?, fecha_cierre = ? WHERE id = ?').run(
      montoCierre,
      new Date().toISOString(),
      caja.id
    );

    res.json(estadoCaja(dia));
  } catch (error) {
    next(error);
  }
});

app.get('/api/categorias', (_req, res) => {
  const categorias = db
    .prepare(
      `SELECT c.id, c.nombre, COUNT(p.id) AS productos
       FROM categorias c
       LEFT JOIN productos p ON p.categoria = c.nombre COLLATE NOCASE
       GROUP BY c.id
       ORDER BY c.nombre COLLATE NOCASE ASC`
    )
    .all();
  res.json(categorias);
});

app.post('/api/categorias', (req, res, next) => {
  try {
    const nombre = parseCategoriaNombre(req.body?.nombre);
    let info;
    try {
      info = db.prepare('INSERT INTO categorias (nombre) VALUES (?)').run(nombre);
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe una categoría con ese nombre');
      }
      throw error;
    }

    res.status(201).json({ id: Number(info.lastInsertRowid), nombre, productos: 0 });
  } catch (error) {
    next(error);
  }
});

app.put('/api/categorias/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const existente = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
    if (!existente) throw httpError(404, 'Categoría no encontrada');

    const nombre = parseCategoriaNombre(req.body?.nombre);

    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE categorias SET nombre = ? WHERE id = ?').run(nombre, id);
        db.prepare('UPDATE productos SET categoria = ? WHERE categoria = ? COLLATE NOCASE').run(
          nombre,
          existente.nombre
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe una categoría con ese nombre');
      }
      throw error;
    }

    const productos = db
      .prepare('SELECT COUNT(*) AS total FROM productos WHERE categoria = ? COLLATE NOCASE')
      .get(nombre).total;
    res.json({ id, nombre, productos });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/categorias/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const existente = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
    if (!existente) throw httpError(404, 'Categoría no encontrada');

    const productos = db
      .prepare('SELECT COUNT(*) AS total FROM productos WHERE categoria = ? COLLATE NOCASE')
      .get(existente.nombre).total;

    if (productos > 0) {
      throw httpError(
        409,
        `No se puede eliminar: la categoría tiene ${productos} producto${productos === 1 ? '' : 's'} asociado${productos === 1 ? '' : 's'}`
      );
    }

    db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/productos', (req, res, next) => {
  try {
    const producto = parseProducto(req.body);
    let info;
    try {
      info = db
        .prepare(
          `INSERT INTO productos (nombre, categoria, precio, cantidad, imagen, codigo_barras)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          producto.nombre,
          producto.categoria,
          producto.precio,
          producto.cantidad,
          producto.imagen,
          producto.codigo_barras
        );
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe un producto con ese código de barra');
      }
      throw error;
    }

    const creado = db
      .prepare('SELECT * FROM productos WHERE id = ?')
      .get(Number(info.lastInsertRowid));
    res.status(201).json(creado);
  } catch (error) {
    next(error);
  }
});

app.put('/api/productos/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const existente = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    if (!existente) throw httpError(404, 'Producto no encontrado');

    const producto = parseProducto(req.body);
    try {
      db.prepare(
        `UPDATE productos
         SET nombre = ?, categoria = ?, precio = ?, cantidad = ?, imagen = ?, codigo_barras = ?
         WHERE id = ?`
      ).run(
        producto.nombre,
        producto.categoria,
        producto.precio,
        producto.cantidad,
        producto.imagen,
        producto.codigo_barras,
        id
      );
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe otro producto con ese código de barra');
      }
      throw error;
    }

    res.json(db.prepare('SELECT * FROM productos WHERE id = ?').get(id));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/productos/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const info = db.prepare('DELETE FROM productos WHERE id = ?').run(id);
    if (info.changes === 0) throw httpError(404, 'Producto no encontrado');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

function parsePeriodoVentas(query) {
  const periodo = ['dia', 'mes', 'anio'].includes(String(query?.periodo)) ? String(query.periodo) : 'dia';
  const hoy = new Date();
  const valorPorDefecto =
    periodo === 'dia'
      ? localDay(hoy)
      : periodo === 'mes'
        ? localDay(hoy).slice(0, 7)
        : String(hoy.getFullYear());
  const valor = String(query?.valor ?? valorPorDefecto).trim() || valorPorDefecto;

  if (periodo === 'dia') {
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    const fechaValida =
      /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
      fecha.getFullYear() === anio &&
      fecha.getMonth() === mes - 1 &&
      fecha.getDate() === dia;
    if (!fechaValida) throw httpError(400, 'La fecha debe tener el formato AAAA-MM-DD');
    return { periodo, valor, where: 'dia = ?', params: [valor] };
  }

  if (periodo === 'mes') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
      throw httpError(400, 'El mes debe tener el formato AAAA-MM');
    }
    return { periodo, valor, where: 'dia LIKE ?', params: [`${valor}-%`] };
  }

  if (!/^\d{4}$/.test(valor)) throw httpError(400, 'El año debe tener el formato AAAA');
  return { periodo, valor, where: 'dia LIKE ?', params: [`${valor}-%`] };
}

function crearSerieVacia(etiquetas) {
  return etiquetas.map((etiqueta) => ({ etiqueta, total: 0, ventas: 0, unidades: 0 }));
}

function construirSeries(periodo, valor, ventas) {
  let series;
  let indice;

  if (periodo === 'dia') {
    series = crearSerieVacia(Array.from({ length: 24 }, (_, hora) => String(hora).padStart(2, '0')));
    indice = (venta) => new Date(venta.fecha).getHours();
  } else if (periodo === 'mes') {
    const [anio, mes] = valor.split('-').map(Number);
    const dias = new Date(anio, mes, 0).getDate();
    series = crearSerieVacia(
      Array.from({ length: dias }, (_, dia) => String(dia + 1).padStart(2, '0'))
    );
    indice = (venta) => Number(venta.dia.slice(8, 10)) - 1;
  } else {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    series = crearSerieVacia(meses);
    indice = (venta) => Number(venta.dia.slice(5, 7)) - 1;
  }

  for (const venta of ventas) {
    const posicion = indice(venta);
    const item = series[posicion];
    if (!item) continue;
    item.total = round2(item.total + venta.total);
    item.ventas += 1;
    item.unidades += venta.items.reduce((suma, producto) => suma + producto.cantidad, 0);
  }

  return series;
}

function parseVenta(metodoPagoRaw, items) {
  const metodoPago = String(metodoPagoRaw ?? '').trim();
  if (!metodoPago) throw httpError(400, 'Debe elegir un método de pago');
  if (metodoPago.length > 40) throw httpError(400, 'Método de pago inválido');
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'El carrito está vacío');

  const agrupados = new Map();
  for (const item of items) {
    const productoId = Number(item?.productoId);
    const cantidad = Number(item?.cantidad);
    if (!Number.isInteger(productoId) || productoId <= 0) {
      throw httpError(400, 'Producto inválido en el carrito');
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw httpError(400, 'Cantidad inválida en el carrito');
    }
    agrupados.set(productoId, (agrupados.get(productoId) ?? 0) + cantidad);
  }

  return { metodoPago, agrupados };
}

app.get('/api/ventas', (req, res, next) => {
  try {
    const { periodo, valor, where, params } = parsePeriodoVentas(req.query);

    const filas = db.prepare(`SELECT * FROM ventas WHERE ${where} ORDER BY fecha DESC`).all(...params);
    const ventas = filas.map((fila) => ({
      id: fila.id,
      fecha: fila.fecha,
      dia: fila.dia,
      metodoPago: fila.metodo_pago,
      total: fila.total,
      items: JSON.parse(fila.resumen),
    }));

    const totalPeriodo = round2(ventas.reduce((acc, venta) => acc + venta.total, 0));
    const unidades = ventas.reduce(
      (acc, venta) => acc + venta.items.reduce((suma, item) => suma + item.cantidad, 0),
      0
    );

    const acumulado = new Map();
    for (const venta of ventas) {
      for (const item of venta.items) {
        const clave = item.productoId ?? item.nombre;
        const actual = acumulado.get(clave) ?? {
          productoId: item.productoId ?? null,
          nombre: item.nombre,
          categoria: item.categoria,
          cantidad: 0,
          total: 0,
        };
        actual.cantidad += item.cantidad;
        actual.total += item.subtotal;
        acumulado.set(clave, actual);
      }
    }

    const masVendidos = [...acumulado.values()]
      .map((item) => ({ ...item, total: round2(item.total) }))
      .sort((a, b) => b.cantidad - a.cantidad || b.total - a.total);

    res.json({
      periodo,
      valor,
      ventas,
      totalPeriodo,
      cantidadVentas: ventas.length,
      unidades,
      masVendidos,
      series: construirSeries(periodo, valor, ventas),
    });
  } catch (error) {
    next(error);
  }
});

function construirResumenConStock(agrupados) {
  const buscarProducto = db.prepare(
    'SELECT id, nombre, categoria, precio, cantidad, codigo_barras FROM productos WHERE id = ?'
  );
  const actualizarStock = db.prepare('UPDATE productos SET cantidad = cantidad - ? WHERE id = ?');
  const resumen = [];
  let total = 0;

  for (const [productoId, cantidad] of agrupados) {
    const producto = buscarProducto.get(productoId);
    if (!producto) throw httpError(404, 'Uno de los productos del carrito ya no existe');
    if (producto.cantidad < cantidad) {
      throw httpError(
        409,
        `Stock insuficiente para "${producto.nombre}" (disponible: ${producto.cantidad})`
      );
    }

    const subtotal = round2(producto.precio * cantidad);
    total += subtotal;
    resumen.push({
      productoId: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      codigo_barras: producto.codigo_barras,
      precio: producto.precio,
      cantidad,
      subtotal,
    });
    actualizarStock.run(cantidad, productoId);
  }

  return { resumen, total: round2(total) };
}

app.post('/api/ventas', (req, res, next) => {
  try {
    const { metodoPago, agrupados } = parseVenta(req.body?.metodoPago, req.body?.items);
    const dia = localDay();
    if (!cajaAbiertaHoy(dia)) {
      throw httpError(409, 'Primero abrí la caja del día para registrar ventas');
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const { resumen, total } = construirResumenConStock(agrupados);
      const fecha = new Date();
      const info = db
        .prepare(
          `INSERT INTO ventas (fecha, dia, metodo_pago, total, resumen)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(fecha.toISOString(), dia, metodoPago, total, JSON.stringify(resumen));

      db.exec('COMMIT');

      res.status(201).json({
        id: Number(info.lastInsertRowid),
        fecha: fecha.toISOString(),
        dia,
        metodoPago,
        total,
        items: resumen,
      });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.put('/api/ventas/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const existente = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
    if (!existente) throw httpError(404, 'Venta no encontrada');

    const { metodoPago, agrupados } = parseVenta(req.body?.metodoPago, req.body?.items);
    const itemsAnteriores = JSON.parse(existente.resumen);

    db.exec('BEGIN IMMEDIATE');
    try {
      const restaurarStock = db.prepare('UPDATE productos SET cantidad = cantidad + ? WHERE id = ?');
      for (const item of itemsAnteriores) {
        restaurarStock.run(item.cantidad, item.productoId);
      }

      const { resumen, total } = construirResumenConStock(agrupados);
      db.prepare(
        'UPDATE ventas SET metodo_pago = ?, total = ?, resumen = ? WHERE id = ?'
      ).run(metodoPago, total, JSON.stringify(resumen), id);

      db.exec('COMMIT');

      res.json({
        id,
        fecha: existente.fecha,
        dia: existente.dia,
        metodoPago,
        total,
        items: resumen,
      });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/exportar', (_req, res, next) => {
  const tmpFile = path.join(os.tmpdir(), `almacen-export-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  try {
    db.exec(`VACUUM INTO '${tmpFile.replace(/'/g, "''")}'`);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    res.download(tmpFile, `almacen-${stamp}.db`, (error) => {
      fs.unlink(tmpFile, () => {});
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    fs.unlink(tmpFile, () => {});
    next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || (error.type === 'entity.too.large' ? 413 : 500);
  const message =
    status === 413
      ? 'La imagen o los datos enviados son demasiado grandes'
      : error.message || 'Error interno del servidor';
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API del sistema de almacén escuchando en http://localhost:${PORT}`);
});
