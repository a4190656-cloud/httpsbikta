<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Booking writes go through server functions in src/lib/bookings.functions.ts using the admin client; tables have no public policies — keeps customer data private.
- Customers manage bookings via an unguessable manage_token link, no login — fast checkout.
- Google Calendar is accessed only from src/lib/gcal.server.ts via the connector gateway — single integration point.
- Payment is TEST MODE: /checkout-test posts `{source:"takbull", type}` to the parent; swap for the real Takbull iframe + verified server callback when credentials exist.
- First signed-in user auto-becomes admin (bootstrap in getAdminStatus) — owner setup without manual SQL.
- Customer review screenshots use the private `customer-reviews` bucket and signed URLs; only admins manage metadata and files — public viewers never receive storage permissions.

- Admin server functions use requireAdmin (src/lib/admin-auth.ts): signed-in admin bearer OR HMAC-signed HttpOnly PIN cookie from /api/admin-verify (ADMIN_ACCESS_KEY) — emergency access when the auth service is blocked by network filters.
- Browser backend calls are rewritten to the same-origin proxy /api/public/sb/* (src/lib/backend-proxy.ts) — bypasses filters that block the backend domain.
