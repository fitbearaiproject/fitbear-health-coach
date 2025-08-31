-- Step 3: Performance Advisor indexes for meal_logs and chat_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meal_logs_user_time 
ON meal_logs (user_id, meal_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_logs_user_created 
ON chat_logs (user_id, created_at DESC);

-- Step 5: Water intake/hydration logging table
CREATE TABLE IF NOT EXISTS hydration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cups INTEGER NOT NULL DEFAULT 1,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE hydration_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for hydration_logs
CREATE POLICY "hydration_logs_select_own" 
ON hydration_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "hydration_logs_insert_own" 
ON hydration_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hydration_logs_update_own" 
ON hydration_logs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "hydration_logs_delete_own" 
ON hydration_logs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Index for hydration queries
CREATE INDEX IF NOT EXISTS idx_hydration_logs_user_date 
ON hydration_logs (user_id, log_date DESC);