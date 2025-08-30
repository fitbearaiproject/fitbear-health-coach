-- Enable RLS on tables that don't have it enabled
ALTER TABLE public.dish_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;

-- Create appropriate RLS policies for the dish catalog (publicly readable since it's reference data)
CREATE POLICY "dish_catalog_read_all" ON public.dish_catalog FOR SELECT USING (true);
CREATE POLICY "dish_synonyms_read_all" ON public.dish_synonyms FOR SELECT USING (true);

-- Nudges should be user-specific
CREATE POLICY "nudges_select_own" ON public.nudges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nudges_insert_own" ON public.nudges FOR INSERT WITH CHECK (auth.uid() = user_id);