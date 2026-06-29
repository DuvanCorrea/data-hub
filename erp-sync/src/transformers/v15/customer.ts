import type { ParamsMap, TransformerContext } from '../../types';
import { params } from '../../config/params';

/**
 * Transformer de Customer para ERPNext v15.
 * Misma lógica que v16 pero sin campos custom (requieren configuración separada).
 */
export function buildCustomerPayload(
  payload: Record<string, unknown>,
  p: ParamsMap,
  context: TransformerContext,
): Record<string, unknown> {
  const customerName = payload.customer_name;
  if (!customerName || String(customerName).trim() === '') {
    throw new Error('TRANSFORM: customer_name es requerido');
  }

  return {
    doctype: 'Customer',
    customer_name: String(customerName).trim(),
    customer_type: payload.customer_type ?? 'Individual',
    customer_group: payload.customer_group ?? params.customerGroup(p),
    territory: payload.territory ?? params.territory(p),
    mobile_no: payload.mobile_no ?? null,
    email_id: payload.email_id ?? null,
    // v15 no garantiza campos custom — incluir pero puede ignorarlos ERPNext
    custom_external_id: context.external_id,
  };
}
