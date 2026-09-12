/**
 * Date -> "YYYY-MM-DD" en la zona LOCAL, el formato que espera
 * <input type="date">. `toISOString()` desfasea al día UTC (no al local), por
 * eso hay que formatear a mano con los getters locales. El servidor parsea
 * "YYYY-MM-DD" como `T00:00:00` local (ver optId/optDate en lib/forms.ts), así
 * que la ida y vuelta es estable.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Valor por defecto "hoy" para <input type="date">, en zona local. */
export function todayInputValue(): string {
  return toDateInputValue(new Date());
}
