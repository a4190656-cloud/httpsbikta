import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, CupSoda, Link2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EndOfMonthMethod, PayMethod } from "@/lib/booking-rules";

const CONTACT_EMAIL = "b0539000374@gmail.com";

export function DrinksReminder() {
  return (
    <aside className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-right text-sm leading-relaxed">
      <CupSoda className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <p><strong className="text-primary">שימו לב: לקחתם שתייה מהמקרר?</strong> אנא זכרו לעדכן במערכת. הדיווח הינו באחריותכם האישית – תודה מראש ובהבנה!</p>
    </aside>
  );
}

export function LostBookingLinkNotice() {
  return (
    <aside className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-4 text-right text-sm leading-relaxed">
      <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <p><strong className="text-primary">רוצים לבטל או לשנות הזמנה?</strong> היכנסו לקישור האישי שקיבלתם בסיום ההזמנה. איבדתם את הקישור? שריינו קודם מועד חדש, ולאחר מכן צרו איתנו קשר לביטול המועד הישן.</p>
    </aside>
  );
}

export function PersonalBookingLink({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(`${window.location.origin}/manage/${encodeURIComponent(token)}`); }, [token]);
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("הקישור האישי הועתק"); }
    catch { toast.error("לא ניתן להעתיק אוטומטית. סמנו והעתיקו את הקישור המוצג."); }
  }
  return (
    <aside className="mt-5 rounded-lg border-2 border-primary/25 bg-primary/5 p-5 text-right">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-primary"><Link2 className="h-5 w-5 shrink-0" />קישור אישי לניהול ההזמנה</h2>
      <p className="mt-2 font-semibold leading-relaxed">חשוב לשמור קישור זה! דרך קישור אישי זה תוכלו לצפות בפרטי ההזמנה או לבטלה בעת הצורך.</p>
      <p className="mt-2 text-sm text-muted-foreground">ביטול עצמאי אפשרי עד 48 שעות לפני המועד.</p>
      <Input aria-label="קישור אישי לניהול ההזמנה" readOnly dir="ltr" value={url} onFocus={(e) => e.target.select()} className="mt-4 w-full bg-card text-sm" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!url} onClick={copyLink}>{copied ? <Check /> : <Copy />}{copied ? "הקישור הועתק" : "העתק קישור"}</Button>
        <Button asChild variant="outline"><Link to="/manage/$token" params={{ token }}>צפייה וניהול ההזמנה</Link></Button>
      </div>
    </aside>
  );
}

export function ConfirmationContactActions({ waUrl, method, settlement, drinksOnly = false }: { waUrl: string; method: PayMethod; settlement?: EndOfMonthMethod | undefined; drinksOnly?: boolean }) {
  const needsProof = method === "העברה" || (method === "סוף חודש" && settlement === "העברה");
  let message = "";
  try { message = new URL(waUrl).searchParams.get("text") ?? ""; } catch {}
  const emailUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(drinksOnly ? "עדכון לקיחת שתייה — בקתה B" : "פרטי הזמנה — בקתה B")}&body=${encodeURIComponent(message + (needsProof ? "\n\nמצורפת אסמכתת תשלום בהעברה בנקאית." : ""))}`;
  return (
    <div className="mt-5 space-y-3 text-right">
      {needsProof && <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-primary">נא לשלוח לנו אסמכתת תשלום לאישור סופי. ניתן לצרף אותה להודעת וואטסאפ או למייל.</p>}
      <Button asChild size="lg" className="h-auto min-h-16 w-full whitespace-normal rounded-lg py-3">
        <a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle /><span className="min-w-0 text-center"><span className="block font-semibold">שליחת פרטי {drinksOnly ? "השתייה" : "ההזמנה"} בוואטסאפ</span><span className="mt-1 block text-sm" dir="ltr">053-9000374</span></span></a>
      </Button>
      <Button asChild variant="outline" size="lg" className="h-auto min-h-16 w-full whitespace-normal rounded-lg py-3">
        <a href={emailUrl}><Mail /><span className="min-w-0 text-center"><span className="block font-semibold">שליחת פרטים באימייל</span><span className="mt-1 block break-all text-sm" dir="ltr">{CONTACT_EMAIL}</span></span></a>
      </Button>
    </div>
  );
}