import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// Zod-like validation (lightweight version for Deno)
interface BPSProfile {
  diet_type?: string;
  conditions?: string[];
  activity_level?: string;
  health_goals?: string;
  allergies?: string[];
  cuisines?: string[];
}

interface Targets {
  calories_per_day?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
}

interface MealAnalyzeRequest {
  image_url: string;
  bps_profile: BPSProfile;
  targets: Targets;
}

interface DetectedDish {
  name: string;
  portion: string;
  description: string;
  coach_note: string;
  flags: string[];
  confidence: number;
  portion_multiplier: number;
}

interface VisionResponse {
  dishes: DetectedDish[];
  overall_note: string;
  model_confidence: number;
}

interface MealDish {
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
  confidence_level?: string;
  data_source?: string;
}

interface MealAnalyzeResponse {
  dishes: MealDish[];
  summary: {
    total_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
  };
  overall_note?: string;
  confidence_summary?: {
    high_confidence_dishes: number;
    medium_confidence_dishes: number;
    low_confidence_dishes: number;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function validateRequest(body: any): MealAnalyzeRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be an object');
  }

  if (!body.image_url || typeof body.image_url !== 'string') {
    throw new Error('image_url is required and must be a string');
  }

  if (!body.bps_profile || typeof body.bps_profile !== 'object') {
    throw new Error('bps_profile is required and must be an object');
  }

  if (!body.targets || typeof body.targets !== 'object') {
    throw new Error('targets is required and must be an object');
  }

  return body as MealAnalyzeRequest;
}

async function retryApiCall(fn: () => Promise<Response>, maxRetries = 1): Promise<Response> {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fn();
      
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        if (i < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error;
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
    }
  }
  
  throw lastError;
}

async function checkForDuplicates(supabase: any, userId: string, totalKcal: number): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentLogs } = await supabase
      .from('meal_logs')
      .select('kcal')
      .eq('user_id', userId)
      .gte('meal_time', oneHourAgo)
      .limit(5);

    if (!recentLogs || recentLogs.length === 0) return false;

    // Check if any recent meal has similar calorie count (within 10%)
    return recentLogs.some((log: any) => 
      Math.abs(log.kcal - totalKcal) < (totalKcal * 0.1)
    );
  } catch (error) {
    console.log('Duplicate check failed, proceeding:', error.message);
    return false;
  }
}

async function lookupNutrition(supabase: any, dishName: string, cuisine?: string) {
  try {
    const response = await supabase.functions.invoke('nutrition-lookup', {
      body: { 
        dish_name: dishName,
        cuisine: cuisine 
      }
    });

    if (response.error) {
      console.warn(`Nutrition lookup failed for ${dishName}:`, response.error);
      return null;
    }

    return response.data;
  } catch (error) {
    console.warn(`Nutrition lookup error for ${dishName}:`, error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Validate required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    
    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing SUPABASE_URL environment variable',
          request_id: requestId,
          error_class: 'Config'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    if (!supabaseServiceRole) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY) environment variable',
          request_id: requestId,
          error_class: 'Config'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing GOOGLE_API_KEY environment variable',
          request_id: requestId,
          error_class: 'Config'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate Content-Type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ 
          error: 'Content-Type must be application/json',
          request_id: requestId,
          error_class: 'DataContract'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse and validate request
    let requestData;
    try {
      const body = await req.json();
      requestData = validateRequest(body);
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          request_id: requestId,
          error_class: 'DataContract'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { image_url, bps_profile, targets } = requestData;

    // Build user context
    const userContext = `User Profile:
Diet: ${bps_profile.diet_type || 'Not specified'}
Activity Level: ${bps_profile.activity_level || 'Not specified'}
Health Goals: ${bps_profile.health_goals || 'Not specified'}
Conditions: ${bps_profile.conditions?.join(', ') || 'None'}
Allergies: ${bps_profile.allergies?.join(', ') || 'None'}
Preferred Cuisines: ${bps_profile.cuisines?.join(', ') || 'All'}

Targets:
Daily Calories: ${targets.calories_per_day || 'Not set'}
Protein: ${targets.protein_g || 'Not set'}g
Carbs: ${targets.carbs_g || 'Not set'}g
Fat: ${targets.fat_g || 'Not set'}g
Fiber: ${targets.fiber_g || 'Not set'}g`;

const systemPrompt = `You are the Meal Scanner powered by Coach C — guiding through a Bio-Psycho-Social lens, combining body nutrition needs, mindset awareness, and lifestyle-friendly habits. You have deep knowledge of Indian, South Asian, and global homemade food. 

IMPORTANT: Your job is ONLY to:
1. Recognize dish names from the image
2. Estimate portion sizes using visual cues and Indian household units
3. Provide descriptions and coach notes
4. DO NOT fabricate nutrition values - they will be looked up from authoritative sources

**Core directives:**

1. **Dish Recognition**: Identify specific dish names with high accuracy. Use both visual detection and knowledge of Indian cooking styles.
2. **Portion Estimation**: Use household unit heuristics (katori, roti diameter, ladle size) and visual context to estimate portions.
3. **Regional Variations**: When uncertain between variations (e.g., "Indori Poha" vs "Kanda Poha"), specify the most likely type based on visual cues.
4. **Visual Quality Assessment**: If image quality is poor or dishes are unclear, indicate uncertainty in your confidence score.

**Low-Confidence Scenarios:**
- Poor image quality, lighting, or blurry dishes
- Ambiguous dishes that could be multiple things
- Portions impossible to estimate reliably from the image
- When uncertain, be honest and flag it for user clarification

${userContext}

**CRITICAL**: Do not include kcal, protein_g, carbs_g, fat_g, fiber_g, or sugar_g in your response. These will be populated from authoritative nutrition databases.

Output format (strict): Return ONLY valid JSON with this schema:
{
  "dishes": [
    {
      "name": "string (specific dish name for nutrition lookup)",
      "portion": "string (use Indian units; include grams estimate in parentheses)",
      "description": "string (what you see in the image)",
      "coach_note": "string (dietary advice based on user profile)",
      "flags": ["string", ...],
      "confidence": number,
      "portion_multiplier": number
    }
  ],
  "overall_note": "string",
  "model_confidence": number
}`;

    // Fetch image and convert to base64 for inline_data
    let imageBase64 = '';
    let imagePx = 'unknown';
    try {
      console.log('Fetching image from:', image_url);
      const imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      
      const contentLength = imageResponse.headers.get('content-length');
      if (contentLength) {
        imagePx = `${Math.round(parseInt(contentLength) / 1024)}KB`;
      }
      
      const imageBytes = await imageResponse.arrayBuffer();
      const imageUint8Array = new Uint8Array(imageBytes);
      imageBase64 = base64Encode(imageUint8Array);
      
      console.log(`Image processed: ${imagePx}, base64 length: ${imageBase64.length}`);
    } catch (error) {
      console.error('Image fetch error:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }

    // Call Gemini API for dish recognition and portion estimation only
    const geminiResponse = await retryApiCall(async () => {
      return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(20000), // 20s timeout
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { text: 'Return only valid JSON matching the specified contract.' },
              { text: userContext },
              { 
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 1536,
            responseMimeType: "application/json"
          }
        }),
      });
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const status = geminiResponse.status;
      console.error('Gemini non-OK (meal-analyze):', status, errorText?.slice(0, 600), requestId);
      const latencyMs = Date.now() - startTime;
      const errorClass = status === 401 || status === 403 ? 'Auth' : status === 429 ? 'RateLimit' : status >= 500 ? 'Network' : 'Logic';
      return new Response(
        JSON.stringify({
          error: `Gemini API error: ${status}`,
          request_id: requestId,
          latency_ms: latencyMs,
          error_class: errorClass,
          model_response: errorText?.slice(0, 500) || ''
        }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    
    const candidate = geminiData?.candidates?.[0];
    const finishReason = candidate?.finishReason || candidate?.finish_reason;
    if (finishReason && String(finishReason).toUpperCase().includes('SAFETY')) {
      const latencyMs = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          error: 'AI response was blocked by safety filters. Try a tighter crop or clearer image.',
          request_id: requestId,
          latency_ms: latencyMs,
          error_class: 'DataContract'
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rawResponse = '';
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts) && parts.length) {
      const textPart = parts.find((p: any) => typeof p.text === 'string');
      rawResponse = textPart?.text ?? (parts[0]?.text ?? '');
    } else if (typeof candidate?.content?.text === 'string') {
      rawResponse = candidate.content.text;
    }

    if (!rawResponse) {
      throw new Error('No response from Gemini AI');
    }
    
    // Parse JSON response with robust error handling
    let visionData: VisionResponse;
    let jsonParseOk = true;
    
    try {
      // Try parsing as direct JSON first
      visionData = JSON.parse(rawResponse);
      
      // Validate response structure
      if (!visionData.dishes || !Array.isArray(visionData.dishes)) {
        throw new Error('Invalid response structure: dishes array required');
      }
      
    } catch (parseError) {
      jsonParseOk = false;
      
      // Try extracting JSON from markdown or other formatting
      const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/) || 
                       rawResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const jsonString = jsonMatch[1] || jsonMatch[0];
          visionData = JSON.parse(jsonString);
          jsonParseOk = true;
        } catch (secondParseError) {
          // Fallback: try a compact re-query to ensure JSON closes correctly
          try {
            const compactPrompt = `You previously returned an incomplete JSON. Now return ONLY valid, compact JSON with at most 8 dishes. Keep description <= 100 chars and coach_note <= 80 chars. No extra text.`;
            const compactRes = await retryApiCall(async () => {
              return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(15000),
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      { text: compactPrompt },
                      { text: systemPrompt },
                      { text: userContext },
                      { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
                    ]
                  }],
                  generationConfig: {
                    temperature: 0.2,
                    topK: 30,
                    topP: 0.8,
                    maxOutputTokens: 1024,
                    responseMimeType: 'application/json'
                  }
                })
              });
            });

            const compactJson = await compactRes.json();
            const cCand = compactJson?.candidates?.[0];
            const cParts = cCand?.content?.parts;
            let cText = '';
            if (Array.isArray(cParts) && cParts.length) {
              const t = cParts.find((p: any) => typeof p.text === 'string');
              cText = t?.text ?? (cParts[0]?.text ?? '');
            } else if (typeof cCand?.content?.text === 'string') {
              cText = cCand.content.text;
            }
            if (!cText) throw new Error('No compact response');

            visionData = JSON.parse(cText);
            jsonParseOk = true;
          } catch (fallbackErr) {
            // Return error with model text for debugging
            return new Response(
              JSON.stringify({ 
                error: 'Failed to parse JSON response from AI model',
                request_id: requestId,
                error_class: 'DataContract',
                model_response: rawResponse.substring(0, 500),
                latency_ms: Date.now() - startTime
              }),
              { 
                status: 422, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'No valid JSON found in AI response',
            request_id: requestId,
            error_class: 'DataContract',
            model_response: rawResponse.substring(0, 500),
            latency_ms: Date.now() - startTime
          }),
          { 
            status: 422, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Initialize Supabase client for nutrition lookup
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Lookup nutrition data for each detected dish
    const enrichedDishes: MealDish[] = [];
    let highConfidenceCount = 0;
    let mediumConfidenceCount = 0;
    let lowConfidenceCount = 0;

    console.log(`Looking up nutrition for ${visionData.dishes.length} detected dishes`);

    for (const detectedDish of visionData.dishes) {
      console.log(`Processing dish: ${detectedDish.name}`);
      
      const nutritionData = await lookupNutrition(
        supabase, 
        detectedDish.name, 
        bps_profile.cuisines?.[0]
      );

      if (nutritionData) {
        // Apply portion multiplier to scale nutrition values
        const multiplier = detectedDish.portion_multiplier || 1;
        
        const enrichedDish: MealDish = {
          name: detectedDish.name,
          portion: detectedDish.portion,
          kcal: Math.round((nutritionData.kcal || 0) * multiplier),
          protein_g: Math.round((nutritionData.protein_g || 0) * multiplier * 10) / 10,
          carbs_g: Math.round((nutritionData.carbs_g || 0) * multiplier * 10) / 10,
          fat_g: Math.round((nutritionData.fat_g || 0) * multiplier * 10) / 10,
          fiber_g: nutritionData.fiber_g ? Math.round(nutritionData.fiber_g * multiplier * 10) / 10 : 0,
          sugar_g: nutritionData.sugar_g ? Math.round(nutritionData.sugar_g * multiplier * 10) / 10 : 0,
          description: detectedDish.description,
          coach_note: detectedDish.coach_note + (nutritionData.confidence_level === 'HIGH' ? '' : ' (Note: Nutrition data has medium/low confidence)'),
          flags: detectedDish.flags,
          confidence_level: nutritionData.confidence_level,
          data_source: nutritionData.data_source
        };

        enrichedDishes.push(enrichedDish);

        // Count confidence levels
        if (nutritionData.confidence_level === 'HIGH') highConfidenceCount++;
        else if (nutritionData.confidence_level === 'MEDIUM') mediumConfidenceCount++;
        else lowConfidenceCount++;

        console.log(`✓ Enriched ${detectedDish.name} with ${nutritionData.confidence_level} confidence from ${nutritionData.data_source}`);
      } else {
        // Fallback with conservative estimates
        const enrichedDish: MealDish = {
          name: detectedDish.name,
          portion: detectedDish.portion,
          kcal: 200,
          protein_g: 10,
          carbs_g: 20,
          fat_g: 8,
          fiber_g: 3,
          sugar_g: 5,
          description: detectedDish.description,
          coach_note: detectedDish.coach_note + ' (Note: Nutrition data estimated - please verify)',
          flags: [...detectedDish.flags, 'estimated'],
          confidence_level: 'LOW',
          data_source: 'AI_ESTIMATED'
        };

        enrichedDishes.push(enrichedDish);
        lowConfidenceCount++;
        console.log(`⚠️ Using fallback estimates for ${detectedDish.name}`);
      }
    }

    // Calculate summary totals
    const summary = {
      total_kcal: enrichedDishes.reduce((sum, dish) => sum + dish.kcal, 0),
      protein_g: Math.round(enrichedDishes.reduce((sum, dish) => sum + dish.protein_g, 0) * 10) / 10,
      carbs_g: Math.round(enrichedDishes.reduce((sum, dish) => sum + dish.carbs_g, 0) * 10) / 10,
      fat_g: Math.round(enrichedDishes.reduce((sum, dish) => sum + dish.fat_g, 0) * 10) / 10,
      fiber_g: Math.round(enrichedDishes.reduce((sum, dish) => sum + dish.fiber_g, 0) * 10) / 10,
      sugar_g: Math.round(enrichedDishes.reduce((sum, dish) => sum + dish.sugar_g, 0) * 10) / 10,
    };

    // Optional: Check for potential duplicates
    const authHeader = req.headers.get('authorization');
    let isDuplicate = false;
    
    if (authHeader && summary.total_kcal) {
      try {
        // This is a simplified approach - in production you'd validate the JWT
        const userId = 'extracted_from_jwt'; // Placeholder
        // isDuplicate = await checkForDuplicates(supabase, userId, summary.total_kcal);
      } catch (error) {
        console.log('Duplicate check skipped:', error.message);
      }
    }

    const latencyMs = Date.now() - startTime;

    const responseData: MealAnalyzeResponse = {
      dishes: enrichedDishes,
      summary: summary,
      overall_note: visionData.overall_note,
      confidence_summary: {
        high_confidence_dishes: highConfidenceCount,
        medium_confidence_dishes: mediumConfidenceCount,
        low_confidence_dishes: lowConfidenceCount
      }
    };

    console.log(`✅ Meal analysis complete: ${enrichedDishes.length} dishes, ${highConfidenceCount} high confidence, ${mediumConfidenceCount} medium, ${lowConfidenceCount} low`);

    return new Response(
      JSON.stringify({ 
        request_id: requestId,
        status: 'success',
        latency_ms: latencyMs,
        model: 'gemini-2.0-flash + authoritative-nutrition',
        image_px: imagePx,
        json_parse_ok: jsonParseOk,
        duplicate_warning: isDuplicate,
        analysis: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Meal analysis error:', error);
    console.error('Error stack:', error.stack);
    const latencyMs = Date.now() - startTime;

    // Determine error class based on error type
    let errorClass = 'Internal';
    if (error.message?.includes('environment')) {
      errorClass = 'Config';
    } else if (error.message?.includes('Request body')) {
      errorClass = 'Request';
    } else if (error.message?.includes('fetch')) {
      errorClass = 'Network';
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        request_id: requestId,
        error_class: errorClass,
        latency_ms: latencyMs,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});