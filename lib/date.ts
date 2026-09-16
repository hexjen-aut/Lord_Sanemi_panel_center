export function dayOfWeek(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export function weekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
