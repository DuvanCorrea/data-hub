import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

// Las migraciones viven en ../migrations/ relativo a este archivo en src/
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const TRACKING_TABLE = 'erpsync_migrations';

export async function runMigrations(pool: Pool): Promise<void> {
  // Crear tabla de tracking si no existe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id         SERIAL      PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP   NOT NULL DEFAULT NOW()
    )
  `);

  // Leer archivos .sql ordenados
  const sqlFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const filename of sqlFiles) {
    // Verificar si ya fue aplicada
    const { rowCount } = await pool.query(
      `SELECT 1 FROM ${TRACKING_TABLE} WHERE filename = $1`,
      [filename],
    );

    if (rowCount && rowCount > 0) {
      console.log(`[migrations] Already applied: ${filename}`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO ${TRACKING_TABLE} (filename) VALUES ($1)`,
        [filename],
      );
      await client.query('COMMIT');
      console.log(`[migrations] Applied: ${filename}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed [${filename}]: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  console.log('[migrations] All migrations up to date.');
}
