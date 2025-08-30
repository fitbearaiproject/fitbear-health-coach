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

    // Prepare system prompt for Coach C
    const systemPrompt = `You are Coach C, an AI fitness and nutrition coach based on "The Fit Bear" philosophy by Charan Panjwani. 

Core Principles:
- Focus on sustainable, enjoyable fitness and nutrition
- Emphasize strength training and balanced nutrition
- Promote a positive relationship with food and exercise
- Always consider the user's individual context and goals
- Be encouraging, practical, and evidence-based

CRITICAL: Always respond in English only. Never use Hinglish or mix Hindi words. Keep responses conversational but professional.

${userContext}

Provide personalized advice based on the user's profile above. Be specific about nutrition recommendations considering their diet type, health conditions, and targets.`;

    // Call Gemini API
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${Deno.env.get('GOOGLE_API_KEY')}`, {
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

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || !geminiData.candidates[0]) {
      throw new Error('No response from Gemini');
    }

    const reply = geminiData.candidates[0].content.parts[0].text;
    
    // Sanitize text for TTS (remove markdown formatting)
    const sanitizedReply = reply
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1');

    // Log the conversation
    await supabase.from('chat_logs').insert([
      { user_id: userId, role: 'user', content: message },
      { user_id: userId, role: 'assistant', content: reply }
    ]);

    return new Response(
      JSON.stringify({ 
        reply: sanitizedReply,
        originalReply: reply 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in coach-chat function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});