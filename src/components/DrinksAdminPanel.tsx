import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Loader2, Minus, Plus } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DEFAULT_SETTINGS, DRINKS, FREE_STATUSES, INCOME_STATUSES, PAY_METHOD_LABEL, drinksTotal, formatILS, type DrinkCart } from "@/lib/booking-rules";
import { adminCreateManual, adminUpdateBooking, getSettings } from "@/lib/bookings.functions";
import { drinkAmount } from "@/lib/drinks-ledger";

type DrinksRow = { id: string; kind: string; full_name: string; phone: string; total: number | string; drinks_total: number | string; status: string; notes?: string | null };

export function DrinksLedgerActions({ row }: { row: DrinksRow }) {
  const qc = useQueryClient();
  const update = useServerFn(adminUpdateBooking);
  const [saving, setSaving] = useState(false);
  if (FREE_STATUSES.includes(row.status) || drinkAmount(row) <= 0) return null;
  if (INCOME_STATUSES.includes(row.status)) return row.notes?.includes("הותאם מול הקופה") ? <span className="text-xs text-primary">הותאם מול הקופה</span> : null;
  async function reconcile() {
    if (row.kind !== "drinks" && !confirm("השתייה כלולה בהזמנת בקתה. סימון זה יסמן את כל ההזמנה כשולמה, כולל שעות הבקתה. להמשיך?")) return;
    setSaving(true);
    try {
      await update({ data: { id: row.id, paid: true, method: "מזומן", notes: [row.notes, "שולם במזומן / הותאם מול הקופה"].filter(Boolean).join("\n").slice(0, 1000) } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["ledger"] }), qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["revenue"] })]);
      toast.success("שולם במזומן והותאם מול הקופה");
    } catch (e) { toast.error(e instanceof Error ? e.message : "עדכון התשלום נכשל"); }
    finally { setSaving(false); }
  }
  const digits = row.phone.replace(/\D/g, "");
  const phone = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  const message = `היי ${row.full_name}, ראינו שדיווחת על לקיחת שתייה בסך ${formatILS(drinkAmount(row))}, נשמח להסדרת התשלום. תודה, בקתה B`;
  return <div className="mt-2 flex flex-wrap items-center gap-1">
    <Button size="icon" variant="outline" disabled={saving} onClick={reconcile} aria-label="שולם במזומן / הותאם" title="שולם במזומן / הותאם מול הקופה"><Banknote className="h-4 w-4" /></Button>
    {/^972\d{8,9}$/.test(phone) && <Button asChild size="icon" variant="outline"><a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`תזכורת חוב בוואטסאפ ל${row.full_name}`} title="תזכורת חוב בוואטסאפ"><WhatsAppIcon className="h-4 w-4" /></a></Button>}
  </div>;
}

export function TillNoteDialog({ onSaved }: { onSaved: () => Promise<void> }) {
  const create = useServerFn(adminCreateManual), fetchSettings = useServerFn(getSettings);
  const { data: settings = DEFAULT_SETTINGS } = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings() });
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false);
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [amount, setAmount] = useState("");
  const [cart, setCart] = useState<DrinkCart>({});
  const [paid, setPaid] = useState(true), [method, setMethod] = useState<"מזומן" | "ביט" | "העברה">("מזומן");
  const [date, setDate] = useState("");
  useEffect(() => { setAmount(String(drinksTotal(cart, settings.drinkPrices))); }, [cart, settings]);
  useEffect(() => { if (open) { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); setDate(local.toISOString().slice(0, 16)); } }, [open]);
  async function save() {
    if (!name.trim() || !date || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !DRINKS.some((d) => (cart[d.id] ?? 0) > 0)) { toast.error("מלאו שם, תאריך, פריטים וסכום תקין"); return; }
    setSaving(true);
    try { await create({ data: { fullName: name, phone, startsAt: null, endsAt: null, occurredAt: new Date(date).toISOString(), purpose: "drinks", drinks: cart, amount: Number(amount), method, paid, notes: paid && method === "מזומן" ? "פתק ידני — שולם במזומן / הותאם מול הקופה" : "פתק ידני מהקופה" } }); toast.success("הפתק נשמר"); await onSaved(); setOpen(false); setName(""); setPhone(""); setCart({}); }
    catch (e) { toast.error(e instanceof Error ? e.message : "שמירת הפתק נכשלה"); } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus />הזנת פתק מקופה</Button></DialogTrigger><DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>הזנת פתק מקופה ידנית</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="till-name">שם לקוח / מזהה</Label><Input id="till-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></div><div><Label htmlFor="till-phone">טלפון (לתזכורת חוב)</Label><Input id="till-phone" dir="ltr" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="till-date">תאריך ושעה</Label><Input id="till-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="grid grid-cols-2 gap-3 sm:col-span-2">{DRINKS.map((d) => <div key={d.id} className="rounded-lg border border-border p-3 text-center"><p className="text-sm font-semibold">{d.label} · {formatILS(settings.drinkPrices[d.id])}</p><div className="mt-2 flex items-center justify-center gap-3"><Button size="icon" variant="outline" disabled={!(cart[d.id] ?? 0)} aria-label={`הפחת ${d.label} בפתק`} onClick={() => setCart({ ...cart, [d.id]: Math.max(0, (cart[d.id] ?? 0) - 1) })}><Minus /></Button><span className="w-6 tabular-nums">{cart[d.id] ?? 0}</span><Button size="icon" variant="secondary" disabled={(cart[d.id] ?? 0) >= 50} aria-label={`הוסף ${d.label} בפתק`} onClick={() => setCart({ ...cart, [d.id]: (cart[d.id] ?? 0) + 1 })}><Plus /></Button></div></div>)}</div><div><Label htmlFor="till-amount">סכום (₪)</Label><Input id="till-amount" type="number" min="0.01" max={100000} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div><div><Label htmlFor="till-method">אמצעי תשלום</Label><select id="till-method" value={method} onChange={(e) => { const v = e.target.value; if (v === "מזומן" || v === "ביט" || v === "העברה") setMethod(v); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{["מזומן", "ביט", "העברה"].map((m) => <option key={m} value={m}>{PAY_METHOD_LABEL[m]}</option>)}</select></div><div className="grid grid-cols-2 gap-2 sm:col-span-2" role="group" aria-label="מצב תשלום הפתק"><Button variant={paid ? "default" : "outline"} onClick={() => setPaid(true)}>שולם</Button><Button variant={!paid ? "default" : "outline"} onClick={() => setPaid(false)}>ממתין / חייב</Button></div></div><Button disabled={saving} onClick={save}>{saving && <Loader2 className="animate-spin" />}שמירת פתק</Button></DialogContent></Dialog>;
}