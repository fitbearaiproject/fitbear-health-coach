import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

interface NutritionRequest {
  dish_name: string;
  portion?: string;
  cuisine?: string;
}

interface NutritionResponse {
  dish_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  data_source: 'IFCT' | 'USDA' | 'USER_VERIFIED' | 'AI_ESTIMATED';
  portion_weight_g: number | null;
  micronutrients?: {
    vitamin_c_mg?: number;
    iron_mg?: number;
    calcium_mg?: number;
  };
  catalog_key?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dish_name, portion, cuisine } = await req.json() as NutritionRequest;
    
    if (!dish_name) {
      throw new Error('dish_name is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const usdaApiKey = Deno.env.get('USDA_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    console.log(`Looking up nutrition for: "${dish_name}"`);

    // Step 1: Exact match in dish_catalog (prioritize IFCT/INDB for Indian foods)
    const { data: exactMatch } = await supabase
      .from('dish_catalog')
      .select('*')
      .ilike('name', dish_name)
      .order('confidence_level', { ascending: false })
      .order('data_source', { ascending: false }) // IFCT/INDB before USDA
      .limit(1)
      .maybeSingle();

    if (exactMatch && (exactMatch.confidence_level === 'HIGH' || exactMatch.data_source === 'IFCT' || exactMatch.data_source === 'INDB')) {
      console.log(`Found HIGH confidence exact match for: ${dish_name} (${exactMatch.data_source})`);
      return new Response(JSON.stringify({
        dish_name: exactMatch.name,
        kcal: exactMatch.kcal || 0,
        protein_g: exactMatch.protein_g || 0,
        carbs_g: exactMatch.carbs_g || 0,
        fat_g: exactMatch.fat_g || 0,
        fiber_g: exactMatch.fiber_g,
        sugar_g: exactMatch.sugar_g,
        sodium_mg: exactMatch.sodium_mg,
        confidence_level: exactMatch.confidence_level,
        data_source: exactMatch.data_source,
        portion_weight_g: exactMatch.portion_weight_g,
        micronutrients: {
          vitamin_c_mg: exactMatch.vitamin_c_mg,
          iron_mg: exactMatch.iron_mg,
          calcium_mg: exactMatch.calcium_mg
        },
        catalog_key: exactMatch.catalog_key
      } as NutritionResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Fuzzy search in dish_catalog and synonyms (prioritize Indian sources)
    const { data: fuzzyMatches } = await supabase
      .from('dish_catalog')
      .select('*')
      .or(`name.ilike.%${dish_name}%,catalog_key.ilike.%${dish_name.replace(/\s+/g, '_').toLowerCase()}%`)
      .order('data_source', { ascending: false }) // IFCT/INDB first
      .order('confidence_level', { ascending: false })
      .limit(5);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      // Prefer Indian sources (IFCT/INDB) over USDA for Indian context
      const bestMatch = fuzzyMatches.find(m => m.data_source === 'IFCT' || m.data_source === 'INDB') || fuzzyMatches[0];
      
      if (bestMatch.confidence_level === 'HIGH' || bestMatch.confidence_level === 'MEDIUM' || 
          bestMatch.data_source === 'IFCT' || bestMatch.data_source === 'INDB') {
        console.log(`Found fuzzy match for: ${dish_name} -> ${bestMatch.name} (${bestMatch.data_source})`);
        return new Response(JSON.stringify({
          dish_name: bestMatch.name,
          kcal: bestMatch.kcal || 0,
          protein_g: bestMatch.protein_g || 0,
          carbs_g: bestMatch.carbs_g || 0,
          fat_g: bestMatch.fat_g || 0,
          fiber_g: bestMatch.fiber_g,
          sugar_g: bestMatch.sugar_g,
          sodium_mg: bestMatch.sodium_mg,
          confidence_level: bestMatch.data_source === 'IFCT' || bestMatch.data_source === 'INDB' ? 'HIGH' : 'MEDIUM',
          data_source: bestMatch.data_source,
          portion_weight_g: bestMatch.portion_weight_g,
          micronutrients: {
            vitamin_c_mg: bestMatch.vitamin_c_mg,
            iron_mg: bestMatch.iron_mg,
            calcium_mg: bestMatch.calcium_mg
          },
          catalog_key: bestMatch.catalog_key
        } as NutritionResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Step 3: USDA API lookup
    console.log(`Searching USDA database for: "${dish_name}"`);
    
    const usdaSearchResponse = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${usdaApiKey}&query=${encodeURIComponent(dish_name)}&pageSize=5&dataType=Foundation,SR%20Legacy`
    );

    if (!usdaSearchResponse.ok) {
      console.warn(`USDA API error: ${usdaSearchResponse.status}`);
    } else {
      const usdaData = await usdaSearchResponse.json();
      
      if (usdaData.foods && usdaData.foods.length > 0) {
        const bestFood = usdaData.foods[0];
        
        // Extract nutrition data from USDA response
        const nutrients = bestFood.foodNutrients || [];
        const getNutrient = (id: number) => {
          const nutrient = nutrients.find((n: any) => n.nutrientId === id);
          return nutrient ? Number(nutrient.value) : null;
        };

        const nutritionData: NutritionResponse = {
          dish_name: bestFood.description || dish_name,
          kcal: getNutrient(1008) || 0, // Energy
          protein_g: getNutrient(1003) || 0, // Protein
          carbs_g: getNutrient(1005) || 0, // Carbohydrates
          fat_g: getNutrient(1004) || 0, // Total fat
          fiber_g: getNutrient(1079), // Fiber
          sugar_g: getNutrient(2000), // Sugars
          sodium_mg: getNutrient(1093), // Sodium
          confidence_level: 'HIGH',
          data_source: 'USDA',
          portion_weight_g: 100, // USDA data is per 100g
          micronutrients: {
            vitamin_c_mg: getNutrient(1162),
            iron_mg: getNutrient(1089),
            calcium_mg: getNutrient(1087)
          }
        };

        // Cache in our database
        const catalogKey = dish_name.replace(/\s+/g, '_').toLowerCase();
        await supabase
          .from('dish_catalog')
          .upsert({
            name: nutritionData.dish_name,
            catalog_key: catalogKey,
            kcal: nutritionData.kcal,
            protein_g: nutritionData.protein_g,
            carbs_g: nutritionData.carbs_g,
            fat_g: nutritionData.fat_g,
            fiber_g: nutritionData.fiber_g,
            sugar_g: nutritionData.sugar_g,
            sodium_mg: nutritionData.sodium_mg,
            confidence_level: 'HIGH',
            data_source: 'USDA',
            usda_fdc_id: bestFood.fdcId,
            portion_weight_g: 100,
            vitamin_c_mg: nutritionData.micronutrients?.vitamin_c_mg,
            iron_mg: nutritionData.micronutrients?.iron_mg,
            calcium_mg: nutritionData.micronutrients?.calcium_mg,
            cuisine: cuisine || 'International',
            default_serving: '100g'
          });

        console.log(`Successfully found and cached USDA data for: ${dish_name}`);
        nutritionData.catalog_key = catalogKey;
        
        return new Response(JSON.stringify(nutritionData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Step 4: Return low confidence with conservative estimates
    console.log(`No authoritative data found for: ${dish_name}, returning conservative estimate`);
    
    return new Response(JSON.stringify({
      dish_name,
      kcal: 200, // Conservative estimate
      protein_g: 10,
      carbs_g: 20,
      fat_g: 8,
      fiber_g: 3,
      sugar_g: null,
      sodium_mg: null,
      confidence_level: 'LOW',
      data_source: 'AI_ESTIMATED',
      portion_weight_g: null
    } as NutritionResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Nutrition lookup error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      confidence_level: 'LOW'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});