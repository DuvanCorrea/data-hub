import { Router, Request, Response, NextFunction } from 'express';
import { SourcesRepository } from '../../repository/SourcesRepository';
import { RecordsRepository } from '../../repository/RecordsRepository';

const router = Router();
const sourcesRepo = new SourcesRepository();
const recordsRepo = new RecordsRepository();

// ─── GET /admin/sources ───────────────────────────────────────────────────────

router.get('/sources', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sources = await sourcesRepo.findAll();
    res.status(200).json({ data: sources });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /admin/sources/:id ───────────────────────────────────────────────────

router.put('/sources/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'ID debe ser un número entero' });
      return;
    }

    const { is_active } = req.body as { is_active?: boolean };
    if (typeof is_active !== 'boolean') {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Se requiere el campo is_active (boolean)',
      });
      return;
    }

    const updated = await sourcesRepo.setActive(id, is_active);
    if (!updated) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Fuente ${id} no encontrada` });
      return;
    }

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/stats ─────────────────────────────────────────────────────────
// Contadores por estado para el dashboard del frontend

router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rows } = await import('../../db').then(({ pool }) =>
      pool.query<{ sync_status: string; count: string }>(`
        SELECT sync_status, COUNT(*)::int AS count
          FROM erpsync_incoming_records
         GROUP BY sync_status
      `),
    );

    const counts: Record<string, number> = {
      pending: 0,
      processing: 0,
      synced: 0,
      error: 0,
      blocked: 0,
      skipped: 0,
    };

    for (const row of rows) {
      counts[row.sync_status] = row.count as unknown as number;
    }

    res.status(200).json({ data: counts });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/sources/:id/sync-pending ─────────────────────────────────────
// Disparar sincronización de todos los pending de una fuente

router.post('/sources/:id/sync-pending', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'ID debe ser un número entero' });
      return;
    }

    const source = await sourcesRepo.findById(id);
    if (!source) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Fuente ${id} no encontrada` });
      return;
    }

    const records = await recordsRepo.findPendingByFilter(source.source_name);

    if (records.length === 0) {
      res.status(200).json({ triggered: 0, message: 'No hay registros pendientes para esta fuente' });
      return;
    }

    // Background
    const { processOne } = await import('../../engine/SyncEngine');
    void (async () => {
      for (const record of records) {
        try {
          await processOne(record, 'manual');
        } catch (err) {
          console.error(`[admin] Error processing record ${record.id}:`, (err as Error).message);
        }
      }
    })();

    res.status(200).json({
      triggered: records.length,
      source_name: source.source_name,
      message: 'Sincronización iniciada en background',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
