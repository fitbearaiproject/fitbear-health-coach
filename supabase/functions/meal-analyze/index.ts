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

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { image_data, user_id } = await req.json();
    
    if (!image_data || !user_id) {
      throw new Error('Image data and user_id are required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, targets(*)')
      .eq('user_id', user_id)
      .maybeSingle();

    // Build context from user profile
    let userContext = "User Profile: ";
    if (profile) {
      userContext += `Diet: ${profile.diet_type || 'Not specified'}, `;
      userContext += `Activity Level: ${profile.activity_level || 'Not specified'}, `;
      userContext += `Health Goals: ${profile.health_goals || 'Not specified'}, `;
      userContext += `Conditions: ${profile.conditions ? JSON.stringify(profile.conditions) : 'None'}. `;
      
      if (profile.targets) {
        userContext += `Targets: Calories: ${profile.targets.calories_per_day || 'Not set'}, `;
        userContext += `Protein: ${profile.targets.protein_g || 'Not set'}g. `;
      }
    }

    // System prompt for meal analysis
    const systemPrompt = `You are Coach C, analyzing a meal photo for nutrition tracking.

Analyze this meal image and detect all visible food items with their estimated portions and nutrition.

For each dish/item detected, provide:
- Name (in everyday Indian terms)
- Portion size (using Indian household units: katori, roti count/diameter, ladle, handful, etc.)
- Estimated calories
- Macros (protein/carbs/fat in grams)
- Health flags (high-protein, high-fiber, fried, sugary, etc.)

${userContext}

Consider user's dietary preferences and health conditions.
Be practical and realistic with portion estimates.
If multiple items look similar, group them as one entry.

Return as JSON:
{
  "dishes": [
    {
      "name": "Dal Tadka",
      "portion": "1 katori (150ml)",
      "kcal": 120,
      "protein_g": 8,
      "carbs_g": 18,
      "fat_g": 3,
      "flags": ["high-protein", "comfort-food"]
    }
  ],
  "total_kcal": 000,
  "meal_notes": "Brief overall assessment of the meal's healthiness",
  "portion_confidence": "high/medium/low"
}`;

    // Call Gemini API with image
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${Deno.env.get('GOOGLE_API_KEY')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { 
                inline_data: {
                  mime_type: "image/jpeg",
                  data: image_data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1536,
        }
      }),
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || !geminiData.candidates[0]) {
      throw new Error('No response from Gemini');
    }

    const rawResponse = geminiData.candidates[0].content.parts[0].text;
    
    // Parse JSON response
    let parsedData;
    try {
      // Extract JSON from response if wrapped in markdown
      const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/) || rawResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : rawResponse;
      parsedData = JSON.parse(jsonString);
    } catch (parseError) {
      // Fallback: return raw response if JSON parsing fails
      parsedData = {
        dishes: [],
        total_kcal: 0,
        meal_notes: rawResponse,
        portion_confidence: "low",
        parsing_error: true
      };
    }

    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        request_id: requestId,
        analysis: parsedData,
        model: 'gemini-2.0-flash-exp',
        latency_ms: latencyMs,
        user_context: userContext
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meal-analyze function:', error);
    const latencyMs = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        request_id: requestId,
        latency_ms: latencyMs,
        error_class: error.message.includes('API key') || error.message.includes('auth') ? 'Auth' :
                     error.message.includes('429') ? 'RateLimit' :
                     error.message.includes('network') || error.message.includes('fetch') ? 'Network' :
                     error.message.includes('required') || error.message.includes('validation') ? 'DataContract' :
                     'Logic'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});