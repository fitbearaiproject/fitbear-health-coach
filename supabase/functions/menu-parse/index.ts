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

interface MenuParseRequest {
  image_url: string;
  bps_profile: BPSProfile;
  targets: Targets;
}

interface DetectedMenuItem {
  name: string;
  portion: string;
  description: string;
  coach_note: string;
  tags: string[];
  bucket: "Top Picks" | "Alternates" | "To Avoid";
  confidence: number;
  reasoning: string;
}

interface VisionMenuResponse {
  items: DetectedMenuItem[];
  reasoning: string;
  overall_note?: string;
  model_confidence: number;
}

interface DishItem {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  description: string;
  coach_note: string;
  tags: string[];
  reasoning: string;
  confidence_level?: string;
  data_source?: string;
}

interface MenuAnalysis {
  top_picks: DishItem[];
  alternates: DishItem[];
  to_avoid: DishItem[];
  general_notes: string;
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

function validateRequest(body: any): MenuParseRequest {
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

  return body as MenuParseRequest;
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

const systemPrompt = `You are the Menu Scanner for Fitbear AI, a nutrition assistant with deep expertise in Indian, South Asian, and global cuisine. Use vision + food knowledge to analyze a restaurant menu image (inline_data). Your goal: segment and categorize dishes into Top Picks / Alternates / To Avoid with accurate recommendations.

IMPORTANT: Your job is ONLY to:
1. Recognize dish names from the menu image
2. Estimate typical restaurant portions for each dish
3. Categorize dishes based on user's health profile
4. Provide coach notes and reasoning
5. DO NOT fabricate nutrition values - they will be looked up from authoritative sources

**Guidelines:**

1. **Dish Recognition**: Parse menu text and identify specific dish names with high accuracy.
2. **Portion Awareness**: Estimate typical restaurant serving sizes using Indian units (katori, pieces, plates).
3. **Health-Based Categorization**: 
   - **Top Picks**: Align with user's diet type, health goals, and nutritional needs
   - **Alternates**: Moderate choices that can work with modifications
   - **To Avoid**: High in allergens, conflicts with health conditions, or poor nutritional profile
4. **Respect User Profile**: Consider dietary preferences, allergies, health conditions, and goals.

**Low-Confidence Scenarios:**
- Poor image quality or unreadable menu text
- Ambiguous dish names or unfamiliar cuisine
- When uncertain about ingredients or preparation methods

${userContext}

**CRITICAL**: Do not include kcal, protein_g, carbs_g, fat_g, fiber_g, or sugar_g in your response. These will be populated from authoritative nutrition databases.

Output format (strict): Return ONLY valid JSON with this schema:
{
  "items": [
    {
      "name": "string (specific dish name for nutrition lookup)",
      "portion": "string (typical restaurant serving size)",
      "description": "string (menu description or visual details)",
      "coach_note": "string (why this fits user's profile)",
      "tags": ["string", ...],
      "bucket": "Top Picks" | "Alternates" | "To Avoid",
      "confidence": number,
      "reasoning": "string (brief rationale for bucket placement)"
    }
  ],
  "reasoning": "string (overall menu analysis strategy)",
  "overall_note": "string (general advice for this restaurant/menu)",
  "model_confidence": number
}`;

    // Fetch image and convert to base64 for inline_data
    let imageBase64 = '';
    let imagePx = 'unknown';
    let imageMimeType = 'image/jpeg';
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

      const contentTypeHeader = imageResponse.headers.get('content-type');
      if (contentTypeHeader) {
        imageMimeType = contentTypeHeader.split(';')[0].trim();
      }
      
      const imageBytes = await imageResponse.arrayBuffer();
      const imageUint8Array = new Uint8Array(imageBytes);
      imageBase64 = base64Encode(imageUint8Array);
      
      console.log(`Image processed: ${imagePx}, base64 length: ${imageBase64.length}, mime: ${imageMimeType}`);
    } catch (error) {
      console.error('Image fetch error:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }

    // Call Gemini API for menu recognition and categorization only
    const geminiResponse = await retryApiCall(async () => {
      return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(40000), // 40s timeout to reduce flaky timeouts
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { text: 'Return only valid JSON matching the specified contract.' },
              { text: userContext },
              { 
                inline_data: {
                  mime_type: imageMimeType,
                  data: imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        }),
      });
    }, 2);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const status = geminiResponse.status;
      console.error('Gemini non-OK (menu-parse):', status, errorText?.slice(0, 600), requestId);
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
    let visionData: VisionMenuResponse;
    let jsonParseOk = true;
    
    try {
      // Try parsing as direct JSON first
      visionData = JSON.parse(rawResponse);
      
      // Validate response structure
      if (!visionData.items || !Array.isArray(visionData.items)) {
        throw new Error('Invalid response structure: items array required');
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

    // Initialize Supabase client for nutrition lookup
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Transform to UI format with nutrition lookup
    const analysis: MenuAnalysis = {
      top_picks: [],
      alternates: [],
      to_avoid: [],
      general_notes: visionData.reasoning || ''
    };

    let highConfidenceCount = 0;
    let mediumConfidenceCount = 0;
    let lowConfidenceCount = 0;

    console.log(`Looking up nutrition for ${visionData.items.length} menu items`);

    // Categorize items by bucket and enrich with nutrition data
    for (const item of visionData.items) {
      console.log(`Processing menu item: ${item.name}`);
      
      const nutritionData = await lookupNutrition(
        supabase, 
        item.name, 
        bps_profile.cuisines?.[0]
      );

      let dishItem: DishItem;

      if (nutritionData) {
        dishItem = {
          name: item.name,
          portion: item.portion,
          kcal: nutritionData.kcal || 0,
          protein_g: nutritionData.protein_g || 0,
          carbs_g: nutritionData.carbs_g || 0,
          fat_g: nutritionData.fat_g || 0,
          fiber_g: nutritionData.fiber_g || 0,
          description: item.description || '',
          coach_note: item.coach_note + (nutritionData.confidence_level === 'HIGH' ? '' : ' (Note: Nutrition data has medium/low confidence)'),
          tags: item.tags,
          reasoning: item.reasoning,
          confidence_level: nutritionData.confidence_level,
          data_source: nutritionData.data_source
        };

        // Count confidence levels
        if (nutritionData.confidence_level === 'HIGH') highConfidenceCount++;
        else if (nutritionData.confidence_level === 'MEDIUM') mediumConfidenceCount++;
        else lowConfidenceCount++;

        console.log(`✓ Enriched ${item.name} with ${nutritionData.confidence_level} confidence from ${nutritionData.data_source}`);
      } else {
        // Fallback with conservative estimates
        dishItem = {
          name: item.name,
          portion: item.portion,
          kcal: 350, // Higher estimate for restaurant dishes
          protein_g: 15,
          carbs_g: 35,
          fat_g: 12,
          fiber_g: 4,
          description: item.description || '',
          coach_note: item.coach_note + ' (Note: Nutrition data estimated - please verify)',
          tags: [...item.tags, 'estimated'],
          reasoning: item.reasoning,
          confidence_level: 'LOW',
          data_source: 'AI_ESTIMATED'
        };

        lowConfidenceCount++;
        console.log(`⚠️ Using fallback estimates for ${item.name}`);
      }

      // Place in appropriate bucket
      if (item.bucket === 'Top Picks') {
        analysis.top_picks.push(dishItem);
      } else if (item.bucket === 'Alternates') {
        analysis.alternates.push(dishItem);
      } else if (item.bucket === 'To Avoid') {
        analysis.to_avoid.push(dishItem);
      }
    }

    // Add overall note if present
    if (visionData.overall_note) {
      analysis.overall_note = visionData.overall_note;
    }

    // Add confidence summary
    analysis.confidence_summary = {
      high_confidence_dishes: highConfidenceCount,
      medium_confidence_dishes: mediumConfidenceCount,
      low_confidence_dishes: lowConfidenceCount
    };

    const latencyMs = Date.now() - startTime;

    console.log(`✅ Menu analysis complete: ${visionData.items.length} items, ${highConfidenceCount} high confidence, ${mediumConfidenceCount} medium, ${lowConfidenceCount} low`);

    return new Response(
      JSON.stringify({ 
        request_id: requestId,
        status: 'success',
        latency_ms: latencyMs,
        model: 'gemini-2.0-flash + authoritative-nutrition',
        image_px: imagePx,
        json_parse_ok: jsonParseOk,
        analysis: analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Menu analysis error:', error);
    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        error: error.message,
        request_id: requestId,
        error_class: 'Internal',
        latency_ms: latencyMs
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});