import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Admin access: either a signed-in admin (bearer token) or a valid
// emergency PIN session cookie issued by /api/admin-verify.
export const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const { PIN_COOKIE, readCookie, verifyPinToken } = await import("./admin-pin.server");
  if (verifyPinToken(readCookie(request?.headers.get("cookie") ?? null, PIN_COOKIE))) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return next({ context: { supabase: supabaseAdmin as any, userId: null as string | null, pin: true } });
  }

  const auth = request?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized");
  const url = process.env["SUPABASE_URL"]!;
  const pk = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, pk, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (pk.startsWith("sb_") && h.get("Authorization") === `Bearer ${pk}`) h.delete("Authorization");
        h.set("apikey", pk);
        return fetch(input, { ...init, headers: h });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized");
  return next({ context: { supabase: supabase as any, userId: data.claims.sub as string | null, pin: false } });
});
