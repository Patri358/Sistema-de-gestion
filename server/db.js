import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPathEnv = process.env.ALMACEN_DB_PATH;
export const dbPath =
  dbPathEnv && path.isAbsolute(dbPathEnv) ? dbPathEnv : path.join(dataDir, dbPathEnv || 'almacen.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = DELETE;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    precio REAL NOT NULL CHECK (precio >= 0),
    cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
    stock_minimo INTEGER NOT NULL DEFAULT 10 CHECK (stock_minimo >= 0),
    imagen TEXT,
    codigo_barras TEXT UNIQUE,
    activo INTEGER NOT NULL DEFAULT 1,
    tipo TEXT NOT NULL DEFAULT 'unidad' CHECK (tipo IN ('unidad', 'peso')),
    gramos_por_unidad INTEGER CHECK (gramos_por_unidad IS NULL OR gramos_por_unidad > 0),
    gramos_disponibles INTEGER CHECK (gramos_disponibles IS NULL OR gramos_disponibles >= 0)
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    dia TEXT NOT NULL,
    metodo_pago TEXT NOT NULL,
    cliente TEXT,
    total REAL NOT NULL CHECK (total >= 0),
    descuento REAL NOT NULL DEFAULT 0,
    descuento_tipo TEXT,
    descuento_valor REAL NOT NULL DEFAULT 0,
    pago_con REAL,
    vuelto REAL,
    resumen TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cajas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia TEXT NOT NULL,
    monto_apertura REAL NOT NULL CHECK (monto_apertura >= 0),
    monto_cierre REAL CHECK (monto_cierre IS NULL OR monto_cierre >= 0),
    fecha_apertura TEXT NOT NULL,
    fecha_cierre TEXT
  );

  CREATE TABLE IF NOT EXISTS movimientos_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    producto_nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    motivo TEXT NOT NULL,
    cantidad_anterior INTEGER NOT NULL,
    cantidad_nueva INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    dia TEXT NOT NULL,
    lote_id INTEGER,
    fecha_vencimiento TEXT,
    cantidad_movimiento INTEGER
  );

  CREATE TABLE IF NOT EXISTS retiros_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caja_id INTEGER NOT NULL,
    monto REAL NOT NULL CHECK (monto > 0),
    motivo TEXT NOT NULL,
    fecha TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'empleado', 'encargado')),
    permisos TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razon_social TEXT NOT NULL UNIQUE COLLATE NOCASE,
    telefono TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    rubro TEXT NOT NULL DEFAULT '',
    descripcion TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proveedor_productos (
    proveedor_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    precio_compra REAL NOT NULL DEFAULT 0 CHECK (precio_compra >= 0),
    PRIMARY KEY (proveedor_id, producto_id)
  );

  CREATE TABLE IF NOT EXISTS vencimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto TEXT NOT NULL,
    fecha TEXT NOT NULL,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pagos_clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    venta_id INTEGER NOT NULL,
    monto REAL NOT NULL CHECK (monto > 0),
    fecha TEXT NOT NULL,
    dia TEXT NOT NULL,
    usuario_id INTEGER,
    caja_id INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_ventas_dia ON ventas (dia);
  CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (nombre);
  CREATE INDEX IF NOT EXISTS idx_movimientos_stock_producto
    ON movimientos_stock (producto_id, fecha);
  CREATE INDEX IF NOT EXISTS idx_retiros_caja_caja ON retiros_caja (caja_id, fecha);
  CREATE INDEX IF NOT EXISTS idx_pagos_clientes_cliente ON pagos_clientes (cliente_id, fecha);
  CREATE INDEX IF NOT EXISTS idx_pagos_clientes_venta ON pagos_clientes (venta_id);
  CREATE INDEX IF NOT EXISTS idx_pagos_clientes_caja ON pagos_clientes (caja_id, fecha);
  CREATE INDEX IF NOT EXISTS idx_proveedor_productos_proveedor
    ON proveedor_productos (proveedor_id);
  CREATE INDEX IF NOT EXISTS idx_proveedor_productos_producto
    ON proveedor_productos (producto_id);
  CREATE INDEX IF NOT EXISTS idx_vencimientos_fecha ON vencimientos (fecha);
`);

function asegurarColumna(tabla, columna, definicion) {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all();
  if (!columnas.some((fila) => fila.name === columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
}

asegurarColumna('productos', 'activo', 'INTEGER NOT NULL DEFAULT 1');
asegurarColumna('productos', 'stock_minimo', 'INTEGER NOT NULL DEFAULT 10');
asegurarColumna('productos', 'tipo', "TEXT NOT NULL DEFAULT 'unidad'");
asegurarColumna('productos', 'gramos_por_unidad', 'INTEGER');
asegurarColumna('productos', 'gramos_disponibles', 'INTEGER');
db.exec(
  `UPDATE productos
   SET gramos_disponibles = gramos_por_unidad
   WHERE tipo = 'peso' AND cantidad > 0 AND gramos_por_unidad > 0 AND gramos_disponibles IS NULL`
);
asegurarColumna('movimientos_stock', 'lote_id', 'INTEGER');
asegurarColumna('movimientos_stock', 'fecha_vencimiento', 'TEXT');
asegurarColumna('movimientos_stock', 'cantidad_movimiento', 'INTEGER');
asegurarColumna('ventas', 'cliente', 'TEXT');
asegurarColumna('ventas', 'cliente_id', 'INTEGER');
asegurarColumna('ventas', 'fiado', 'INTEGER NOT NULL DEFAULT 0');
asegurarColumna('ventas', 'descuento', 'REAL NOT NULL DEFAULT 0');
asegurarColumna('ventas', 'descuento_tipo', 'TEXT');
asegurarColumna('ventas', 'descuento_valor', 'REAL NOT NULL DEFAULT 0');
asegurarColumna('ventas', 'pago_con', 'REAL');
asegurarColumna('ventas', 'vuelto', 'REAL');
asegurarColumna('vencimientos', 'producto_id', 'INTEGER');
db.exec(
  `UPDATE vencimientos
   SET producto_id = (SELECT id FROM productos WHERE nombre = vencimientos.producto COLLATE NOCASE)
   WHERE producto_id IS NULL`
);
db.exec('CREATE INDEX IF NOT EXISTS idx_vencimientos_producto ON vencimientos (producto_id)');

const usuariosSql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'")
  .get()?.sql;

if (!/encargado/i.test(usuariosSql ?? '')) {
  const tienePermisos = db
    .prepare('PRAGMA table_info(usuarios)')
    .all()
    .some((fila) => fila.name === 'permisos');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE usuarios RENAME TO usuarios_legacy;
      CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('admin', 'empleado', 'encargado')),
        permisos TEXT,
        creado_en TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO usuarios (id, nombre, password_hash, rol, permisos, creado_en)
      SELECT id, nombre, password_hash, rol, ${tienePermisos ? 'permisos' : 'NULL'}, creado_en
      FROM usuarios_legacy;
      DROP TABLE usuarios_legacy;
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

for (const fila of db
  .prepare('SELECT id, permisos FROM usuarios WHERE permisos IS NOT NULL')
  .all()) {
  try {
    const permisos = JSON.parse(fila.permisos);
    if (!Array.isArray(permisos) || !permisos.includes('ventas')) continue;
    const migrados = [...new Set(permisos.map((permiso) => (permiso === 'ventas' ? 'estadisticas' : permiso)))];
    db.prepare('UPDATE usuarios SET permisos = ? WHERE id = ?').run(
      JSON.stringify(migrados),
      fila.id
    );
  } catch {}
}

const cajasSql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cajas'")
  .get()?.sql;

if (/dia\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(cajasSql ?? '')) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE cajas RENAME TO cajas_legacy;
      CREATE TABLE cajas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dia TEXT NOT NULL,
        monto_apertura REAL NOT NULL CHECK (monto_apertura >= 0),
        monto_cierre REAL CHECK (monto_cierre IS NULL OR monto_cierre >= 0),
        fecha_apertura TEXT NOT NULL,
        fecha_cierre TEXT
      );
      INSERT INTO cajas (id, dia, monto_apertura, monto_cierre, fecha_apertura, fecha_cierre)
      SELECT id, dia, monto_apertura, monto_cierre, fecha_apertura, fecha_cierre
      FROM cajas_legacy;
      DROP TABLE cajas_legacy;
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

asegurarColumna('cajas', 'abierto_por', 'INTEGER');
asegurarColumna('cajas', 'cerrado_por', 'INTEGER');

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_movimientos_stock_lote ON movimientos_stock (lote_id);
  CREATE INDEX IF NOT EXISTS idx_cajas_dia ON cajas (dia);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cajas_abierta
  ON cajas (dia)
  WHERE monto_cierre IS NULL;

  INSERT OR IGNORE INTO categorias (nombre)
  SELECT DISTINCT TRIM(categoria)
  FROM productos
  WHERE TRIM(categoria) <> '';
`);

if (!db.prepare('SELECT clave FROM configuracion WHERE clave = ?').get('clave_sesion')) {
  db.prepare('INSERT INTO configuracion (clave, valor) VALUES (?, ?)').run(
    'clave_sesion',
    crypto.randomBytes(32).toString('hex')
  );
}

const claveSesion = db
  .prepare('SELECT valor FROM configuracion WHERE clave = ?')
  .get('clave_sesion').valor;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verificarPassword(password, guardado) {
  try {
    const [algoritmo, salt, hash] = String(guardado).split(':');
    if (algoritmo !== 'scrypt' || !salt || !hash) return false;
    const calculado = crypto.scryptSync(String(password), salt, 64);
    const esperado = Buffer.from(hash, 'hex');
    return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
  } catch {
    return false;
  }
}

function codificarBase64Url(valor) {
  return Buffer.from(valor).toString('base64url');
}

export function crearToken(usuario) {
  const payload = codificarBase64Url(
    JSON.stringify({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, iat: Date.now() })
  );
  const firma = crypto.createHmac('sha256', claveSesion).update(payload).digest('base64url');
  return `${payload}.${firma}`;
}

export function verificarToken(token) {
  try {
    const [payload, firma] = String(token ?? '').split('.');
    if (!payload || !firma) return null;
    const esperada = crypto.createHmac('sha256', claveSesion).update(payload).digest('base64url');
    if (
      firma.length !== esperada.length ||
      !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))
    ) {
      return null;
    }
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(datos.id) || datos.id <= 0) return null;
    return datos;
  } catch {
    return null;
  }
}

if (!db.prepare('SELECT id FROM usuarios WHERE nombre = ? COLLATE NOCASE').get('patricio')) {
  db.prepare('INSERT INTO usuarios (nombre, password_hash, rol) VALUES (?, ?, ?)').run(
    'patricio',
    hashPassword('123456789'),
    'admin'
  );
}
