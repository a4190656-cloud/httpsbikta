// Google Sheets income tracker — one tab per month named "01".."12".
// Columns: A מספר | B תאריך | C שם | D שעות | E שתיה | F תאריך תשלום | G אמצעי תשלום | H סכום | I שולם | J קבלה | K סטטוס
const SHEET_ID = "1aBErZU4hqTuJDoALfHSMu-fiOmZdPaFfOaZp8pk2xUQ";
const GATEWAY = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${SHEET_ID}`;
const FIRST_ROW = 4;

function headers() {
  const lk = process.env["LOVABLE_API_KEY"];
  const ck = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lk || !ck) return null;
  return { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck, "Content-Type": "application/json" };
}

const parts = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "numeric", month: "2-digit" }).formatToParts(d);
  return { day: p.find((x) => x.type === "day")!.value, month: p.find((x) => x.type === "month")!.value };
};
export const monthTab = (d = new Date()) => parts(d).month;
const dm = (d: Date) => { const p = parts(d); return `${p.day}/${Number(p.month)}`; };
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };

export type IncomeRow = {
  date: Date; name: string; hours: number | ""; drinks: string; amount: number;
  method: string; paid: boolean; status: string;
};

export async function appendIncome(row: IncomeRow): Promise<boolean> {
  const h = headers();
  if (!h) return false;
  try {
    const tab = monthTab(row.date);
    const res = await fetch(`${GATEWAY}/values/'${tab}'!A${FIRST_ROW}:C500`, { headers: h });
    if (!res.ok) { console.error(`Sheets read failed [${res.status}]: ${await res.text()}`); return false; }
    const values = ((await res.json()) as { values?: string[][] }).values ?? [];
    let i = values.findIndex((r) => !(r[2] ?? "").trim());
    if (i === -1) i = values.length;
    const prevNum = [...values.slice(0, i)].reverse().map((r) => num(r[0])).find((n) => n > 0) ?? 0;
    const rowNum = FIRST_ROW + i;
    const number = num(values[i]?.[0]) || prevNum + 1;
    const body = { values: [[number, dm(row.date), row.name, row.hours, row.drinks, row.paid ? dm(new Date()) : "", row.method, row.amount, row.paid, false, row.status]] };
    const w = await fetch(`${GATEWAY}/values/'${tab}'!A${rowNum}:K${rowNum}?valueInputOption=USER_ENTERED`, { method: "PUT", headers: h, body: JSON.stringify(body) });
    if (!w.ok) { console.error(`Sheets write failed [${w.status}]: ${await w.text()}`); return false; }
    return true;
  } catch (e) { console.error("Sheets sync error", e); return false; }
}

/** Monthly total from the sheet: the value next to "סך הכנסות לחודש זה", else sum of column H. */
export async function sheetMonthTotal(d = new Date()): Promise<{ total: number; rows: number } | null> {
  const h = headers();
  if (!h) return null;
  const tab = monthTab(d);
  const res = await fetch(`${GATEWAY}/values/'${tab}'!A${FIRST_ROW}:N500`, { headers: h });
  if (!res.ok) { console.error(`Sheets read failed [${res.status}]: ${await res.text()}`); return null; }
  const values = ((await res.json()) as { values?: string[][] }).values ?? [];
  const filled = values.filter((r) => (r[2] ?? "").trim());
  for (const r of values) {
    const li = r.findIndex((c) => String(c).includes("סך הכנסות"));
    if (li >= 0) { const v = r.slice(li + 1).find((c) => num(c) > 0); if (v) return { total: num(v), rows: filled.length }; }
  }
  return { total: filled.reduce((s, r) => s + num(r[7]), 0), rows: filled.length };
}
