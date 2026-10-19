// Pure helpers for the Google Sheet -> site import (no I/O, unit-testable).
// Why this exists: the old import identified a sheet row only by its row NUMBER and
// parsed dates loosely, so inserting/sorting rows, two imports running at once, or a
// date typed as "19.10" made bookings duplicate or land on the wrong day.

export type SheetRow = { row: number; cells: string[] };

export type Candidate = {
  id: string; kind: string; status: string; full_name: string; phone: string;
  total: number | string; payment_method: string; receipt_issued: boolean | null;
  paid_at: string | null; starts_at: string; ends_at: string;
  sheet_tab: string | null; sheet_row: number | null;
};

export type ParsedRow = {
  row: number; day: number | null; fullName: string; phone: string; hours: number;
  drinks: string; paidDay: { d: number; m: number } | null; method: string; total: number;
  paid: boolean; receipt: boolean; statusCell: string; key: string;
};

/** The year this spreadsheet's month tabs ("01".."12") belong to. The tabs carry no year, so the
 *  sheet -> site import only runs for this year. Change it (or set env SHEET_YEAR) when a new yearly sheet starts. */
export const SHEET_YEAR = Number(typeof process !== "undefined" ? process.env["SHEET_YEAR"] : "") || 2026;

export type Plan = {
  updates: { id: string; patch: Record<string, unknown>; rekey?: string | undefined }[];
  inserts: { row: number; key: string; parsed: ParsedRow; startsAt: string; endsAt: string }[];
  cancels: string[];
  /** Extra copies of a row created by the old double import (same row, same day + name, kind "sheet"). */
  twins: string[];
  skipped: { row: number; reason: string }[];
};

const FREE = ["cancelled", "no_show"];
const truthy = (v: string) => /^(true|כן|v|✓|✔|1|yes)$/i.test(v.trim());
export const parseNum = (v: string) => { const n = Number(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
export const normName = (s: string) => s.replace(/[\u200e\u200f"'׳״]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Day of month (Asia/Jerusalem) of an ISO timestamp, plus its month and year. */
export function jlmParts(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const [y, m, d] = p.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

/**
 * Reads the day from a sheet date cell that lives in the tab for month `tabMonth`.
 * The tab is the source of truth for the month; the cell only gives the day.
 * Accepts 19/10, 19.10, 19-10-2026, 19/10/26, 2026-10-19, "19 באוק׳", Sheets serial numbers,
 * and US-style 10/19 or 10/5 (the tab month tells which number is the month).
 * Returns null when no valid day can be read (the row is then NOT imported on a guessed date).
 */
export function parseSheetDay(cell: string, tabMonth: number, year: number): number | null {
  const s = String(cell ?? "").trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) { // Sheets/Excel serial date (days since 1899-12-30)
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return dt.getUTCDate();
  }
  const iso = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  let d: number | undefined, mo: number | undefined;
  if (iso) { mo = Number(iso[2]); d = Number(iso[3]); }
  else {
    const n = (s.match(/\d+/g) ?? []).map(Number);
    d = n[0]; mo = n[1];
  }
  if (!d) return null;
  let day = d;
  if (mo !== undefined && mo !== tabMonth && d === tabMonth && mo >= 1 && mo <= 31) day = mo; // written month-first
  if (day < 1 || day > daysIn(year, tabMonth)) return null;
  return day;
}

export function parseRow(r: SheetRow, tabMonth: number, year: number): ParsedRow | null {
  const [, date = "", nameCell = "", hoursCell = "", drinksCell = "", paidDateCell = "", method = "", amountCell = "", paidCell = "", receiptCell = "", statusCell = ""] = r.cells;
  if (!nameCell.trim()) return null;
  const phoneMatch = nameCell.match(/(\+?\d[\d-]{7,})\s*$/);
  const phone = phoneMatch ? phoneMatch[1]! : "";
  const fullName = (phoneMatch ? nameCell.slice(0, phoneMatch.index) : nameCell).trim() || nameCell.trim();
  const day = parseSheetDay(date, tabMonth, year);
  const [pd, pm] = (paidDateCell.match(/\d+/g) ?? []).map(Number);
  const paidDay = pd && pm ? { d: pd, m: pm } : null;
  return {
    row: r.row, day, fullName, phone, hours: parseNum(hoursCell), drinks: drinksCell, paidDay,
    method, total: parseNum(amountCell), paid: truthy(paidCell), receipt: truthy(receiptCell), statusCell,
    key: `${day ?? "?"}|${normName(fullName)}`,
  };
}

const candKey = (c: Candidate) => `${jlmParts(c.starts_at).d}|${normName(c.full_name)}`;
/** Stable identity of a sheet row's content: year-tab|day|name#occurrence (hashed into manage_token, which is UNIQUE). */
export const sheetKey = (year: number, tab: string, key: string, occ: number) => `${year}-${tab}|${key}#${occ}`;

/**
 * Decides what one import of a month tab should do, matching sheet rows to bookings by
 * CONTENT (day + name) first and row number second, so moved/inserted/sorted rows keep
 * their booking, and a row that already has a booking is never inserted again.
 */
export function planSheetImport(
  rows: SheetRow[], candidates: Candidate[],
  opts: { tab: string; year: number; statusFromSheet: (label: string, paid: boolean, receipt: boolean) => string },
): Plan {
  const tabMonth = Number(opts.tab);
  const plan: Plan = { updates: [], inserts: [], cancels: [], twins: [], skipped: [] };
  const parsed: ParsedRow[] = [];
  const blankRows = new Set<number>();
  for (const r of rows) { const p = parseRow(r, tabMonth, opts.year); if (p) parsed.push(p); else blankRows.add(r.row); }
  const lastRow = rows.length ? Math.max(...rows.map((r) => r.row)) : 0;

  // Linked = already tied to this tab. Unlinked = bookings in this month not yet in the sheet
  // (e.g. a website booking whose sheet write has not been linked yet).
  const linked = candidates.filter((c) => c.sheet_tab === opts.tab);
  const unlinked = candidates.filter((c) => !c.sheet_tab && (() => { const p = jlmParts(c.starts_at); return p.y === opts.year && p.m === tabMonth; })());
  const used = new Set<string>();
  const match = new Map<number, { c: Candidate; firstLink: boolean }>();
  const prefer = (a: Candidate, b: Candidate) => Number(FREE.includes(a.status)) - Number(FREE.includes(b.status));

  // 1) same row number AND same content
  for (const p of parsed) {
    const c = linked.find((x) => !used.has(x.id) && x.sheet_row === p.row && (p.day === null ? normName(x.full_name) === normName(p.fullName) : candKey(x) === p.key));
    if (c) { used.add(c.id); match.set(p.row, { c, firstLink: false }); }
  }
  // 2) same content, different row (row was moved / rows inserted above it), then not-yet-linked bookings
  for (const p of parsed) {
    if (match.has(p.row) || p.day === null) continue;
    const c = linked.filter((x) => !used.has(x.id) && candKey(x) === p.key).sort(prefer)[0];
    if (c) { used.add(c.id); match.set(p.row, { c, firstLink: false }); continue; }
    const u = unlinked.filter((x) => !used.has(x.id) && candKey(x) === p.key).sort(prefer)[0];
    if (u) { used.add(u.id); match.set(p.row, { c: u, firstLink: true }); }
  }
  // 3) same row number, content changed and that booking was not found anywhere else -> an edit of this row
  for (const p of parsed) {
    if (match.has(p.row)) continue;
    const c = linked.find((x) => !used.has(x.id) && x.sheet_row === p.row);
    if (c) { used.add(c.id); match.set(p.row, { c, firstLink: false }); }
  }

  const occ = new Map<string, number>();
  for (const p of parsed) {
    const n = (occ.get(p.key) ?? 0) + 1; occ.set(p.key, n);
    const m = match.get(p.row);
    const status = opts.statusFromSheet(p.statusCell, p.paid, p.receipt);
    const paidAt = p.paid && p.paidDay ? new Date(Date.UTC(opts.year, p.paidDay.m - 1, p.paidDay.d, 9)).toISOString() : null;
    if (m) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = m.c, patch: any = {};
      if (b.sheet_tab !== opts.tab) patch.sheet_tab = opts.tab;
      if (b.sheet_row !== p.row) patch.sheet_row = p.row;
      if (!m.firstLink) { // first link of an existing website booking: link only, never overwrite its data
        if (p.fullName !== b.full_name) patch.full_name = p.fullName;
        if (p.phone && p.phone !== b.phone) patch.phone = p.phone;
        if (p.total !== Number(b.total)) { patch.total = p.total; patch.subtotal = p.total; patch.vat = 0; }
        if (p.method && p.method !== b.payment_method) patch.payment_method = p.method;
        if (status !== b.status) patch.status = status;
        if (p.receipt !== !!b.receipt_issued) patch.receipt_issued = p.receipt;
        if (p.paid && !b.paid_at && paidAt) patch.paid_at = paidAt;
        if (!p.paid && b.paid_at) patch.paid_at = null;
        if (b.kind === "sheet" && p.day !== null && jlmParts(b.starts_at).d !== p.day) { // date fixed in the sheet
          const s = new Date(Date.UTC(opts.year, tabMonth - 1, p.day, 9));
          const len = new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime();
          patch.starts_at = s.toISOString(); patch.ends_at = new Date(s.getTime() + len).toISOString();
        }
      }
      const rekey = b.kind === "sheet" && p.day !== null && candKey(b) !== p.key ? sheetKey(opts.year, opts.tab, p.key, n) : undefined;
      if (Object.keys(patch).length || rekey) plan.updates.push({ id: b.id, patch, rekey });
      continue;
    }
    if (p.day === null) { plan.skipped.push({ row: p.row, reason: "unreadable date" }); continue; }
    const s = new Date(Date.UTC(opts.year, tabMonth - 1, p.day, 9));
    plan.inserts.push({ row: p.row, key: sheetKey(opts.year, opts.tab, p.key, n), parsed: p, startsAt: s.toISOString(), endsAt: new Date(s.getTime() + p.hours * 3600_000).toISOString() });
  }

  // A linked booking whose row is now empty (cleared) is cancelled, as before. One whose entry
  // simply moved is matched above; one whose row now holds someone else is left untouched.
  const matchedAt = new Map<number, string>();
  for (const p of parsed) if (match.has(p.row) && p.day !== null) matchedAt.set(p.row, p.key);
  for (const c of linked) {
    if (used.has(c.id) || c.sheet_row == null) continue;
    if (c.kind === "sheet" && matchedAt.get(c.sheet_row) === candKey(c)) { plan.twins.push(c.id); continue; }
    if (FREE.includes(c.status)) continue;
    if (blankRows.has(c.sheet_row) || c.sheet_row > lastRow) plan.cancels.push(c.id);
  }
  return plan;
}
