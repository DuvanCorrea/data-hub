import 'dotenv/config';
import { testConnection } from './db';
import { runMigrations } from './migrations-runner';
import { pool } from './db';
import { createApp } from './api/server';
import { startScheduler } from './scheduler';

const PORT = parseInt(process.env.ERP_SYNC_PORT ?? '3001', 10);

async function bootstrap(): Promise<void> {
  console.log('[app] Iniciando erp-sync...');

  // 1. Verificar conexión a BD
  await testConnection();

  // 2. Ejecutar migraciones
  await runMigrations(pool);

  // 3. Crear servidor Express
  const app = createApp();

  // 4. Iniciar servidor HTTP
  app.listen(PORT, () => {
    console.log(`[app] erp-sync corriendo en http://0.0.0.0:${PORT}`);
    console.log(`[app] Health: http://0.0.0.0:${PORT}/health`);
  });

  // 5. Iniciar scheduler
  await startScheduler();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[app] SIGTERM recibido. Cerrando...');
    await pool.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[app] SIGINT recibido. Cerrando...');
    await pool.end();
    process.exit(0);
  });
}

bootstrap().catch((err: Error) => {
  console.error('[app] Error fatal al iniciar:', err.message);
  process.exit(1);
});
