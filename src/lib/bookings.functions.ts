import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./admin-auth";
import {
  canCancel, DEFAULT_SETTINGS, DRINKS, drinksText, drinksTotal, priceFor, purposeLabel, PURPOSES,
  splitVat, type DrinkCart, type Settings, PAY_METHODS, PAYMENT_RECORD_METHODS, END_OF_MONTH_METHODS,
  paymentRecordMethod, STATUSES, STATUS_LABEL, INCOME_STATUSES, FREE_STATUSES,
} from "./booking-rules";

type Busy = { start: string; end: string };

async function loadSettings(): Promise<Settings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("settings").select("hourly_rate, drink_prices").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return { hourlyRate: Number(data.hourly_rate), drinkPrices: { ...DEFAULT_SETTINGS.drinkPrices, ...(data.drink_prices as object) } };
}

export const getSettings = createServerFn({ method: "GET" }).handler(async () => loadSettings());

type ReviewRow = { id: string; storage_path: string; title: string | null; is_visible: boolean; sort_order: number; created_at: string };

async function reviewsWithUrls(rows: ReviewRow[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return Promise.all(rows.map(async (review) => {
    const { data } = await supabaseAdmin.storage.from("customer-reviews").createSignedUrl(review.storage_path, 3600);
    return { id: review.id, title: review.title, isVisible: review.is_visible, sortOrder: review.sort_order, imageUrl: data?.signedUrl ?? "" };
  }));
}

export const getPublicReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("customer_reviews").select("id, storage_path, title, is_visible, sort_order, created_at")
    .eq("is_visible", true).order("sort_order").order("created_at", { ascending: false });
  return {
    reviews: ((data ?? []) as ReviewRow[]).map((review) => ({
      id: review.id,
      title: review.title,
      isVisible: review.is_visible,
      sortOrder: review.sort_order,
      imageUrl: `/api/public/reviews/${review.id}`,
    })),
  };
});

async function busyBetween(timeMin: string, timeMax: string): Promise<Busy[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { gcalBusy } = await import("./gcal.server");
  const [bk, bl, g] = await Promise.all([
    supabaseAdmin.from("bookings").select("starts_at, ends_at, status, created_at, payment_method")
      .eq("kind", "booking").lt("starts_at", timeMax).gt("ends_at", timeMin).not("status", "in", `(${FREE_STATUSES.join(",")})`),
    supabaseAdmin.from("blocks").select("starts_at, ends_at").lt("starts_at", timeMax).gt("ends_at", timeMin),
    gcalBusy(timeMin, timeMax),
  ]);
  const bookings = bk.data ?? [];
  return [
    ...bookings.map((b) => ({ start: b.starts_at, end: b.ends_at })),
    ...(bl.data ?? []).map((b) => ({ start: b.starts_at, end: b.ends_at })),
    ...g,
  ];
}

const overlaps = (busy: Busy[], s: string, e: string) =>
  busy.some((b) => new Date(b.start) < new Date(e) && new Date(b.end) > new Date(s));

export const getBusy = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).parse(d))
  .handler(async ({ data }) => ({ busy: await busyBetween(data.from, data.to) }));

const cartSchema = z.object(Object.fromEntries(DRINKS.map((d) => [d.id, z.number().int().min(0).max(50).optional()]))) as z.ZodType<DrinkCart>;
const phoneSchema = z.string().trim().regex(/^0(5\d|[2-4]|[89]|7\d)-?\d{7}$/);
const emailSchema = z.union([z.literal(""), z.string().trim().email().max(255)]).optional();
const newToken = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

const bookingInput = z.object({
  purpose: z.enum(PURPOSES.map((p) => p.id) as [string, ...string[]]).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  fullName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  email: emailSchema,
  attendees: z.number().int().min(1).max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
  drinks: cartSchema.optional(),
  paymentMethod: z.enum(PAY_METHODS).optional(),
  endOfMonthMethod: z.enum(END_OF_MONTH_METHODS).optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === "סוף חודש" && !data.endOfMonthMethod) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endOfMonthMethod"], message: "יש לבחור כיצד יוסדר התשלום בסוף החודש" });
  }
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => bookingInput.parse(d))
  .handler(async ({ data }) => {
    const start = new Date(data.startsAt); const endD = new Date(data.endsAt);
    const mins = (endD.getTime() - start.getTime()) / 60000;
    if (mins < 30 || mins > 24 * 60 || mins % 30 !== 0) throw new Error("משך ההזמנה לא תקין");
    if (start.getTime() < Date.now() - 5 * 60 * 1000) throw new Error("המועד שנבחר כבר עבר");
    const end = endD.toISOString();
    const busy = await busyBetween(start.toISOString(), end);
    if (overlaps(busy, start.toISOString(), end)) throw new Error("המועד נתפס זה עתה, אנא בחרו שעה אחרת");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await loadSettings();
    const hours = mins / 60;
    const cart = data.drinks ?? {};
    const p = priceFor(hours, s.hourlyRate, drinksTotal(cart, s.drinkPrices));
    const token = newToken();
    const { data: row, error } = await supabaseAdmin.from("bookings").insert({
      purpose: data.purpose ?? "other", starts_at: start.toISOString(), ends_at: end, hours: Math.ceil(hours), duration_hours: hours,
      full_name: data.fullName, phone: data.phone, email: data.email || "", attendees: data.attendees ?? 1,
      notes: data.notes || null, subtotal: p.subtotal, vat: p.vat, total: p.total, manage_token: token,
      drinks: cart, drinks_total: p.drinks,
      payment_method: paymentRecordMethod(data.paymentMethod ?? "ביט", data.endOfMonthMethod),
    }).select("*").single();
    if (error) { console.error("booking insert failed", error); throw new Error("לא הצלחנו לשמור את ההזמנה"); }
    const eventId = await gcalFor(row as unknown as BookingRow);
    if (eventId) await supabaseAdmin.from("bookings").update({ google_event_id: eventId }).eq("id", row.id);
    await syncSheet(row as unknown as BookingRow);
    return { id: row.id, token, total: p.total };
  });

export const createDrinkOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    fullName: z.string().trim().min(2).max(100), phone: phoneSchema, drinks: cartSchema,
    paymentMethod: z.enum(PAY_METHODS), endOfMonthMethod: z.enum(END_OF_MONTH_METHODS).optional(),
  }).superRefine((value, ctx) => {
    if (value.paymentMethod === "סוף חודש" && !value.endOfMonthMethod) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endOfMonthMethod"], message: "יש לבחור כיצד יוסדר התשלום בסוף החודש" });
    }
  }).parse(d))
  .handler(async ({ data }) => {
    const s = await loadSettings();
    const total = drinksTotal(data.drinks, s.drinkPrices);
    if (total <= 0) throw new Error("בחרו לפחות משקה אחד");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const token = newToken();
    const v = splitVat(total);
    const { data: row, error } = await supabaseAdmin.from("bookings").insert({
      kind: "drinks", purpose: "drinks", starts_at: now, ends_at: now, hours: 0, duration_hours: 0,
      full_name: data.fullName, phone: data.phone, email: "", attendees: 1,
      subtotal: v.subtotal, vat: v.vat, total, manage_token: token, drinks: data.drinks, drinks_total: total,
      payment_method: paymentRecordMethod(data.paymentMethod, data.endOfMonthMethod),
    }).select("*").single();
    if (error) { console.error("booking insert failed", error); throw new Error("לא הצלחנו לשמור את ההזמנה"); }
    await syncSheet(row as unknown as BookingRow);
    return { token, total };
  });

type BookingRow = {
  id: string; kind: string; purpose: string; full_name: string; phone: string; email: string; attendees: number;
  duration_hours: number; total: number; notes: string | null; starts_at: string; ends_at: string; drinks: unknown;
  payment_method: string; status: string; paid_at?: string | null; receipt_issued?: boolean;
  sheet_tab?: string | null; sheet_row?: number | null; google_event_id?: string | null;
};

async function gcalFor(b: BookingRow) {
  if (b.kind !== "booking") return null;
  const { gcalCreate } = await import("./gcal.server");
  const drinks = drinksText(b.drinks as DrinkCart);
  const purposeSuffix = b.purpose && b.purpose !== "other" ? ` (${purposeLabel(b.purpose)})` : "";
  return gcalCreate({
    summary: `השכרת בקתה B - ${b.full_name}${purposeSuffix}`,
    description: `טלפון: ${b.phone}\n${b.email ? `אימייל: ${b.email}\n` : ""}משך: ${b.duration_hours} שעות\n${drinks ? `שתייה: ${drinks}\n` : ""}אמצעי תשלום: ${b.payment_method}\nסטטוס: ${STATUS_LABEL[b.status] ?? b.status}\nסכום: ₪${b.total}\n${b.notes ? `הערות: ${b.notes}` : ""}`,
    start: b.starts_at, end: b.ends_at,
  });
}

function incomeRow(b: BookingRow) {
  const paid = INCOME_STATUSES.includes(b.status);
  return {
    date: new Date(b.starts_at), name: b.phone ? `${b.full_name} ${b.phone}` : b.full_name,
    hours: b.kind === "booking" ? Number(b.duration_hours) : ("" as const),
    drinks: drinksText(b.drinks as DrinkCart), amount: Number(b.total), method: b.payment_method,
    paid, paidAt: b.paid_at ? new Date(b.paid_at) : null, receipt: !!b.receipt_issued,
    status: STATUS_LABEL[b.status] ?? b.status,
  };
}

/** Background backup to the Google Sheet: updates the booking's row, or appends one. */
async function syncSheet(b: BookingRow) {
  try {
    const { appendIncome, updateIncomeRow } = await import("./sheets.server");
    if (b.sheet_tab && b.sheet_row) { await updateIncomeRow({ tab: b.sheet_tab, row: b.sheet_row }, incomeRow(b)); return; }
    const loc = await appendIncome(incomeRow(b));
    if (loc) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("bookings").update({ sheet_tab: loc.tab, sheet_row: loc.row }).eq("id", b.id);
    }
  } catch (e) { console.error("sheet sync", e); }
}

async function syncPaid(b: BookingRow) {
  const eventId = b.google_event_id ? null : await gcalFor(b);
  await syncSheet(b);
  return eventId;
}

export const getBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin.from("bookings")
      .select("id, kind, purpose, starts_at, ends_at, duration_hours, full_name, attendees, status, total, drinks")
      .eq("manage_token", data.token).maybeSingle();
    return { booking: b };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { gcalDelete } = await import("./gcal.server");
    const { data: b } = await supabaseAdmin.from("bookings").select("*").eq("manage_token", data.token).single();
    if (!b) throw new Error("ההזמנה לא נמצאה");
    if (b.status === "cancelled") return { ok: true };
    if (b.kind !== "booking" || !canCancel(new Date(b.starts_at))) throw new Error("מועד הביטול חלף");
    if (b.google_event_id) await gcalDelete(b.google_event_id);
    await supabaseAdmin.from("bookings").update({ status: "cancelled", google_event_id: null }).eq("id", b.id);
    await syncSheet({ ...b, status: "cancelled" } as unknown as BookingRow);
    return { ok: true };
  });

// ---------- Admin ----------
async function assertAdmin(ctx: { supabase: any; userId: string | null; pin: boolean }) {
  if (ctx.pin) return;
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    if (context.pin) return { isAdmin: true };
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (data) return { isAdmin: true };
    // Bootstrap: the very first signed-in user becomes the owner/admin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: context.userId!, role: "admin" });
      return { isAdmin: true };
    }
    return { isAdmin: false };
  });

export const adminList = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const months = new Set([jlmMonth(data.from), jlmMonth(new Date(new Date(data.to).getTime() - 1).toISOString())]);
    for (const mo of months) await importSheetMonth(mo);
    const { gcalEvents } = await import("./gcal.server");
    const [b, bl, ev] = await Promise.all([
      context.supabase.from("bookings").select("id, kind, purpose, starts_at, ends_at, duration_hours, full_name, phone, email, attendees, notes, status, total, drinks, payment_method, source, google_event_id, sheet_tab, sheet_row, receipt_issued, paid_at")
        .gte("starts_at", data.from).lt("starts_at", data.to).order("starts_at"),
      context.supabase.from("blocks").select("*").gte("starts_at", data.from).lt("starts_at", data.to).order("starts_at"),
      gcalEvents(data.from, data.to),
    ]);
    // Calendar -> site: moved events update the booking time, deleted events cancel it.
    const evById = new Map(ev.map((e) => [e.id, e]));
    const { gcalGet } = await import("./gcal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const bk of (b.data ?? []) as any[]) {
      if (!bk.google_event_id || bk.kind !== "booking" || FREE_STATUSES.includes(bk.status)) continue;
      const found = evById.get(bk.google_event_id);
      const cur = found ? { start: found.start, end: found.end } : await gcalGet(bk.google_event_id);
      if (cur === undefined) continue;
      if (cur === null) {
        await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", bk.id);
        bk.status = "cancelled";
        await syncSheet({ ...bk, status: "cancelled" } as BookingRow);
        continue;
      }
      const s = new Date(cur.start).toISOString(), e = new Date(cur.end).toISOString();
      if (s !== new Date(bk.starts_at).toISOString() || e !== new Date(bk.ends_at).toISOString()) {
        const dur = Math.round(((new Date(e).getTime() - new Date(s).getTime()) / 3600_000) * 2) / 2;
        await supabaseAdmin.from("bookings").update({ starts_at: s, ends_at: e, duration_hours: dur, hours: Math.ceil(dur) }).eq("id", bk.id);
        Object.assign(bk, { starts_at: s, ends_at: e, duration_hours: dur });
      }
    }
    const ours = new Set((b.data ?? []).map((x: any) => x.google_event_id).filter(Boolean));
    const calendar = ev.filter((e) => !ours.has(e.id));
    return { bookings: b.data ?? [], blocks: bl.data ?? [], calendar };
  });

export const adminAddBlock = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ startsAt: z.string(), endsAt: z.string(), reason: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("blocks").insert({ starts_at: data.startsAt, ends_at: data.endsAt, reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveBlock = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await context.supabase.from("blocks").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminCreateManual = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    fullName: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(20),
    startsAt: z.string().datetime({ offset: true }).nullable(),
    endsAt: z.string().datetime({ offset: true }).nullable(),
    purpose: z.string().max(20),
    occurredAt: z.string().datetime({ offset: true }).optional(),
    drinks: cartSchema,
    amount: z.number().min(0).max(100000),
    method: z.enum([...PAYMENT_RECORD_METHODS, "אחר"]),
    paid: z.boolean(),
    receipt: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await loadSettings();
    const isBooking = !!(data.startsAt && data.endsAt);
    const now = new Date().toISOString();
    const hours = data.startsAt && data.endsAt ? (new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime()) / 3600000 : 0;
    if (isBooking && hours <= 0) throw new Error("שעת הסיום חייבת להיות אחרי ההתחלה");
    const v = splitVat(data.amount);
    const row = {
      kind: isBooking ? "booking" : "drinks", purpose: isBooking ? data.purpose : "drinks",
      starts_at: data.startsAt ?? data.occurredAt ?? now, ends_at: data.endsAt ?? data.occurredAt ?? now, hours: Math.ceil(hours), duration_hours: hours,
      full_name: data.fullName, phone: data.phone, email: "", attendees: 1, notes: data.notes || null,
      subtotal: v.subtotal, vat: v.vat, total: data.amount, manage_token: newToken(),
      drinks: data.drinks, drinks_total: isBooking ? drinksTotal(data.drinks, s.drinkPrices) : data.amount,
      payment_method: data.method, source: "manual", status: data.paid ? (data.receipt ? "invoiced" : "paid") : "pending",
      paid_at: data.paid ? now : null, receipt_issued: !!data.receipt,
    };
    const { data: ins, error } = await supabaseAdmin.from("bookings").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    const eventId = await syncPaid(ins as unknown as BookingRow);
    if (eventId) await supabaseAdmin.from("bookings").update({ google_event_id: eventId }).eq("id", ins.id);
    return { ok: true };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    hourlyRate: z.number().min(0).max(10000),
    drinkPrices: z.object(Object.fromEntries(DRINKS.map((x) => [x.id, z.number().min(0).max(1000)]))),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("settings")
      .update({ hourly_rate: data.hourlyRate, drink_prices: data.drinkPrices, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRevenue = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0); from.setMonth(from.getMonth() - 5);
    const { data } = await context.supabase.from("bookings").select("starts_at, kind, total, drinks_total, status")
      .in("status", INCOME_STATUSES).gte("starts_at", from.toISOString());
    const months: Record<string, { month: string; total: number; drinks: number; bookings: number; drinkOrders: number }> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(from); d.setMonth(from.getMonth() + i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[k] = { month: k, total: 0, drinks: 0, bookings: 0, drinkOrders: 0 };
    }
    for (const r of (data ?? []) as any[]) {
      const k = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).format(new Date(r.starts_at));
      const m = months[k]; if (!m) continue;
      m.total += Number(r.total); m.drinks += Number(r.drinks_total);
      if (r.kind === "booking") m.bookings++; else m.drinkOrders++;
    }
    const { sheetMonthTotal } = await import("./sheets.server");
    let sheet: { total: number; rows: number } | null = null;
    try { sheet = await sheetMonthTotal(); } catch (e) { console.error(e); }
    return { months: Object.values(months), sheet };
  });

export const adminAddTransaction = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    type: z.enum(["income", "expense"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().trim().min(1).max(120), amount: z.number().positive().max(1_000_000),
    method: z.string().trim().max(30), notes: z.string().trim().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { appendIncome } = await import("./sheets.server");
    const expense = data.type === "expense";
    const ok = await appendIncome({
      date: new Date(`${data.date}T12:00:00+03:00`), name: data.description, hours: "",
      drinks: data.notes ?? "", amount: expense ? -data.amount : data.amount,
      method: data.method, paid: true, status: expense ? "הוצאה" : "הכנסה ידנית",
    });
    if (!ok) throw new Error("לא הצלחנו לרשום בגיליון, נסו שוב");
    return { ok: true };
  });

export const adminListReviews = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("customer_reviews").select("id, storage_path, title, is_visible, sort_order, created_at")
      .order("sort_order").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { reviews: await reviewsWithUrls((data ?? []) as ReviewRow[]) };
  });

export const adminAddReview = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    fileBase64: z.string().min(1).max(11_500_000),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    title: z.string().trim().max(120).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Buffer.from(data.fileBase64, "base64");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("התמונה גדולה מדי — עד 8MB");
    const ext = data.contentType.split("/")[1] === "jpeg" ? "jpg" : data.contentType.split("/")[1];
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from("customer-reviews").upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { count } = await supabaseAdmin.from("customer_reviews").select("id", { count: "exact", head: true });
    const { error } = await supabaseAdmin.from("customer_reviews").insert({ storage_path: path, title: data.title || null, sort_order: count ?? 0 });
    if (error) { await supabaseAdmin.storage.from("customer-reviews").remove([path]); throw new Error(error.message); }
    return { ok: true };
  });

export const adminUpdateReview = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), isVisible: z.boolean(), sortOrder: z.number().int().min(0).max(999) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("customer_reviews").update({ is_visible: data.isVisible, sort_order: data.sortOrder }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: review } = await supabaseAdmin.from("customer_reviews").select("storage_path").eq("id", data.id).maybeSingle();
    if (!review) throw new Error("התגובה לא נמצאה");
    const { error: storageError } = await supabaseAdmin.storage.from("customer-reviews").remove([review.storage_path]);
    if (storageError) throw new Error(storageError.message);
    const { error } = await supabaseAdmin.from("customer_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Ledger ("יומן בקתה") ----------
const jlmMonth = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).format(new Date(iso));


// ---------- Sheet -> site import ----------
const truthy = (v: string) => /^(true|כן|v|✓|✔|1|yes)$/i.test(v.trim());
const parseNum = (v: string) => { const n = Number(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
function statusFromSheet(label: string, paid: boolean, receipt: boolean) {
  const hit = Object.entries(STATUS_LABEL).find(([, v]) => v === label.trim());
  if (hit) return hit[0];
  if (paid && receipt) return "invoiced";
  return paid ? "paid" : "pending";
}

/** Pulls the month's sheet tab into the database: edited rows update bookings, new rows are added, cleared rows cancel. */
async function importSheetMonth(month: string) {
  try {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const tab = String(m).padStart(2, "0");
    const { readMonthRows } = await import("./sheets.server");
    const rows = await readMonthRows(tab);
    if (!rows) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linked } = await supabaseAdmin.from("bookings")
      .select("id, full_name, phone, total, payment_method, status, receipt_issued, paid_at, sheet_row, kind")
      .eq("sheet_tab", tab).gte("starts_at", new Date(Date.UTC(y, m - 2, 20)).toISOString()).lt("starts_at", new Date(Date.UTC(y, m, 10)).toISOString());
    const byRow = new Map((linked ?? []).map((b) => [b.sheet_row, b]));
    for (const { row, cells } of rows) {
      const [, date = "", nameCell = "", hoursCell = "", drinksCell = "", paidDateCell = "", method = "", amountCell = "", paidCell = "", receiptCell = "", statusCell = ""] = cells;
      const b = byRow.get(row);
      if (!nameCell) {
        if (b && !FREE_STATUSES.includes(b.status)) await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
        continue;
      }
      const phoneMatch = nameCell.match(/(\+?\d[\d-]{7,})\s*$/);
      const phone = phoneMatch ? phoneMatch[1]! : "";
      const fullName = (phoneMatch ? nameCell.slice(0, phoneMatch.index) : nameCell).trim() || nameCell;
      const paid = truthy(paidCell), receipt = truthy(receiptCell);
      const status = statusFromSheet(statusCell, paid, receipt);
      const total = parseNum(amountCell);
      const [pd, pm] = paidDateCell.split("/").map(Number);
      const paidAt = paid && pd && pm ? new Date(Date.UTC(y, pm - 1, pd, 9)).toISOString() : null;
      if (b) {
        const patch: any = {};
        if (fullName !== b.full_name) patch.full_name = fullName;
        if (phone && phone !== b.phone) patch.phone = phone;
        if (total !== Number(b.total)) { patch.total = total; patch.subtotal = total; patch.vat = 0; }
        if (method && method !== b.payment_method) patch.payment_method = method;
        if (status !== b.status) patch.status = status;
        if (receipt !== !!b.receipt_issued) patch.receipt_issued = receipt;
        if (paid && !b.paid_at && paidAt) patch.paid_at = paidAt;
        if (!paid && b.paid_at) patch.paid_at = null;
        if (Object.keys(patch).length) await supabaseAdmin.from("bookings").update(patch as never).eq("id", b.id);
        continue;
      }
      const [d, mo] = date.split("/").map(Number);
      const start = new Date(Date.UTC(y, (mo || m) - 1, d || 1, 9));
      const hours = parseNum(hoursCell);
      await supabaseAdmin.from("bookings").insert({
        kind: "sheet", source: "sheet", purpose: "other", full_name: fullName, phone, email: "",
        starts_at: start.toISOString(), ends_at: new Date(start.getTime() + hours * 3600_000).toISOString(),
        hours: Math.ceil(hours), duration_hours: hours, subtotal: total, vat: 0, total,
        notes: drinksCell ? `שתייה: ${drinksCell}` : "נוסף מהגיליון",
        payment_method: method || "אחר", status, receipt_issued: receipt, paid_at: paidAt,
        manage_token: crypto.randomUUID().replace(/-/g, ""), sheet_tab: tab, sheet_row: row,
      } as never);
    }
  } catch (e) { console.error("sheet import", e); }
}

export const adminLedger = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await importSheetMonth(data.month);
    const [y, m] = data.month.split("-").map(Number) as [number, number];
    const from = new Date(Date.UTC(y, m - 1, 1) - 3 * 3600_000).toISOString();
    const to = new Date(Date.UTC(y, m, 1) + 3 * 3600_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("bookings")
      .select("id, kind, starts_at, ends_at, duration_hours, full_name, phone, drinks, drinks_total, payment_method, paid_at, total, status, receipt_issued, notes, source, created_at")
      .gte("starts_at", from).lt("starts_at", to).order("starts_at");
    if (error) throw new Error(error.message);
    const list = (rows ?? []).filter((r) => jlmMonth(r.starts_at) === data.month);
    const total = list.filter((r) => INCOME_STATUSES.includes(r.status)).reduce((s, r) => s + Number(r.total), 0);
    return { rows: list, total };
  });

export const adminUpdateBooking = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: z.enum(STATUSES).optional(),
    paid: z.boolean().optional(),
    receipt: z.boolean().optional(),
    paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    method: z.enum([...PAYMENT_RECORD_METHODS, "אחר"]).optional(),
    total: z.number().min(0).max(100000).optional(),
    fullName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(20).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin.from("bookings").select("*").eq("id", data.id).single();
    if (!b) throw new Error("ההזמנה לא נמצאה");
    const patch: any = {};
    if (data.status) patch.status = data.status;
    if (data.paid === true) { patch.status = b.receipt_issued ? "invoiced" : "paid"; patch.paid_at = b.paid_at ?? new Date().toISOString(); }
    if (data.paid === false) { patch.status = "pending"; patch.paid_at = null; }
    if (data.receipt !== undefined) {
      patch.receipt_issued = data.receipt;
      const st = (patch.status as string) ?? b.status;
      if (data.receipt && (st === "paid" || st === "pending")) { patch.status = "invoiced"; patch.paid_at = b.paid_at ?? new Date().toISOString(); }
      if (!data.receipt && st === "invoiced") patch.status = "paid";
    }
    if (data.paidAt !== undefined) patch.paid_at = data.paidAt ? `${data.paidAt}T12:00:00+03:00` : null;
    if (data.method) patch.payment_method = data.method;
    if (data.total !== undefined) { const v = splitVat(data.total); patch.total = data.total; patch.subtotal = v.subtotal; patch.vat = v.vat; if (b.kind === "drinks") patch.drinks_total = data.total; }
    if (data.fullName) patch.full_name = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    const next = { ...b, ...patch } as unknown as BookingRow;
    // Freeing statuses release the calendar slot; reviving re-creates the event.
    if (FREE_STATUSES.includes(next.status) && b.google_event_id) {
      const { gcalDelete } = await import("./gcal.server");
      await gcalDelete(b.google_event_id); patch.google_event_id = null;
    } else if (!FREE_STATUSES.includes(next.status) && !b.google_event_id && b.kind === "booking" && FREE_STATUSES.includes(b.status)) {
      const id = await gcalFor(next); if (id) patch.google_event_id = id;
    }
    const { error } = await supabaseAdmin.from("bookings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncSheet({ ...next, google_event_id: (patch.google_event_id as string | null | undefined) ?? b.google_event_id });
    return { ok: true };
  });

export const adminDeleteBooking = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin.from("bookings").select("*").eq("id", data.id).single();
    if (!b) throw new Error("ההזמנה לא נמצאה");
    if (b.google_event_id) { const { gcalDelete } = await import("./gcal.server"); await gcalDelete(b.google_event_id).catch(() => {}); }
    if (b.sheet_tab && b.sheet_row) { const { updateIncomeRow } = await import("./sheets.server"); await updateIncomeRow({ tab: b.sheet_tab, row: b.sheet_row }, null); }
    const { error } = await supabaseAdmin.from("bookings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
