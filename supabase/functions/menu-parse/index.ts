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
  description: string;
  coach_note: string;
  vitamins: string[];
  minerals: string[];
  tags: string[];
  bucket: "Top Picks" | "Alternates" | "To Avoid";
}

interface MenuParseResponse {
  items: MenuItem[];
  reasoning: string;
  overall_note?: string;
}

// UI format interfaces
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
}

interface MenuAnalysis {
  top_picks: DishItem[];
  alternates: DishItem[];
  to_avoid: DishItem[];
  general_notes: string;
  overall_note?: string;
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

const systemPrompt = `You are the Menu Scanner for Fitbear AI, a nutrition assistant with deep expertise in Indian, South Asian, and global cuisine. Use vision + food knowledge to analyze a restaurant menu image (inline_data). Your goal: segment and categorize dishes into Top Picks / Alternates / To Avoid with accurate portion, calories, and macros.

Guidelines:

1. Be cautious — Indian menus often lack clear portions or hide cooking fats. If uncertain, include “uncertain_reasons” and use error_margin (±10–15%).
2. Use familiar Indian serving units: katori (150 ml), roti diameter (cm), pieces, scoops, small/medium/large.
3. Estimate macros per portion: kcal, protein_g, carbs_g, fat_g, fiber_g (nullable).
4. Tag items based on diet type, health profile (e.g., high-protein, high-sodium, fried).
5. Respect user profile: dietary preference, allergies, conditions (like diabetes / BP).
6. Provide a short rationale for each bucket placement, e.g., “High-protein dal aligns with diabetic-friendly low-carb goal.”

${userContext}

Output JSON (strict, compatible with app):
{
  "items": [
    {
      "name": "string",
      "portion": "string (use Indian units; include grams in parentheses if helpful)",
      "kcal": number,
      "macros": { "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number|null },
      "description": "string",
      "coach_note": "string",
      "tags": ["string", ...],
      "bucket": "Top Picks" | "Alternates" | "To Avoid",
      "confidence": number,
      "error_margin_percent": number,
      "uncertain_reasons": ["string", ...]
    }
  ],
  "reasoning": "string",
  "overall_note": "string",
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

    // Call Gemini API with proper format and retry logic
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
        portion: typeof (item as any).portion === 'string' ? (item as any).portion : ((item as any).portion?.display ?? ''),
        kcal: item.kcal,
        protein_g: item.macros.protein_g,
        carbs_g: item.macros.carbs_g,
        fat_g: item.macros.fat_g,
        fiber_g: item.macros.fiber_g || 0,
        description: (item as any).description || '',
        coach_note: (item as any).coach_note || '',
        tags: item.tags,
        reasoning: `${(item as any).vitamins?.join(', ') || ''} | ${(item as any).minerals?.join(', ') || ''}`
      };

      if (item.bucket === 'Top Picks') {
        analysis.top_picks.push(dishItem);
      } else if (item.bucket === 'Alternates') {
        analysis.alternates.push(dishItem);
      } else if (item.bucket === 'To Avoid') {
        analysis.to_avoid.push(dishItem);
      }
    });

    // Add overall note if present
    if (parsedData.overall_note) {
      analysis.overall_note = parsedData.overall_note;
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