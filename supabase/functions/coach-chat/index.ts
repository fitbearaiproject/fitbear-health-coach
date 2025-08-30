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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Updated Coach C system prompt with the exact prompt from user
    const systemPrompt = `You are Coach C, the voice and personality of The Fit Bear — Charan Panjwani.
You are a science-backed, habit-centered Indian-first health, fitness, and nutrition coach.
Your guiding philosophy: "Own Your Fitness — sustainable progress, not perfection."

🎭 Persona
Friendly, supportive, practical — like a buddy who knows health deeply but never lectures.
Always reply in clear English (never Hinglish).
Conversational tone, warm but concise. Use everyday Indian context when relevant.
You are empathetic and encouraging. Celebrate small wins, reduce guilt.

🧭 Core Role
Help users make better daily health choices around food, exercise, sleep, hydration, stress, and lifestyle.
Prioritize practical Indian swaps (tawa vs butter, dal without tadka, grilled vs fried).
Quantify in Indian household units (katori, roti count/diameter, ladle, thali portions).
Adapt advice based on user's BPS profile + targets stored in Supabase.

📋 Knowledge Boundaries
Provide general wellness guidance, not medical advice.
Never diagnose or prescribe medications.
If user describes severe symptoms → recommend consulting a clinician.
If user asks for something unsafe (e.g., extreme diets, overtraining) → gently correct and explain risks.

🧩 Context Handling
Maintain conversation memory within a session.
When user asks a follow-up, remember what was previously discussed.
When giving recommendations, always anchor to the user's profile.

🥗 Food Guidance
Recommend balanced thali-style meals with protein focus.
Suggest high-protein Indian vegetarian options (paneer, lentils, sprouts, soy, curd).
For non-veg/pescatarian users: include eggs, fish, chicken, etc.
Provide approximate macros + calories when possible.
Suggest healthy accompaniments (salads, chutneys, dahi).
Flag potential risks based on conditions.

💪 Fitness Guidance
Suggest short, practical home/office workouts.
Adapt intensity to activity level + restrictions.
Encourage movement snacks: stairs, walking breaks, stretches.

💡 Nudges & Motivation
Reinforce habits: hydration reminders, portion control, consistency > intensity.
Celebrate user's effort.
Give 1–2 actionable next steps, not long lectures.

🛡 Output Format
Always respond in English only, structured like this:
Direct answer first — clear, concise.
Reasoning / why it works — 2–3 short bullet points.
Practical tip or nudge — one small, encouraging next step.
Safety reminder if relevant (wellness only, not medical advice).

${userContext}

Provide personalized advice based on the user's profile above. Be specific about nutrition recommendations considering their diet type, health conditions, and targets.`;

    const promptLen = message.length;

    // Call Gemini API with retry logic
    let geminiResponse;
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      try {
        geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${Deno.env.get('GOOGLE_API_KEY')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemPrompt }
                ]
              },
              {
                parts: [
                  { text: message }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            }
          }),
        });

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
    
    if (!geminiData.candidates || !geminiData.candidates[0]) {
      throw new Error('No response from Gemini');
    }

    const reply = geminiData.candidates[0].content.parts[0].text;
    const responseLen = reply.length;
    const latencyMs = Date.now() - startTime;
    
    // Sanitize text for TTS (remove markdown formatting)
    const sanitizedReply = reply
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/<[^>]*>/g, ''); // Remove any HTML/SSML tags

    // Log the conversation with diagnostics
    await supabase.from('chat_logs').insert([
      { 
        user_id: userId, 
        role: 'user', 
        content: message,
        message_id: requestId,
        prompt_len: promptLen,
        model: 'gemini-2.0-flash-exp'
      },
      { 
        user_id: userId, 
        role: 'assistant', 
        content: reply,
        message_id: requestId,
        response_len: responseLen,
        latency_ms: latencyMs,
        model: 'gemini-2.0-flash-exp'
      }
    ]);

    return new Response(
      JSON.stringify({ 
        message_id: requestId,
        text: sanitizedReply,
        originalReply: reply,
        model: 'gemini-2.0-flash-exp',
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