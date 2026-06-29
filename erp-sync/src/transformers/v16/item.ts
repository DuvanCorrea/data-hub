import type { ParamsMap, TransformerContext } from '../../types';

/**
 * Placeholder para transformer de Item en ERPNext v16.
 * Implementar en Etapa 2.
 */
export function buildItemPayload(
  payload: Record<string, unknown>,
  _params: ParamsMap,
  context: TransformerContext,
): Record<string, unknown> {
  if (!payload.item_code) {
    throw new Error('TRANSFORM: item_code es requerido');
  }

  return {
    doctype: 'Item',
    item_code: payload.item_code,
    item_name: payload.item_name ?? payload.item_code,
    item_group: payload.item_group ?? 'All Item Groups',
    stock_uom: payload.stock_uom ?? 'Nos',
    is_stock_item: payload.is_stock_item ?? 1,
    custom_external_id: context.external_id,
    custom_source: context.source_name,
    ...(payload.description ? { description: payload.description } : {}),
  };
}
