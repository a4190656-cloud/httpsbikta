import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  Stethoscope, Palette, Laptop, Users, Sparkles, Trees, Home, ArrowLeft, ArrowRight,
  Check, ShieldCheck, Clock, Loader2, KeyRound, CalendarDays, X,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { he } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import logo from "@/assets/bikta-logo.png.asset.json";
import {
  DURATIONS, HOURLY_RATE, PURPOSES, priceFor, formatILS, formatDateTime, formatTime, type PurposeId,
} from "@/lib/booking-rules";
import { getBusy, createBooking, confirmPayment } from "@/lib/bookings.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "בקתה B — הזמנת בקתה עם גינה פרטית לפי שעה" },
      { name: "description", content: "קליניקה, סטודיו, משרד או פגישות: הזמינו את בקתה B לפי שעה, ₪40 לשעה, זמינה 24/7." },
      { property: "og:title", content: "בקתה B — השכרה לפי שעה" },
      { property: "og:description", content: "בקתה אווירתית עם גינה פרטית. בחרו מועד ושלמו אונליין תוך דקה." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookingPage,
});

const ICONS: Record<PurposeId, typeof Stethoscope> = {
  clinic: Stethoscope, studio: Palette, office: Laptop, meetings: Users, other: Sparkles,
};
const STEPS = ["מטרה", "מועד", "פרטים", "תשלום"];
const spring = { type: "spring" as const, stiffness: 400, damping: 25 };

type Form = { fullName: string; phone: string; email: string; attendees: number; notes: string };

function BookingPage() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [purpose, setPurpose] = useState<PurposeId | null>(null);
  const [date, setDate] = useState<Date | undefined>(() => new Date());
  const [hours, setHours] = useState(1);
  const [startIso, setStartIso] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ fullName: "", phone: "", email: "", attendees: 1, notes: "" });
  const [done, setDone] = useState<{ token: string; accessCode: string } | null>(null);

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  const price = priceFor(hours);

  if (done) {
    return (
      <Shell>
        <Celebration token={done.token} accessCode={done.accessCode} startIso={startIso!} hours={hours} purpose={purpose!} total={price.total} name={form.fullName} />
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-12 text-center">
        <motion.div initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.08 } } }}>
          <motion.p variants={fade} className="text-sm font-medium tracking-wide text-accent">בקתה עם גינה פרטית · לכל מטרה</motion.p>
          <motion.h1 variants={fade} className="mt-3 font-display text-4xl font-bold text-primary sm:text-5xl">
            המקום השקט שלכם, לפי שעה
          </motion.h1>
          <motion.p variants={fade} className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {formatILS(HOURLY_RATE)} לשעה, כולל מע״מ וגישה לגינה. זמינה בכל שעה, כל יום.
          </motion.p>
          <motion.div variants={fade} className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            {[[Home, "בקתה מאובזרת"], [Trees, "גינה פרטית"], [Clock, "24/7"], [ShieldCheck, "תשלום מאובטח"]].map(([I, t]: any) => (
              <span key={t} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground"><I className="h-3.5 w-3.5 text-accent" />{t}</span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24">
        <Stepper step={step} />
        <div className="glass relative mt-6 overflow-hidden rounded-3xl p-6 sm:p-10">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step} custom={dir}
              initial={{ opacity: 0, x: dir * -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * 40 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {step === 0 && <StepPurpose value={purpose} onChange={(p) => { setPurpose(p); }} onNext={() => go(1)} />}
              {step === 1 && (
                <StepTime date={date} setDate={(d) => { setDate(d); setStartIso(null); }} hours={hours}
                  setHours={(h) => { setHours(h); setStartIso(null); }} startIso={startIso} setStartIso={setStartIso}
                  onBack={() => go(0)} onNext={() => go(2)} />
              )}
              {step === 2 && <StepDetails form={form} setForm={setForm} onBack={() => go(1)} onNext={() => go(3)} />}
              {step === 3 && (
                <StepPay purpose={purpose!} startIso={startIso!} hours={hours} form={form} onBack={() => go(2)}
                  onPaid={(token, accessCode) => setDone({ token, accessCode })} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </Shell>
  );
}

const fade = { h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0 } };

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background bg-hero"><SiteHeader />{children}</div>;
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
            {i < step ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={`text-sm ${i === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</span>
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

function StepPurpose({ value, onChange, onNext }: { value: PurposeId | null; onChange: (p: PurposeId) => void; onNext: () => void }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold">לאיזו מטרה תשתמשו בבקתה?</h2>
      <p className="mt-1 text-sm text-muted-foreground">בחרו את השימוש שמתאים לכם</p>
      <motion.div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.06 } } }}>
        {PURPOSES.map((p) => {
          const I = ICONS[p.id]; const active = value === p.id;
          return (
            <motion.button key={p.id} variants={fade} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}
              onClick={() => onChange(p.id)}
              className={`rounded-2xl border p-5 text-right transition-colors ${active ? "border-primary bg-primary text-primary-foreground shadow-organic" : "border-border bg-card hover:border-accent"}`}>
              <I className={`h-6 w-6 ${active ? "" : "text-accent"}`} />
              <div className="mt-3 font-semibold">{p.label}</div>
              <div className={`mt-1 text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{p.desc}</div>
            </motion.button>
          );
        })}
      </motion.div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4"><Home className="h-8 w-8 text-primary" /><div><div className="font-semibold text-sm">הבקתה</div><div className="text-xs text-muted-foreground">חלל עץ חמים ומואר</div></div></div>
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4"><Trees className="h-8 w-8 text-primary" /><div><div className="font-semibold text-sm">הגינה הפרטית</div><div className="text-xs text-muted-foreground">כלולה בכל הזמנה</div></div></div>
      </div>
      <Nav onNext={onNext} disabled={!value} />
    </div>
  );
}

function dayStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function StepTime(props: {
  date: Date | undefined; setDate: (d?: Date) => void; hours: number; setHours: (h: number) => void;
  startIso: string | null; setStartIso: (s: string | null) => void; onBack: () => void; onNext: () => void;
}) {
  const { date, hours, startIso } = props;
  const fetchBusy = useServerFn(getBusy);
  const from = date ? dayStart(date) : null;
  const { data, isLoading } = useQuery({
    queryKey: ["busy", from?.toISOString()],
    enabled: !!from,
    queryFn: () => fetchBusy({ data: { from: from!.toISOString(), to: new Date(from!.getTime() + 36 * 3600_000).toISOString() } }),
  });
  const slots = useMemo(() => {
    if (!from) return [];
    const busy = data?.busy ?? [];
    return Array.from({ length: 24 }, (_, h) => {
      const s = new Date(from); s.setHours(h);
      const e = new Date(s.getTime() + hours * 3600_000);
      const past = s.getTime() < Date.now();
      const taken = busy.some((b) => new Date(b.start) < e && new Date(b.end) > s);
      return { iso: s.toISOString(), label: formatTime(s.toISOString()), disabled: past || taken };
    });
  }, [from?.getTime(), data, hours]);
  const price = priceFor(hours);

  return (
    <div>
      <h2 className="font-display text-2xl font-bold">מתי תרצו להגיע?</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="rounded-2xl border border-border bg-card p-2">
          <Calendar locale={he} dir="rtl" mode="single" selected={date} onSelect={props.setDate} disabled={(d) => d < dayStart(new Date())} className="p-3 pointer-events-auto" />
        </div>
        <div>
          <Label className="text-sm">משך ההשכרה</Label>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {DURATIONS.map((d) => (
              <motion.button key={d.hours} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}
                onClick={() => props.setHours(d.hours)}
                className={`rounded-xl border px-2 py-2.5 text-sm ${hours === d.hours ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-accent"}`}>
                <div className="font-semibold">{d.label}</div>
                {d.sub && <div className="text-[10px] opacity-75">{d.sub}</div>}
              </motion.button>
            ))}
          </div>
          <Label className="mt-5 block text-sm">שעת התחלה</Label>
          {isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> בודקים זמינות ביומן…</div>
          ) : (
            <div className="mt-2 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pe-1 sm:grid-cols-6">
              {slots.map((s) => (
                <motion.button key={s.iso} disabled={s.disabled} whileHover={s.disabled ? {} : { scale: 1.02 }} whileTap={s.disabled ? {} : { scale: 0.98 }} transition={spring}
                  onClick={() => props.setStartIso(s.iso)}
                  className={`rounded-lg border py-2 text-sm tabular-nums ${s.disabled ? "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through" : startIso === s.iso ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card hover:border-accent"}`}>
                  {s.label}
                </motion.button>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-secondary px-5 py-4">
            <div className="text-sm text-secondary-foreground">
              {startIso ? <>{formatDateTime(startIso)} · {hours} שעות</> : "בחרו שעת התחלה"}
            </div>
            <div className="font-display text-2xl font-bold text-primary">{formatILS(price.total)}</div>
          </div>
        </div>
      </div>
      <Nav onBack={props.onBack} onNext={props.onNext} disabled={!startIso} />
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
    email: !/^\S+@\S+\.\S+$/.test(form.email) ? "כתובת אימייל לא תקינה" : "",
  };
  const valid = !errors.fullName && !errors.phone && !errors.email && form.attendees >= 1;
  const set = (k: keyof Form, v: any) => setForm({ ...form, [k]: v });
  return (
    <div>
      <h2 className="font-display text-2xl font-bold">הפרטים שלכם</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="שם מלא" error={touched ? errors.fullName : ""}><Input value={form.fullName} maxLength={100} onChange={(e) => set("fullName", e.target.value)} /></Field>
        <Field label="טלפון" error={touched ? errors.phone : ""}><Input dir="ltr" inputMode="tel" placeholder="050-1234567" className="text-right" value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} /></Field>
        <Field label="אימייל" error={touched ? errors.email : ""}><Input dir="ltr" type="email" className="text-right" maxLength={255} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="מספר משתתפים"><Input type="number" min={1} max={40} value={form.attendees} onChange={(e) => set("attendees", Math.max(1, Math.min(40, Number(e.target.value) || 1)))} /></Field>
        <div className="sm:col-span-2"><Field label="בקשות מיוחדות (לא חובה)"><Textarea rows={3} maxLength={1000} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
      </div>
      <Nav onBack={onBack} onNext={() => { setTouched(true); if (valid) onNext(); }} />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}

function StepPay({ purpose, startIso, hours, form, onBack, onPaid }: {
  purpose: PurposeId; startIso: string; hours: number; form: Form; onBack: () => void; onPaid: (token: string, code: string) => void;
}) {
  const create = useServerFn(createBooking);
  const confirm = useServerFn(confirmPayment);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const p = priceFor(hours);

  useEffect(() => {
    if (!token) return;
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.source !== "takbull") return;
      if (e.data.type === "success") {
        try {
          const r = await confirm({ data: { token } });
          onPaid(token, r.accessCode ?? "");
        } catch { toast.error("התשלום התקבל אך אירעה תקלה ברישום. נציג יחזור אליכם."); }
      } else {
        setToken(null);
        toast(e.data.type === "cancel" ? "התשלום בוטל — ההזמנה שלכם עדיין ממתינה כאן 🌿" : "משהו השתבש בתשלום. אפשר לנסות שוב בעוד רגע.");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [token]);

  const start = async () => {
    setLoading(true);
    try {
      const r = await create({ data: { purpose, startsAt: startIso, hours: hours as 1, ...form, notes: form.notes || undefined } });
      setToken(r.token);
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />{formatDateTime(startIso)} · {hours} שעות · {PURPOSES.find((x) => x.id === purpose)?.label}</div>
        <dl className="mt-5 space-y-3 text-sm">
          <Row k={`${formatILS(HOURLY_RATE)} × ${hours} שעות (לפני מע״מ)`} v={formatILS(p.subtotal)} />
          <Row k="גישה לגינה הפרטית" v="כלול" />
          <Row k='מע"מ (18%)' v={formatILS(p.vat)} />
          <div className="border-t border-border pt-3"><Row k={<b>סה״כ לתשלום</b>} v={<b className="font-display text-2xl text-primary">{formatILS(p.total)}</b>} /></div>
        </dl>
      </div>
      <Nav onBack={onBack} onNext={start} nextLabel="לתשלום מאובטח" loading={loading} />

      <AnimatePresence>
        {token && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-organic" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }} transition={spring}>
              <button aria-label="סגירה" onClick={() => { setToken(null); toast("התשלום בוטל — ההזמנה שלכם עדיין ממתינה כאן 🌿"); }} className="absolute left-3 top-3 z-10 rounded-full bg-muted p-1.5"><X className="h-4 w-4" /></button>
              <iframe title="תשלום תקבול" src={`/checkout-test?amount=${p.total}`} className="h-[560px] w-full border-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}

function Celebration({ token, accessCode, startIso, hours, purpose, total, name }: { token: string; accessCode: string; startIso: string; hours: number; purpose: PurposeId; total: number; name: string }) {
  useEffect(() => {
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
            <Row k="משך" v={`${hours} שעות`} />
            <Row k="מטרה" v={PURPOSES.find((x) => x.id === purpose)?.label} />
            <Row k="שולם" v={formatILS(total)} />
          </dl>
          <div className="mt-5 rounded-2xl bg-primary p-4 text-center text-primary-foreground">
            <div className="flex items-center justify-center gap-2 text-sm opacity-80"><KeyRound className="h-4 w-4" /> קוד כניסה לבקתה</div>
            <div className="mt-1 font-display text-4xl font-bold tracking-[0.3em]">{accessCode}</div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">הקישו את הקוד במנעול שליד דלת העץ. הגינה פתוחה בשער הצדדי. נא להשאיר את המקום כפי שמצאתם.</p>
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
