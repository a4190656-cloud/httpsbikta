import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, FileSpreadsheet, ImageUp, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DRINKS, PURPOSES, drinksTotal, formatILS, type DrinkCart, type DrinkPrices } from "@/lib/booking-rules";
import { adminAddReview, adminCreateManual, adminDeleteReview, adminListReviews, adminRevenue, adminSaveSettings, adminUpdateReview, getSettings } from "@/lib/bookings.functions";
import { supabase } from "@/integrations/supabase/client";

const METHODS = ["מזומן", "העברה", "אחר"] as const;

export function ManualBookingDialog() {
  const qc = useQueryClient();
  const create = useServerFn(adminCreateManual);
  const fetchS = useServerFn(getSettings);
  const { data: s } = useQuery({ queryKey: ["settings"], queryFn: () => fetchS() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", date: "", from: "10:00", to: "11:00", purpose: "clinic", method: "מזומן" as (typeof METHODS)[number], paid: true, notes: "", withTime: true });
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
        purpose: f.purpose, drinks: cart, amount: Number(amount) || 0, method: f.method, paid: f.paid, notes: f.notes || undefined,
      } });
      toast.success("ההזמנה נוספה ונרשמה בגיליון");
      qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["revenue"] });
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
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> שולם</label>
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
      <h2 className="font-semibold">הכנסות</h2>
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
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from("customer-reviews").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      try {
        await add({ data: { storagePath: path, title: title.trim() || undefined } });
      } catch (error) {
        await supabase.storage.from("customer-reviews").remove([path]);
        throw error;
      }
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
