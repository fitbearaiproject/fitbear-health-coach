-- Add fiber_g column to meal_logs table for complete macronutrient tracking
ALTER TABLE public.meal_logs ADD COLUMN fiber_g NUMERIC;