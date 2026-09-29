// Shared, browser-safe booking rules.
export const HOURLY_RATE = 40; // ₪ per hour, VAT included
export const VAT_RATE = 0.18;

export const PURPOSES = [
  { id: "clinic", label: "קליניקה", desc: "טיפולים ופגישות אישיות בשקט מוחלט" },
  { id: "studio", label: "סטודיו", desc: "יוגה, צילום, יצירה ותנועה" },
  { id: "office", label: "משרד / עבודה שקטה", desc: "יום עבודה מרוכז מול הגינה" },
  { id: "meetings", label: "פגישות והרצאות", desc: "סדנאות, ישיבות צוות ומפגשים" },
  { id: "other", label: "אחר", desc: "מפגש פרטי או כל מטרה אחרת" },
] as const;
export type PurposeId = (typeof PURPOSES)[number]["id"];

export const DURATIONS = [
  { hours: 1, label: "שעה" },
  { hours: 2, label: "שעתיים" },
  { hours: 3, label: "3 שעות" },
  { hours: 6, label: "חצי יום", sub: "6 שעות" },
  { hours: 12, label: "יום מלא", sub: "12 שעות" },
];

export function priceFor(hours: number) {
  const total = HOURLY_RATE * hours;
  const subtotal = Math.round((total / (1 + VAT_RATE)) * 100) / 100;
  const vat = Math.round((total - subtotal) * 100) / 100;
  return { subtotal, vat, total };
}

export const purposeLabel = (id: string) => PURPOSES.find((p) => p.id === id)?.label ?? id;

// Israeli holidays (non-business days), YYYY-MM-DD
const HOLIDAYS = new Set([
  "2026-04-02", "2026-04-08", "2026-04-22", "2026-05-22", "2026-09-12", "2026-09-13",
  "2026-09-21", "2026-09-26", "2026-10-03",
  "2027-03-23", "2027-03-29", "2027-05-12", "2027-06-11", "2027-10-02", "2027-10-03",
  "2027-10-11", "2027-10-16", "2027-10-23",
]);

const ymd = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
const weekday = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short" }).format(d);

export function isBusinessDay(d: Date) {
  const w = weekday(d);
  return w !== "Fri" && w !== "Sat" && !HOLIDAYS.has(ymd(d));
}

/** Full business days strictly between now and the booking date. */
export function businessDaysUntil(start: Date, now = new Date()) {
  let count = 0;
  const cur = new Date(now);
  cur.setDate(cur.getDate() + 1);
  while (ymd(cur) < ymd(start)) {
    if (isBusinessDay(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
export const canCancel = (start: Date, now = new Date()) => businessDaysUntil(start, now) >= 2;

export function formatILS(n: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(n);
}
export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
