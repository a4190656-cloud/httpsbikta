import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canCancel, priceFor, purposeLabel, PURPOSES } from "./booking-rules";

type Busy = { start: string; end: string };

async function busyBetween(timeMin: string, timeMax: string): Promise<Busy[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { gcalBusy } = await import("./gcal.server");
  const [bk, bl, g] = await Promise.all([
    supabaseAdmin.from("bookings").select("starts_at, ends_at, status, created_at")
      .lt("starts_at", timeMax).gt("ends_at", timeMin).neq("status", "cancelled"),
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

const bookingInput = z.object({
  purpose: z.enum(PURPOSES.map((p) => p.id) as [string, ...string[]]),
  startsAt: z.string().datetime({ offset: true }),
  hours: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6), z.literal(12)]),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^0(5\d|[2-4]|[89]|7\d)-?\d{7}$/),
  email: z.string().trim().email().max(255),
  attendees: z.number().int().min(1).max(40),
  notes: z.string().trim().max(1000).optional(),
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => bookingInput.parse(d))
  .handler(async ({ data }) => {
    const start = new Date(data.startsAt);
    if (start.getTime() < Date.now() - 5 * 60 * 1000) throw new Error("המועד שנבחר כבר עבר");
    const end = new Date(start.getTime() + data.hours * 3600_000).toISOString();
    const busy = await busyBetween(start.toISOString(), end);
    if (overlaps(busy, start.toISOString(), end)) throw new Error("המועד נתפס זה עתה, אנא בחרו שעה אחרת");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const p = priceFor(data.hours);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: row, error } = await supabaseAdmin.from("bookings").insert({
      purpose: data.purpose, starts_at: start.toISOString(), ends_at: end, hours: data.hours,
      full_name: data.fullName, phone: data.phone, email: data.email, attendees: data.attendees,
      notes: data.notes || null, subtotal: p.subtotal, vat: p.vat, total: p.total, manage_token: token,
    }).select("id").single();
    if (error) throw new Error("לא הצלחנו לשמור את ההזמנה");
    return { id: row.id, token };
  });

// TEST MODE: confirms payment without a real processor. Replace with a verified
// Takbull server callback once merchant credentials exist.
export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { gcalCreate } = await import("./gcal.server");
    const { data: b } = await supabaseAdmin.from("bookings").select("*").eq("manage_token", data.token).single();
    if (!b) throw new Error("ההזמנה לא נמצאה");
    if (b.status === "paid") return { accessCode: b.access_code };
    const accessCode = String(Math.floor(100000 + Math.random() * 900000));
    const eventId = await gcalCreate({
      summary: `השכרת בקתה B - ${b.full_name} (${purposeLabel(b.purpose)})`,
      description: `טלפון: ${b.phone}\nאימייל: ${b.email}\nמשתתפים: ${b.attendees}\nמשך: ${b.hours} שעות\nסכום: ₪${b.total}\n${b.notes ? `הערות: ${b.notes}` : ""}`,
      start: b.starts_at, end: b.ends_at,
    });
    await supabaseAdmin.from("bookings").update({ status: "paid", access_code: accessCode, google_event_id: eventId }).eq("id", b.id);
    return { accessCode };
  });

export const getBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(32).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin.from("bookings")
      .select("id, purpose, starts_at, ends_at, hours, full_name, attendees, status, total, access_code")
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
    if (!canCancel(new Date(b.starts_at))) throw new Error("מועד הביטול חלף");
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
      context.supabase.from("bookings").select("id, purpose, starts_at, ends_at, hours, full_name, phone, email, attendees, notes, status, total")
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
