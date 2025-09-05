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

    // Import IFCT 2017 data
    console.log('Fetching IFCT 2017 data...');
    const ifctResponse = await fetch('https://raw.githubusercontent.com/nodef/ifct2017/main/index.json');
    const ifctData = await ifctResponse.json();

    let importedCount = 0;

    for (const [foodCode, foodData] of Object.entries(ifctData)) {
      const food = foodData as any;
      
      // Skip if missing essential data
      if (!food.name || !food.energy) continue;

      const catalogKey = food.name.toLowerCase().replace(/\s+/g, '_');
      
      try {
        await supabase
          .from('dish_catalog')
          .upsert({
            name: food.name,
            catalog_key: catalogKey,
            kcal: food.energy || 0,
            protein_g: food.protein || 0,
            carbs_g: food.carbohydrate || 0,
            fat_g: food.fat || 0,
            fiber_g: food.fiber || null,
            sugar_g: food.sugars || null,
            sodium_mg: food.sodium ? food.sodium * 1000 : null, // Convert g to mg
            confidence_level: 'HIGH',
            data_source: 'IFCT',
            portion_weight_g: 100, // IFCT data is per 100g
            vitamin_c_mg: food.vitaminC || null,
            iron_mg: food.iron || null,
            calcium_mg: food.calcium || null,
            cuisine: 'Indian',
            default_serving: '100g'
          }, {
            onConflict: 'catalog_key'
          });

        importedCount++;
        
        if (importedCount % 50 === 0) {
          console.log(`Imported ${importedCount} IFCT entries...`);
        }
      } catch (error) {
        console.error(`Error importing IFCT food ${food.name}:`, error);
      }
    }

    console.log(`Successfully imported ${importedCount} IFCT 2017 entries`);

    // Import INDB data (CSV format)
    console.log('Fetching INDB data...');
    const indbResponse = await fetch('https://raw.githubusercontent.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/main/data/INDB_version1.csv');
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
      message: `Successfully imported ${importedCount} IFCT and ${indbImported} INDB entries`,
      ifct_count: importedCount,
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