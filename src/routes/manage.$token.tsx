import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { hoursUntil, canCancel, formatDateTime, formatILS, hebrewDate, purposeLabel } from "@/lib/booking-rules";
import { cancelBooking, getBookingByToken } from "@/lib/bookings.functions";

export const Route = createFileRoute("/manage/$token")({
  head: () => ({ meta: [{ title: "ניהול הזמנה — בקתה B" }, { name: "robots", content: "noindex" }] }),
  component: Manage,
});

const STATUS: Record<string, string> = { paid: "שולם", cancelled: "בוטל", pending: "ממתין" };

function Manage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getBookingByToken);
  const cancel = useServerFn(cancelBooking);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["manage", token], queryFn: () => get({ data: { token } }) });
  const b = data?.booking;

  return (
    <div className="min-h-screen bg-background bg-hero">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-5 py-12">
        <h1 className="font-display text-3xl font-bold text-primary">ניהול ההזמנה</h1>
        {isLoading ? <Loader2 className="mt-8 h-6 w-6 animate-spin" /> : !b ? (
          <p className="mt-6 text-muted-foreground">ההזמנה לא נמצאה. <Link to="/" className="text-accent">חזרה לדף הבית</Link></p>
        ) : (
          <div className="glass mt-6 rounded-3xl p-6">
            <dl className="space-y-2 text-sm">
              {[["שם", b.full_name], ["מועד", formatDateTime(b.starts_at)], ["תאריך עברי", hebrewDate(b.starts_at)], ["משך", `${b.duration_hours} שעות`], ["מטרה", purposeLabel(b.purpose)], ["סכום", formatILS(Number(b.total))], ["סטטוס", STATUS[b.status] ?? b.status]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {b.status !== "cancelled" && (
              canCancel(new Date(b.starts_at)) ? (
                <div className="mt-6">
                  <p className="mb-3 text-xs text-muted-foreground">נותרו כ-{hoursUntil(new Date(b.starts_at))} שעות — אפשר לבטל עד 48 שעות מראש.</p>
                  <Button variant="destructive" className="w-full" disabled={busy} onClick={async () => {
                    if (!confirm("לבטל את ההזמנה?")) return;
                    setBusy(true);
                    try { await cancel({ data: { token } }); toast.success("ההזמנה בוטלה. ההחזר יטופל בהקדם."); qc.invalidateQueries({ queryKey: ["manage", token] }); }
                    catch (e: any) { toast.error(e?.message ?? "הביטול נכשל"); } finally { setBusy(false); }
                  }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}ביטול ההזמנה</Button>
                </div>
              ) : (
                <div className="mt-6">
                  <Button disabled className="w-full" variant="secondary">ביטול ההזמנה</Button>
                  <p className="mt-3 flex gap-2 text-sm text-accent"><AlertTriangle className="h-4 w-4 shrink-0" />מועד הביטול חלף (פחות מ-48 שעות). ההזמנה תחויב בתשלום מלא.</p>
                </div>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
