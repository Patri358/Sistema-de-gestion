import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crearToken,
  db,
  hashPassword,
  verificarPassword,
  verificarToken,
} from './db.js';

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

const AVISOS_VENCIMIENTO = ['inicio_mes', 'inicio_semana', 'dia'];
const AVISOS_VENCIMIENTO_VALIDOS = new Set(AVISOS_VENCIMIENTO);

function normalizarAvisosVencimiento(raw) {
  const valores = Array.isArray(raw)
    ? raw
    : String(raw ?? '')
        .split(',')
        .map((valor) => valor.trim())
        .filter(Boolean);
  const unicos = [...new Set(valores)];
  const invalidos = unicos.filter((valor) => !AVISOS_VENCIMIENTO_VALIDOS.has(valor));
  if (invalidos.length) throw httpError(400, 'Hay avisos de vencimiento inválidos');
  return AVISOS_VENCIMIENTO.filter((valor) => unicos.includes(valor));
}

function leerConfigTexto(clave, defecto) {
  return db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave)?.valor ?? defecto;
}

function guardarConfigTexto(clave, valor) {
  db.prepare(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`
  ).run(clave, String(valor));
}

function configuracionVencimientos() {
  const avisosGuardados = leerConfigTexto(
    'vencimientos_avisos',
    leerConfigTexto('vencimientos_aviso', 'dia')
  );
  return {
    avisos: normalizarAvisosVencimiento(avisosGuardados),
    borrarStockCero: leerConfigTexto('vencimientos_borrar_stock_cero', '0') === '1',
  };
}

function borrarVencimientosSiStockCero(productoId) {
  if (!configuracionVencimientos().borrarStockCero) return;
  db.prepare('DELETE FROM vencimientos WHERE producto_id = ?').run(productoId);
}

function esProductoPeso(producto) {
  return producto?.tipo === 'peso';
}

function gramosDisponibles(producto) {
  if (!esProductoPeso(producto)) return 0;
  const unidades = Number(producto.cantidad) || 0;
  const gramosPorUnidad = Number(producto.gramos_por_unidad) || 0;
  const parcial = Number(producto.gramos_disponibles) || 0;
  if (unidades <= 0 || gramosPorUnidad <= 0) return 0;
  return (unidades - 1) * gramosPorUnidad + Math.min(parcial, gramosPorUnidad);
}

function stockPorGramos(producto, gramos) {
  const gramosPorUnidad = Number(producto.gramos_por_unidad) || 0;
  if (!esProductoPeso(producto) || gramosPorUnidad <= 0 || gramos <= 0) {
    return { cantidad: 0, gramosDisponibles: 0 };
  }
  const cantidad = Math.ceil(gramos / gramosPorUnidad);
  return {
    cantidad,
    gramosDisponibles: gramos - (cantidad - 1) * gramosPorUnidad,
  };
}

function devolverStock(producto, cantidad) {
  if (esProductoPeso(producto)) {
    return stockPorGramos(producto, gramosDisponibles(producto) + cantidad);
  }
  return {
    cantidad: (Number(producto.cantidad) || 0) + cantidad,
    gramosDisponibles: producto.gramos_disponibles,
  };
}

function parseNombreUsuario(raw) {
  const nombre = String(raw ?? '').trim();
  if (!nombre) throw httpError(400, 'El nombre de usuario es obligatorio');
  if (nombre.length > 60) throw httpError(400, 'El nombre de usuario no puede superar los 60 caracteres');
  return nombre;
}

function parseRolUsuario(raw) {
  const rol = String(raw ?? '');
  if (!['admin', 'empleado'].includes(rol)) {
    throw httpError(400, 'El rol debe ser Admin o Empleado');
  }
  return rol;
}

function parsePasswordUsuario(body, obligatoria = true) {
  const password = String(body?.password ?? '');
  const confirmar = String(body?.confirmarPassword ?? '');
  if (!password && !obligatoria && !confirmar) return null;
  if (!password) throw httpError(400, 'La contraseña es obligatoria');
  if (password !== confirmar) throw httpError(400, 'Las contraseñas no coinciden');
  return password;
}

function usuarioPublico(fila) {
  return { id: fila.id, nombre: fila.nombre, rol: fila.rol, creadoEn: fila.creado_en };
}

function nombreUsuarioCaja(id) {
  if (id === null || id === undefined) return 'Sin registro';
  return db.prepare('SELECT nombre FROM usuarios WHERE id = ?').get(id)?.nombre ?? 'Usuario eliminado';
}

function autenticar(req, _res, next) {
  const cabecera = String(req.headers.authorization ?? '');
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  const datos = verificarToken(token);
  if (!datos) return next(httpError(401, 'Sesión expirada. Iniciá sesión nuevamente.'));

  const usuario = db.prepare('SELECT id, nombre, rol FROM usuarios WHERE id = ?').get(datos.id);
  if (!usuario) return next(httpError(401, 'Usuario no disponible. Iniciá sesión nuevamente.'));

  req.usuario = usuario;
  next();
}

function soloAdmin(req, _res, next) {
  if (req.usuario?.rol !== 'admin') {
    return next(httpError(403, 'No tenés permisos para realizar esta acción'));
  }
  next();
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
    throw httpError(400, 'La categoría no existe. Creala primero en la sección Agregar productos');
  }
  return categoria.nombre;
}

function parseTextoProveedor(raw, etiqueta, max, obligatorio = false) {
  const texto = String(raw ?? '').trim();
  if (!texto && obligatorio) throw httpError(400, `${etiqueta} es obligatoria`);
  if (texto.length > max) throw httpError(400, `${etiqueta} no puede superar los ${max} caracteres`);
  return texto;
}

function parseIdsProductosProveedor(raw) {
  if (!Array.isArray(raw)) throw httpError(400, 'La lista de productos no es válida');
  const ids = [...new Set(raw.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw httpError(400, 'La lista de productos no es válida');
  }
  if (ids.length > 0) {
    const encontrados = db
      .prepare(`SELECT COUNT(*) AS total FROM productos WHERE id IN (${ids.map(() => '?').join(', ')})`)
      .get(...ids).total;
    if (encontrados !== ids.length) {
      throw httpError(400, 'Uno de los productos seleccionados no existe');
    }
  }
  return ids;
}

function parseProveedor(body) {
  const razonSocial = parseTextoProveedor(body?.razon_social, 'La razón social', 120, true);
  const telefono = parseTextoProveedor(body?.telefono, 'El teléfono', 60);
  const email = parseTextoProveedor(body?.email, 'El mail', 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'El mail no es válido');
  }
  const rubro = parseTextoProveedor(body?.rubro, 'El rubro', 80);
  const descripcion = parseTextoProveedor(body?.descripcion, 'La descripción', 500);
  const productoIds = parseIdsProductosProveedor(body?.producto_ids);
  return { razonSocial, telefono, email, rubro, descripcion, productoIds };
}

function parsePrecioCompra(raw) {
  const precio = Number(raw);
  if (!Number.isFinite(precio) || precio < 0) {
    throw httpError(400, 'El precio de compra debe ser un número mayor o igual a cero');
  }
  return Math.round(precio * 100) / 100;
}

function parseVencimiento(body) {
  const productoId = Number(body?.producto_id ?? body?.productoId);
  if (!Number.isInteger(productoId) || productoId <= 0) {
    throw httpError(400, 'Elegí un producto creado');
  }
  const producto = db.prepare('SELECT nombre FROM productos WHERE id = ?').get(productoId);
  if (!producto) throw httpError(400, 'El producto elegido no existe');

  const fecha = String(body?.fecha ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw httpError(400, 'La fecha no es válida');
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaValidada = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fechaValidada.getUTCFullYear() !== anio ||
    fechaValidada.getUTCMonth() !== mes - 1 ||
    fechaValidada.getUTCDate() !== dia
  ) {
    throw httpError(400, 'La fecha no es válida');
  }
  return { productoId, producto: producto.nombre, fecha };
}

function obtenerProveedor(id) {
  const proveedor = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id);
  if (!proveedor) throw httpError(404, 'Proveedor no encontrado');
  const productos = db
    .prepare(
      `SELECT p.id, p.nombre, p.categoria, p.precio, p.cantidad, pp.precio_compra
       FROM proveedor_productos pp
       INNER JOIN productos p ON p.id = pp.producto_id
       WHERE pp.proveedor_id = ?
       ORDER BY p.nombre COLLATE NOCASE ASC`
    )
    .all(id);
  return { ...proveedor, productos };
}

function parseProducto(
  body,
  activoPorDefecto = 1,
  stockMinimoPorDefecto = STOCK_BAJO_LIMITE,
  productoAnterior = null
) {
  const nombre = String(body?.nombre ?? '').trim();
  const categoria = parseCategoriaNombre(body?.categoria);
  const precioRaw = body?.precio;
  const cantidadRaw = body?.cantidad;
  const stockMinimoRaw = body?.stock_minimo;
  const codigo = String(body?.codigo_barras ?? '').trim();
  const imagen = typeof body?.imagen === 'string' && body.imagen.startsWith('data:image/') ? body.imagen : null;
  const activoRaw = body?.activo;
  let activo = activoPorDefecto ? 1 : 0;
  let stockMinimo = stockMinimoPorDefecto;
  const tipo = String(body?.tipo ?? productoAnterior?.tipo ?? 'unidad');
  if (!['unidad', 'peso'].includes(tipo)) {
    throw httpError(400, 'El tipo de producto debe ser unidad o peso');
  }

  if (activoRaw !== undefined && activoRaw !== null) {
    if (typeof activoRaw === 'boolean') {
      activo = activoRaw ? 1 : 0;
    } else if ([0, 1, '0', '1'].includes(activoRaw)) {
      activo = Number(activoRaw);
    } else {
      throw httpError(400, 'El estado del producto es inválido');
    }
  }

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

  let gramosPorUnidad = null;
  let gramosDisponibles = null;
  if (tipo === 'peso') {
    const gramosRaw = body?.gramosPorUnidad ?? body?.gramos_por_unidad ?? productoAnterior?.gramos_por_unidad;
    gramosPorUnidad = Number(gramosRaw);
    if (
      gramosRaw === '' ||
      gramosRaw === null ||
      gramosRaw === undefined ||
      !Number.isInteger(gramosPorUnidad) ||
      gramosPorUnidad <= 0
    ) {
      throw httpError(400, 'Los gramos por unidad deben ser un número entero mayor que 0');
    }

    const reiniciarParcial =
      !productoAnterior ||
      productoAnterior.tipo !== 'peso' ||
      Number(productoAnterior.cantidad) !== cantidad ||
      Number(productoAnterior.gramos_por_unidad) !== gramosPorUnidad;
    gramosDisponibles = reiniciarParcial
      ? gramosPorUnidad
      : Number(productoAnterior.gramos_disponibles) || 0;
    if (cantidad <= 0) gramosDisponibles = 0;
    if (gramosDisponibles > gramosPorUnidad) gramosDisponibles = gramosPorUnidad;
  }

  if (
    stockMinimoRaw !== undefined &&
    stockMinimoRaw !== null &&
    stockMinimoRaw !== ''
  ) {
    stockMinimo = Number(stockMinimoRaw);
    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      throw httpError(400, 'El stock mínimo debe ser un número entero mayor o igual a 0');
    }
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
    stock_minimo: stockMinimo,
    codigo_barras: codigo || null,
    imagen,
    activo,
    tipo,
    gramos_por_unidad: gramosPorUnidad,
    gramos_disponibles: gramosDisponibles,
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

function parseMotivo(raw, etiqueta = 'motivo') {
  const motivo = String(raw ?? '').trim();
  if (!motivo) throw httpError(400, `Indicá el ${etiqueta}`);
  if (motivo.length > 200) throw httpError(400, `El ${etiqueta} no puede superar los 200 caracteres`);
  return motivo;
}

function parseCliente(raw) {
  const cliente = String(raw ?? '').trim();
  if (!cliente) return null;
  if (cliente.length > 120) {
    throw httpError(400, 'El nombre del comprador no puede superar los 120 caracteres');
  }
  return cliente;
}

function parseNombreCliente(raw) {
  const nombre = String(raw ?? '').trim();
  if (!nombre) {
    throw httpError(400, 'El nombre del cliente es obligatorio para vender a fiado');
  }
  if (nombre.length > 120) {
    throw httpError(400, 'El nombre del cliente no puede superar los 120 caracteres');
  }
  return nombre;
}

function clienteParaVenta(body) {
  const clienteId = Number(body?.clienteId);
  if (Number.isInteger(clienteId) && clienteId > 0) {
    const cliente = db.prepare('SELECT id, nombre FROM clientes WHERE id = ?').get(clienteId);
    if (!cliente) throw httpError(400, 'El cliente elegido no existe');
    return cliente;
  }

  const nombre = parseNombreCliente(body?.clienteNombre ?? body?.cliente);
  db.prepare('INSERT OR IGNORE INTO clientes (nombre) VALUES (?)').run(nombre);
  return db.prepare('SELECT id, nombre FROM clientes WHERE nombre = ? COLLATE NOCASE').get(nombre);
}

function clienteOpcionalParaVenta(body) {
  const clienteId = Number(body?.clienteId);
  if (Number.isInteger(clienteId) && clienteId > 0) {
    const cliente = db.prepare('SELECT id, nombre FROM clientes WHERE id = ?').get(clienteId);
    if (!cliente) throw httpError(400, 'El cliente elegido no existe');
    return cliente;
  }

  const nombre = String(body?.clienteNombre ?? body?.cliente ?? '').trim();
  if (!nombre) return null;
  if (nombre.length > 120) {
    throw httpError(400, 'El nombre del cliente no puede superar los 120 caracteres');
  }
  db.prepare('INSERT OR IGNORE INTO clientes (nombre) VALUES (?)').run(nombre);
  return db.prepare('SELECT id, nombre FROM clientes WHERE nombre = ? COLLATE NOCASE').get(nombre);
}

function pagosDeVenta(ventaId) {
  return db
    .prepare(
      `SELECT p.id, p.monto, p.fecha, p.dia, p.usuario_id, u.nombre AS usuario_nombre
       FROM pagos_clientes p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.venta_id = ?
       ORDER BY p.fecha ASC, p.id ASC`
    )
    .all(ventaId)
    .map((fila) => ({
      id: fila.id,
      monto: fila.monto,
      fecha: fila.fecha,
      dia: fila.dia,
      usuario: nombreUsuarioCaja(fila.usuario_id, fila.usuario_nombre),
    }));
}

function ventaConEstado(fila) {
  const items = JSON.parse(fila.resumen);
  const pagos = pagosDeVenta(fila.id);
  const montoPagado = round2(pagos.reduce((suma, pago) => suma + pago.monto, 0));
  const esFiado = Boolean(fila.fiado);
  const saldo = esFiado ? round2(Math.max(0, fila.total - montoPagado)) : 0;
  const clienteNombre =
    fila.cliente ??
    (fila.cliente_id
      ? db.prepare('SELECT nombre FROM clientes WHERE id = ?').get(fila.cliente_id)?.nombre ?? null
      : null);
  return {
    id: fila.id,
    fecha: fila.fecha,
    dia: fila.dia,
    metodoPago: fila.metodo_pago,
    cliente: clienteNombre,
    clienteId: fila.cliente_id ?? null,
    fiado: esFiado,
    pagado: !esFiado || saldo === 0,
    montoPagado,
    saldo,
    pagos,
    subtotal: round2(items.reduce((suma, item) => suma + item.subtotal, 0)),
    descuento: round2(fila.descuento ?? 0),
    descuentoTipo: fila.descuento_tipo ?? null,
    descuentoValor: round2(fila.descuento_valor ?? 0),
    pagoCon: fila.pago_con ?? null,
    vuelto: fila.vuelto ?? null,
    total: fila.total,
    items,
  };
}

function clientesResumen() {
  return db
    .prepare(
      `SELECT c.id, c.nombre, c.creado_en,
              COALESCE(v.total_fiado, 0) AS total_fiado,
              COALESCE(v.cantidad_compras, 0) AS cantidad_compras,
              v.ultima_compra,
              COALESCE(p.total_pagado, 0) AS total_pagado
       FROM clientes c
       LEFT JOIN (
         SELECT cliente_id,
                COUNT(*) AS cantidad_compras,
                SUM(CASE WHEN COALESCE(fiado, 0) = 1 THEN total ELSE 0 END) AS total_fiado,
                MAX(fecha) AS ultima_compra
         FROM ventas
         WHERE cliente_id IS NOT NULL
         GROUP BY cliente_id
       ) v ON v.cliente_id = c.id
       LEFT JOIN (
         SELECT cliente_id, SUM(monto) AS total_pagado
         FROM pagos_clientes
         GROUP BY cliente_id
       ) p ON p.cliente_id = c.id
       ORDER BY c.nombre COLLATE NOCASE ASC`
    )
    .all()
    .map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      creadoEn: fila.creado_en,
      cantidadCompras: fila.cantidad_compras,
      ultimaCompra: fila.ultima_compra ?? null,
      totalFiado: round2(fila.total_fiado),
      totalPagado: round2(fila.total_pagado),
      deuda: round2(Math.max(0, fila.total_fiado - fila.total_pagado)),
    }));
}

function detalleCliente(clienteId) {
  const cliente = db.prepare('SELECT id, nombre FROM clientes WHERE id = ?').get(clienteId);
  if (!cliente) throw httpError(404, 'Cliente no encontrado');

  const ventas = db
    .prepare('SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC, id DESC')
    .all(clienteId)
    .map(ventaConEstado);
  const pagos = db
    .prepare(
      `SELECT p.id, p.venta_id, p.monto, p.fecha, p.dia, p.usuario_id, u.nombre AS usuario_nombre,
              v.total AS venta_total
       FROM pagos_clientes p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       LEFT JOIN ventas v ON v.id = p.venta_id
       WHERE p.cliente_id = ?
       ORDER BY p.fecha DESC, p.id DESC`
    )
    .all(clienteId)
    .map((fila) => ({
      id: fila.id,
      ventaId: fila.venta_id,
      monto: fila.monto,
      fecha: fila.fecha,
      dia: fila.dia,
      usuario: nombreUsuarioCaja(fila.usuario_id, fila.usuario_nombre),
    }));

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    ventas,
    pagos,
    totalCompras: round2(ventas.reduce((suma, venta) => suma + venta.total, 0)),
    totalFiado: round2(
      ventas.filter((venta) => venta.fiado).reduce((suma, venta) => suma + venta.total, 0)
    ),
    totalPagado: round2(pagos.reduce((suma, pago) => suma + pago.monto, 0)),
    deuda: round2(ventas.reduce((suma, venta) => suma + venta.saldo, 0)),
  };
}

function registrarMovimientoStock({
  productoId,
  productoNombre,
  tipo,
  motivo,
  cantidadAnterior,
  cantidadNueva,
  fecha = new Date(),
}) {
  const delta = Number(cantidadNueva) - Number(cantidadAnterior);
  if (!Number.isFinite(delta) || delta === 0) return;
  const iso = fecha.toISOString();
  db.prepare(
    `INSERT INTO movimientos_stock
       (producto_id, producto_nombre, tipo, motivo, cantidad_anterior, cantidad_nueva, delta, fecha, dia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    productoId,
    productoNombre,
    tipo,
    motivo,
    cantidadAnterior,
    cantidadNueva,
    delta,
    iso,
    localDay(fecha)
  );
}

function retirosDeCaja(cajaId) {
  return db
    .prepare('SELECT * FROM retiros_caja WHERE caja_id = ? ORDER BY fecha ASC, id ASC')
    .all(cajaId)
    .map((fila) => ({
      id: fila.id,
      monto: fila.monto,
      motivo: fila.motivo,
      fecha: fila.fecha,
      dia: localDay(new Date(fila.fecha)),
    }));
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

function cobrosDeCaja(cajaId) {
  return db
    .prepare('SELECT monto FROM pagos_clientes WHERE caja_id = ?')
    .all(cajaId)
    .map((fila) => fila.monto);
}

function cobrosDelDia(dia) {
  return db
    .prepare('SELECT monto FROM pagos_clientes WHERE dia = ?')
    .all(dia)
    .map((fila) => fila.monto);
}

function agregarCobrosAResumen(resumen, cobros) {
  const totalCobros = round2(cobros.reduce((suma, monto) => suma + monto, 0));
  const porMetodo = [...resumen.porMetodo];
  const indice = porMetodo.findIndex((metodo) => metodo.metodoPago === 'Cobro de deuda');
  if (indice >= 0) {
    porMetodo[indice].cantidad += cobros.length;
    porMetodo[indice].total = round2(porMetodo[indice].total + totalCobros);
  } else if (cobros.length > 0) {
    porMetodo.push({
      metodoPago: 'Cobro de deuda',
      cantidad: cobros.length,
      total: totalCobros,
    });
  }
  porMetodo.sort(
    (a, b) => b.total - a.total || a.metodoPago.localeCompare(b.metodoPago, 'es')
  );

  return {
    ...resumen,
    totalVentas: round2(resumen.totalVentas + totalCobros),
    totalEfectivo: round2(resumen.totalEfectivo + totalCobros),
    porMetodo,
    cantidadCobros: cobros.length,
  };
}

function resumenVentasDia(dia) {
  const filas = db
    .prepare('SELECT metodo_pago, total FROM ventas WHERE dia = ? AND COALESCE(fiado, 0) = 0')
    .all(dia);
  return resumenVentasFilas(filas);
}

function resumenVentasRango(desde, hasta) {
  const where = hasta
    ? 'fecha >= ? AND fecha <= ? AND COALESCE(fiado, 0) = 0'
    : 'fecha >= ? AND COALESCE(fiado, 0) = 0';
  const filas = db
    .prepare(`SELECT metodo_pago, total FROM ventas WHERE ${where}`)
    .all(...(hasta ? [desde, hasta] : [desde]));
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
    abiertoPor: nombreUsuarioCaja(fila.abierto_por),
    cerradoPor: nombreUsuarioCaja(fila.cerrado_por),
  };
}

function cajaConResumen(fila) {
  const caja = cajaAObjeto(fila);
  if (!caja) return null;
  const resumen = agregarCobrosAResumen(
    resumenVentasRango(caja.fechaApertura, caja.fechaCierre),
    cobrosDeCaja(caja.id)
  );
  const retiros = retirosDeCaja(caja.id);
  const totalRetiros = round2(retiros.reduce((suma, retiro) => suma + retiro.monto, 0));
  const efectivoEsperado = round2(caja.montoApertura + resumen.totalEfectivo - totalRetiros);
  return {
    ...caja,
    retiros,
    resumen: {
      ...resumen,
      totalRetiros,
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
  const resumenDia = agregarCobrosAResumen(resumenVentasDia(dia), cobrosDelDia(dia));
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

app.post('/api/login', (req, res, next) => {
  try {
    const nombre = String(req.body?.usuario ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!nombre || !password) throw httpError(400, 'Ingresá usuario y contraseña');

    const usuario = db
      .prepare('SELECT * FROM usuarios WHERE nombre = ? COLLATE NOCASE')
      .get(nombre);
    if (!usuario || !verificarPassword(password, usuario.password_hash)) {
      throw httpError(401, 'Usuario o contraseña incorrectos');
    }

    res.json({ token: crearToken(usuario), usuario: usuarioPublico(usuario) });
  } catch (error) {
    next(error);
  }
});

app.use('/api', autenticar);

app.get('/api/sesion', (req, res) => {
  res.json({ usuario: req.usuario });
});

app.get('/api/usuarios', soloAdmin, (_req, res) => {
  const usuarios = db
    .prepare('SELECT id, nombre, rol, creado_en FROM usuarios ORDER BY nombre COLLATE NOCASE ASC')
    .all()
    .map(usuarioPublico);
  res.json({ usuarios });
});

app.post('/api/usuarios', soloAdmin, (req, res, next) => {
  try {
    const nombre = parseNombreUsuario(req.body?.nombre);
    const rol = parseRolUsuario(req.body?.rol);
    const password = parsePasswordUsuario(req.body, true);

    let info;
    try {
      info = db
        .prepare('INSERT INTO usuarios (nombre, password_hash, rol) VALUES (?, ?, ?)')
        .run(nombre, hashPassword(password), rol);
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe un usuario con ese nombre');
      }
      throw error;
    }

    const creado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json(usuarioPublico(creado));
  } catch (error) {
    next(error);
  }
});

app.put('/api/usuarios/:id', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const existente = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    if (!existente) throw httpError(404, 'Usuario no encontrado');

    const nombre = parseNombreUsuario(req.body?.nombre);
    const rol = parseRolUsuario(req.body?.rol);
    const password = parsePasswordUsuario(req.body, false);

    try {
      if (password) {
        db.prepare('UPDATE usuarios SET nombre = ?, rol = ?, password_hash = ? WHERE id = ?').run(
          nombre,
          rol,
          hashPassword(password),
          id
        );
      } else {
        db.prepare('UPDATE usuarios SET nombre = ?, rol = ? WHERE id = ?').run(nombre, rol, id);
      }
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe un usuario con ese nombre');
      }
      throw error;
    }

    res.json(usuarioPublico(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/usuarios/:id', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');
    if (id === req.usuario.id) {
      throw httpError(400, 'No podés eliminar tu propio usuario');
    }

    const info = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    if (info.changes === 0) throw httpError(404, 'Usuario no encontrado');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

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
       WHERE cantidad < stock_minimo AND activo = 1
       ORDER BY cantidad ASC, nombre COLLATE NOCASE ASC`
    )
    .all();

  res.json({ productos });
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

app.get('/api/movimientos-stock', soloAdmin, (req, res, next) => {
  try {
    const productoIdRaw = String(req.query.productoId ?? '').trim();
    let productoId = null;
    if (productoIdRaw) {
      productoId = Number(productoIdRaw);
      if (!Number.isInteger(productoId) || productoId <= 0) {
        throw httpError(400, 'El producto seleccionado es inválido');
      }
    }

    const filas = productoId
      ? db
          .prepare(
            `SELECT * FROM movimientos_stock
             WHERE producto_id = ?
             ORDER BY fecha DESC, id DESC
             LIMIT 500`
          )
          .all(productoId)
      : db
          .prepare(
            `SELECT * FROM movimientos_stock
             ORDER BY fecha DESC, id DESC
             LIMIT 500`
          )
          .all();

    const movimientos = filas.map((fila) => ({
      id: fila.id,
      productoId: fila.producto_id,
      productoNombre: fila.producto_nombre,
      tipo: fila.tipo,
      motivo: fila.motivo,
      cantidadAnterior: fila.cantidad_anterior,
      cantidadNueva: fila.cantidad_nueva,
      delta: fila.delta,
      fecha: fila.fecha,
      dia: fila.dia,
    }));

    res.json({ productoId, movimientos, total: movimientos.length });
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
      `INSERT INTO cajas
         (dia, monto_apertura, monto_cierre, fecha_apertura, fecha_cierre, abierto_por)
       VALUES (?, ?, NULL, ?, NULL, ?)`
    ).run(dia, montoApertura, new Date().toISOString(), req.usuario.id);

    res.status(201).json(estadoCaja(dia));
  } catch (error) {
    next(error);
  }
});

app.post('/api/caja/retirar', (req, res, next) => {
  try {
    const dia = localDay();
    const caja = cajaAbiertaHoy(dia);
    if (!caja) throw httpError(409, 'No hay una caja abierta para registrar el retiro');

    const monto = parseMonto(req.body?.monto, 'monto del retiro');
    if (monto <= 0) throw httpError(400, 'El monto del retiro debe ser mayor a 0');
    const motivo = parseMotivo(req.body?.motivo, 'motivo del retiro');

    const disponible = cajaConResumen(caja).resumen.efectivoEsperado;
    if (monto > disponible) {
      throw httpError(
        409,
        `El retiro supera el efectivo disponible en la caja (${disponible.toFixed(2)})`
      );
    }

    db.prepare('INSERT INTO retiros_caja (caja_id, monto, motivo, fecha) VALUES (?, ?, ?, ?)').run(
      caja.id,
      monto,
      motivo,
      new Date().toISOString()
    );

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
    db.prepare(
      'UPDATE cajas SET monto_cierre = ?, fecha_cierre = ?, cerrado_por = ? WHERE id = ?'
    ).run(montoCierre, new Date().toISOString(), req.usuario.id, caja.id);

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

app.post('/api/categorias', soloAdmin, (req, res, next) => {
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

app.put('/api/categorias/:id', soloAdmin, (req, res, next) => {
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

app.delete('/api/categorias/:id', soloAdmin, (req, res, next) => {
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

app.get('/api/proveedores', soloAdmin, (_req, res, next) => {
  try {
    const proveedores = db
      .prepare(
        `SELECT pr.*, COUNT(pp.producto_id) AS productos
         FROM proveedores pr
         LEFT JOIN proveedor_productos pp ON pp.proveedor_id = pr.id
         GROUP BY pr.id
         ORDER BY pr.razon_social COLLATE NOCASE ASC`
      )
      .all();
    res.json(proveedores);
  } catch (error) {
    next(error);
  }
});

app.get('/api/proveedores/:id', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');
    res.json(obtenerProveedor(id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/proveedores', soloAdmin, (req, res, next) => {
  try {
    const datos = parseProveedor(req.body);
    let id;
    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        const info = db
          .prepare(
            `INSERT INTO proveedores (razon_social, telefono, email, rubro, descripcion)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(datos.razonSocial, datos.telefono, datos.email, datos.rubro, datos.descripcion);
        id = Number(info.lastInsertRowid);
        const insertarProducto = db.prepare(
          'INSERT INTO proveedor_productos (proveedor_id, producto_id, precio_compra) VALUES (?, ?, 0)'
        );
        for (const productoId of datos.productoIds) insertarProducto.run(id, productoId);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe un proveedor con esa razón social');
      }
      throw error;
    }
    res.status(201).json(obtenerProveedor(id));
  } catch (error) {
    next(error);
  }
});

app.put('/api/proveedores/:id', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');
    obtenerProveedor(id);
    const datos = parseProveedor(req.body);

    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          `UPDATE proveedores
           SET razon_social = ?, telefono = ?, email = ?, rubro = ?, descripcion = ?
           WHERE id = ?`
        ).run(
          datos.razonSocial,
          datos.telefono,
          datos.email,
          datos.rubro,
          datos.descripcion,
          id
        );

        if (datos.productoIds.length > 0) {
          const marcadores = datos.productoIds.map(() => '?').join(', ');
          db.prepare(
            `DELETE FROM proveedor_productos
             WHERE proveedor_id = ? AND producto_id NOT IN (${marcadores})`
          ).run(id, ...datos.productoIds);
          const insertarProducto = db.prepare(
            `INSERT OR IGNORE INTO proveedor_productos (proveedor_id, producto_id, precio_compra)
             VALUES (?, ?, 0)`
          );
          for (const productoId of datos.productoIds) insertarProducto.run(id, productoId);
        } else {
          db.prepare('DELETE FROM proveedor_productos WHERE proveedor_id = ?').run(id);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw httpError(409, 'Ya existe un proveedor con esa razón social');
      }
      throw error;
    }

    res.json(obtenerProveedor(id));
  } catch (error) {
    next(error);
  }
});

app.put('/api/proveedores/:id/productos/:productoId', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const productoId = Number(req.params.productoId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(productoId) || productoId <= 0) {
      throw httpError(400, 'Id inválido');
    }
    obtenerProveedor(id);
    const producto = db.prepare('SELECT id FROM productos WHERE id = ?').get(productoId);
    if (!producto) throw httpError(404, 'Producto no encontrado');
    const precioCompra = parsePrecioCompra(req.body?.precio_compra);

    db.prepare(
      `INSERT INTO proveedor_productos (proveedor_id, producto_id, precio_compra)
       VALUES (?, ?, ?)
       ON CONFLICT (proveedor_id, producto_id) DO UPDATE SET precio_compra = excluded.precio_compra`
    ).run(id, productoId, precioCompra);

    res.json(obtenerProveedor(id));
  } catch (error) {
    next(error);
  }
});

app.get('/api/vencimientos', (req, res, next) => {
  try {
    const condiciones = [];
    const parametros = [];
    const desde = String(req.query.desde ?? '').trim();
    const hasta = String(req.query.hasta ?? '').trim();
    if (desde) {
      condiciones.push('fecha >= ?');
      parametros.push(desde);
    }
    if (hasta) {
      condiciones.push('fecha <= ?');
      parametros.push(hasta);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const vencimientos = db
      .prepare(`SELECT id, producto_id AS productoId, producto, fecha FROM vencimientos ${where} ORDER BY fecha ASC, producto COLLATE NOCASE ASC`)
      .all(...parametros);
    res.json(vencimientos);
  } catch (error) {
    next(error);
  }
});

app.post('/api/vencimientos', (req, res, next) => {
  try {
    const datos = parseVencimiento(req.body);
    const info = db
      .prepare('INSERT INTO vencimientos (producto_id, producto, fecha) VALUES (?, ?, ?)')
      .run(datos.productoId, datos.producto, datos.fecha);
    res.status(201).json({
      id: Number(info.lastInsertRowid),
      productoId: datos.productoId,
      producto: datos.producto,
      fecha: datos.fecha,
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/vencimientos/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');
    const resultado = db.prepare('DELETE FROM vencimientos WHERE id = ?').run(id);
    if (resultado.changes === 0) throw httpError(404, 'Vencimiento no encontrado');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/configuracion/vencimientos', (_req, res, next) => {
  try {
    res.json(configuracionVencimientos());
  } catch (error) {
    next(error);
  }
});

app.put('/api/configuracion/vencimientos', (req, res, next) => {
  try {
    const avisos = normalizarAvisosVencimiento(req.body?.avisos ?? req.body?.aviso ?? []);
    const borrarStockCero =
      req.body?.borrarStockCero === true || String(req.body?.borrarStockCero) === 'true';
    guardarConfigTexto('vencimientos_avisos', avisos.join(','));
    guardarConfigTexto('vencimientos_borrar_stock_cero', borrarStockCero ? '1' : '0');
    res.json(configuracionVencimientos());
  } catch (error) {
    next(error);
  }
});

app.post('/api/productos', soloAdmin, (req, res, next) => {
  try {
    const producto = parseProducto(req.body);
    let info;
    try {
      info = db
        .prepare(
          `INSERT INTO productos
             (nombre, categoria, precio, cantidad, stock_minimo, imagen, codigo_barras, activo,
              tipo, gramos_por_unidad, gramos_disponibles)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          producto.nombre,
          producto.categoria,
          producto.precio,
          producto.cantidad,
          producto.stock_minimo,
          producto.imagen,
          producto.codigo_barras,
          producto.activo,
          producto.tipo,
          producto.gramos_por_unidad,
          producto.gramos_disponibles
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
    registrarMovimientoStock({
      productoId: creado.id,
      productoNombre: creado.nombre,
      tipo: 'alta',
      motivo: 'Alta de producto',
      cantidadAnterior: 0,
      cantidadNueva: creado.cantidad,
    });
    res.status(201).json(creado);
  } catch (error) {
    next(error);
  }
});

app.put('/api/productos/:id', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const existente = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    if (!existente) throw httpError(404, 'Producto no encontrado');

    const producto = parseProducto(
      req.body,
      existente.activo,
      existente.stock_minimo,
      existente
    );
    const cambioStock = producto.cantidad !== existente.cantidad;
    const motivoStock = cambioStock
      ? parseMotivo(req.body?.motivoStock, 'motivo del movimiento de stock')
      : null;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
         `UPDATE productos
          SET nombre = ?, categoria = ?, precio = ?, cantidad = ?, stock_minimo = ?,
              imagen = ?, codigo_barras = ?, activo = ?, tipo = ?,
              gramos_por_unidad = ?, gramos_disponibles = ?
          WHERE id = ?`
      ).run(
        producto.nombre,
        producto.categoria,
        producto.precio,
        producto.cantidad,
        producto.stock_minimo,
        producto.imagen,
        producto.codigo_barras,
        producto.activo,
        producto.tipo,
        producto.gramos_por_unidad,
        producto.gramos_disponibles,
        id
      );

      if (cambioStock) {
        registrarMovimientoStock({
          productoId: id,
          productoNombre: producto.nombre,
          tipo: 'ajuste',
          motivo: motivoStock,
          cantidadAnterior: existente.cantidad,
          cantidadNueva: producto.cantidad,
        });
      }

      if (producto.cantidad === 0) borrarVencimientosSiStockCero(id);

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
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

app.delete('/api/productos/:id', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    db.exec('BEGIN IMMEDIATE');
    try {
      const info = db.prepare('DELETE FROM productos WHERE id = ?').run(id);
      if (info.changes === 0) throw httpError(404, 'Producto no encontrado');
      db.prepare('DELETE FROM vencimientos WHERE producto_id = ?').run(id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
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

function parseDescuento(tipoRaw, valorRaw, subtotal) {
  const tipo = String(tipoRaw ?? '').trim();
  const valorVacio = valorRaw === '' || valorRaw === null || valorRaw === undefined;
  const valor = Number(valorRaw);

  if (valorVacio || !Number.isFinite(valor) || valor === 0) {
    return { descuentoTipo: null, descuentoValor: 0, descuento: 0 };
  }
  if (valor < 0) throw httpError(400, 'El descuento no puede ser negativo');

  if (tipo === 'porcentaje') {
    if (valor > 100) throw httpError(400, 'El descuento no puede superar el 100%');
    return {
      descuentoTipo: tipo,
      descuentoValor: round2(valor),
      descuento: round2((subtotal * valor) / 100),
    };
  }

  if (tipo === 'monto') {
    if (valor > subtotal) throw httpError(400, 'El descuento no puede superar el subtotal');
    return {
      descuentoTipo: tipo,
      descuentoValor: round2(valor),
      descuento: round2(valor),
    };
  }

  throw httpError(400, 'El tipo de descuento es inválido');
}

function parsePagoCon(metodoPago, pagoRaw, total) {
  if (metodoPago !== 'Efectivo' || pagoRaw === '' || pagoRaw === null || pagoRaw === undefined) {
    return { pagoCon: null, vuelto: null };
  }

  const pagoCon = Number(pagoRaw);
  if (!Number.isFinite(pagoCon) || pagoCon < 0) {
    throw httpError(400, 'El monto pagado debe ser un número mayor o igual a 0');
  }
  if (pagoCon < total) {
    throw httpError(400, 'El monto pagado no alcanza a cubrir el total de la venta');
  }

  return { pagoCon: round2(pagoCon), vuelto: round2(pagoCon - total) };
}

app.get('/api/clientes', (_req, res, next) => {
  try {
    res.json(clientesResumen());
  } catch (error) {
    next(error);
  }
});

app.get('/api/clientes/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id de cliente inválido');
    res.json(detalleCliente(id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/clientes/:id/pagos', (req, res, next) => {
  try {
    const clienteId = Number(req.params.id);
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      throw httpError(400, 'Id de cliente inválido');
    }
    const cliente = db.prepare('SELECT id, nombre FROM clientes WHERE id = ?').get(clienteId);
    if (!cliente) throw httpError(404, 'Cliente no encontrado');

    const ventaId = Number(req.body?.ventaId);
    if (!Number.isInteger(ventaId) || ventaId <= 0) {
      throw httpError(400, 'Elegí una compra para pagar');
    }
    const venta = db
      .prepare('SELECT * FROM ventas WHERE id = ? AND cliente_id = ? AND COALESCE(fiado, 0) = 1')
      .get(ventaId, clienteId);
    if (!venta) throw httpError(404, 'Compra a fiado no encontrada para este cliente');

    const monto = parseMonto(req.body?.monto, 'monto a pagar');
    if (monto <= 0) throw httpError(400, 'El monto a pagar debe ser mayor a 0');

    const dia = localDay();
    const caja = cajaAbiertaHoy(dia);
    if (!caja) throw httpError(409, 'Primero abrí la caja del día para cobrar deudas');

    db.exec('BEGIN IMMEDIATE');
    try {
      const pagado = db
        .prepare('SELECT COALESCE(SUM(monto), 0) AS total FROM pagos_clientes WHERE venta_id = ?')
        .get(ventaId).total;
      const saldo = round2(venta.total - pagado);
      if (saldo <= 0) throw httpError(409, 'Esta compra ya está pagada');
      if (monto > saldo) {
        throw httpError(409, `El monto supera la deuda de la compra (${saldo.toFixed(2)})`);
      }

      db.prepare(
        `INSERT INTO pagos_clientes
           (cliente_id, venta_id, monto, fecha, dia, usuario_id, caja_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(clienteId, ventaId, monto, new Date().toISOString(), dia, req.usuario.id, caja.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    res.status(201).json(detalleCliente(clienteId));
  } catch (error) {
    next(error);
  }
});

app.get('/api/ventas', soloAdmin, (req, res, next) => {
  try {
    const { periodo, valor, where, params } = parsePeriodoVentas(req.query);

    const filas = db.prepare(`SELECT * FROM ventas WHERE ${where} ORDER BY fecha DESC`).all(...params);
    const ventas = filas.map(ventaConEstado);

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

function construirResumenConStock(agrupados, permitirInactivos = new Set()) {
  const buscarProducto = db.prepare(
    `SELECT id, nombre, categoria, precio, cantidad, codigo_barras, activo,
            tipo, gramos_por_unidad, gramos_disponibles
     FROM productos WHERE id = ?`
  );
  const actualizarStock = db.prepare(
    'UPDATE productos SET cantidad = ?, gramos_disponibles = ? WHERE id = ?'
  );
  const resumen = [];
  const movimientos = [];
  let total = 0;

  for (const [productoId, cantidad] of agrupados) {
    const producto = buscarProducto.get(productoId);
    if (!producto) throw httpError(404, 'Uno de los productos del carrito ya no existe');
    if (!producto.activo && !permitirInactivos.has(producto.id)) {
      throw httpError(409, `El producto "${producto.nombre}" está deshabilitado`);
    }

    const peso = esProductoPeso(producto);
    const disponible = gramosDisponibles(producto) || producto.cantidad;
    if (disponible < cantidad) {
      throw httpError(
        409,
        `Stock insuficiente para "${producto.nombre}" (disponible: ${disponible}${peso ? ' g' : ''})`
      );
    }

    const gramosPorUnidad = peso ? Number(producto.gramos_por_unidad) : null;
    const subtotal = round2(
      peso ? (producto.precio * cantidad) / gramosPorUnidad : producto.precio * cantidad
    );
    total += subtotal;
    resumen.push({
      productoId: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
      codigo_barras: producto.codigo_barras,
      precio: peso ? round2(producto.precio / gramosPorUnidad) : producto.precio,
      precioUnidad: producto.precio,
      cantidad,
      tipo: producto.tipo,
      gramos: peso ? cantidad : null,
      gramosPorUnidad,
      subtotal,
    });

    let cantidadNueva;
    if (peso) {
      const nuevoStock = stockPorGramos(producto, gramosDisponibles(producto) - cantidad);
      cantidadNueva = nuevoStock.cantidad;
      actualizarStock.run(cantidadNueva, nuevoStock.gramosDisponibles, productoId);
    } else {
      cantidadNueva = producto.cantidad - cantidad;
      actualizarStock.run(cantidadNueva, producto.gramos_disponibles, productoId);
    }
    if (cantidadNueva === 0) borrarVencimientosSiStockCero(productoId);
    movimientos.push({
      productoId: producto.id,
      productoNombre: producto.nombre,
      cantidadAnterior: producto.cantidad,
      cantidadNueva,
    });
  }

  return { resumen, total: round2(total), movimientos };
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
      const { resumen, total: subtotal, movimientos } = construirResumenConStock(agrupados);
      const { descuentoTipo, descuentoValor, descuento } = parseDescuento(
        req.body?.descuentoTipo,
        req.body?.descuentoValor,
        subtotal
      );
      const total = round2(subtotal - descuento);
      const { pagoCon, vuelto } = parsePagoCon(metodoPago, req.body?.pagoCon, total);
      const esFiado = metodoPago === 'Fiado';
      const cliente = esFiado
        ? clienteParaVenta(req.body)
        : clienteOpcionalParaVenta(req.body);
      const clienteId = cliente?.id ?? null;
      const fecha = new Date();
      const info = db
        .prepare(
          `INSERT INTO ventas
             (fecha, dia, metodo_pago, cliente, cliente_id, fiado, total, descuento,
              descuento_tipo, descuento_valor, pago_con, vuelto, resumen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          fecha.toISOString(),
          dia,
          metodoPago,
          cliente?.nombre ?? null,
          clienteId,
          esFiado ? 1 : 0,
          total,
          descuento,
          descuentoTipo,
          descuentoValor,
          pagoCon,
          vuelto,
          JSON.stringify(resumen)
        );

      const ventaId = Number(info.lastInsertRowid);
      for (const movimiento of movimientos) {
        registrarMovimientoStock({
          ...movimiento,
          tipo: 'venta',
          motivo: `Venta #${ventaId}`,
          fecha,
        });
      }

      db.exec('COMMIT');

      res.status(201).json({
        id: Number(info.lastInsertRowid),
        fecha: fecha.toISOString(),
        dia,
        metodoPago,
        cliente: cliente?.nombre ?? null,
        clienteId,
        fiado: esFiado,
        pagado: !esFiado,
        montoPagado: 0,
        saldo: esFiado ? total : 0,
        subtotal,
        descuento,
        descuentoTipo,
        descuentoValor,
        pagoCon,
        vuelto,
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

app.put('/api/ventas/:id', soloAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id inválido');

    const existente = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
    if (!existente) throw httpError(404, 'Venta no encontrada');

    const { metodoPago, agrupados } = parseVenta(req.body?.metodoPago, req.body?.items);
    const itemsAnteriores = JSON.parse(existente.resumen);
    const productosAnteriores = new Set(itemsAnteriores.map((item) => item.productoId));
    const tipoRaw =
      req.body?.descuentoTipo !== undefined ? req.body.descuentoTipo : existente.descuento_tipo;
    const valorRaw =
      req.body?.descuentoValor !== undefined ? req.body.descuentoValor : existente.descuento_valor;
    const pagoRaw = req.body?.pagoCon !== undefined ? req.body.pagoCon : existente.pago_con;
    const clienteRaw = req.body?.cliente !== undefined ? req.body.cliente : existente.cliente;
    const esFiado = metodoPago === 'Fiado';
    const clienteIdRaw =
      req.body?.clienteId !== undefined ? req.body.clienteId : existente.cliente_id;
    const cliente = esFiado
      ? clienteParaVenta({ clienteId: clienteIdRaw, clienteNombre: clienteRaw })
      : clienteOpcionalParaVenta({ clienteId: clienteIdRaw, clienteNombre: clienteRaw });
    const clienteTexto = cliente?.nombre ?? parseCliente(clienteRaw);
    const clienteId = cliente?.id ?? null;

    db.exec('BEGIN IMMEDIATE');
    try {
      const buscarStock = db.prepare('SELECT * FROM productos WHERE id = ?');
      const idsAfectados = new Set([
        ...itemsAnteriores.map((item) => item.productoId),
        ...agrupados.keys(),
      ]);
      const stockAntes = new Map();
      for (const productoId of idsAfectados) {
        const actual = buscarStock.get(productoId);
        if (actual) stockAntes.set(productoId, actual.cantidad);
      }

      const restaurarStock = db.prepare(
        'UPDATE productos SET cantidad = ?, gramos_disponibles = ? WHERE id = ?'
      );
      for (const item of itemsAnteriores) {
        const producto = buscarStock.get(item.productoId);
        if (!producto) continue;
        const nuevoStock = devolverStock(producto, item.gramos ?? item.cantidad);
        restaurarStock.run(nuevoStock.cantidad, nuevoStock.gramosDisponibles, item.productoId);
      }

      const { resumen, total: subtotal } = construirResumenConStock(
        agrupados,
        productosAnteriores
      );
      const { descuentoTipo, descuentoValor, descuento } = parseDescuento(
        tipoRaw,
        valorRaw,
        subtotal
      );
      const total = round2(subtotal - descuento);
      const { pagoCon, vuelto } = parsePagoCon(metodoPago, pagoRaw, total);

      db.prepare(
        `UPDATE ventas
         SET metodo_pago = ?, cliente = ?, cliente_id = ?, fiado = ?, total = ?, descuento = ?,
             descuento_tipo = ?, descuento_valor = ?, pago_con = ?, vuelto = ?, resumen = ?
         WHERE id = ?`
      ).run(
        metodoPago,
        clienteTexto,
        clienteId,
        esFiado ? 1 : 0,
        total,
        descuento,
        descuentoTipo,
        descuentoValor,
        pagoCon,
        vuelto,
        JSON.stringify(resumen),
        id
      );

      const fechaMovimiento = new Date();
      for (const [productoId, cantidadAnterior] of stockAntes) {
        const actual = buscarStock.get(productoId);
        if (!actual) continue;
        registrarMovimientoStock({
          productoId,
          productoNombre: actual.nombre,
          tipo: 'edicion_venta',
          motivo: `Edición de venta #${id}`,
          cantidadAnterior,
          cantidadNueva: actual.cantidad,
          fecha: fechaMovimiento,
        });
      }

      db.exec('COMMIT');

      res.json({
        id,
        fecha: existente.fecha,
        dia: existente.dia,
        metodoPago,
        cliente: clienteTexto,
        clienteId,
        fiado: esFiado,
        subtotal,
        descuento,
        descuentoTipo,
        descuentoValor,
        pagoCon,
        vuelto,
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

app.get('/api/exportar', soloAdmin, (_req, res, next) => {
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
