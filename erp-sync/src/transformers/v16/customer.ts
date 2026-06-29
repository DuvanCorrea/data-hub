import type { ParamsMap, TransformerContext } from '../../types';
import { params } from '../../config/params';

export interface CustomerPayload {
  customer_name: string;
  email_id?: string;
  mobile_no?: string;
  customer_type?: string;
  customer_group?: string;
  territory?: string;
  [key: string]: unknown;
}

/**
 * Transforma el payload estándar recibido al formato Customer de ERPNext v16.
 * Incluye el external_id como campo custom para trazabilidad.
 */
export function buildCustomerPayload(
  payload: Record<string, unknown>,
  p: ParamsMap,
  context: TransformerContext,
): Record<string, unknown> {
  const data = payload as CustomerPayload;

  if (!data.customer_name || String(data.customer_name).trim() === '') {
    throw new Error('TRANSFORM: customer_name es requerido');
  }

  return {
    doctype: 'Customer',
    customer_name: String(data.customer_name).trim(),
    customer_type: data.customer_type ?? 'Individual',
    customer_group: data.customer_group ?? params.customerGroup(p),
    territory: data.territory ?? params.territory(p),
    mobile_no: data.mobile_no ?? null,
    email_id: data.email_id ?? null,
    // Trazabilidad: guarda el ID externo en campo custom de ERPNext
    // Requiere que exista el campo custom_external_id en el DocType Customer
    custom_external_id: context.external_id,
    custom_source: context.source_name,
  };
}
