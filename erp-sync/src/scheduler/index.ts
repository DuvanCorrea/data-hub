import cron from 'node-cron';
import { loadParams, params } from '../config/params';
import { runBatch } from '../engine/SyncEngine';

let scheduledTask: cron.ScheduledTask | null = null;

export async function startScheduler(): Promise<void> {
  const currentParams = await loadParams();
  const cronExpression = params.cron(currentParams);

  if (!cron.validate(cronExpression)) {
    console.error(`[scheduler] Expresión cron inválida: "${cronExpression}". Scheduler no iniciado.`);
    return;
  }

  scheduledTask = cron.schedule(cronExpression, async () => {
    try {
      // Recargar params en cada ejecución para respetar cambios en caliente
      const liveParams = await loadParams();
      if (!params.isEnabled(liveParams)) {
        console.log('[scheduler] Tick ignorado — ERPSYNC_ENABLED=false');
        return;
      }

      console.log(`[scheduler] Tick — ${new Date().toISOString()}`);
      const processed = await runBatch();
      if (processed > 0) {
        console.log(`[scheduler] Batch completado: ${processed} registros procesados`);
      }
    } catch (err) {
      console.error('[scheduler] Error en tick:', (err as Error).message);
    }
  });

  console.log(`[scheduler] Iniciado con cron: "${cronExpression}"`);
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[scheduler] Detenido');
  }
}
