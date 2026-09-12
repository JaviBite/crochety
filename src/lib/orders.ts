// Helpers de pedidos compartidos por listado y dashboard.

/** Vencido: fecha prevista anterior a hoy (00:00 local) y aún no cobrado. */
export function isOrderOverdue(order: {
  dueDate: Date | null;
  status: string;
}): boolean {
  if (!order.dueDate || order.status === "COBRADO") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return order.dueDate < today;
}

/**
 * Quién cobra un pedido: si no se especificó (`collectedById` null, el caso
 * por defecto y de todos los pedidos anteriores al campo), lo cobra quien lo
 * tiene asignado; sin asignado tampoco, no se sabe quién tiene el dinero.
 */
export function resolveOrderCollectorId(order: {
  collectedById: string | null;
  assignedToId: string | null;
}): string | null {
  return order.collectedById ?? order.assignedToId;
}
