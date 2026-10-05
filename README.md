# Bikta B Bookings

Build a premium, high-conversion hourly rental booking and payment platform in Hebrew (RTL) for "בקתה B" (Bikta B) - an atmospheric cabin with a private garden rented by the hour for clinics, studios, meetings, office work, and private gatherings.

Visual Identity & Design System (Extracted from the uploaded "Bikta B" logo):
- Brand Colors:
  - Primary Green: Deep Forest Green (#2D4A32 / #263E2B)
  - Earth Accent: Warm Rustic Wood Brown (#8C502E / #7B4425)
  - Background & Base: Warm Cream / Alabaster (#FDFBF7 / #FAF7F2) with crisp white cards
  - Text & Headings: Rich Deep Slate / Charcoal (#1C1E1B)
- Aesthetic & Feel: High-end "Rustic Modern" / "Boutique Hospitality" aesthetic. Elegant typography (Heebo/Rubik), generous whitespace, glassmorphism cards with fine warm borders, subtle organic shadows, and micro-interactions.
- Prominently feature the uploaded Bikta B logo in the sticky header and on confirmation receipts.

Framer Motion Animations:
- Staggered entrance animations for cards, badges, and features on load.
- Tactile spring physics (whileHover={{ scale: 1.02 }}, whileTap={{ scale: 0.98 }}) on slot cards, purpose selectors, and action buttons.
- Fluid AnimatedPresence transitions between booking steps.
- Explosive celebration animation upon successful payment: pulsing green & bronze concentric rings, checkmark badge, and confetti burst.

Core User Booking Flow (Hourly Space Rental):
1. Step 1 - Purpose & Usage Selection:
   - Visual selection chips/cards: "קליניקה" (Clinic), "סטודיו" (Studio), "משרד / עבודה שקטה" (Office), "פגישות והרצאות" (Meetings), "אחר" (Other).
   - Display a preview gallery badge highlighting the indoor cabin and private outdoor garden.

2. Step 2 - Date & Time Slot Selection (Hourly Logic):
   - Interactive calendar connected to Google Calendar.
   - Dynamic duration selector: 1 hour, 2 hours, 3 hours, half-day, or full-day block.
   - Interactive timeline / time slot picker showing available blocks, automatically calculating total price in ₪ based on selected duration.

3. Step 3 - Client Information & Details:
   - Inputs: Full Name, Phone (Israeli formatting), Email, Number of attendees, Special requests/notes.

4. Step 4 - Cancellation Policy & Embedded Takbull Checkout:
   - Notice badge: "ביטול ללא עלות מתאפשר עד 2 ימי עסקים לפני המועד בלבד."
   - Detailed breakdown: Base hourly rate × hours, Garden access included, VAT (מע"מ), Total.
   - Embedded Takbull (תקבול) iframe modal with blurred backdrop.
   - postMessage listener:
     - On 'success': Instantly record booking, reserve slot, trigger Google Calendar sync, and display celebration screen with access code / entry instructions.
     - On 'cancel'/'error': Gracefully dismiss with warm toast message.

Cancellation & Rescheduling Engine (Strict 2 Business Days Policy):
- Israeli Business Days calculation (excluding Fridays, Saturdays, and holidays).
- Unique secure client management token sent on booking confirmation screen and via email/SMS.
- If >= 2 full business days remaining: Client can cancel with one click; slot immediately frees up, Google Calendar event is deleted, and webhook signals refund/credit.
- If < 2 business days remaining: Cancellation button is disabled with notice: "מועד הביטול חלף (פחות מ-2 ימי עסקים). לתיאום חריג יש ליצור קשר ישירות עם המקום."

Google Calendar Two-Way Sync:
- Real-time availability fetch from Google Calendar to block overlapping reservations.
- Automatic creation of booking event upon payment: "השכרת בקתה B - [שם המזמין] ([מטרת ההשכרה])" with full contact details and duration.

Admin Management Dashboard:
- Timeline & Day/Week view of reservations.
- Quick block toggle for maintenance, private events, or owner use.
- Status filters: שולם, בוטל, ממתין.

Build with RTL-first layout, Tailwind CSS, Lucide icons, and accessible Radix/Shadcn primitives.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://httpsbikta.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/84ba6c3c-fce2-4a1b-aa31-929d8d20730c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
