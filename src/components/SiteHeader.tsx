import { Link } from "@tanstack/react-router";
import { Images } from "lucide-react";
import logo from "@/assets/bikta-logo.png.asset.json";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 glass !border-x-0 !border-t-0 !shadow-none">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="בקתה B" className="h-16 w-auto" />
        </Link>
        <nav className="flex items-center gap-3 text-sm text-muted-foreground sm:gap-5">
          <a href="tel:+972539000374" className="hover:text-foreground">צרו קשר</a>
          <a href="/#gallery" className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-2 font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
            <Images className="h-4 w-4" /> גלריית תמונות
          </a>
          <Link to="/admin" className="hover:text-foreground">ניהול</Link>
        </nav>
      </div>
    </header>
  );
}
