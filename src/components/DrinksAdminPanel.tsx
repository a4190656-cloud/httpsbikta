import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Check, CupSoda, Loader2, MessageCircle, Minus, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DEFAULT_SETTINGS, DRINKS, FREE_STATUSES, INCOME_STATUSES, PAY_METHOD_LABEL, drinksText, drinksTotal, formatDateTime, formatILS, type DrinkCart } from "@/lib/booking-rules";
import { adminCreateManual, adminLedger, adminUpdateBooking, getSettings } from "@/lib/bookings.functions";
import { drinkAmount, drinksLedgerTotals } from "@/lib/drinks-ledger";

const monthNow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).format(new Date());

export function DrinksAdminPanel() {
  const qc = useQueryClient();
  const ledger = useServerFn(adminLedger), update = useServerFn(adminUpdateBooking);
  const [month, setMonth] = useState(monthNow);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["ledger", month], queryFn: () => ledger({ data: { month } }), refetchInterval: 30_000 });
  const rows = query.data?.rows ?? [];
  const totals = drinksLedgerTotals(rows);
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["ledger"] }), qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["revenue"] })]); };
  const drinks = rows.filter((r) => !FREE_STATUSES.includes(r.status) && drinkAmount(r) > 0);
  const filtered = drinks.filter((r) => {
    const paid = INCOME_STATUSES.includes(r.status);
    return (filter === "all" || (filter === "paid" ? paid : r.status === "pending")) && `${r.full_name} ${r.phone}`.includes(search.trim());
  });
  async function markPaid(row: (typeof rows)[number], cash: boolean) {
    if (row.kind !== "drinks" && !confirm("השתייה כלולה בהזמנת בקתה. סימון זה יסמן את כל ההזמנה כשולמה, כולל שעות הבקתה. להמשיך?")) return;
    setSavingId(row.id);
    try {
      await update({ data: { id: row.id, paid: true, ...(cash ? { method: "מזומן" as const, notes: [row.notes, "שולם במזומן / הותאם מול הקופה"].filter(Boolean).join("\n").slice(0, 1000) } : {}) } });
      toast.success(cash ? "שולם במזומן והותאם מול הקופה" : "התשלום עודכן"); await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "עדכון התשלום נכשל"); }
    finally { setSavingId(null); }
  }
  function actions(row: (typeof rows)[number]) {
    if (INCOME_STATUSES.includes(row.status)) return <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Check className="h-4 w-4" />{row.notes?.includes("הותאם מול הקופה") ? "הותאם מול הקופה" : "שולם"}</span>;
    const digits = row.phone.replace(/\D/g, "");
    const phone = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
    const valid = /^972\d{8,9}$/.test(phone);
    const message = `היי ${row.full_name}, ראינו שדיווחת על לקיחת שתייה בסך ${formatILS(drinkAmount(row))}, נשמח להסדרת התשלום. תודה, בקתה B`;
    return <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={savingId === row.id} onClick={() => markPaid(row, true)}><Banknote />שולם במזומן / הותאם</Button>
      <Button size="sm" variant="outline" disabled={savingId === row.id} onClick={() => markPaid(row, false)}><Check />שולם</Button>
      {valid ? <Button asChild size="icon" variant="outline"><a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`תזכורת חוב בוואטסאפ ל${row.full_name}`} title="תזכורת חוב בוואטסאפ"><MessageCircle /></a></Button> : <span className="text-xs text-muted-foreground">אין מספר לתזכורת</span>}
    </div>;
  }
  return (
    <section className="mt-6 min-w-0" aria-label="ניהול שתייה, קופה ומעקב חובות">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-2xl font-bold text-primary"><CupSoda />ניהול שתייה, קופה ומעקב חובות</h2><TillNoteDialog onSaved={refresh} /></div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["הכנסות משתייה ששולמה", totals.drinksPaid], ["חובות שתייה פתוחים", totals.drinksDebt], ["סך הכנסות — בקתה ושתייה", totals.income], ["הוצאות החודש", totals.expenses], ["יתרה — הכנסות פחות הוצאות", totals.balance]].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs leading-relaxed text-muted-foreground">{label}</p><p className="mt-2 font-display text-xl font-bold text-primary">{formatILS(Number(value))}</p></div>)}
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><Input aria-label="חודש קופת שתייה" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" /><Input aria-label="חיפוש לקוח שתייה" placeholder="חיפוש לפי שם או טלפון" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1" /><select aria-label="סינון תשלום שתייה" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="all">כל התשלומים</option><option value="debt">ממתין לתשלום / חוב</option><option value="paid">שולם</option></select><Button variant="outline" size="icon" aria-label="רענון קופת שתייה" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} /></Button></div>
      {query.isError ? <p role="alert" className="mt-5 text-destructive">לא הצלחנו לטעון את הקופה. נסו לרענן.</p> : query.isLoading ? <Loader2 className="mt-6 animate-spin" /> : <>
        <div className="mt-5 hidden overflow-x-auto rounded-lg border border-border md:block"><table className="w-full text-right text-sm"><thead className="bg-muted"><tr>{["תאריך ושעה", "לקוח", "משקאות וכמויות", "סכום שתייה", "אמצעי תשלום", "סטטוס", "פעולות"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{filtered.map((r) => <tr key={r.id} className="border-t border-border align-top"><td className="p-3">{formatDateTime(r.starts_at)}</td><td className="p-3"><b>{r.full_name}</b><div dir="ltr" className="text-right text-xs text-muted-foreground">{r.phone || r.id.slice(0, 8)}</div></td><td className="p-3">{drinksText(r.drinks as DrinkCart) || r.notes || "שתייה"}{r.kind !== "drinks" && <div className="mt-1 text-xs text-muted-foreground">כלול בהזמנת בקתה</div>}</td><td className="p-3 font-semibold">{formatILS(drinkAmount(r))}</td><td className="p-3">{PAY_METHOD_LABEL[r.payment_method] ?? r.payment_method}</td><td className="p-3">{INCOME_STATUSES.includes(r.status) ? "שולם" : "ממתין לתשלום / חוב"}</td><td className="p-3">{actions(r)}</td></tr>)}</tbody></table></div>
        <div className="mt-5 space-y-3 md:hidden">{filtered.map((r) => <article key={r.id} className="rounded-lg border border-border bg-card p-4"><div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{r.full_name}</h3><b className="shrink-0 text-primary">{formatILS(drinkAmount(r))}</b></div><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(r.starts_at)}</p><p className="mt-3 text-sm">{drinksText(r.drinks as DrinkCart) || r.notes || "שתייה"}</p><p className="mt-2 text-xs">{PAY_METHOD_LABEL[r.payment_method] ?? r.payment_method} · {INCOME_STATUSES.includes(r.status) ? "שולם" : "ממתין לתשלום / חוב"}</p>{r.kind !== "drinks" && <p className="mt-1 text-xs text-muted-foreground">כלול בהזמנת בקתה</p>}<div className="mt-3 border-t border-border pt-3">{actions(r)}</div></article>)}</div>
        {!filtered.length && <p className="py-10 text-center text-muted-foreground">אין דיווחי שתייה התואמים לחיפוש בחודש זה.</p>}
      </>}
    </section>
  );
}

function TillNoteDialog({ onSaved }: { onSaved: () => Promise<void> }) {
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