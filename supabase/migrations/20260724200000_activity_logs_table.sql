-- Activity Logs table for tracking all searches, imports, syncs, and errors in real time

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'completed',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  detail TEXT,
  source TEXT,
  products_count INTEGER,
  opportunities_count INTEGER,
  duration TEXT,
  error_code TEXT,
  stack_trace TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON public.activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON public.activity_logs(type);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_activity_logs" ON public.activity_logs;
CREATE POLICY "users_manage_own_activity_logs"
  ON public.activity_logs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
