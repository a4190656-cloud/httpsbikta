ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS receipt_issued boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS sheet_tab text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS sheet_row integer;