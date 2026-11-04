import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'almacen.db');
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
    imagen TEXT,
    codigo_barras TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    dia TEXT NOT NULL,
    metodo_pago TEXT NOT NULL,
    total REAL NOT NULL CHECK (total >= 0),
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

  CREATE INDEX IF NOT EXISTS idx_ventas_dia ON ventas (dia);
  CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (nombre);
`);

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
