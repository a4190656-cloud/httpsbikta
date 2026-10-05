import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, FileSpreadsheet, ImageUp, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DRINKS, PURPOSES, drinksTotal, drinksText, formatILS, formatTime, hoursLabel, PAYMENT_RECORD_METHODS, PAY_METHOD_LABEL, STATUSES, STATUS_LABEL, type DrinkCart, type DrinkPrices } from "@/lib/booking-rules";
import { adminDeleteBooking, adminLedger, adminUpdateBooking, adminAddTransaction, adminAddReview, adminCreateManual, adminDeleteReview, adminListReviews, adminRevenue, adminSaveSettings, adminUpdateReview, getSettings } from "@/lib/bookings.functions";
import { supabase } from "@/integrations/supabase/client";

const METHODS = PAYMENT_RECORD_METHODS;

export function ManualBookingDialog() {
  const qc = useQueryClient();
  const create = useServerFn(adminCreateManual);
  const fetchS = useServerFn(getSettings);
  const { data: s } = useQuery({ queryKey: ["settings"], queryFn: () => fetchS() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", date: "", from: "10:00", to: "11:00", purpose: "clinic", method: "מזומן" as (typeof METHODS)[number], paid: true, receipt: false, notes: "", withTime: true });
  const [cart, setCart] = useState<DrinkCart>({});
  const [amount, setAmount] = useState<string>("");

  const hours = f.withTime && f.date ? Math.max(0, (new Date(`${f.date}T${f.to}`).getTime() - new Date(`${f.date}T${f.from}`).getTime()) / 3600000) : 0;
  const suggested = s ? Math.round((hours * s.hourlyRate + drinksTotal(cart, s.drinkPrices)) * 100) / 100 : 0;
  useEffect(() => { setAmount(String(suggested)); }, [suggested]);

  const submit = async () => {
    if (!f.name.trim()) { toast.error("נא להזין שם"); return; }
    if (f.withTime && (!f.date || hours <= 0)) { toast.error("בדקו תאריך ושעות"); return; }
    setSaving(true);
    try {
      await create({ data: {
        fullName: f.name, phone: f.phone,
        startsAt: f.withTime ? new Date(`${f.date}T${f.from}`).toISOString() : null,
        endsAt: f.withTime ? new Date(`${f.date}T${f.to}`).toISOString() : null,
        purpose: f.purpose, drinks: cart, amount: Number(amount) || 0, method: f.method, paid: f.paid, receipt: f.receipt, notes: f.notes || undefined,
      } });
      toast.success("ההזמנה נוספה ונרשמה בגיליון");
      qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["revenue"] }); qc.invalidateQueries({ queryKey: ["ledger"] });
      setOpen(false); setCart({});
    } catch (e: any) { toast.error(e?.message ?? "שמירה נכשלה"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> הוספת תור ידני / הזמנה טלפונית</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>הזמנה ידנית</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>שם</Label><Input value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>טלפון</Label><Input dir="ltr" value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.withTime} onChange={(e) => setF({ ...f, withTime: e.target.checked })} /> כולל שעות בבקתה (בטלו לרכישת שתייה בלבד)</label>
          {f.withTime && <>
            <div className="space-y-1"><Label>תאריך</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="space-y-1"><Label>מטרה</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })}>
                {PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select></div>
            <div className="space-y-1"><Label>משעה</Label><Input type="time" step={1800} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
            <div className="space-y-1"><Label>עד שעה</Label><Input type="time" step={1800} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          </>}
          <div className="sm:col-span-2">
            <Label>שתייה</Label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {DRINKS.map((d) => (
                <div key={d.id} className="space-y-1 text-center text-xs">{d.label}
                  <Input type="number" min={0} max={50} value={cart[d.id] ?? 0} onChange={(e) => setCart({ ...cart, [d.id]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1"><Label>סכום (₪)</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1"><Label>אמצעי תשלום</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as any })}>
              {METHODS.map((m) => <option key={m} value={m}>{PAY_METHOD_LABEL[m]}</option>)}
            </select></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> שולם כבר?</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.receipt} onChange={(e) => setF({ ...f, receipt: e.target.checked })} /> הופקה קבלה/חשבונית?</label>
          <div className="space-y-1 sm:col-span-2"><Label>הערות</Label><Input value={f.notes} maxLength={1000} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <Button className="mt-2 w-full" disabled={saving} onClick={submit}>{saving ? "שומר…" : "שמירה"}</Button>
      </DialogContent>
    </Dialog>
  );
}

export function RevenuePanel() {
  const rev = useServerFn(adminRevenue);
  const { data, isLoading } = useQuery({ queryKey: ["revenue"], queryFn: () => rev() });
  const months = data?.months ?? [];
  const cur = months[months.length - 1];
  const max = Math.max(1, ...months.map((m) => m.total));
  const label = (k: string) => new Date(`${k}-01T12:00`).toLocaleDateString("he-IL", { month: "short" });
  return (
    <div className="glass mt-6 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">הכנסות</h2><TransactionDialog /></div>
      {isLoading ? <p className="mt-2 text-sm text-muted-foreground">טוען…</p> : (
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="grid grid-cols-2 gap-3">
            <Stat k="החודש (מערכת)" v={formatILS(cur?.total ?? 0)} />
            <Stat k="החודש (גיליון)" v={data?.sheet ? formatILS(data.sheet.total) : "—"} icon />
            <Stat k="הזמנות ששולמו" v={String(cur?.bookings ?? 0)} />
            <Stat k="מכירות שתייה" v={formatILS(cur?.drinks ?? 0)} />
          </div>
          <div className="flex h-40 items-end gap-3">
            {months.map((m, i) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${formatILS(m.total)} · שתייה ${formatILS(m.drinks)}`}>
                <div className="relative flex w-full flex-1 items-end">
                  <motion.div className="w-full rounded-t-md bg-primary" initial={{ height: 0 }} animate={{ height: `${(m.total / max) * 100}%` }} transition={{ delay: i * 0.06 }}>
                    <div className="w-full rounded-t-md bg-accent" style={{ height: m.total ? `${(m.drinks / m.total) * 100}%` : 0 }} />
                  </motion.div>
                </div>
                <span className="text-[11px] text-muted-foreground">{label(m.month)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full bg-primary" /> סה״כ · <span className="inline-block h-2 w-2 rounded-full bg-accent" /> שתייה</p>
    </div>
  );
}

function TransactionDialog() {
  const qc = useQueryClient();
  const add = useServerFn(adminAddTransaction);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const empty = { type: "income" as "income" | "expense", date: today, description: "", amount: "", method: "מזומן", notes: "" };
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [f, setF] = useState(empty);
  const submit = async () => {
    if (!f.description.trim()) { toast.error("נא להזין תיאור"); return; }
    if (!(Number(f.amount) > 0)) { toast.error("נא להזין סכום"); return; }
    setSaving(true);
    try {
      await add({ data: { type: f.type, date: f.date, description: f.description, amount: Number(f.amount), method: f.method, notes: f.notes || undefined } });
      toast.success(f.type === "expense" ? "ההוצאה נרשמה בגיליון" : "ההכנסה נרשמה בגיליון");
      qc.invalidateQueries({ queryKey: ["revenue"] }); setOpen(false); setF(empty);
    } catch (e: any) { toast.error(e?.message ?? "שמירה נכשלה"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> תנועה ידנית</Button></DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader><DialogTitle>הוספת הכנסה / הוצאה</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          {(["income", "expense"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setF({ ...f, type: t })}
              className={`rounded-full py-2 text-sm font-medium transition ${f.type === t ? (t === "income" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground") : "text-muted-foreground"}`}>
              {t === "income" ? "הכנסה" : "הוצאה"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>תיאור</Label><Input value={f.description} maxLength={120} placeholder={f.type === "expense" ? "למשל: ניקיון, קניית שתייה" : "למשל: שם לקוח"} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1"><Label>תאריך</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="space-y-1"><Label>סכום (₪)</Label><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1"><Label>אמצעי תשלום</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {[...PAYMENT_RECORD_METHODS, "אחר"].map((m) => <option key={m} value={m}>{PAY_METHOD_LABEL[m] ?? m}</option>)}
            </select></div>
          <div className="space-y-1"><Label>הערה</Label><Input value={f.notes} maxLength={200} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">התנועה תירשם בגיליון בלשונית של חודש התאריך{f.type === "expense" ? ", כסכום שלילי" : ""}.</p>
        <Button className="w-full" disabled={saving} onClick={submit}>{saving ? "שומר…" : "שמירה בגיליון"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ k, v, icon }: { k: string; v: string; icon?: boolean }) {
  return <div className="rounded-xl bg-card p-3"><div className="flex items-center gap-1 text-xs text-muted-foreground">{icon && <FileSpreadsheet className="h-3 w-3" />}{k}</div><div className="mt-1 font-display text-xl font-bold text-primary">{v}</div></div>;
}

export function SettingsPanel() {
  const qc = useQueryClient();
  const fetchS = useServerFn(getSettings);
  const save = useServerFn(adminSaveSettings);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => fetchS() });
  const [rate, setRate] = useState(""); const [prices, setPrices] = useState<DrinkPrices | null>(null);
  useEffect(() => { if (data) { setRate(String(data.hourlyRate)); setPrices(data.drinkPrices); } }, [data]);
  if (!prices) return null;
  return (
    <div className="glass mt-8 rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Settings2 className="h-4 w-4" /> הגדרות מחירים</h2>
      <p className="text-xs text-muted-foreground">המחירים כוללים מע״מ. לחסימת מועדים השתמשו ב"חסימה מהירה" למעלה.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-5">
        <div className="space-y-1"><Label>מחיר לשעה</Label><Input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        {DRINKS.map((d) => (
          <div key={d.id} className="space-y-1"><Label>{d.label}</Label>
            <Input type="number" min={0} value={prices[d.id]} onChange={(e) => setPrices({ ...prices, [d.id]: Number(e.target.value) || 0 })} /></div>
        ))}
      </div>
      <Button className="mt-4" onClick={async () => {
        try { await save({ data: { hourlyRate: Number(rate) || 0, drinkPrices: prices } }); toast.success("ההגדרות נשמרו"); qc.invalidateQueries({ queryKey: ["settings"] }); }
        catch (e: any) { toast.error(e?.message ?? "שמירה נכשלה"); }
      }}>שמירת הגדרות</Button>
    </div>
  );
}

export function ReviewsAdminPanel() {
  const qc = useQueryClient();
  const list = useServerFn(adminListReviews);
  const add = useServerFn(adminAddReview);
  const update = useServerFn(adminUpdateReview);
  const remove = useServerFn(adminDeleteReview);
  const { data, isLoading } = useQuery({ queryKey: ["admin-reviews"], queryFn: () => list() });
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
      qc.invalidateQueries({ queryKey: ["public-reviews"] }),
    ]);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("אפשר להעלות קובץ תמונה בלבד"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("התמונה גדולה מדי — עד 8MB"); return; }
    setUploading(true);
    try {
      const fileBase64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = () => rej(new Error("קריאת הקובץ נכשלה"));
        r.readAsDataURL(file);
      });
      await add({ data: { fileBase64, contentType: file.type, title: title.trim() || undefined } });
      setTitle("");
      toast.success("צילום התגובה נוסף לאתר");
      await refresh();
    } catch (error: any) { toast.error(error?.message ?? "העלאת התמונה נכשלה"); }
    finally { setUploading(false); }
  };

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex items-center gap-2"><ImageUp className="h-5 w-5 text-accent" /><h2 className="font-semibold">תגובות של לקוחות</h2></div>
      <p className="mt-1 text-xs text-muted-foreground">העלו צילומי מסך של תגובות. רק תמונות שמסומנות כגלויות יופיעו בעמוד הראשי.</p>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1"><Label>כותרת קצרה (לא חובה)</Label><Input value={title} maxLength={120} placeholder="למשל: סדנה באווירה נהדרת" onChange={(e) => setTitle(e.target.value)} /></div>
        <Button asChild disabled={uploading}>
          <label className="cursor-pointer"><ImageUp className="h-4 w-4" />{uploading ? "מעלה…" : "העלאת צילום תגובה"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => { void upload(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
        </Button>
      </div>
      {isLoading ? <p className="mt-4 text-sm text-muted-foreground">טוען תגובות…</p> : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.reviews ?? []).map((review) => (
            <div key={review.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={review.imageUrl} alt={review.title || "צילום תגובת לקוח"} className="h-48 w-full object-contain" />
              <div className="border-t border-border p-3">
                <div className="truncate text-sm font-medium">{review.title || "ללא כותרת"}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant={review.isVisible ? "secondary" : "outline"} onClick={async () => { await update({ data: { id: review.id, isVisible: !review.isVisible, sortOrder: review.sortOrder } }); await refresh(); }}>
                    {review.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{review.isVisible ? "גלוי" : "מוסתר"}
                  </Button>
                  <div className="ms-auto flex items-center gap-1"><Label className="text-xs">סדר</Label><Input type="number" min={0} max={999} defaultValue={review.sortOrder} className="h-8 w-16" onBlur={async (e) => { await update({ data: { id: review.id, isVisible: review.isVisible, sortOrder: Number(e.target.value) || 0 } }); await refresh(); }} /></div>
                  <Button size="icon" variant="ghost" aria-label="מחיקת תגובה" onClick={async () => { if (!confirm("למחוק את צילום התגובה?")) return; await remove({ data: { id: review.id } }); toast.success("התגובה נמחקה"); await refresh(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
          {!data?.reviews.length && <p className="text-sm text-muted-foreground">עדיין לא הועלו צילומי תגובות.</p>}
        </div>
      )}
    </section>
  );
}

// ---------- "יומן בקתה" ledger ----------
const BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200",
  paid: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200",
  invoiced: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200",
  cancelled: "bg-muted text-muted-foreground border-border",
  no_show: "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200",
  credit: "bg-muted text-muted-foreground border-border",
};
const jlm = (iso: string) => new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric" });
const ymd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));

export function LedgerPanel() {
  const qc = useQueryClient();
  const ledger = useServerFn(adminLedger);
  const update = useServerFn(adminUpdateBooking);
  const del = useServerFn(adminDeleteBooking);
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).format(new Date()));
  const [edit, setEdit] = useState<any | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["ledger", month], queryFn: () => ledger({ data: { month } }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ledger"] }); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["revenue"] }); };
  const patch = async (id: string, p: Record<string, unknown>) => {
    try { await update({ data: { id, ...p } as any }); refresh(); } catch (e: any) { toast.error(e?.message ?? "עדכון נכשל"); }
  };
  const monthLabel = new Date(`${month}-01T12:00`).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const rows = data?.rows ?? [];

  return (
    <section className="glass mt-6 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4 text-accent" /> יומן בקתה</h2>
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" aria-label="בחירת חודש" />
      </div>
      <div className="mt-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
        <span className="text-sm opacity-90">סך הכנסות לחודש זה ({monthLabel}): </span>
        <span className="font-display text-2xl font-bold">{formatILS(data?.total ?? 0)}</span>
      </div>
      {isLoading ? <p className="mt-4 text-sm text-muted-foreground">טוען…</p> : (
        <div className="mt-4 space-y-3 md:hidden">
          {rows.map((r: any, i: number) => {
            const paid = r.status === "paid" || r.status === "invoiced";
            return (
              <article key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-xs text-muted-foreground">#{i + 1}</span><h3 className="truncate font-semibold">{r.full_name}</h3></div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{jlm(r.starts_at)}</span>
                      <span>{r.kind === "booking" ? `${formatTime(r.starts_at)}–${formatTime(r.ends_at)}` : "שתייה בלבד"}</span>
                      <span dir="ltr">{r.phone}</span>
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-lg font-bold text-primary">{formatILS(Number(r.total))}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/60 p-2"><span className="text-muted-foreground">תשלום</span><div className="mt-0.5 font-medium">{PAY_METHOD_LABEL[r.payment_method] ?? r.payment_method}</div></div>
                  <div className="rounded-lg bg-muted/60 p-2"><span className="text-muted-foreground">שתייה</span><div className="mt-0.5 truncate font-medium">{drinksText(r.drinks) || "—"}</div></div>
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2"><Label className="text-xs">תאריך תשלום</Label><Input type="date" className="h-9 min-w-0 text-xs" value={r.paid_at ? ymd(r.paid_at) : ""} onChange={(e) => patch(r.id, { paidAt: e.target.value || null })} /></div>
                  <select aria-label="סטטוס" value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })} className={`h-9 w-full rounded-full border px-3 text-xs font-medium ${BADGE[r.status] ?? BADGE["cancelled"]}`}>
                    {STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
                  </select>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 border-t border-border pt-3">
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" aria-label="שולם" className="h-4 w-4 accent-primary" checked={paid} onChange={(e) => patch(r.id, { paid: e.target.checked })} /> שולם</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" aria-label="קבלה" className="h-4 w-4 accent-primary" checked={!!r.receipt_issued} onChange={(e) => patch(r.id, { receipt: e.target.checked })} /> קבלה</label>
                  <Button size="icon" variant="ghost" aria-label="עריכה" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="מחיקה" onClick={async () => {
                    if (!confirm("האם למחוק הזמנה זו?")) return;
                    try { await del({ data: { id: r.id } }); toast.success("ההזמנה נמחקה והמועד שוחרר"); refresh(); } catch (e: any) { toast.error(e?.message ?? "מחיקה נכשלה"); }
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </article>
            );
          })}
          {!rows.length && <p className="rounded-xl border border-border bg-card px-3 py-6 text-center text-muted-foreground">אין רשומות בחודש זה.</p>}
        </div>
      )}
      {!isLoading && (
        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>{["#", "תאריך", "שם ומשפחה", "שעות", "שתייה", "אמצעי תשלום", "תאריך תשלום", "סכום", "שולם", "קבלה", "סטטוס", "פעולות"].map((h) => <th key={h} className="px-2 py-2 text-right font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r: any, i: number) => {
                const paid = r.status === "paid" || r.status === "invoiced";
                return (
                  <tr key={r.id} className="border-t border-border align-middle">
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{jlm(r.starts_at)}</td>
                    <td className="px-2 py-2"><div className="font-medium">{r.full_name}</div><div dir="ltr" className="text-right text-xs text-muted-foreground">{r.phone}</div></td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs">{r.kind === "booking" ? <>{formatTime(r.starts_at)}–{formatTime(r.ends_at)}<div className="text-muted-foreground">{hoursLabel(Number(r.duration_hours))}</div></> : "שתייה בלבד"}</td>
                    <td className="px-2 py-2 text-xs">{drinksText(r.drinks) || "—"}</td>
                    <td className="px-2 py-2"><span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">{PAY_METHOD_LABEL[r.payment_method] ?? r.payment_method}</span></td>
                    <td className="px-2 py-2"><Input type="date" className="h-8 w-[130px] text-xs" value={r.paid_at ? ymd(r.paid_at) : ""} onChange={(e) => patch(r.id, { paidAt: e.target.value || null })} /></td>
                    <td className="px-2 py-2 font-semibold whitespace-nowrap">{formatILS(Number(r.total))}</td>
                    <td className="px-2 py-2 text-center"><input type="checkbox" aria-label="שולם" className="h-4 w-4 accent-primary" checked={paid} onChange={(e) => patch(r.id, { paid: e.target.checked })} /></td>
                    <td className="px-2 py-2 text-center"><input type="checkbox" aria-label="קבלה" className="h-4 w-4 accent-primary" checked={!!r.receipt_issued} onChange={(e) => patch(r.id, { receipt: e.target.checked })} /></td>
                    <td className="px-2 py-2">
                      <select aria-label="סטטוס" value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}
                        className={`h-8 rounded-full border px-2 text-xs font-medium ${BADGE[r.status] ?? BADGE["cancelled"]}`}>
                        {STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <Button size="icon" variant="ghost" aria-label="עריכה" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="מחיקה" onClick={async () => {
                        if (!confirm("האם למחוק הזמנה זו?")) return;
                        try { await del({ data: { id: r.id } }); toast.success("ההזמנה נמחקה והמועד שוחרר"); refresh(); } catch (e: any) { toast.error(e?.message ?? "מחיקה נכשלה"); }
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">אין רשומות בחודש זה.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">כל שינוי נשמר מיד ומתעדכן ברקע גם בגיליון.</p>
      {edit && <EditBookingDialog row={edit} onClose={() => setEdit(null)} onSave={async (p) => { await patch(edit.id, p); setEdit(null); }} />}
    </section>
  );
}

function EditBookingDialog({ row, onClose, onSave }: { row: any; onClose: () => void; onSave: (p: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ fullName: row.full_name, phone: row.phone, total: String(row.total), method: row.payment_method, notes: row.notes ?? "" });
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader><DialogTitle>עריכת רשומה</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>שם</Label><Input value={f.fullName} maxLength={100} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
          <div className="space-y-1"><Label>טלפון</Label><Input dir="ltr" value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>סכום (₪)</Label><Input type="number" min={0} value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></div>
          <div className="space-y-1"><Label>אמצעי תשלום</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {[...PAYMENT_RECORD_METHODS, "אחר"].map((m) => <option key={m} value={m}>{PAY_METHOD_LABEL[m] ?? m}</option>)}
            </select></div>
          <div className="space-y-1 sm:col-span-2"><Label>הערות</Label><Input value={f.notes} maxLength={1000} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <Button className="w-full" disabled={saving || !f.fullName.trim()} onClick={async () => {
          setSaving(true);
          try { await onSave({ fullName: f.fullName, phone: f.phone, total: Number(f.total) || 0, method: f.method, notes: f.notes }); toast.success("נשמר"); }
          finally { setSaving(false); }
        }}>{saving ? "שומר…" : "שמירה"}</Button>
      </DialogContent>
    </Dialog>
  );
}
