import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import type { LegalDoc } from "@/lib/legal";

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 py-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
          <ArrowRight className="h-4 w-4" aria-hidden /> חזרה להזמנה
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-primary">{doc.title}</h1>
        <p className="mt-2 text-muted-foreground">{doc.description}</p>
        <div className="mt-8 space-y-8">
          {doc.sections.map((s) => (
            <section key={s.h} className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">{s.h}</h2>
              <ul className="mt-3 list-disc space-y-2 ps-5 leading-relaxed text-foreground/90">
                {s.p.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
