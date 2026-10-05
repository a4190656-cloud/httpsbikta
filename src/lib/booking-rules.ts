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

export function hoursUntil(start: Date, now = new Date()) {
  return Math.max(0, Math.floor((start.getTime() - now.getTime()) / 3_600_000));
}
export const canCancel = (start: Date, now = new Date()) => start.getTime() - now.getTime() >= 48 * 3_600_000;

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
export const PAY_METHODS = ["ביט", "העברה", "מזומן", "סוף חודש"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export const END_OF_MONTH_METHODS = ["ביט", "העברה", "מזומן"] as const;
export type EndOfMonthMethod = (typeof END_OF_MONTH_METHODS)[number];
export const PAYMENT_RECORD_METHODS = ["ביט", "העברה", "מזומן", "סוף חודש - ביט", "סוף חודש - העברה", "סוף חודש - מזומן"] as const;
export type PaymentRecordMethod = (typeof PAYMENT_RECORD_METHODS)[number];
export const PAY_METHOD_LABEL: Record<string, string> = {
  "ביט": "ביט",
  "העברה": "העברה בנקאית",
  "מזומן": "מזומן במקום",
  "סוף חודש": "תשלום מרוכז בסוף חודש",
  "סוף חודש - ביט": "סוף חודש — ביט",
  "סוף חודש - העברה": "סוף חודש — העברה בנקאית",
  "סוף חודש - מזומן": "סוף חודש — מזומן",
};
export function paymentRecordMethod(method: PayMethod, settlement?: EndOfMonthMethod): PaymentRecordMethod {
  if (method !== "סוף חודש") return method;
  if (!settlement) throw new Error("יש לבחור כיצד יוסדר התשלום בסוף החודש");
  return `סוף חודש - ${settlement}`;
}
export function paymentInstructions(method: PayMethod, settlement?: EndOfMonthMethod) {
  if (method === "ביט") return "אופן תשלום: ביט למספר 053-9000374 (נא לצרף צילום אישור העברה)";
  if (method === "העברה") return "אופן תשלום: העברה בנקאית\nבנק: 12 (הפועלים) | סניף: 290 | חשבון: 62225\nעל שם: מחלא בוקשפן\nסיבת העברה חובה: שירותי משרד\n(נא לצרף צילום אסמכתא)";
  if (method === "מזומן") return "אופן תשלום: מזומן במקום בבקתה";
  return `אופן תשלום: תשלום מרוכז בסוף חודש (אמצעי תשלום נבחר: ${PAY_METHOD_LABEL[settlement ?? ""] ?? "לא נבחר"})`;
}
export const STATUSES = ["pending", "paid", "invoiced", "cancelled", "no_show", "credit"] as const;
export const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לתשלום / אישור", paid: "שולם", invoiced: "הופקה קבלה",
  cancelled: "בוטל", no_show: "לא הייתה ולא שילמה", credit: "נשאר זכות",
};
/** Statuses that count as income. */
export const INCOME_STATUSES = ["paid", "invoiced"];
/** Statuses that free the calendar slot. */
export const FREE_STATUSES = ["cancelled", "no_show"];
