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

interface MenuItem {
  name: string;
  portion: string;
  kcal: number;
  macros: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
  vitamins: string[];
  minerals: string[];
  tags: string[];
  bucket: "Top Picks" | "Alternates" | "To Avoid";
}

interface MenuParseResponse {
  items: MenuItem[];
  reasoning: string;
}

// UI format interfaces
interface DishItem {
  name: string;
  portion: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  tags: string[];
  reasoning: string;
}

interface MenuAnalysis {
  top_picks: DishItem[];
  alternates: DishItem[];
  to_avoid: DishItem[];
  general_notes: string;
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

    const systemPrompt = `You are Coach C, analyzing restaurant menu images for healthy recommendations.

Analyze the provided menu image and categorize dishes into:
1. **Top Picks** - Healthiest options aligned with user's profile
2. **Alternates** - Moderate choices with potential modifications  
3. **To Avoid** - High calorie/unhealthy options

For each dish, provide:
- Name (exact as shown on menu)
- Portion size (in practical Indian units: katori, roti, piece, etc.)
- Estimated calories
- Complete macros (protein/carbs/fat/fiber in grams)
- Key vitamins/minerals when significant
- Health tags (high-protein, low-carb, gluten-free, etc.)

${userContext}

Consider user's diet type, health conditions, and targets when categorizing.
Use everyday Indian context and portions. Be practical and encouraging.

CRITICAL: Return ONLY valid JSON in this exact format:
{
  "items": [
    {
      "name": "Dish Name",
      "portion": "1 katori (150ml)",
      "kcal": 350,
      "macros": {
        "protein_g": 15,
        "carbs_g": 45,
        "fat_g": 12,
        "fiber_g": 6
      },
      "vitamins": ["Vitamin A", "Vitamin C"],
      "minerals": ["Iron", "Calcium"],
      "tags": ["high-protein", "vegetarian"],
      "bucket": "Top Picks"
    }
  ],
  "reasoning": "Overall analysis of menu and recommendations based on user profile"
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
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        }),
      });
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const status = geminiResponse.status;
      
      if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      } else if (status >= 500) {
        throw new Error('Google AI service temporarily unavailable. Please try again.');
      } else {
        throw new Error(`Gemini API error: ${status} - ${errorText}`);
      }
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || !geminiData.candidates[0]) {
      throw new Error('No response from Gemini AI');
    }

    const rawResponse = geminiData.candidates[0].content.parts[0].text;
    
    // Parse JSON response with robust error handling
    let parsedData: MenuParseResponse;
    let jsonParseOk = true;
    
    try {
      // Try parsing as direct JSON first
      parsedData = JSON.parse(rawResponse);
      
      // Validate response structure
      if (!parsedData.items || !Array.isArray(parsedData.items)) {
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

    // Transform to UI format
    const analysis: MenuAnalysis = {
      top_picks: [],
      alternates: [],
      to_avoid: [],
      general_notes: parsedData.reasoning || ''
    };

    // Categorize items by bucket
    parsedData.items.forEach(item => {
      const dishItem: DishItem = {
        name: item.name,
        portion: item.portion,
        kcal: item.kcal,
        protein_g: item.macros.protein_g,
        carbs_g: item.macros.carbs_g,
        fat_g: item.macros.fat_g,
        tags: item.tags,
        reasoning: `${item.vitamins?.join(', ')} | ${item.minerals?.join(', ')}`
      };

      if (item.bucket === 'Top Picks') {
        analysis.top_picks.push(dishItem);
      } else if (item.bucket === 'Alternates') {
        analysis.alternates.push(dishItem);
      } else if (item.bucket === 'To Avoid') {
        analysis.to_avoid.push(dishItem);
      }
    });

    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        request_id: requestId,
        status: 'success',
        latency_ms: latencyMs,
        model: 'gemini-2.0-flash',
        image_px: imagePx,
        json_parse_ok: jsonParseOk,
        analysis: analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in menu-parse function:', error);
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