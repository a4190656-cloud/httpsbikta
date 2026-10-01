import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "כניסת מנהל — בקתה B" }, { name: "description", content: "כניסה לניהול הזמנות בקתה B" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [netError, setNetError] = useState(false);
  const attempt = () => mode === "in"
    ? supabase.auth.signInWithPassword({ email, password })
    : supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault(); setLoading(true); setNetError(false);
    let result: Awaited<ReturnType<typeof attempt>> | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        result = await attempt();
        const msg = result.error?.message ?? "";
        if (!/fetch|network/i.test(msg)) break;
      } catch { result = null; }
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
    setLoading(false);
    const msg = result?.error?.message ?? "";
    if (!result || /fetch|network/i.test(msg)) { setNetError(true); return; }
    const { data, error } = result;
    if (error) { toast.error(error.message === "Invalid login credentials" ? "אימייל או סיסמה שגויים" : error.message); return; }
    if (data.session) nav({ to: "/admin" }); else toast.success("נשלח אליכם מייל לאימות החשבון");
  };
  return (
    <div className="min-h-screen bg-background bg-hero">
      <SiteHeader />
      <form onSubmit={submit} className="glass mx-auto mt-16 max-w-sm space-y-4 rounded-3xl p-8">
        <h1 className="font-display text-2xl font-bold text-primary">{mode === "in" ? "כניסת מנהל" : "יצירת חשבון מנהל"}</h1>
        <div className="space-y-1.5"><Label>אימייל</Label><Input dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>סיסמה</Label><Input dir="ltr" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {netError && (
          <div role="alert" className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-semibold text-destructive">לא הצלחנו להתחבר לשרת</p>
            <p className="text-muted-foreground">ייתכן שחיבור האינטרנט חלש, או ש-VPN / סינון אינטרנט חוסם את הגישה. נסו לכבות אותם לרגע או לעבור בין Wi‑Fi לנתונים סלולריים.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => submit()} disabled={loading}>נסו שוב</Button>
          </div>
        )}
        <Button className="w-full" disabled={loading}>{loading ? "מתחבר…" : mode === "in" ? "כניסה" : "הרשמה"}</Button>
        <button type="button" className="w-full text-sm text-accent" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "אין חשבון? הרשמה" : "יש חשבון? כניסה"}
        </button>
      </form>
    </div>
  );
}
