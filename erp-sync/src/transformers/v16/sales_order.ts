import type { ParamsMap, TransformerContext } from '../../types';

/**
 * Placeholder para transformer de Sales Order en ERPNext v16.
 * Implementar en Etapa 3.
 */
export function buildSalesOrderPayload(
  payload: Record<string, unknown>,
  _params: ParamsMap,
  context: TransformerContext,
): Record<string, unknown> {
  if (!payload.customer) {
    throw new Error('TRANSFORM: customer es requerido');
  }
  if (!payload.delivery_date) {
    throw new Error('TRANSFORM: delivery_date es requerido');
  }

  return {
    doctype: 'Sales Order',
    customer: payload.customer,
    delivery_date: payload.delivery_date,
    transaction_date: payload.transaction_date ?? new Date().toISOString().split('T')[0],
    order_type: payload.order_type ?? 'Sales',
    items: payload.items ?? [],
    custom_external_id: context.external_id,
    custom_source: context.source_name,
  };
}
