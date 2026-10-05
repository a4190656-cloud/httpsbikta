import { Link } from "@tanstack/react-router";
import { BUSINESS } from "@/lib/legal";
import aoLogo from "@/assets/ao-logo.png.asset.json";

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
          {BUSINESS.name} | עוסק פטור: {BUSINESS.businessId} | טלפון: <a href={`tel:${BUSINESS.phoneIntl}`} dir="ltr" className="hover:text-primary">053-9000374</a>
        </p>
        <a
          href="https://a4190656-cloud.github.io/AO/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center gap-3 border-t border-border/60 pt-5 transition-opacity hover:opacity-80"
          aria-label="AO אהרן אוירבך שירותי דיגיטל — לאתר הבונה"
        >
          <img src={aoLogo.url} alt="AO אהרן אוירבך שירותי דיגיטל" className="h-10 w-10 rounded-full object-cover shadow-sm" />
          <p className="text-xs leading-relaxed">
            האתר נבנה ע״י <span className="font-semibold text-foreground/80">AO אהרן אוירבך — שירותי דיגיטל</span>
            {" "}| טלפון ליצירת קשר:{" "}
            <span dir="ltr" className="font-medium hover:text-primary">053-419-0656</span>
          </p>
        </a>
      </div>
    </footer>
  );
}
