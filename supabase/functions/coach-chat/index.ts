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
    const { message, userId } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Message and userId are required');
    }

    // Validate required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    
    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing SUPABASE_URL environment variable',
          message_id: requestId,
          error_class: 'Config'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!supabaseServiceRole) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY) environment variable',
          message_id: requestId,
          error_class: 'Config'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing GOOGLE_API_KEY environment variable',
          message_id: requestId,
          error_class: 'Config'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // Get user profile and targets for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, targets(*)')
      .eq('user_id', userId)
      .single();

    // Build context from user profile
    let userContext = "User Profile: ";
    if (profile) {
      userContext += `Gender: ${profile.gender || 'Not specified'}, `;
      userContext += `Diet: ${profile.diet || 'Not specified'}, `;
      userContext += `Activity Level: ${profile.activity_level || 'Not specified'}, `;
      userContext += `Health Goals: ${profile.health_goals || 'Not specified'}, `;
      userContext += `Conditions: ${profile.conditions ? JSON.stringify(profile.conditions) : 'None'}, `;
      userContext += `Notes: ${profile.bps_notes || 'None'}. `;
      
      if (profile.targets) {
        userContext += `Nutrition Targets: Calories: ${profile.targets.calories_per_day || 'Not set'}, `;
        userContext += `Protein: ${profile.targets.protein_g || 'Not set'}g, `;
        userContext += `Carbs: ${profile.targets.carbs_g || 'Not set'}g, `;
        userContext += `Fat: ${profile.targets.fat_g || 'Not set'}g.`;
      }
    }

    // Fetch last 20 messages for conversational memory
    let historyContents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];
    try {
      const { data: history, error: historyError } = await supabase
        .from('chat_logs')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!historyError && history && Array.isArray(history)) {
        // Reverse to chronological order and map to Gemini roles
        historyContents = history.reverse().map((m: any) => ({
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: m.content || '' }]
        }));
      }
    } catch (_) {
      // If history fetch fails, proceed without memory
      historyContents = [];
    }

    // Coach C system prompt (Fit Bear philosophy)
    const systemPrompt = `You are Coach C — a compassionate, science-backed health coach modeled on Charan Panjwani’s Fit Bear philosophy, centered on Bio-Psycho-Social-Nutritional wisdom. Your approach is holistic, culturally grounded (especially Indian/South Asian contexts), and deeply empathetic.

You integrate:
•  The 4 pillars of Indian holistic wellness:  
   – Ahaar (food as nourishment)  
   – Vihaar (restful recharge)  
   – Aachaar (habit + routine discipline)  
   – Vichaar (healing, positive mindset)  
•  Evidence-based coaching powered by the biopsychosocial model—validated to improve motivation, self-care, and chronic condition outcomes  
•  The Biopsychosocial-Nutritional framework—integrating food as both fuel and stress mediator in the ecosystem of health  

You embody PhD-level mastery of health, nutrition, fitness, behavior change, longevity, and mental wellness—but you communicate kindly and simply.

When coaching:
1. Start by understanding the whole picture: user’s biological needs (age, sex, conditions), psychological drivers (stress, motivation), and social context (routines, family, work).
2. Align advice with the four pillars, weaving in meaningful suggestions across food, sleep, habits, and mindset.
3. Normalize daily challenges and focus on sustainable, tiny habit shifts over perfection.
4. Offer tools like mindful breathing or habit linking (“After I brush teeth, I’ll stretch for 2 minutes”) to deepen behavior change.
5. Use simple metaphors (e.g., “like planting seeds, small habits grow over time”) when useful.
6. Always tie advice back to the individual’s photo, log, or profile goals — cite real data (“You achieved your protein target yesterday—nice!”).
7. Never offer medical diagnoses—focus on actionable, non-judgmental guidance (“For medical advice, please consult a doctor”).
8. When unsure, ask one clarifying question at a time (“Can you tell me your evening mealtime habit so I can adapt?”).
9. Praise small wins and invite reflection: “That one extra glass of water counts. How did it make you feel?”

Output format:
- Use conversational language but always be grounded, empathetic, and user-centered.
- Every response ends with a tiny nudge tailored to their daily life (e.g., “Tomorrow, try green chutney instead of ketchup—just one small swap.”).

User Context:
${userContext}`;

    const promptLen = message.length;

    // Call Gemini API with retry logic
    let geminiResponse;
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      try {
        const requestBody = {
          systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
          contents: [
            ...historyContents,
            { role: 'user', parts: [{ text: message }] }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        };

        geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!geminiResponse.ok && geminiResponse.status !== 429) {
          const errText = await geminiResponse.text();
          console.error('Gemini non-OK for coach-chat:', geminiResponse.status, errText?.slice(0, 600), requestId);
          const status = geminiResponse.status;
          const errorClass = status === 401 || status === 403 ? 'Auth' : status === 429 ? 'RateLimit' : status >= 500 ? 'Network' : 'Logic';
          const latencyMs = Date.now() - startTime;
          return new Response(
            JSON.stringify({
              error: `Gemini API error: ${status}`,
              message_id: requestId,
              latency_ms: latencyMs,
              error_class: errorClass,
              model_response: errText?.slice(0, 500) || ''
            }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (geminiResponse.status === 429 && retryCount < maxRetries) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          continue;
        }

        break;
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          continue;
        }
        throw error;
      }
    }

    const geminiData = await geminiResponse.json();
    
    if (geminiData.error) {
      throw new Error(geminiData.error.message || 'Gemini API error');
    }

    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content?.parts?.length) {
      throw new Error('No response from Gemini');
    }

    const parts = geminiData.candidates[0].content.parts;
    const reply = parts.map((p: any) => p.text || '').join('\n').trim();
    const responseLen = reply.length;
    const latencyMs = Date.now() - startTime;
    
    // Sanitize text for TTS (remove markdown formatting)
    const sanitizedReply = reply
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/namaste/gi, '') // Remove "namaste" for Coach C English-only
      .replace(/<[^>]*>/g, ''); // Remove any HTML/SSML tags

    // Log the conversation with diagnostics
    await supabase.from('chat_logs').insert([
      { 
        user_id: userId, 
        role: 'user', 
        content: message,
        message_id: requestId,
        prompt_len: promptLen,
        model: 'gemini-2.0-flash'
      },
      { 
        user_id: userId, 
        role: 'assistant', 
        content: reply,
        message_id: requestId,
        response_len: responseLen,
        latency_ms: latencyMs,
        model: 'gemini-2.0-flash'
      }
    ]);

    return new Response(
      JSON.stringify({ 
        message_id: requestId,
        text: sanitizedReply,
        originalReply: reply,
        model: 'gemini-2.0-flash',
        tokens_in: promptLen,
        tokens_out: responseLen,
        latency_ms: latencyMs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in coach-chat function:', error);
    const latencyMs = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message_id: requestId,
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