-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS public.meal_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own meal logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meal_logs' AND policyname = 'meal_logs_update_own'
  ) THEN
    CREATE POLICY "meal_logs_update_own"
    ON public.meal_logs
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Allow users to delete their own meal logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meal_logs' AND policyname = 'meal_logs_delete_own'
  ) THEN
    CREATE POLICY "meal_logs_delete_own"
    ON public.meal_logs
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;