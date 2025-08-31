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

interface MealDish {
  name: string;
  portion: string;
  kcal: number;
  macros: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
  flags: string[];
}

interface MealAnalyzeResponse {
  dishes: MealDish[];
  summary: {
    total_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
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

    const systemPrompt = `You are Coach C, analyzing a meal photo for nutrition tracking.

Analyze this meal image and detect all visible food items with their estimated portions and nutrition.

For each dish/item detected, provide:
- Name (in everyday Indian terms)
- Portion size (using Indian household units: katori, roti count/diameter, ladle, handful, etc.)
- Estimated calories
- Complete macros (protein/carbs/fat/fiber in grams)
- Health flags (high-protein, high-fiber, fried, sugary, etc.)

${userContext}

Consider user's dietary preferences and health conditions.
Be practical and realistic with portion estimates.
If multiple items look similar, group them as one entry.

CRITICAL: Return ONLY valid JSON in this exact format:
{
  "dishes": [
    {
      "name": "Dal Tadka",
      "portion": "1 katori (150ml)",
      "kcal": 120,
      "macros": {
        "protein_g": 8,
        "carbs_g": 18,
        "fat_g": 3,
        "fiber_g": 5
      },
      "flags": ["high-protein", "comfort-food"]
    }
  ],
  "summary": {
    "total_kcal": 450,
    "protein_g": 25,
    "carbs_g": 55,
    "fat_g": 15
  }
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

    // Call Gemini API with proper format and retry logic
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
    let parsedData: MealAnalyzeResponse;
    let jsonParseOk = true;
    
    try {
      // Try parsing as direct JSON first
      parsedData = JSON.parse(rawResponse);
      
      // Validate response structure
      if (!parsedData.dishes || !Array.isArray(parsedData.dishes)) {
        throw new Error('Invalid response structure: dishes array required');
      }
      
      if (!parsedData.summary || typeof parsedData.summary !== 'object') {
        throw new Error('Invalid response structure: summary object required');
      }
      
    } catch (parseError) {
      jsonParseOk = false;
      
      // Try extracting JSON from markdown or other formatting
      const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/) || 
                       rawResponse.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const jsonString = jsonMatch[1] || jsonMatch[0];
          parsedData = JSON.parse(jsonString);
          jsonParseOk = true;
        } catch (secondParseError) {
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

    // Optional: Check for potential duplicates
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Extract user_id from auth header if available for duplicate checking
    const authHeader = req.headers.get('authorization');
    let isDuplicate = false;
    
    if (authHeader && parsedData.summary?.total_kcal) {
      try {
        // This is a simplified approach - in production you'd validate the JWT
        const userId = 'extracted_from_jwt'; // Placeholder
        // isDuplicate = await checkForDuplicates(supabase, userId, parsedData.summary.total_kcal);
      } catch (error) {
        console.log('Duplicate check skipped:', error.message);
      }
    }

    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        request_id: requestId,
        status: 'success',
        latency_ms: latencyMs,
        model: 'gemini-2.0-flash',
        image_px: imagePx,
        json_parse_ok: jsonParseOk,
        duplicate_warning: isDuplicate,
        analysis: parsedData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meal-analyze function:', error);
    const latencyMs = Date.now() - startTime;
    
    // Classify error types
    let errorClass = 'Logic';
    let statusCode = 500;
    
    if (error.message.includes('API key') || error.message.includes('auth')) {
      errorClass = 'Auth';
      statusCode = 401;
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      errorClass = 'RateLimit';
      statusCode = 429;
    } else if (error.message.includes('network') || error.message.includes('fetch') || 
               error.message.includes('temporarily unavailable')) {
      errorClass = 'Network';
      statusCode = 503;
    } else if (error.message.includes('timeout')) {
      errorClass = 'Network';
      statusCode = 408;
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        request_id: requestId,
        latency_ms: latencyMs,
        error_class: errorClass
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});