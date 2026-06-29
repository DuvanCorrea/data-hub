import { Router, Request, Response, NextFunction } from 'express';
import { RecordsRepository } from '../../repository/RecordsRepository';
import { LogRepository } from '../../repository/LogRepository';
import { SourcesRepository } from '../../repository/SourcesRepository';
import { loadParams, params } from '../../config/params';
import { ENTITY_DOCTYPE_MAP } from '../../transformers';
import type {
  PostRecordsBody,
  PostRecordsResponse,
  RecordActionResult,
  EntityType,
} from '../../types';

const router = Router();
const recordsRepo = new RecordsRepository();
const logRepo = new LogRepository();
const sourcesRepo = new SourcesRepository();

// ─── POST /api/records ────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as PostRecordsBody;

    if (!body.source_name || !body.entity_type || !Array.isArray(body.records)) {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Se requieren source_name, entity_type y records[]',
      });
      return;
    }

    if (body.records.length === 0) {
      res.status(400).json({ error: 'EMPTY_RECORDS', message: 'El array records no puede estar vacío' });
      return;
    }

    // Validar fuente
    const source = await sourcesRepo.findByName(body.source_name);
    if (!source || !source.is_active) {
      res.status(400).json({
        error: 'SOURCE_INACTIVE',
        message: `La fuente ${body.source_name} no está activa o no existe`,
      });
      return;
    }

    // Validar entity_type
    const erpDoctype = ENTITY_DOCTYPE_MAP[body.entity_type as EntityType];
    if (!erpDoctype) {
      res.status(400).json({
        error: 'INVALID_ENTITY_TYPE',
        message: `entity_type no soportado: ${body.entity_type}. Valores válidos: customer, item, sales_order`,
      });
      return;
    }

    const currentParams = await loadParams();
    const maxAttempts = params.maxAttempts(currentParams);

    const results: RecordActionResult[] = [];
    let enqueued = 0;
    let reEnqueued = 0;

    for (const item of body.records) {
      if (!item.external_id || !item.payload) {
        continue; // Skip inválidos
      }

      const { record, action } = await recordsRepo.upsert({
        source_name: body.source_name,
        entity_type: body.entity_type as EntityType,
        external_id: String(item.external_id),
        erp_doctype: erpDoctype,
        payload: item.payload,
        max_attempts: maxAttempts,
        triggered_by: 'api',
      });

      results.push({
        external_id: item.external_id,
        record_id: record.id,
        status: record.sync_status,
        action,
      });

      if (action === 'enqueued') enqueued++;
      else reEnqueued++;
    }

    const response: PostRecordsResponse = {
      received: body.records.length,
      enqueued,
      re_enqueued: reEnqueued,
      records: results,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/records ─────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter = {
      source_name: req.query.source_name as string | undefined,
      entity_type: req.query.entity_type as string | undefined,
      sync_status: req.query.sync_status as string | undefined,
      from_date: req.query.from_date as string | undefined,
      to_date: req.query.to_date as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const result = await recordsRepo.list(filter);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/records/:id ─────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'ID debe ser un número entero' });
      return;
    }

    const record = await recordsRepo.findById(id);
    if (!record) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Registro ${id} no encontrado` });
      return;
    }

    const log = await logRepo.findByRecordId(id);
    res.status(200).json({ ...record, log });
  } catch (err) {
    next(err);
  }
});

export default router;
