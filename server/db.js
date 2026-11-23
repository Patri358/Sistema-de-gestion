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
    activo INTEGER NOT NULL DEFAULT 1
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
    dia TEXT NOT NULL
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
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'empleado')),
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
`);

function asegurarColumna(tabla, columna, definicion) {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all();
  if (!columnas.some((fila) => fila.name === columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
}

asegurarColumna('productos', 'activo', 'INTEGER NOT NULL DEFAULT 1');
asegurarColumna('productos', 'stock_minimo', 'INTEGER NOT NULL DEFAULT 10');
asegurarColumna('ventas', 'cliente', 'TEXT');
asegurarColumna('ventas', 'cliente_id', 'INTEGER');
asegurarColumna('ventas', 'fiado', 'INTEGER NOT NULL DEFAULT 0');
asegurarColumna('ventas', 'descuento', 'REAL NOT NULL DEFAULT 0');
asegurarColumna('ventas', 'descuento_tipo', 'TEXT');
asegurarColumna('ventas', 'descuento_valor', 'REAL NOT NULL DEFAULT 0');
asegurarColumna('ventas', 'pago_con', 'REAL');
asegurarColumna('ventas', 'vuelto', 'REAL');

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
