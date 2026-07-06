// Todo el dinero se guarda en céntimos (Int) para evitar errores de coma
// flotante en los balances. Estos helpers convierten y formatean en EUR.

export function centsToEur(cents: number): number {
  return cents / 100;
}

export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

export function formatCents(cents: number, locale: string = "es"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
