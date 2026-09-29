import { Link } from "@tanstack/react-router";
import logo from "@/assets/bikta-logo.png.asset.json";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 glass !border-x-0 !border-t-0 !shadow-none">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="בקתה B" className="h-14 w-auto" />
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <a href="tel:" className="hidden sm:inline hover:text-foreground">צרו קשר</a>
          <Link to="/admin" className="hover:text-foreground">ניהול</Link>
        </nav>
      </div>
    </header>
  );
}
