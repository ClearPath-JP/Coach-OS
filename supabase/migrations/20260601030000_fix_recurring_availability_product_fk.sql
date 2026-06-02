-- Fix a pre-existing broken FK: recurring_availability.session_product_id referenced the
-- legacy/empty `session_products` table, but the entire app uses `session_packages`
-- (packages, invoices, class booking, the new Classes feature). No existing slot set
-- session_product_id, so nothing tripped it until the Classes overhaul started linking
-- slots to their package. Re-point the FK at the table the app actually uses.

ALTER TABLE public.recurring_availability
  DROP CONSTRAINT IF EXISTS recurring_availability_session_product_id_fkey;

ALTER TABLE public.recurring_availability
  ADD CONSTRAINT recurring_availability_session_product_id_fkey
  FOREIGN KEY (session_product_id) REFERENCES public.session_packages(id) ON DELETE SET NULL;
