import { Router, Request, Response, NextFunction } from 'express';
import { RecordsRepository } from '../../repository/RecordsRepository';
import { processOne } from '../../engine/SyncEngine';
import type { TriggerBody, SyncStatus } from '../../types';

const router = Router();
const recordsRepo = new RecordsRepository();

// ─── GET /sync/status ─────────────────────────────────────────────────────────

router.get('/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ids, external_ids, source_name } = req.query;

    let records;

    if (ids) {
      const idList = String(ids)
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      records = await recordsRepo.findByIds(idList);
    } else if (external_ids && source_name) {
      const externalIdList = String(external_ids)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      records = await recordsRepo.findByExternalIds(String(source_name), externalIdList);
    } else {
      res.status(400).json({
        error: 'INVALID_PARAMS',
        message: 'Proporcionar ids o (external_ids + source_name)',
      });
      return;
    }

    const data = records.map((r) => ({
      id: r.id,
      external_id: r.external_id,
      sync_status: r.sync_status,
      erp_record_id: r.erp_record_id,
    }));

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /sync/trigger ───────────────────────────────────────────────────────

router.post('/trigger', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as TriggerBody;
    let records;

    if (body.record_ids && body.record_ids.length > 0) {
      records = await recordsRepo.findByIds(body.record_ids);
    } else if (body.source_name) {
      records = await recordsRepo.findPendingByFilter(
        body.source_name,
        body.entity_type,
        body.sync_status as SyncStatus | undefined,
      );
    } else {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Proporcionar record_ids o source_name',
      });
      return;
    }

    if (records.length === 0) {
      res.status(200).json({ triggered: 0, message: 'No hay registros para procesar' });
      return;
    }

    // Lanzar en background sin await
    void (async () => {
      for (const record of records) {
        try {
          await processOne(record, 'manual');
        } catch (err) {
          console.error(`[trigger] Error processing record ${record.id}:`, (err as Error).message);
        }
      }
    })();

    res.status(200).json({
      triggered: records.length,
      message: 'Sincronización iniciada en background',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /sync/requeue/:id ───────────────────────────────────────────────────

router.post('/requeue/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'ID debe ser un número entero' });
      return;
    }

    const current = await recordsRepo.findById(id);
    if (!current) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Registro ${id} no encontrado` });
      return;
    }

    if (current.sync_status !== 'blocked') {
      res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Solo se pueden reencolar registros en estado 'blocked'. Estado actual: ${current.sync_status}`,
      });
      return;
    }

    const updated = await recordsRepo.requeue(id);
    if (!updated) {
      res.status(409).json({ error: 'REQUEUE_FAILED', message: 'No se pudo reencolar el registro' });
      return;
    }

    res.status(200).json({
      record_id: id,
      previous_status: 'blocked' as SyncStatus,
      new_status: 'pending' as SyncStatus,
      attempts_reset: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
