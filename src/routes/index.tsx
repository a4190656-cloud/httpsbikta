import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  Trees, Home, ArrowLeft, ArrowRight,
  Check, ShieldCheck, Clock, Loader2, CalendarDays, X, Minus, Plus, CupSoda, MessageCircle, MessageSquareQuote,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PhotoGallery, ReviewsSection } from "@/components/MediaSections";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { he } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import logo from "@/assets/bikta-logo.png.asset.json";
import {
  DEFAULT_SETTINGS, DRINKS, priceFor, drinksTotal, hoursLabel, formatILS, formatDateTime, formatTime, hebrewDate,
  type DrinkCart, type Settings, PAY_METHODS, PAY_METHOD_LABEL, type PayMethod,
} from "@/lib/booking-rules";
import { getBusy, createBooking, confirmPayment, createDrinkOrder, getSettings } from "@/lib/bookings.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "בקתה B — הזמנת בקתה עם גינה פרטית לפי שעה" },
      { name: "description", content: "קליניקה, סטודיו, משרד או פגישות: הזמינו את בקתה B לפי חצי שעה או שעה, זמינה 24/6." },
      { property: "og:title", content: "שריון שעות בביקתה B" },
      { property: "og:description", content: "בקתה אווירתית עם גינה פרטית. בחרו מועד ושלמו אונליין תוך דקה. ₪40 לשעה, זמינה 24/6." },
      { property: "og:image", content: "https://httpsbikta.lovable.app/og-share.jpg" },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:url", content: "https://httpsbikta.lovable.app/" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "שריון שעות בביקתה B" },
      { name: "twitter:description", content: "בקתה אווירתית עם גינה פרטית. בחרו מועד ושלמו אונליין תוך דקה." },
      { name: "twitter:image", content: "https://httpsbikta.lovable.app/og-share.jpg" },
    ],
  }),
  component: BookingPage,
});

const STEPS = ["מועד", "פרטים", "תשלום"];
const spring = { type: "spring" as const, stiffness: 400, damping: 25 };
const fade = { h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0 } };

type Form = { fullName: string; phone: string; notes: string };
type Range = { start: string; end: string } | null;

function useSettings(): Settings {
  const fetchS = useServerFn(getSettings);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => fetchS(), staleTime: 60_000 });
  return data ?? DEFAULT_SETTINGS;
}

function TypedHeadline({ text }: { text: string }) {
  return (
    <h1 className="mt-3 font-display text-4xl font-bold text-primary sm:text-5xl" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <motion.span key={i} aria-hidden initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.15 + i * 0.045, duration: 0.25 }}>{ch}</motion.span>
      ))}
      <motion.span aria-hidden className="ms-1 inline-block w-[3px] bg-accent align-middle" style={{ height: "0.9em" }}
        animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
    </h1>
  );
}

function BookingPage() {
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [date, setDate] = useState<Date | undefined>(() => new Date());
  const [range, setRange] = useState<Range>(null);
  const [cart, setCart] = useState<DrinkCart>({});
  const [form, setForm] = useState<Form>({ fullName: "", phone: "", notes: "" });
  const [done, setDone] = useState<string | null>(null);
  const [offline, setOffline] = useState<PayMethod | null>(null);
  const [drinksOnly, setDrinksOnly] = useState(false);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [step, done]);
  const hours = range ? (new Date(range.end).getTime() - new Date(range.start).getTime()) / 3600_000 : 0;
  const price = priceFor(hours, settings.hourlyRate, drinksTotal(cart, settings.drinkPrices));

  if (done && range && offline) {
    return <Shell><OfflineConfirm token={done} range={range} method={offline} total={price.total} name={form.fullName} /><ReviewsSection /><PhotoGallery /></Shell>;
  }
  if (done && range) {
    return <Shell><Celebration token={done} startIso={range.start} hours={hours} total={price.total} name={form.fullName} /><ReviewsSection /><PhotoGallery /></Shell>;
  }

  return (
    <Shell>
      <section className="mx-auto max-w-6xl px-5 pb-6 pt-10 text-center">
        <motion.div initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.1 } } }}>
          <motion.p variants={fade} className="text-sm font-medium tracking-wide text-accent">בקתה עם גינה פרטית · לכל מטרה</motion.p>
          <TypedHeadline text="המקום השקט שלכם, לפי שעה" />
          <motion.div variants={fade} transition={{ delay: 1.1 }} className="mt-4 flex justify-center">
            <Button asChild variant="secondary" className="h-auto rounded-full border border-accent/30 px-5 py-2.5 shadow-organic">
              <a href="#reviews"><MessageSquareQuote className="h-4 w-4 text-accent" /><span className="font-semibold">מה אנשים חושבים עלינו?</span></a>
            </Button>
          </motion.div>
          <motion.p variants={fade} transition={{ delay: 1.3 }} className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {formatILS(settings.hourlyRate)} לשעה, כולל מע״מ. הזמנה בקפיצות של חצי שעה.
          </motion.p>
          <motion.div className="mt-5 flex flex-wrap justify-center gap-2 text-xs" initial="h" animate="s"
            variants={{ s: { transition: { staggerChildren: 0.08, delayChildren: 1.4 } } }}>
            {[[Home, "בקתה מאובזרת"], [Trees, "גינה פרטית"], [Clock, "24/6"], [ShieldCheck, "תשלום מאובטח"]].map(([I, t]: any) => (
              <motion.span variants={fade} key={t} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground"><I className="h-3.5 w-3.5 text-accent" />{t}</motion.span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <motion.section className="mx-auto max-w-4xl px-5 pb-24" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
        <Stepper step={step} />
        <div className="glass relative mt-6 overflow-hidden rounded-3xl p-6 sm:p-10">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir}
              initial={{ opacity: 0, x: dir * -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * 40 }}
              transition={{ duration: 0.28, ease: "easeOut" }}>
              {step === 0 && (
                <StepTime date={date} setDate={(d) => { setDate(d); setRange(null); }} range={range} setRange={setRange}
                  cart={cart} setCart={setCart} settings={settings} onNext={() => (range ? go(1) : setDrinksOnly(true))} />
              )}
              {step === 1 && <StepDetails form={form} setForm={setForm} onBack={() => go(0)} onNext={() => go(2)} />}
              {step === 2 && range && (
                <StepPay range={range} hours={hours} cart={cart} settings={settings} form={form}
                  onBack={() => go(1)} onPaid={setDone} onOffline={(t, m) => { setOffline(m); setDone(t); }} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>
      <ReviewsSection />
      <PhotoGallery />
      <FloatingActions onDrinks={() => setDrinksOnly(true)} />
      <AnimatePresence>{drinksOnly && <DrinksOnly settings={settings} initialCart={range ? {} : cart} onClose={() => setDrinksOnly(false)} />}</AnimatePresence>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background bg-hero"><SiteHeader />{children}</div>;
}

function FloatingActions({ onDrinks }: { onDrinks: () => void }) {
  const breathe = (delay: number) => ({
    animate: { scale: [1, 1.06, 1] },
    transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const, delay },
  });
  return (
    <>
      <motion.div className="fixed bottom-5 right-3 z-30 sm:bottom-7 sm:right-6" {...breathe(0)}>
        <Button asChild className="h-11 w-11 rounded-full p-0 shadow-organic">
          <a href="https://wa.me/972539000374" target="_blank" rel="noopener noreferrer" aria-label="יצירת קשר בוואטסאפ">
            <MessageCircle className="h-5 w-5" />
          </a>
        </Button>
      </motion.div>
      <motion.div className="fixed bottom-5 left-3 z-30 sm:bottom-7 sm:left-6" {...breathe(1.3)}>
        <Button variant="secondary" className="h-12 rounded-full border border-accent/30 px-4 shadow-organic sm:h-14 sm:px-5" onClick={onDrinks}>
          <CupSoda className="h-5 w-5 text-accent" /> <span>תשלום על שתייה</span>
        </Button>
      </motion.div>
    </>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
            {i < step ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={`hidden text-sm sm:inline ${i === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</span>
          {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
        </li>
      ))}
    </ol>
  );
}

function Nav({ onBack, onNext, nextLabel = "המשך", disabled, loading }: { onBack?: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean; loading?: boolean }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {onBack ? <Button variant="ghost" onClick={onBack}><ArrowRight className="h-4 w-4" /> חזרה</Button> : <span />}
      <motion.div whileHover={{ scale: disabled ? 1 : 1.02 }} whileTap={{ scale: disabled ? 1 : 0.98 }} transition={spring}>
        <Button size="lg" className="h-12 rounded-full px-8 text-base" disabled={disabled || loading} onClick={onNext}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}{nextLabel} <ArrowLeft className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

function dayStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function DrinkCounters({ cart, setCart, prices }: { cart: DrinkCart; setCart: (c: DrinkCart) => void; prices: Settings["drinkPrices"] }) {
  const set = (id: keyof DrinkCart, n: number) => setCart({ ...cart, [id]: Math.max(0, Math.min(50, n)) });
  return (
    <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-4" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }}>
      {DRINKS.map((d) => {
        const n = cart[d.id] ?? 0;
        return (
          <motion.div key={d.id} variants={fade} className={`rounded-xl border p-3 text-center transition-colors ${n ? "border-accent bg-accent/10" : "border-border bg-card"}`}>
            <div className="text-sm font-semibold">{d.label}</div>
            <div className="text-xs text-muted-foreground">{formatILS(prices[d.id])}</div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <motion.button whileTap={{ scale: 0.85 }} aria-label={`פחות ${d.label}`} onClick={() => set(d.id, n - 1)} disabled={!n}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></motion.button>
              <AnimatePresence mode="popLayout">
                <motion.span key={n} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring}
                  className="w-5 font-bold tabular-nums">{n}</motion.span>
              </AnimatePresence>
              <motion.button whileTap={{ scale: 0.85 }} aria-label={`עוד ${d.label}`} onClick={() => set(d.id, n + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="h-3.5 w-3.5" /></motion.button>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function StepTime(props: {
  date: Date | undefined; setDate: (d?: Date) => void; range: Range; setRange: (r: Range) => void;
  cart: DrinkCart; setCart: (c: DrinkCart) => void; settings: Settings; onNext: () => void;
}) {
  const { date, range, settings } = props;
  const fetchBusy = useServerFn(getBusy);
  const from = date ? dayStart(date) : null;
  const { data, isLoading } = useQuery({
    queryKey: ["busy", from?.toISOString()],
    enabled: !!from,
    queryFn: () => fetchBusy({ data: { from: from!.toISOString(), to: new Date(from!.getTime() + 24 * 3600_000).toISOString() } }),
  });
  const busy = data?.busy ?? [];
  const slots = useMemo(() => {
    if (!from) return [];
    return Array.from({ length: 48 }, (_, i) => {
      const s = new Date(from.getTime() + i * 30 * 60_000);
      const e = new Date(s.getTime() + 30 * 60_000);
      const disabled = s.getTime() < Date.now() - 60_000 || busy.some((b) => new Date(b.start) < e && new Date(b.end) > s);
      return { iso: s.toISOString(), end: e.toISOString(), label: formatTime(s.toISOString()), disabled };
    });
  }, [from?.getTime(), data]);

  const click = (idx: number) => {
    const s = slots[idx]!;
    if (!range) { props.setRange({ start: s.iso, end: s.end }); return; }
    const first = slots.findIndex((x) => x.iso === range.start);
    const last = slots.findIndex((x) => x.end === range.end);
    const selected = idx >= first && idx <= last;
    if (selected) {
      if (first === last) { props.setRange(null); return; }
      if (idx === first) { props.setRange({ start: slots[first + 1]!.iso, end: range.end }); return; }
      if (idx === last) { props.setRange({ start: range.start, end: slots[last - 1]!.end }); return; }
      toast("כדי לשמור על שעות רצופות, אפשר להסיר חצי שעה רק מקצה הבחירה");
      return;
    }
    if (idx === first - 1) { props.setRange({ start: s.iso, end: range.end }); return; }
    if (idx === last + 1) { props.setRange({ start: range.start, end: s.end }); return; }
    toast("בחרו חצאי שעה רצופים, אחד אחרי השני");
  };
  const inRange = (iso: string) => range && iso >= range.start && iso < range.end;
  const hours = range ? (new Date(range.end).getTime() - new Date(range.start).getTime()) / 3600_000 : 0;
  const price = priceFor(hours, settings.hourlyRate, drinksTotal(props.cart, settings.drinkPrices));

  return (
    <div>
      <h2 className="font-display text-2xl font-bold">מתי תרצו להגיע?</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="rounded-2xl border border-border bg-card p-2 self-start">
          <Calendar locale={he} dir="rtl" mode="single" selected={date} onSelect={props.setDate} disabled={(d) => d < dayStart(new Date())} className="p-3 pointer-events-auto" />
          {date && <p className="px-3 pb-2 text-center text-sm text-muted-foreground">{hebrewDate(date)}</p>}
        </div>
        <div>
          <Label className="block text-sm">בחרו את כל חצאי השעה הרצויים</Label>
          <p className="text-xs text-muted-foreground">כל לחיצה מוסיפה חצי שעה רצופה · לחיצה נוספת מסירה אותה</p>
          {isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> בודקים זמינות ביומן…</div>
          ) : (
            <div className="mt-2 grid max-h-72 grid-cols-4 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-6">
              {slots.map((s, i) => {
                const sel = inRange(s.iso);
                return (
                  <motion.button key={s.iso} disabled={s.disabled} whileHover={s.disabled ? {} : { scale: 1.04 }} whileTap={s.disabled ? {} : { scale: 0.95 }} transition={spring}
                    onClick={() => click(i)}
                    className={`rounded-lg border py-2 text-sm tabular-nums transition-colors ${s.disabled ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through" : sel ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card hover:border-accent"}`}>
                    {s.label}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2"><CupSoda className="h-5 w-5 text-accent" /><h3 className="font-semibold">שתייה קרה להזמנה (לא חובה)</h3></div>
        <div className="mt-3"><DrinkCounters cart={props.cart} setCart={props.setCart} prices={settings.drinkPrices} /></div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-secondary px-5 py-4">
        <div className="text-sm text-secondary-foreground">
          {range ? <>{formatDateTime(range.start)}–{formatTime(range.end)} · {hoursLabel(hours)} · נבחרו {hours * 2} חצאי שעה</> : "בחרו חצאי שעה"}
          {range && <div className="mt-0.5 text-xs text-secondary-foreground/70">{hebrewDate(range.start)}</div>}
        </div>
        <motion.div key={price.total} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display text-2xl font-bold text-primary">{formatILS(price.total)}</motion.div>
      </div>
      {!range && drinksTotal(props.cart, props.settings.drinkPrices) > 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">לא נבחרו שעות — אפשר להמשיך ולהזמין רק את השתייה</p>
      )}
      <Nav onNext={props.onNext} disabled={!range && drinksTotal(props.cart, props.settings.drinkPrices) <= 0} nextLabel={!range && drinksTotal(props.cart, props.settings.drinkPrices) > 0 ? "המשך להזמנת שתייה" : "המשך"} />
    </div>
  );
}

const phoneRe = /^0(5\d|[2-4]|[89]|7\d)-?\d{7}$/;
function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 10);
  return d.length > 3 && d.startsWith("05") ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
}

function StepDetails({ form, setForm, onBack, onNext }: { form: Form; setForm: (f: Form) => void; onBack: () => void; onNext: () => void }) {
  const [touched, setTouched] = useState(false);
  const errors = {
    fullName: form.fullName.trim().length < 2 ? "נא להזין שם מלא" : "",
    phone: !phoneRe.test(form.phone) ? "מספר טלפון ישראלי לא תקין" : "",
  };
  const valid = !errors.fullName && !errors.phone;
  const set = (k: keyof Form, v: any) => setForm({ ...form, [k]: v });
  return (
    <div>
      <h2 className="font-display text-2xl font-bold">הפרטים שלכם</h2>
      <motion.div className="mt-6 grid gap-4 sm:grid-cols-2" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }}>
        <motion.div variants={fade}><Field label="שם מלא" error={touched ? errors.fullName : ""}><Input value={form.fullName} maxLength={100} onChange={(e) => set("fullName", e.target.value)} /></Field></motion.div>
        <motion.div variants={fade}><Field label="טלפון" error={touched ? errors.phone : ""}><Input dir="ltr" inputMode="tel" placeholder="050-1234567" className="text-right" value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} /></Field></motion.div>
        <motion.div variants={fade} className="sm:col-span-2"><Field label="בקשות מיוחדות (לא חובה)"><Textarea rows={3} maxLength={1000} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></motion.div>
      </motion.div>
      <Nav onBack={onBack} onNext={() => { setTouched(true); if (valid) onNext(); }} />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}

/** Test-mode payment modal + postMessage listener. */
function usePayment(confirmToken: (t: string) => void) {
  const confirm = useServerFn(confirmPayment);
  const [pay, setPay] = useState<{ token: string; amount: number } | null>(null);
  useEffect(() => {
    if (!pay) return;
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.source !== "takbull") return;
      if (e.data.type === "success") {
        try { const r = await confirm({ data: { token: pay.token } }); if (r.ok) { setPay(null); confirmToken(pay.token); } }
        catch { toast.error("התשלום התקבל אך אירעה תקלה ברישום. נציג יחזור אליכם."); }
      } else {
        setPay(null);
        toast(e.data.type === "cancel" ? "התשלום בוטל — ההזמנה שלכם עדיין ממתינה כאן 🌿" : "משהו השתבש בתשלום. אפשר לנסות שוב בעוד רגע.");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [pay]);
  const modal = (
    <AnimatePresence>
      {pay && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-organic" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }} transition={spring}>
            <button aria-label="סגירה" onClick={() => { setPay(null); toast("התשלום בוטל 🌿"); }} className="absolute left-3 top-3 z-10 rounded-full bg-muted p-1.5"><X className="h-4 w-4" /></button>
            <iframe title="תשלום תקבול" src={`/checkout-test?amount=${pay.amount}`} className="h-[560px] w-full border-0" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { setPay, modal };
}

function StepPay({ range, hours, cart, settings, form, onBack, onPaid, onOffline }: {
  range: { start: string; end: string }; hours: number; cart: DrinkCart; settings: Settings; form: Form;
  onBack: () => void; onPaid: (token: string) => void; onOffline: (token: string, method: PayMethod) => void;
}) {
  const create = useServerFn(createBooking);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<PayMethod>("אשראי");
  const { setPay, modal } = usePayment(onPaid);
  const p = priceFor(hours, settings.hourlyRate, drinksTotal(cart, settings.drinkPrices));

  const start = async () => {
    setLoading(true);
    try {
      const r = await create({ data: { startsAt: range.start, endsAt: range.end, ...form, notes: form.notes || undefined, drinks: cart, paymentMethod: method } });
      if (method === "אשראי") setPay({ token: r.token, amount: r.total });
      else onOffline(r.token, method);
    } catch (err: any) { toast.error(err?.message ?? "לא הצלחנו ליצור הזמנה"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-bold">סיכום ותשלום</h2>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
        <ShieldCheck className="h-4 w-4" /> ביטול ללא עלות מתאפשר עד 2 ימי עסקים לפני המועד בלבד.
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatDateTime(range.start)}–{formatTime(range.end)} · {hoursLabel(hours)}</div>
          <div className="mt-1 ps-6 text-xs">{hebrewDate(range.start)}</div>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <Row k={`${formatILS(settings.hourlyRate)} × ${hoursLabel(hours)}`} v={formatILS(p.room)} />
          {p.drinks > 0 && <Row k="שתייה" v={formatILS(p.drinks)} />}
          <Row k="גינה פרטית" v="כלול" />
          <Row k='מתוכם מע"מ (18%)' v={formatILS(p.vat)} />
          <div className="border-t border-border pt-3"><Row k={<b>סה״כ לתשלום</b>} v={<b className="font-display text-2xl text-primary">{formatILS(p.total)}</b>} /></div>
        </dl>
      </div>
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">אמצעי תשלום</div>
        <div role="radiogroup" aria-label="אמצעי תשלום" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PAY_METHODS.map((m) => (
            <motion.button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className={`rounded-2xl border px-3 py-3 text-sm font-medium transition-colors ${method === m ? "border-primary bg-primary text-primary-foreground shadow-organic" : "border-border bg-card hover:border-primary/40"}`}>
              {PAY_METHOD_LABEL[m]}
            </motion.button>
          ))}
        </div>
        {method !== "אשראי" && <p className="mt-2 text-xs text-muted-foreground">המועד יינעל עבורכם, ואישור סופי יינתן אחרי שליחת אסמכתה בוואטסאפ.</p>}
      </div>
      <Consent />
      <Nav onBack={onBack} onNext={start} nextLabel={method === "אשראי" ? "לתשלום מאובטח" : "שריון המועד"} loading={loading} />
      {modal}
    </div>
  );
}

function Consent() {
  const l = "font-medium text-primary underline underline-offset-2";
  return (
    <p className="mt-4 text-center text-xs text-muted-foreground">
      בלחיצה על ביצוע תשלום, הנך מאשר/ת את{" "}
      <a href="/terms" target="_blank" rel="noopener" className={l}>תנאי השימוש</a> ו
      <a href="/cancellation" target="_blank" rel="noopener" className={l}>מדיניות הביטולים</a>
    </p>
  );
}

function DrinksOnly({ settings, onClose, initialCart }: { settings: Settings; onClose: () => void; initialCart?: DrinkCart }) {
  const create = useServerFn(createDrinkOrder);
  const [cart, setCart] = useState<DrinkCart>(initialCart ?? {});
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false); const [ok, setOk] = useState(false);
  const { setPay, modal } = usePayment(() => {
    setOk(true);
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.4 }, colors: ["#2D4A32", "#8C502E", "#C9A06B"] });
  });
  const total = drinksTotal(cart, settings.drinkPrices);
  const submit = async () => {
    if (name.trim().length < 2 || !phoneRe.test(phone)) { toast.error("נא למלא שם וטלפון תקין"); return; }
    setLoading(true);
    try { const r = await create({ data: { fullName: name, phone, drinks: cart } }); setPay({ token: r.token, amount: r.total }); }
    catch (e: any) { toast.error(e?.message ?? "לא הצלחנו ליצור הזמנה"); }
    finally { setLoading(false); }
  };
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg rounded-3xl bg-card p-6 shadow-organic" initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.96 }} transition={spring}>
        <button aria-label="סגירה" onClick={onClose} className="absolute left-4 top-4 rounded-full bg-muted p-1.5"><X className="h-4 w-4" /></button>
        {ok ? (
          <div className="py-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-8 w-8" /></motion.div>
            <h3 className="mt-4 font-display text-2xl font-bold text-primary">לחיים! 🥤</h3>
            <p className="mt-1 text-sm text-muted-foreground">התשלום התקבל, השתייה מחכה לכם במקרר.</p>
            <Button className="mt-6 rounded-full" onClick={onClose}>סגירה</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2"><CupSoda className="h-6 w-6 text-accent" /><h3 className="font-display text-xl font-bold">שתייה קרה בלי הזמנה</h3></div>
            <p className="mt-1 text-sm text-muted-foreground">אתם כבר בבקתה או בגינה? בחרו, שלמו, וקחו מהמקרר.</p>
            <div className="mt-4"><DrinkCounters cart={cart} setCart={setCart} prices={settings.drinkPrices} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="שם"><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="טלפון"><Input dir="ltr" inputMode="tel" className="text-right" placeholder="050-1234567" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} /></Field>
            </div>
            <Consent />
            <Button size="lg" className="mt-3 h-12 w-full rounded-full text-base" disabled={!total || loading} onClick={submit}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} לתשלום {formatILS(total)}
            </Button>
          </>
        )}
        {modal}
      </motion.div>
    </motion.div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}

function Celebration({ token, startIso, hours, total, name }: { token: string; startIso: string; hours: number; total: number; name: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    const colors = ["#2D4A32", "#8C502E", "#FAF7F2", "#C9A06B"];
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.35 }, colors });
    const t = setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.3 }, colors }), 400);
    return () => clearTimeout(t);
  }, []);
  const manageUrl = typeof window !== "undefined" ? `${window.location.origin}/manage/${token}` : "";
  return (
    <section className="mx-auto max-w-xl px-5 py-16 text-center">
      <div className="relative mx-auto h-40 w-40">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className={`absolute inset-0 rounded-full border-2 ${i % 2 ? "border-accent" : "border-primary"}`}
            initial={{ scale: 0.5, opacity: 0.8 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }} />
        ))}
        <motion.div className="absolute inset-6 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-organic"
          initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
          <Check className="h-14 w-14" strokeWidth={3} />
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h1 className="mt-8 font-display text-3xl font-bold text-primary">ההזמנה אושרה, {name.split(" ")[0]}!</h1>
        <p className="mt-2 text-muted-foreground">אישור נשלח גם ליומן שלנו. נתראה בבקתה 🌿</p>
        <div className="glass mt-8 rounded-3xl p-6 text-right">
          <img src={logo.url} alt="בקתה B" className="mx-auto h-16 w-auto" />
          <dl className="mt-5 space-y-2 text-sm">
            <Row k="מועד" v={formatDateTime(startIso)} />
            <Row k="תאריך עברי" v={hebrewDate(startIso)} />
            <Row k="משך" v={hoursLabel(hours)} />
            <Row k="שולם" v={formatILS(total)} />
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">הוראות הגעה: החוזה מלובלין 18 — עולים קטע אחד של מדרגות, יוצאים מהבניין שמאלה, דלת ברזל. להוראות כניסה ופרטים נוספים פנו אלינו: <a href="tel:+972539000374" dir="ltr" className="text-accent underline">053-900-0374</a></p>
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="font-semibold">קישור אישי לניהול ההזמנה</div>
          <p className="mt-1 text-xs text-muted-foreground">שמרו אותו — דרכו אפשר לבטל עד 2 ימי עסקים לפני המועד.</p>
          <div className="mt-3 flex gap-2">
            <Input readOnly dir="ltr" value={manageUrl} className="text-xs" />
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(manageUrl); toast.success("הקישור הועתק"); }}>העתקה</Button>
          </div>
          <Link to="/manage/$token" params={{ token }} className="mt-3 inline-block text-accent underline-offset-4 hover:underline">לניהול ההזמנה</Link>
        </div>
      </motion.div>
    </section>
  );
}

function OfflineConfirm({ token, range, method, total, name }: { token: string; range: { start: string; end: string }; method: PayMethod; total: number; name: string }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, []);
  const dateStr = new Date(range.start).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
  const msg = `שלום, ביצעתי הרגע הזמנה בבקתה B עבור ${name} בתאריך ${dateStr} בין השעות ${formatTime(range.start)}-${formatTime(range.end)}. בחרתי לשלם באמצעות ${PAY_METHOD_LABEL[method]}. אשמח לקבל פרטים לביצוע ההעברה / לשלוח אסמכתה. תודה!`;
  const wa = `https://wa.me/972539000374?text=${encodeURIComponent(msg)}`;
  return (
    <section className="mx-auto max-w-xl px-5 py-14 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-organic">
        <Clock className="h-10 w-10" />
      </motion.div>
      <h1 className="mt-6 font-display text-3xl font-bold text-primary">המועד שוריין, {name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">סטטוס: ממתין לתשלום / אישור</p>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="mt-6 rounded-2xl border-2 border-accent bg-accent/10 p-5 text-right text-base font-bold leading-relaxed text-foreground">
        שים לב: ההזמנה ננעלה זמנית. חובה לדווח ולשלוח אלינו אסמכתת תשלום (או תיאום תשלום במזומן) בוואטסאפ לצורך אישור סופי של התור!
      </motion.div>
      <motion.a href={wa} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-organic">
        <MessageCircle className="h-5 w-5" /> מעבר לוואטסאפ לשליחת אסמכתא / קבלת פרטי תשלום
      </motion.a>
      <div className="glass mt-6 rounded-3xl p-5 text-right">
        <dl className="space-y-2 text-sm">
          <Row k="מועד" v={`${formatDateTime(range.start)}–${formatTime(range.end)}`} />
          <Row k="תאריך עברי" v={hebrewDate(range.start)} />
          <Row k="אמצעי תשלום" v={PAY_METHOD_LABEL[method]} />
          <Row k="סכום לתשלום" v={formatILS(total)} />
        </dl>
        <Link to="/manage/$token" params={{ token }} className="mt-4 inline-block text-sm text-accent underline-offset-4 hover:underline">לניהול ההזמנה</Link>
      </div>
    </section>
  );
}
