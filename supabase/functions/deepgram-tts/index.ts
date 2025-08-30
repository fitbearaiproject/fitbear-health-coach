import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { text, voice } = await req.json();
    
    if (!text) {
      throw new Error('Text is required');
    }

    const voiceModel = voice || 'aura-2-hermes-en';

    // Call Deepgram TTS API with aura-2-hermes-en voice
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('DEEPGRAM_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram TTS error: ${errorText}`);
    }

    // Get audio buffer and convert to base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        audio_mime: 'audio/mpeg',
        voice_used: voiceModel,
        latency_ms: latencyMs,
        request_id: requestId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in deepgram-tts function:', error);
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