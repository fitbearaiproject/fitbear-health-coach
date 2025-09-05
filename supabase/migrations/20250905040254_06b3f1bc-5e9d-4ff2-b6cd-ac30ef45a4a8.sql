-- Update existing entries to have baseline confidence if not set
UPDATE dish_catalog 
SET confidence_level = 'MEDIUM', 
    data_source = 'AI_ESTIMATED',
    last_verified = now()
WHERE confidence_level IS NULL;

-- Create indexes for faster lookups (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_dish_catalog_usda_fdc_id ON dish_catalog(usda_fdc_id);
CREATE INDEX IF NOT EXISTS idx_dish_catalog_confidence ON dish_catalog(confidence_level, data_source);
CREATE INDEX IF NOT EXISTS idx_dish_catalog_name_search ON dish_catalog USING gin(to_tsvector('english', name));