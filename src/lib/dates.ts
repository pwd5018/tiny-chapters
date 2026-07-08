export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateKeyAsLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
