import express, { Request, Response, NextFunction } from 'express';
import recordsRouter from './routes/records.routes';
import syncRouter from './routes/sync.routes';
import adminRouter from './routes/admin.routes';

export function createApp(): express.Application {
  const app = express();

  // ─── Middlewares globales ────────────────────────────────────────────────────
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging básico de requests
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // ─── CORS (para el frontend React) ──────────────────────────────────────────
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  // ─── Health check ────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'erp-sync', timestamp: new Date().toISOString() });
  });

  // ─── Rutas ───────────────────────────────────────────────────────────────────
  app.use('/api/records', recordsRouter);
  app.use('/sync', syncRouter);
  app.use('/admin', adminRouter);

  // ─── 404 ─────────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint no encontrado' });
  });

  // ─── Error handler global ─────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] Unhandled error:', err.message, err.stack);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    });
  });

  return app;
}
