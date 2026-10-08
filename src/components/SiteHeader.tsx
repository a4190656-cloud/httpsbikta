import { Link } from "@tanstack/react-router";
import { Images } from "lucide-react";
import logo from "@/assets/bikta-logo.png.asset.json";
import { AddToHomeScreen } from "@/components/AddToHomeScreen";

export function SiteHeader() {
  return (
    <header className="pointer-events-none sticky top-0 z-40 pb-[84px] sm:pb-[88px]">
      <div className="glass pointer-events-auto !border-x-0 !border-t-0 !shadow-none">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:h-20 sm:px-5">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo.url} alt="בקתה B" className="h-12 w-auto sm:h-16" />
          </Link>
          <nav className="flex items-center gap-2 text-sm text-muted-foreground sm:gap-5">
            <a href="tel:+972539000374" className="hover:text-foreground">צרו קשר</a>
            <a href="/#gallery" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:px-3 sm:py-2 sm:text-sm">
              <Images className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> גלריית תמונות
            </a>
            <Link to="/admin" className="hover:text-foreground">ניהול</Link>
          </nav>
        </div>
      </div>
      <div className="pointer-events-auto absolute left-3 top-16 sm:left-5 sm:top-20">
        <div className="glass rounded-b-[24px] !border-x-0 !border-t-0 !shadow-none px-3 pb-2 pt-0.5 shadow-[0_14px_30px_-20px] shadow-primary/40">
          <AddToHomeScreen />
        </div>
      </div>
    </header>
  );
}
