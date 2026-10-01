import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, LogOut, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatILS, formatTime, purposeLabel } from "@/lib/booking-rules";
import { adminAddBlock, adminList, adminRemoveBlock, getAdminStatus } from "@/lib/bookings.functions";
import { ManualBookingDialog, RevenuePanel, ReviewsAdminPanel, SettingsPanel } from "@/components/AdminPanels";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "לוח ניהול — בקתה B" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const STATUS = { paid: "שולם", cancelled: "בוטל", pending: "ממתין" } as const;
const STATUS_CLS: Record<string, string> = { paid: "bg-primary text-primary-foreground", cancelled: "bg-muted text-muted-foreground line-through", pending: "bg-accent/15 text-accent" };

function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; }

function Admin() {
  const qc = useQueryClient();
  const status = useServerFn(getAdminStatus);
  const list = useServerFn(adminList);
  const addBlock = useServerFn(adminAddBlock);
  const removeBlock = useServerFn(adminRemoveBlock);
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [filter, setFilter] = useState<string[]>(["paid", "pending"]);
  const [blk, setBlk] = useState({ date: "", from: "09:00", to: "17:00", reason: "שימוש בעלים" });

  const range = useMemo(() => {
    const s = view === "week" ? startOfWeek(anchor) : (() => { const x = new Date(anchor); x.setHours(0, 0, 0, 0); return x; })();
    const e = new Date(s); e.setDate(e.getDate() + (view === "week" ? 7 : 1));
    return { s, e };
  }, [anchor, view]);

  const admin = useQuery({ queryKey: ["isAdmin"], queryFn: () => status() });
  const q = useQuery({
    queryKey: ["admin", range.s.toISOString(), view],
    enabled: !!admin.data?.isAdmin,
    queryFn: () => list({ data: { from: range.s.toISOString(), to: range.e.toISOString() } }),
  });

  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => { const d = new Date(range.s); d.setDate(d.getDate() + i); return d; });
  const sameDay = (iso: string, d: Date) => new Date(iso).toDateString() === d.toDateString();
  const shift = (n: number) => { const d = new Date(anchor); d.setDate(d.getDate() + n * (view === "week" ? 7 : 1)); setAnchor(d); };

  if (admin.data && !admin.data.isAdmin) return <Wrap><p className="text-muted-foreground">אין לחשבון זה הרשאות ניהול.</p></Wrap>;

  const bookings = (q.data?.bookings ?? []).filter((b: any) => filter.includes(b.status));

  return (
    <Wrap>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-primary">לוח ניהול</h1>
        <div className="flex gap-2"><ManualBookingDialog />
        <Button variant="ghost" onClick={() => supabase.auth.signOut().then(() => location.assign("/"))}><LogOut className="h-4 w-4" /> יציאה</Button></div>
      </div>
      <RevenuePanel />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-muted p-1">
          {(["day", "week"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 text-sm ${view === v ? "bg-card shadow-sm" : ""}`}>{v === "day" ? "יום" : "שבוע"}</button>)}
        </div>
        <Button size="icon" variant="outline" onClick={() => shift(-1)}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>היום</Button>
        <Button size="icon" variant="outline" onClick={() => shift(1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground">{range.s.toLocaleDateString("he-IL")} – {new Date(range.e.getTime() - 1).toLocaleDateString("he-IL")}</span>
        <div className="ms-auto flex gap-1">
          {Object.entries(STATUS).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(filter.includes(k) ? filter.filter((x) => x !== k) : [...filter, k])}
              className={`rounded-full border px-3 py-1 text-xs ${filter.includes(k) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className={`mt-6 grid gap-3 ${view === "week" ? "md:grid-cols-7" : ""}`}>
        {days.map((d) => (
          <div key={d.toISOString()} className="glass min-h-40 rounded-2xl p-3">
            <div className="mb-2 text-sm font-semibold">{d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" })}</div>
            <div className="space-y-2">
              {(q.data?.blocks ?? []).filter((b: any) => sameDay(b.starts_at, d)).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg bg-foreground/80 p-2 text-xs text-background">
                  <span><Lock className="inline h-3 w-3" /> {formatTime(b.starts_at)}–{formatTime(b.ends_at)} · {b.reason}</span>
                  <button aria-label="הסרת חסימה" onClick={async () => { await removeBlock({ data: { id: b.id } }); qc.invalidateQueries({ queryKey: ["admin"] }); }}><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
              {bookings.filter((b: any) => sameDay(b.starts_at, d)).map((b: any) => (
                <div key={b.id} className={`rounded-lg p-2 text-xs ${STATUS_CLS[b.status]}`} title={`${b.phone} · ${b.email}${b.notes ? " · " + b.notes : ""}`}>
                  <div className="font-semibold">{formatTime(b.starts_at)}–{formatTime(b.ends_at)}</div>
                  <div>{b.full_name} · {purposeLabel(b.purpose)}</div>
                  <div className="opacity-80">{b.attendees} משתתפים · {formatILS(Number(b.total))} · {STATUS[b.status as keyof typeof STATUS]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="glass mt-8 rounded-2xl p-5">
        <h2 className="font-semibold">חסימה מהירה</h2>
        <p className="text-xs text-muted-foreground">לתחזוקה, אירוע פרטי או שימוש בעלים — המועד ייחסם להזמנות.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <Input type="date" value={blk.date} onChange={(e) => setBlk({ ...blk, date: e.target.value })} />
          <Input type="time" value={blk.from} onChange={(e) => setBlk({ ...blk, from: e.target.value })} />
          <Input type="time" value={blk.to} onChange={(e) => setBlk({ ...blk, to: e.target.value })} />
          <Input value={blk.reason} maxLength={100} onChange={(e) => setBlk({ ...blk, reason: e.target.value })} />
          <Button onClick={async () => {
            if (!blk.date) { toast.error("בחרו תאריך"); return; }
            const s = new Date(`${blk.date}T${blk.from}`); const e = new Date(`${blk.date}T${blk.to}`);
            if (e <= s) { toast.error("שעת הסיום חייבת להיות אחרי ההתחלה"); return; }
            await addBlock({ data: { startsAt: s.toISOString(), endsAt: e.toISOString(), reason: blk.reason } });
            toast.success("המועד נחסם"); qc.invalidateQueries({ queryKey: ["admin"] });
          }}><Lock className="h-4 w-4" /> חסימה</Button>
        </div>
      </div>
      <ReviewsAdminPanel />
      <SettingsPanel />
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background bg-hero"><SiteHeader /><main className="mx-auto max-w-6xl px-5 py-10">{children}</main></div>;
}
