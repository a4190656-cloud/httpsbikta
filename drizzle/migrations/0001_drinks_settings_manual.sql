ALTER TABLE public.bookings
  ALTER COLUMN email SET DEFAULT '',
  ADD COLUMN duration_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN kind text NOT NULL DEFAULT 'booking',
  ADD COLUMN drinks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN drinks_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN payment_method text NOT NULL DEFAULT 'אשראי',
  ADD COLUMN source text NOT NULL DEFAULT 'online',
  ADD COLUMN paid_at timestamptz;
UPDATE public.bookings SET duration_hours = hours;
COMMENT ON COLUMN public.bookings.hours IS 'DEPRECATED: replaced by duration_hours';
COMMENT ON COLUMN public.bookings.access_code IS 'DEPRECATED: door codes no longer issued';

CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hourly_rate numeric NOT NULL DEFAULT 40,
  drink_prices jsonb NOT NULL DEFAULT '{"can":6,"spring":6,"water":4,"soda":4}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settings" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.settings (id) SELECT 1;