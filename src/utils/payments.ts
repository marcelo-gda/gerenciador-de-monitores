export function calcHours(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const sp = start.split(":");
  const ep = end.split(":");
  const sh = Number(sp[0]);
  const sm = Number(sp[1] ?? 0);
  const eh = Number(ep[0]);
  const em = Number(ep[1] ?? 0);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  return (endMins - startMins) / 60;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getPeriodLabel(date: Date = new Date()): string {
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
