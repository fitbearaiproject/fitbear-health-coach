-- Add diagnostics columns to chat_logs
ALTER TABLE public.chat_logs
ADD COLUMN IF NOT EXISTS message_id TEXT,
ADD COLUMN IF NOT EXISTS prompt_len INTEGER,
ADD COLUMN IF NOT EXISTS response_len INTEGER,
ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS model TEXT;

-- Helpful index for querying recent logs per user
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_created ON public.chat_logs (user_id, created_at DESC);
