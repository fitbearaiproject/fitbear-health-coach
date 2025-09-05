import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ClarificationRequest {
  dish_name: string;
  user_clarification: string;
  original_analysis: {
    name: string;
    portion: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    description: string;
    confidence_level: string;
  };
  bps_profile: any;
}

interface ClarifiedDish {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  description: string;
  coach_note: string;
  flags: string[];
  confidence_level: string;
  data_source: string;
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
    const requestData: ClarificationRequest = await req.json();
    const startTime = Date.now();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');

    if (!supabaseUrl || !supabaseKey || !googleApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔍 Processing clarification for: ${requestData.dish_name}`);

    // First try to get nutrition from database with clarification context
    const lookupResult = await supabase.functions.invoke('nutrition-lookup', {
      body: { 
        dish_name: `${requestData.dish_name} ${requestData.user_clarification}`,
        portion: requestData.original_analysis.portion,
        cuisine: requestData.bps_profile.cuisines?.[0] || 'indian'
      }
    });

    let clarifiedDish: ClarifiedDish;

    if (lookupResult.data && lookupResult.data.confidence_level === 'HIGH') {
      // Use database result if high confidence
      const nutrition = lookupResult.data;
      clarifiedDish = {
        name: requestData.dish_name,
        portion: requestData.original_analysis.portion,
        kcal: Math.round(nutrition.kcal),
        protein_g: Math.round(nutrition.protein_g * 10) / 10,
        carbs_g: Math.round(nutrition.carbs_g * 10) / 10,
        fat_g: Math.round(nutrition.fat_g * 10) / 10,
        fiber_g: Math.round(nutrition.fiber_g * 10) / 10,
        sugar_g: Math.round(nutrition.sugar_g * 10) / 10,
        description: `${requestData.original_analysis.description} (clarified based on your input)`,
        coach_note: `Based on your clarification: "${requestData.user_clarification}", this analysis has been updated with more accurate nutrition data.`,
        flags: ['clarified', 'database'],
        confidence_level: 'HIGH',
        data_source: nutrition.data_source
      };
    } else {
      // Use AI to re-analyze with clarification
      const prompt = `
      You are a nutrition expert. A user has provided clarification about a food item that was initially analyzed with ${requestData.original_analysis.confidence_level} confidence.

      Original Analysis:
      - Dish: ${requestData.original_analysis.name}
      - Portion: ${requestData.original_analysis.portion}
      - Description: ${requestData.original_analysis.description}
      - Original Calories: ${requestData.original_analysis.kcal}
      - Original Macros: P${requestData.original_analysis.protein_g}g C${requestData.original_analysis.carbs_g}g F${requestData.original_analysis.fat_g}g

      User Clarification: "${requestData.user_clarification}"

      User Profile Context:
      - Diet: ${requestData.bps_profile.diet_type || 'omnivore'}
      - Cuisines: ${requestData.bps_profile.cuisines?.join(', ') || 'indian'}
      - Health Goals: ${requestData.bps_profile.health_goals || 'general wellness'}

      Based on this clarification, provide an updated nutritional analysis. Return ONLY valid JSON in this format:
      {
        "kcal": number,
        "protein_g": number,
        "carbs_g": number,
        "fat_g": number,
        "fiber_g": number,
        "sugar_g": number,
        "updated_description": "string",
        "coach_note": "string acknowledging the clarification and explaining the updated analysis",
        "confidence_improvement": "HIGH|MEDIUM"
      }
      `;

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
          }
        })
      });

      const geminiData = await geminiResponse.json();
      const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) throw new Error('No response from AI');

      // Parse AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid AI response format');

      const updatedNutrition = JSON.parse(jsonMatch[0]);

      clarifiedDish = {
        name: requestData.dish_name,
        portion: requestData.original_analysis.portion,
        kcal: Math.round(updatedNutrition.kcal),
        protein_g: Math.round(updatedNutrition.protein_g * 10) / 10,
        carbs_g: Math.round(updatedNutrition.carbs_g * 10) / 10,
        fat_g: Math.round(updatedNutrition.fat_g * 10) / 10,
        fiber_g: Math.round(updatedNutrition.fiber_g * 10) / 10,
        sugar_g: Math.round(updatedNutrition.sugar_g * 10) / 10,
        description: updatedNutrition.updated_description,
        coach_note: updatedNutrition.coach_note,
        flags: ['clarified', 'ai_updated'],
        confidence_level: updatedNutrition.confidence_improvement,
        data_source: 'AI_CLARIFIED'
      };
    }

    const latencyMs = Date.now() - startTime;

    console.log(`✅ Clarification complete for ${requestData.dish_name}: ${clarifiedDish.confidence_level} confidence`);

    return new Response(
      JSON.stringify({
        success: true,
        clarified_dish: clarifiedDish,
        latency_ms: latencyMs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Clarification error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});