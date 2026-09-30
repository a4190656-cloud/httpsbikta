CREATE TABLE public.customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  title text,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_reviews TO authenticated;
GRANT ALL ON public.customer_reviews TO service_role;

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage customer reviews"
ON public.customer_reviews
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload review screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'customer-reviews' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read review screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'customer-reviews' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update review screenshots"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'customer-reviews' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'customer-reviews' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete review screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'customer-reviews' AND public.has_role(auth.uid(), 'admin'));