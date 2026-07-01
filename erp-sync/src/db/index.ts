import { Pool, PoolConfig } from 'pg';

// Usa variables con prefijo ERP_SYNC_DB_ para no colisionar
// con las variables del backend Spring Boot (DB_HOST, DB_NAME, etc.)
const config: PoolConfig = {
  host:     process.env.ERP_SYNC_DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.ERP_SYNC_DB_PORT ?? '5433', 10),
  database: process.env.ERP_SYNC_DB_NAME     ?? 'erpsync',
  user:     process.env.ERP_SYNC_DB_USER     ?? 'erpsync_user',
  password: process.env.ERP_SYNC_DB_PASSWORD ?? '',
  max:      parseInt(process.env.ERP_SYNC_DB_POOL_MAX ?? '10', 10),
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 5_000,
};

export const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] PostgreSQL connection OK');
  } finally {
    client.release();
  }
}
