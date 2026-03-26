-- Common query patterns: messages, sessions, payments, client programs, progress, audit.

CREATE INDEX IF NOT EXISTS idx_messages_workspace_client_created
  ON public.messages (workspace_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_read_at
  ON public.messages (recipient_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_scheduled_status
  ON public.sessions (workspace_id, scheduled_time)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_payments_workspace_payment_date
  ON public.payments (workspace_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_client_programs_client_status
  ON public.client_programs (client_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_program_progress_client_program_pair
  ON public.program_progress (client_id, client_program_id);
