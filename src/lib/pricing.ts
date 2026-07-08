// Calculadora de precio sugerido de un pedido a partir de sus materiales
// (OrderMaterial). Compartida por el formulario (cliente) y los tests.

export type PricedLine = {
  /** Precio unitario del material en céntimos. */
  priceCents: number;
  /** Unidades/ovillos usados; admite fracciones (media madeja = 0.5). */
  quantity: number;
};

/** Coste total de materiales, redondeando cada línea al céntimo. */
export function materialsCostCents(lines: PricedLine[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.round(line.priceCents * line.quantity),
    0,
  );
}

/**
 * Precio sugerido: coste de materiales × multiplicador (mano de obra y
 * margen), redondeado hacia arriba al múltiplo de 0,50 € para que quede un
 * precio "de tienda".
 */
export function suggestedPriceCents(
  costCents: number,
  multiplier: number,
): number {
  if (costCents <= 0 || multiplier <= 0) return 0;
  return Math.ceil((costCents * multiplier) / 50) * 50;
}
