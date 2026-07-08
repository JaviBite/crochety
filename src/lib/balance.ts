// Balance fino estilo Splitwise. Los gastos los adelanta una persona pero son
// del taller (a partes iguales), y los pedidos los cobra quien los hace pero
// el ingreso también es común. El neto de cada persona:
//
//   neto = (pagado − gastoTotal/N) − (cobrado − ingresoTotal/N)
//
// neto > 0 → le deben; neto < 0 → debe. Los netos suman 0 y se casan con un
// greedy deudor↔acreedor (con 2 personas sale una única transferencia).
// Los pedidos cobrados sin asignar no entran (no se sabe quién tiene el dinero).

export type MemberBalance = {
  id: string;
  name: string;
  /** Gastos pagados de su bolsillo, en céntimos. */
  paidCents: number;
  /** Pedidos cobrados por esta persona, en céntimos. */
  earnedCents: number;
};

export type Settlement = {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amountCents: number;
};

/** Transferencias mínimas para saldar cuentas. Vacío si ya están en paz. */
export function computeSettlements(members: MemberBalance[]): Settlement[] {
  if (members.length < 2) return [];
  const n = members.length;
  const totalPaid = members.reduce((sum, m) => sum + m.paidCents, 0);
  const totalEarned = members.reduce((sum, m) => sum + m.earnedCents, 0);

  const nets = members.map((member) => ({
    member,
    net: Math.round(
      member.paidCents -
        totalPaid / n -
        (member.earnedCents - totalEarned / n),
    ),
  }));

  // El redondeo de las cuotas puede dejar un residuo de ±(N−1) céntimos: se
  // absorbe en el neto de mayor magnitud para que las transferencias cuadren.
  const residual = nets.reduce((sum, entry) => sum + entry.net, 0);
  if (residual !== 0) {
    const biggest = nets.reduce((a, b) =>
      Math.abs(b.net) > Math.abs(a.net) ? b : a,
    );
    biggest.net -= residual;
  }

  const creditors = nets
    .filter((entry) => entry.net > 0)
    .sort((a, b) => b.net - a.net);
  const debtors = nets
    .filter((entry) => entry.net < 0)
    .map((entry) => ({ member: entry.member, owed: -entry.net }))
    .sort((a, b) => b.owed - a.owed);

  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  for (const debtor of debtors) {
    while (debtor.owed > 0 && creditorIndex < creditors.length) {
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.owed, creditor.net);
      if (amount > 0) {
        settlements.push({
          from: { id: debtor.member.id, name: debtor.member.name },
          to: { id: creditor.member.id, name: creditor.member.name },
          amountCents: amount,
        });
        debtor.owed -= amount;
        creditor.net -= amount;
      }
      if (creditor.net === 0) creditorIndex += 1;
    }
  }
  return settlements;
}
