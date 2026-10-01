import { Link } from "@tanstack/react-router";
import { BUSINESS } from "@/lib/legal";

const LINKS = [
  { to: "/terms", label: "תנאי שימוש ותקנון" },
  { to: "/privacy", label: "מדיניות פרטיות" },
  { to: "/cancellation", label: "מדיניות ביטולים" },
  { to: "/accessibility", label: "הצהרת נגישות" },
] as const;

export function SiteFooter() {
  return (
    <footer dir="rtl" className="mt-16 border-t border-border bg-card/60">
      <div className="mx-auto max-w-6xl px-5 py-8 pb-28 text-sm text-muted-foreground">
        <nav aria-label="מידע משפטי" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="font-medium text-foreground/80 underline-offset-4 hover:text-primary hover:underline">{l.label}</Link>
          ))}
        </nav>
        <p className="mt-4 leading-relaxed">
          {BUSINESS.name} | ע.מ / ח.פ: {BUSINESS.businessId} | טלפון: <a href={`tel:${BUSINESS.phoneIntl}`} dir="ltr" className="hover:text-primary">{BUSINESS.phone}</a> | כתובת: {BUSINESS.address}
        </p>
      </div>
    </footer>
  );
}
