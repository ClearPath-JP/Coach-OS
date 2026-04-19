-- Allow 'founding' as a valid plan in the subscriptions table
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'founding', 'starter', 'pro', 'scale'));
