-- Add confidence and source tracking to dish_catalog
ALTER TABLE dish_catalog 
ADD COLUMN confidence_level TEXT CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW')),
ADD COLUMN data_source TEXT CHECK (data_source IN ('IFCT', 'USDA', 'USER_VERIFIED', 'AI_ESTIMATED')),
ADD COLUMN last_verified TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN fiber_g NUMERIC,
ADD COLUMN sugar_g NUMERIC,
ADD COLUMN sodium_mg NUMERIC,
ADD COLUMN usda_fdc_id INTEGER,
ADD COLUMN portion_weight_g NUMERIC;

-- Add micronutrients for enhanced nutrition tracking
ALTER TABLE dish_catalog 
ADD COLUMN vitamin_c_mg NUMERIC,
ADD COLUMN iron_mg NUMERIC,
ADD COLUMN calcium_mg NUMERIC,
ADD COLUMN vitamin_d_mcg NUMERIC,
ADD COLUMN folate_mcg NUMERIC;

-- Update existing entries to have baseline confidence
UPDATE dish_catalog 
SET confidence_level = 'MEDIUM', 
    data_source = 'AI_ESTIMATED',
    last_verified = now()
WHERE confidence_level IS NULL;

-- Create indexes for faster lookups
CREATE INDEX idx_dish_catalog_usda_fdc_id ON dish_catalog(usda_fdc_id);
CREATE INDEX idx_dish_catalog_confidence ON dish_catalog(confidence_level, data_source);
CREATE INDEX idx_dish_catalog_name_search ON dish_catalog USING gin(to_tsvector('english', name));