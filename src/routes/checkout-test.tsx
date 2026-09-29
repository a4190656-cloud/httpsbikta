import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout-test")({
  head: () => ({ meta: [{ title: "תשלום (מצב בדיקה) — בקתה B" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ amount: Number(s["amount"]) || 0 }),
  component: TestCheckout,
});

function TestCheckout() {
  const { amount } = Route.useSearch();
  const send = (type: "success" | "cancel" | "error") => window.parent.postMessage({ source: "takbull", type }, window.location.origin);
  return (
    <div dir="rtl" className="min-h-screen bg-card p-6 font-sans">
      <div className="mb-4 rounded-lg bg-secondary p-3 text-center text-xs text-secondary-foreground">
        מצב בדיקה — לא יחויב כסף אמיתי. כאן יוטמע דף התשלום של תקבול.
      </div>
      <div className="flex items-center gap-2 text-lg font-bold"><CreditCard className="h-5 w-5" /> תשלום מאובטח</div>
      <p className="mt-1 text-3xl font-display font-bold text-primary">₪{amount.toFixed(2)}</p>
      <div className="mt-5 space-y-3">
        <input className="w-full rounded-md border border-input p-3" placeholder="4580 0000 0000 0000" defaultValue="4580 1234 5678 9012" />
        <div className="flex gap-3">
          <input className="w-1/2 rounded-md border border-input p-3" defaultValue="12/28" />
          <input className="w-1/2 rounded-md border border-input p-3" defaultValue="123" />
        </div>
      </div>
      <Button className="mt-6 h-12 w-full text-base" onClick={() => send("success")}><Lock className="h-4 w-4" /> שלם עכשיו</Button>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => send("cancel")}>ביטול</Button>
        <Button variant="ghost" className="flex-1 text-destructive" onClick={() => send("error")}>הדמיית כשל</Button>
      </div>
    </div>
  );
}
