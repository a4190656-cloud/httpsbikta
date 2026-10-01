// Browser-only: reroute backend calls through our own domain (/api/public/sb)
// so network filters that block the backend domain don't break sign-in.
let installed = false;

export function installBackendProxy() {
  if (installed || typeof window === "undefined") return;
  const backend = (import.meta.env['VITE_SUPABASE_URL'] as string | undefined)?.replace(/\/$/, "");
  if (!backend) return;
  installed = true;
  const original = window.fetch.bind(window);
  const proxyBase = `${window.location.origin}/api/public/sb`;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(backend + "/")) {
      const rewritten = proxyBase + url.slice(backend.length);
      if (input instanceof Request) return original(new Request(rewritten, input), init);
      return original(rewritten, init);
    }
    return original(input, init);
  };
}

installBackendProxy();
