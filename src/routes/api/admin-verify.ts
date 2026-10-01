import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const body = z.object({ pin: z.string().min(1).max(128) });

function cookie(value: string, maxAge: number) {
  return `bikta_admin_pin=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export const Route = createFileRoute("/api/admin-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkPin, issuePinToken, PIN_TTL_SEC } = await import("@/lib/admin-pin.server");
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
        if (!process.env["ADMIN_ACCESS_KEY"]) return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
        if (!checkPin(parsed.data.pin)) {
          await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
          return Response.json({ ok: false }, { status: 401 });
        }
        return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie(issuePinToken(), PIN_TTL_SEC), "Cache-Control": "no-store" } });
      },
      DELETE: async () =>
        Response.json({ ok: true }, { headers: { "Set-Cookie": cookie("", 0) } }),
    },
  },
});
