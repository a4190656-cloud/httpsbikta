import { FREE_STATUSES, INCOME_STATUSES } from "./booking-rules";

export type FinancialRow = { kind: string; total: number | string; drinks_total: number | string; status: string };
export function drinkAmount(row: FinancialRow) {
  return Math.max(0, row.kind === "drinks" ? Number(row.total) : Math.min(Number(row.total), Number(row.drinks_total)));
}
export function drinksLedgerTotals(rows: FinancialRow[]) {
  let drinksPaid = 0, drinksDebt = 0, income = 0, expenses = 0;
  for (const row of rows) {
    if (FREE_STATUSES.includes(row.status)) continue;
    const amount = Number(row.total);
    if (amount < 0) { expenses += Math.abs(amount); continue; }
    if (INCOME_STATUSES.includes(row.status)) { income += amount; drinksPaid += drinkAmount(row); }
    else if (row.status === "pending") drinksDebt += drinkAmount(row);
  }
  return { drinksPaid, drinksDebt, income, expenses, balance: income - expenses };
}