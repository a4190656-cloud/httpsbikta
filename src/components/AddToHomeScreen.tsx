import { useEffect, useState } from "react";
import { Download, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function AddToHomeScreen() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const nav = navigator as Navigator & { standalone?: boolean };
    setInstalled(standalone.matches || nav.standalone === true);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setOpen(false); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function install() {
    if (!prompt) { setOpen(true); return; }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch { setOpen(true); }
    finally { setPrompt(null); }
  }
  if (installed) return null;
  return (
    <>
      <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={install}>
        <Download className="h-4 w-4" />הוסף למסך הבית
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-md">
          <DialogTitle className="pt-3 text-right font-display">בקתה B במסך הבית</DialogTitle>
          <DialogDescription className="text-right">
            {ios ? "פתחו את האתר ב-Safari, לחצו על כפתור השיתוף ובחרו ״הוסף למסך הבית״." : "פתחו את האתר ב-Chrome או Edge. בתפריט הדפדפן בחרו ״הוסף למסך הבית״ או ״התקנת אפליקציה״ ואשרו."}
          </DialogDescription>
          <div className="flex items-center gap-3 border-t pt-4 text-sm text-primary">
            {ios ? <Share className="h-5 w-5 shrink-0" /> : <Download className="h-5 w-5 shrink-0" />}
            <span>{ios ? "שיתוף" : "תפריט הדפדפן"}</span><span aria-hidden>←</span><PlusSquare className="h-5 w-5 shrink-0" /><span>הוסף למסך הבית</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}