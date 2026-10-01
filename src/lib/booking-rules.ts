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
/** Hebrew calendar date, e.g. "א׳ בחשוון תשפ״ז". */
export function hebrewDate(iso: string | Date) {
  const parts = new Intl.DateTimeFormat("he-u-ca-hebrew", {
    timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = parseInt(get("day"), 10);
  const year = parseInt(get("year"), 10);
  return `${hebrewNumeral(day)} ב${get("month")} ${hebrewNumeral(year)}`;
}

/** 1→א׳, 15→ט״ו, 5787→תשפ״ז */
function hebrewNumeral(n: number): string {
  if (n >= 1000) n = n % 1000;
  const hundreds = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תתק", "תתר"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  let s = hundreds[Math.floor(n / 100)] ?? "";
  const rest = n % 100;
  if (rest === 15) s += "טו";
  else if (rest === 16) s += "טז";
  else s += (tens[Math.floor(rest / 10)] ?? "") + (ones[rest % 10] ?? "");
  if (s.length === 1) return s + "׳";
  return s.slice(0, -1) + "״" + s.slice(-1);
}

// ---------- Ledger ("יומן בקתה") ----------
export const PAY_METHODS = ["אשראי", "ביט", "העברה", "מזומן"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export const PAY_METHOD_LABEL: Record<string, string> = { "אשראי": "אשראי", "ביט": "ביט", "העברה": "העברה בנקאית", "מזומן": "מזומן במקום" };
export const STATUSES = ["pending", "paid", "invoiced", "cancelled", "no_show", "credit"] as const;
export const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לתשלום / אישור", paid: "שולם", invoiced: "הופקה קבלה",
  cancelled: "בוטל", no_show: "לא הייתה ולא שילמה", credit: "נשאר זכות",
};
/** Statuses that count as income. */
export const INCOME_STATUSES = ["paid", "invoiced"];
/** Statuses that free the calendar slot. */
export const FREE_STATUSES = ["cancelled", "no_show"];
