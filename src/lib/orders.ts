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
