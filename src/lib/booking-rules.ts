// Shared, browser-safe booking rules.
export const HOURLY_RATE = 40; // default ₪ per hour, VAT included (admin-editable in settings)
export const VAT_RATE = 0.18;
export const SLOT_MIN = 30;

export const PURPOSES = [
  { id: "clinic", label: "קליניקה", desc: "טיפולים ופגישות אישיות" },
  { id: "studio", label: "סטודיו", desc: "יוגה, צילום, יצירה" },
  { id: "office", label: "משרד / עבודה", desc: "יום עבודה מרוכז" },
  { id: "meetings", label: "פגישות והרצאות", desc: "סדנאות וישיבות" },
  { id: "other", label: "אחר", desc: "כל מטרה אחרת" },
] as const;
export type PurposeId = (typeof PURPOSES)[number]["id"];

export const DRINKS = [
  { id: "can", label: "פחית" },
  { id: "spring", label: "ספרינג" },
  { id: "water", label: "מים" },
  { id: "soda", label: "סודה" },
] as const;
export type DrinkId = (typeof DRINKS)[number]["id"];
export type DrinkPrices = Record<DrinkId, number>;
export type DrinkCart = Partial<Record<DrinkId, number>>;
export const DEFAULT_DRINK_PRICES: DrinkPrices = { can: 6, spring: 6, water: 4, soda: 4 };
export type Settings = { hourlyRate: number; drinkPrices: DrinkPrices };
export const DEFAULT_SETTINGS: Settings = { hourlyRate: HOURLY_RATE, drinkPrices: DEFAULT_DRINK_PRICES };

export function drinksTotal(cart: DrinkCart, prices: DrinkPrices) {
  return DRINKS.reduce((s, d) => s + (cart[d.id] ?? 0) * (prices[d.id] ?? 0), 0);
}
export function drinksText(cart: DrinkCart) {
  return DRINKS.filter((d) => (cart[d.id] ?? 0) > 0).map((d) => `${cart[d.id]} ${d.label}`).join(", ");
}

export function splitVat(total: number) {
  const subtotal = Math.round((total / (1 + VAT_RATE)) * 100) / 100;
  return { subtotal, vat: Math.round((total - subtotal) * 100) / 100, total };
}
export function priceFor(hours: number, rate = HOURLY_RATE, drinks = 0) {
  const room = Math.round(rate * hours * 100) / 100;
  return { room, drinks, ...splitVat(room + drinks) };
}
export function hoursLabel(h: number) {
  if (h === 0.5) return "חצי שעה";
  if (h === 1) return "שעה";
  if (h === 2) return "שעתיים";
  return `${h} שעות`;
}

export const purposeLabel = (id: string | null) => (id === "drinks" ? "שתייה" : PURPOSES.find((p) => p.id === id)?.label ?? id ?? "");

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
/** Hebrew calendar date, e.g. "י״ד בתשרי תשפ״ז". */
export function hebrewDate(iso: string | Date) {
  return new Intl.DateTimeFormat("he-u-ca-hebrew", {
    timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso));
}
