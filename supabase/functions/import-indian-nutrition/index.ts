import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    console.log('Starting Indian nutrition data import...');

    // Import IFCT 2017 data from NPM package data
    console.log('Fetching IFCT 2017 data from npmjs CDN...');
    const ifctResponse = await fetch('https://unpkg.com/@ifct2017/compositions@latest/compositions.csv');
    const ifctCsv = await ifctResponse.text();
    
    // Parse IFCT CSV
    const ifctLines = ifctCsv.split('\n');
    const ifctHeaders = ifctLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let ifctImported = 0;

    for (let i = 1; i < ifctLines.length; i++) {
      const line = ifctLines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const food: any = {};
      
      ifctHeaders.forEach((header, index) => {
        food[header] = values[index] || '';
      });

      // Skip if missing essential data
      if (!food.name || !food.energy) continue;

      const catalogKey = food.name.toLowerCase().replace(/\s+/g, '_');
      
      try {
        await supabase
          .from('dish_catalog')
          .upsert({
            name: food.name,
            catalog_key: catalogKey,
            kcal: parseFloat(food.energy) || 0,
            protein_g: parseFloat(food.protein) || 0,
            carbs_g: parseFloat(food.carbohydrates) || 0,
            fat_g: parseFloat(food.fat) || 0,
            fiber_g: parseFloat(food.fiber) || null,
            sugar_g: parseFloat(food.sugars) || null,
            sodium_mg: parseFloat(food.sodium) ? parseFloat(food.sodium) * 1000 : null, // Convert g to mg
            confidence_level: 'HIGH',
            data_source: 'IFCT',
            portion_weight_g: 100, // IFCT data is per 100g
            vitamin_c_mg: parseFloat(food.vitamin_c) || null,
            iron_mg: parseFloat(food.iron) || null,
            calcium_mg: parseFloat(food.calcium) || null,
            cuisine: 'Indian',
            default_serving: '100g'
          }, {
            onConflict: 'catalog_key'
          });

        ifctImported++;
        
        if (ifctImported % 50 === 0) {
          console.log(`Imported ${ifctImported} IFCT entries...`);
        }
      } catch (error) {
        console.error(`Error importing IFCT food ${food.name}:`, error);
      }
    }

    console.log(`Successfully imported ${ifctImported} IFCT 2017 entries`);

    // Import INDB data from GitHub raw file
    console.log('Fetching INDB data...');
    const indbResponse = await fetch('https://raw.githubusercontent.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/main/INDB_version1.csv');
    const indbCsv = await indbResponse.text();
    
    // Parse CSV
    const lines = indbCsv.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    let indbImported = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const recipe: any = {};
      
      headers.forEach((header, index) => {
        recipe[header] = values[index] || '';
      });

      if (!recipe.recipe_name || !recipe.energy_kcal_100g) continue;

      const catalogKey = recipe.recipe_name.toLowerCase().replace(/\s+/g, '_');
      
      try {
        await supabase
          .from('dish_catalog')
          .upsert({
            name: recipe.recipe_name,
            catalog_key: catalogKey,
            kcal: parseFloat(recipe.energy_kcal_100g) || 0,
            protein_g: parseFloat(recipe.protein_g_100g) || 0,
            carbs_g: parseFloat(recipe.carbohydrate_g_100g) || 0,
            fat_g: parseFloat(recipe.fat_g_100g) || 0,
            fiber_g: parseFloat(recipe.fiber_g_100g) || null,
            sugar_g: parseFloat(recipe.sugar_g_100g) || null,
            sodium_mg: parseFloat(recipe.sodium_mg_100g) || null,
            confidence_level: 'HIGH',
            data_source: 'INDB',
            portion_weight_g: 100,
            vitamin_c_mg: parseFloat(recipe.vitamin_c_mg_100g) || null,
            iron_mg: parseFloat(recipe.iron_mg_100g) || null,
            calcium_mg: parseFloat(recipe.calcium_mg_100g) || null,
            cuisine: 'Indian',
            default_serving: '100g'
          }, {
            onConflict: 'catalog_key'
          });

        indbImported++;
        
        if (indbImported % 50 === 0) {
          console.log(`Imported ${indbImported} INDB entries...`);
        }
      } catch (error) {
        console.error(`Error importing INDB recipe ${recipe.recipe_name}:`, error);
      }
    }

    console.log(`Successfully imported ${indbImported} INDB entries`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully imported ${ifctImported} IFCT and ${indbImported} INDB entries`,
      ifct_count: ifctImported,
      indb_count: indbImported
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});