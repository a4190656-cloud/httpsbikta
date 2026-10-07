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
- Google Calendar is accessed only from src/lib/gcal.server.ts via the connector gateway; opening the admin calendar pulls linked-event moves/deletions back into bookings — single integration point, calendar edits stay in sync.
- Payments are direct/offline only; confirmation contact actions are customer-initiated WhatsApp/mailto links — no automatic navigation or card processor is used.
- Shared customer reminders, token-link display and contact actions live in BookingConfirmationDetails — cabin and drinks confirmations remain consistent.
- DrinksAdminPanel reuses the booking ledger and admin write functions; drinks-only amounts use the recorded total and combined revenue counts each booking once — cash records stay synchronized without a duplicate ledger.
- First signed-in user auto-becomes admin (bootstrap in getAdminStatus) — owner setup without manual SQL.
- Customer review screenshots use the private `customer-reviews` bucket and a same-origin public image route that exposes visible review IDs only; only admins manage metadata and files — works on filtered networks without public storage permissions.

- Admin server functions use requireAdmin (src/lib/admin-auth.ts): signed-in admin bearer OR HMAC-signed HttpOnly PIN cookie from /api/admin-verify (ADMIN_ACCESS_KEY) — emergency access when the auth service is blocked by network filters.
- Browser backend calls are rewritten to the same-origin proxy /api/public/sb/* (src/lib/backend-proxy.ts) — bypasses filters that block the backend domain.
- Sheet sync is two-way: site changes write to the booking's sheet row (syncSheet); opening the admin ledger/calendar imports the month tab back (importSheetMonth) — edited rows update bookings, new rows become kind "sheet" bookings, cleared rows cancel. Keeps sheet edits visible on the site.
- Every customer payment method locks the slot immediately with status pending; administrators mark payment and receipt status in the ledger.
