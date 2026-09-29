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
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) nav({ to: "/admin" }); else toast.success("נשלח אליכם מייל לאימות החשבון");
  };
  return (
    <div className="min-h-screen bg-background bg-hero">
      <SiteHeader />
      <form onSubmit={submit} className="glass mx-auto mt-16 max-w-sm space-y-4 rounded-3xl p-8">
        <h1 className="font-display text-2xl font-bold text-primary">{mode === "in" ? "כניסת מנהל" : "יצירת חשבון מנהל"}</h1>
        <div className="space-y-1.5"><Label>אימייל</Label><Input dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>סיסמה</Label><Input dir="ltr" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" disabled={loading}>{mode === "in" ? "כניסה" : "הרשמה"}</Button>
        <button type="button" className="w-full text-sm text-accent" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "אין חשבון? הרשמה" : "יש חשבון? כניסה"}
        </button>
      </form>
    </div>
  );
}
