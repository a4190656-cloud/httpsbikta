import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canCancel, DEFAULT_SETTINGS, DRINKS, drinksText, drinksTotal, priceFor, purposeLabel, PURPOSES,
  splitVat, type DrinkCart, type Settings,
} from "./booking-rules";

type Busy = { start: string; end: string };

async function loadSettings(): Promise<Settings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("settings").select("hourly_rate, drink_prices").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return { hourlyRate: Number(data.hourly_rate), drinkPrices: { ...DEFAULT_SETTINGS.drinkPrices, ...(data.drink_prices as object) } };
}

export const getSettings = createServerFn({ method: "GET" }).handler(async () => loadSettings());

async function busyBetween(timeMin: string, timeMax: string): Promise<Busy[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { gcalBusy } = await import("./gcal.server");
  const [bk, bl, g] = await Promise.all([
    supabaseAdmin.from("bookings").select("starts_at, ends_at, status, created_at")
      .eq("kind", "booking").lt("starts_at", timeMax).gt("ends_at", timeMin).neq("status", "cancelled"),
    supabaseAdmin.from("blocks").select("starts_at, ends_at").lt("starts_at", timeMax).gt("ends_at", timeMin),
    gcalBusy(timeMin, timeMax),
  ]);
  const fresh = Date.now() - 20 * 60 * 1000; // pending holds expire after 20 min
  const bookings = (bk.data ?? []).filter((b) => b.status === "paid" || new Date(b.created_at).getTime() > fresh);
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
    }).select("id").single();
    if (error) throw new Error("לא הצלחנו לשמור את ההזמנה");
    return { id: row.id, token, total: p.total };
  });

export const createDrinkOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ fullName: z.string().trim().min(2).max(100), phone: phoneSchema, drinks: cartSchema }).parse(d))
  .handler(async ({ data }) => {
    const s = await loadSettings();
    const total = drinksTotal(data.drinks, s.drinkPrices);
    if (total <= 0) throw new Error("בחרו לפחות משקה אחד");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const token = newToken();
    const v = splitVat(total);
    const { error } = await supabaseAdmin.from("bookings").insert({
      kind: "drinks", purpose: "drinks", starts_at: now, ends_at: now, hours: 0, duration_hours: 0,
      full_name: data.fullName, phone: data.phone, email: "", attendees: 1,
      subtotal: v.subtotal, vat: v.vat, total, manage_token: token, drinks: data.drinks, drinks_total: total,
    });
    if (error) throw new Error("לא הצלחנו לשמור את ההזמנה");
    return { token, total };
  });

type BookingRow = {
  id: string; kind: string; purpose: string; full_name: string; phone: string; email: string; attendees: number;
  duration_hours: number; total: number; notes: string | null; starts_at: string; ends_at: string; drinks: unknown;
  payment_method: string; status: string;
};

async function syncPaid(b: BookingRow) {
  const { appendIncome } = await import("./sheets.server");
  let eventId: string | null = null;
  if (b.kind === "booking") {
    const { gcalCreate } = await import("./gcal.server");
    const drinks = drinksText(b.drinks as DrinkCart);
    const purposeSuffix = b.purpose && b.purpose !== "other" ? ` (${purposeLabel(b.purpose)})` : "";
    eventId = await gcalCreate({
      summary: `השכרת בקתה B - ${b.full_name}${purposeSuffix}`,
      description: `טלפון: ${b.phone}\n${b.email ? `אימייל: ${b.email}\n` : ""}משתתפים: ${b.attendees}\nמשך: ${b.duration_hours} שעות\n${drinks ? `שתייה: ${drinks}\n` : ""}סכום: ₪${b.total}\n${b.notes ? `הערות: ${b.notes}` : ""}`,
      start: b.starts_at, end: b.ends_at,
    });
  }
  await appendIncome({
    date: new Date(b.starts_at), name: b.full_name, hours: b.kind === "booking" ? Number(b.duration_hours) : "",
    drinks: drinksText(b.drinks as DrinkCart), amount: Number(b.total), method: b.payment_method,
    paid: b.status === "paid", status: b.status === "paid" ? "שולם" : "ממתין",
  });
  return eventId;
}

// TEST MODE: confirms payment without a real processor. Replace with a verified
// Takbull server callback once merchant credentials exist.
export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin.from("bookings").select("*").eq("manage_token", data.token).single();
    if (!b) throw new Error("ההזמנה לא נמצאה");
    if (b.status === "paid") return { ok: true };
    const paid = { ...b, status: "paid" } as unknown as BookingRow;
    const eventId = await syncPaid(paid);
    await supabaseAdmin.from("bookings").update({ status: "paid", paid_at: new Date().toISOString(), google_event_id: eventId }).eq("id", b.id);
    return { ok: true };
  });

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
    await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
    return { ok: true };
  });

// ---------- Admin ----------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getAdminStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (data) return { isAdmin: true };
    // Bootstrap: the very first signed-in user becomes the owner/admin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
      return { isAdmin: true };
    }
    return { isAdmin: false };
  });

export const adminList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [b, bl] = await Promise.all([
      context.supabase.from("bookings").select("id, kind, purpose, starts_at, ends_at, duration_hours, full_name, phone, email, attendees, notes, status, total, drinks, payment_method, source")
        .gte("starts_at", data.from).lt("starts_at", data.to).order("starts_at"),
      context.supabase.from("blocks").select("*").gte("starts_at", data.from).lt("starts_at", data.to).order("starts_at"),
    ]);
    return { bookings: b.data ?? [], blocks: bl.data ?? [] };
  });

export const adminAddBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startsAt: z.string(), endsAt: z.string(), reason: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("blocks").insert({ starts_at: data.startsAt, ends_at: data.endsAt, reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await context.supabase.from("blocks").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminCreateManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    fullName: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(20),
    startsAt: z.string().datetime({ offset: true }).nullable(),
    endsAt: z.string().datetime({ offset: true }).nullable(),
    purpose: z.string().max(20),
    drinks: cartSchema,
    amount: z.number().min(0).max(100000),
    method: z.enum(["מזומן", "העברה", "אחר"]),
    paid: z.boolean(),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await loadSettings();
    const isBooking = !!(data.startsAt && data.endsAt);
    const now = new Date().toISOString();
    const hours = isBooking ? (new Date(data.endsAt!).getTime() - new Date(data.startsAt!).getTime()) / 3600000 : 0;
    if (isBooking && hours <= 0) throw new Error("שעת הסיום חייבת להיות אחרי ההתחלה");
    const v = splitVat(data.amount);
    const row = {
      kind: isBooking ? "booking" : "drinks", purpose: isBooking ? data.purpose : "drinks",
      starts_at: data.startsAt ?? now, ends_at: data.endsAt ?? now, hours: Math.ceil(hours), duration_hours: hours,
      full_name: data.fullName, phone: data.phone, email: "", attendees: 1, notes: data.notes || null,
      subtotal: v.subtotal, vat: v.vat, total: data.amount, manage_token: newToken(),
      drinks: data.drinks, drinks_total: drinksTotal(data.drinks, s.drinkPrices),
      payment_method: data.method, source: "manual", status: data.paid ? "paid" : "pending",
      paid_at: data.paid ? now : null,
    };
    const { data: ins, error } = await supabaseAdmin.from("bookings").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    const eventId = await syncPaid(ins as unknown as BookingRow);
    if (eventId) await supabaseAdmin.from("bookings").update({ google_event_id: eventId }).eq("id", ins.id);
    return { ok: true };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0); from.setMonth(from.getMonth() - 5);
    const { data } = await context.supabase.from("bookings").select("starts_at, kind, total, drinks_total, status")
      .eq("status", "paid").gte("starts_at", from.toISOString());
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
