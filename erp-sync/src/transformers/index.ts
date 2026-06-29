import type { EntityType, ErpVersion, ParamsMap, TransformerContext, TransformerFn } from '../types';
import { buildCustomerPayload as buildCustomerV16 } from './v16/customer';
import { buildItemPayload as buildItemV16 } from './v16/item';
import { buildSalesOrderPayload as buildSalesOrderV16 } from './v16/sales_order';
import { buildCustomerPayload as buildCustomerV15 } from './v15/customer';

// ─── Registro de transformers ─────────────────────────────────────────────────

type TransformerRegistry = Partial<Record<ErpVersion, Partial<Record<EntityType, TransformerFn>>>>;

const registry: TransformerRegistry = {
  v16: {
    customer: buildCustomerV16,
    item: buildItemV16,
    sales_order: buildSalesOrderV16,
  },
  v15: {
    customer: buildCustomerV15,
  },
};

// ─── Dispatcher principal ─────────────────────────────────────────────────────

export function build(
  entityType: EntityType,
  erpVersion: ErpVersion,
  payload: Record<string, unknown>,
  p: ParamsMap,
  context: TransformerContext,
): Record<string, unknown> {
  const versionMap = registry[erpVersion];
  if (!versionMap) {
    throw new Error(`TRANSFORM: versión ERP no soportada: ${erpVersion}`);
  }

  const transformer = versionMap[entityType];
  if (!transformer) {
    throw new Error(
      `TRANSFORM: no hay transformer para entity_type="${entityType}" en versión "${erpVersion}"`,
    );
  }

  return transformer(payload, p, context);
}

// ─── Mapeo entity_type → erp_doctype ─────────────────────────────────────────

export const ENTITY_DOCTYPE_MAP: Record<EntityType, string> = {
  customer: 'Customer',
  item: 'Item',
  sales_order: 'Sales Order',
};
